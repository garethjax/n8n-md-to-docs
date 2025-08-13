import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import express from 'express';
import cors from 'cors';
import type { Request, Response } from 'express';
import type { MarkdownRequest, GoogleDocResponse, ErrorResponse } from './types';
import { convertMarkdownToGoogleDoc } from './services/googleDocs';
import { convertMarkdownToDocx } from './services/docxConverter';

const app = express();

// Security middleware
app.use(express.json({ 
  limit: '10mb' // Limit request size to prevent DoS attacks
}));

// CORS configuration - restrict to specific domains in production
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://n8n.io', 'https://*.n8n.io', 'https://docs.google.com', 'https://*.googleapis.com']
    : true, // Allow all origins in development
  credentials: true,
  optionsSuccessStatus: 200,
  maxAge: 86400 // Cache preflight for 24 hours
};

app.use(cors(corsOptions));

// Security headers
app.use((_req: Request, res: Response, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// Rate limiting per IP (simple in-memory implementation)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = 100; // 100 requests per window

function rateLimit(req: Request, res: Response, next: () => void): void {
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  
  const rateLimitData = rateLimitMap.get(clientIP);
  
  if (rateLimitData) {
    if (now > rateLimitData.resetTime) {
      // Reset the counter
      rateLimitMap.set(clientIP, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    } else if (rateLimitData.count >= RATE_LIMIT_MAX_REQUESTS) {
      res.status(429).json({
        error: 'Too many requests',
        details: 'Rate limit exceeded. Please try again later.',
        status: 429
      } as ErrorResponse);
      return;
    } else {
      rateLimitData.count++;
    }
  } else {
    rateLimitMap.set(clientIP, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
  }
  
  next();
}

app.use(rateLimit);

// Input validation helpers
function validateMarkdownContent(content: string): boolean {
  if (!content || typeof content !== 'string') return false;
  if (content.length > 1000000) return false; // Limit to 1MB of text
  return true;
}

function validateFileName(fileName: string): boolean {
  if (!fileName || typeof fileName !== 'string') return false;
  if (fileName.length > 255) return false; // Standard file name limit
  // Check for dangerous characters
  const dangerousChars = /[<>:"/\\|?*\x00-\x1f]/;
  return !dangerousChars.test(fileName);
}

function validateAccessToken(token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  // Basic Google OAuth token format validation
  if (token.length < 100 || token.length > 2048) return false;
  // Should only contain alphanumeric characters, dots, dashes, and underscores
  const validTokenPattern = /^[a-zA-Z0-9._-]+$/;
  return validTokenPattern.test(token);
}

app.post('/', async (req: Request, res: Response) => {
  try {
    logger.info('Received request:', {
      requestId: req.headers['x-request-id'] || 'unknown',
      userAgent: req.headers['user-agent'],
      contentLength: req.headers['content-length'],
      hasAuthHeader: !!req.headers.authorization
    });

    // Handle array of requests
    const requests: MarkdownRequest[] = Array.isArray(req.body) ? req.body : [req.body];
    
    // Validate number of requests
    if (requests.length > 10) {
      return res.status(400).json({
        error: 'Too many requests in batch',
        details: 'Maximum 10 requests allowed per batch',
        status: 400
      } as ErrorResponse);
    }
    
    logger.info(`Processing ${requests.length} request(s)`);
    
    const results = await Promise.all(requests.map(async (request, index) => {
      // Extract and validate request data
      const markdownContent = request.output;
      const authHeader = req.headers.authorization;
      const fileName = request.fileName || 'Converted from Markdown';
      
      logger.info(`Request ${index + 1} validation:`, {
        hasMarkdown: !!markdownContent,
        contentLength: markdownContent?.length,
        hasAuthHeader: !!authHeader,
        fileNameLength: fileName.length
      });

      // Validate markdown content
      if (!validateMarkdownContent(markdownContent)) {
        logger.error(`Request ${index + 1}: Invalid markdown content`);
        return {
          error: 'Invalid markdown content',
          details: 'Markdown content is required and must be less than 1MB',
          status: 400
        } as ErrorResponse;
      }

      // Validate file name
      if (!validateFileName(fileName)) {
        logger.error(`Request ${index + 1}: Invalid file name`);
        return {
          error: 'Invalid file name',
          details: 'File name must be valid and less than 255 characters',
          status: 400
        } as ErrorResponse;
      }

      // Validate authorization
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        logger.error(`Request ${index + 1}: Missing or invalid authorization header`);
        return {
          error: 'Missing or invalid authorization header',
          details: 'Authorization header must be in format: Bearer <token>',
          status: 401
        } as ErrorResponse;
      }

      const accessToken = authHeader.split(' ')[1];
      
      if (!validateAccessToken(accessToken)) {
        logger.error(`Request ${index + 1}: Invalid access token format`);
        return {
          error: 'Invalid access token format',
          status: 401
        } as ErrorResponse;
      }

      try {
        logger.info(`Request ${index + 1}: Starting conversion for "${fileName}"`);
        const result = await convertMarkdownToGoogleDoc(markdownContent, accessToken, fileName);
        logger.info(`Request ${index + 1}: Conversion successful`);
        
        return {
          ...result,
          webhookUrl: request.webhookUrl,
          executionMode: request.executionMode
        } as GoogleDocResponse;
      } catch (error: any) {
        logger.error(`Request ${index + 1}: Conversion failed:`, {
          errorType: error.constructor.name,
          hasMessage: !!error.message,
          statusCode: error.status || error.code
        });
        
        // Don't expose internal error details in production
        const errorMessage = process.env.NODE_ENV === 'production' 
          ? 'Failed to convert markdown to Google Doc'
          : error.message;
        
        return {
          error: 'Failed to convert markdown to Google Doc',
          details: errorMessage,
          status: error.status || 500
        } as ErrorResponse;
      }
    }));

    // Send response
    if (results.length === 1) {
      const result = results[0];
      logger.info('Sending single response with status:', result.status);
      return res.status(result.status).json(result);
    }

    logger.info('Sending multiple responses:', results.length);
    return res.json(results);

  } catch (error: any) {
    logger.error('Fatal error processing requests:', {
      errorType: error.constructor.name,
      hasMessage: !!error.message
    });
    
    return res.status(500).json({
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'production' ? 'Please try again later' : error.message
    } as ErrorResponse);
  }
});

// Test endpoint for debugging conversion issues (disabled in production)
app.post('/test', async (req: Request, res: Response) => {
  try {
    // Disable test endpoint in production for security
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ 
        error: 'Not found',
        status: 404
      } as ErrorResponse);
    }
    
    logger.info('Received test request');
    
    const { markdown, fileName } = req.body;
    
    if (!validateMarkdownContent(markdown)) {
      return res.status(400).json({ 
        error: 'Invalid markdown content',
        details: 'Markdown content is required and must be less than 1MB',
        status: 400
      } as ErrorResponse);
    }
    
    const sanitizedFileName = fileName && validateFileName(fileName) ? fileName : 'test.docx';
    
    logger.info('Test conversion:', {
      markdownSample: markdown.substring(0, 100),
      markdownLength: markdown.length,
      fileName: sanitizedFileName
    });
    
    const result = await convertMarkdownToDocx(markdown);
    logger.info('Test conversion complete', {
      resultSize: result.length
    });
    
    // Return the DOCX buffer for testing
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizedFileName}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.send(Buffer.from(result));
    
  } catch (error: any) {
    logger.error('Error in test endpoint:', {
      errorType: error.constructor.name,
      hasMessage: !!error.message
    });
    return res.status(500).json({ 
      error: 'Internal server error',
      details: 'Test conversion failed',
      status: 500
    } as ErrorResponse);
  }
});

// Export the function with increased memory allocation for v2
export const mdToGoogleDoc = onRequest({
  memory: '1GiB', // Increase memory from default 256MB to 1GB
  timeoutSeconds: 300, // Also increase timeout to 5 minutes (default is 60s)
  region: 'us-central1', // Explicitly set region
  concurrency: 30, // Limit concurrent executions to 30
  minInstances: 0, // No minimum instances
  maxInstances: 50, // Maximum 50 instances
  cors: true // Enable CORS
}, app); 