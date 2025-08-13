import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import express from 'express';
import cors from 'cors';
import type { Request, Response } from 'express';
import type { MarkdownRequest, GoogleDocResponse, ErrorResponse } from './types';
import { convertMarkdownToGoogleDoc } from './services/googleDocs';
import { convertMarkdownToDocx } from './services/docxConverter';

const app = express();

// Middleware
app.use(express.json({ limit: '10mb' })); // Limit body size for security
app.use(cors({ origin: true }));

// Security middleware
app.use((_req: Request, res: Response, next: any) => {
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.post('/', async (req: Request, res: Response) => {
  try {
    logger.info('Received request:', {
      body: {
        ...req.body,
        // Don't log potentially sensitive markdown content
        output: req.body.output ? `[${req.body.output.length} characters]` : undefined
      },
      headers: {
        ...req.headers,
        // Never log authorization headers for security
        authorization: req.headers.authorization ? '[REDACTED]' : undefined
      }
    });

    // Handle array of requests
    const requests: MarkdownRequest[] = Array.isArray(req.body) ? req.body : [req.body];
    logger.info(`Processing ${requests.length} request(s)`);
    
    const results = await Promise.all(requests.map(async (request, index) => {
      // Extract request data
      const markdownContent = request.output;
      const authHeader = req.headers.authorization;
      const fileName = request.fileName || 'Converted from Markdown';
      
      // Validate and sanitize fileName
      let sanitizedFileName = fileName;
      if (sanitizedFileName) {
        // Remove potentially dangerous characters and limit length
        sanitizedFileName = sanitizedFileName.replace(/[<>:"/\\|?*]/g, '').substring(0, 255);
        if (sanitizedFileName.length === 0) {
          sanitizedFileName = 'Converted from Markdown';
        }
      } else {
        sanitizedFileName = 'Converted from Markdown';
      }
      
      logger.info(`Request ${index + 1} validation:`, {
        hasMarkdown: !!markdownContent,
        contentLength: markdownContent?.length,
        hasAuthHeader: !!authHeader,
        fileName: sanitizedFileName
      });

      // Validate markdown content
      if (!markdownContent) {
        logger.error(`Request ${index + 1}: Missing markdown content`);
        return {
          error: 'Missing required field: output',
          status: 400,
          request: {
            ...request,
            output: undefined
          }
        } as ErrorResponse;
      }

      // Validate markdown content length for security (10MB limit)
      if (markdownContent.length > 10 * 1024 * 1024) {
        logger.error(`Request ${index + 1}: Markdown content too large`);
        return {
          error: 'Markdown content too large. Maximum size is 10MB.',
          status: 400
        } as ErrorResponse;
      }

      // Validate authorization
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        logger.error(`Request ${index + 1}: Invalid authorization`);
        return {
          error: 'Missing or invalid authorization header',
          status: 401
        } as ErrorResponse;
      }

      const accessToken = authHeader.split(' ')[1];

      try {
        logger.info(`Request ${index + 1}: Starting conversion for "${sanitizedFileName}"`);
        const result = await convertMarkdownToGoogleDoc(markdownContent, accessToken, sanitizedFileName);
        logger.info(`Request ${index + 1}: Conversion successful:`, result);
        
        return {
          ...result,
          webhookUrl: request.webhookUrl,
          executionMode: request.executionMode
        } as GoogleDocResponse;
      } catch (error: any) {
        logger.error(`Request ${index + 1}: Conversion failed:`, {
          error: error.message,
          status: error.status || error.code,
          details: error.errors || error.stack
        });
        
        return {
          error: 'Failed to convert markdown to Google Doc',
          details: 'Document conversion failed. Please check your input and try again.',
          status: error.status || 500
        } as ErrorResponse;
      }
    }));

    // Send response
    if (results.length === 1) {
      const result = results[0];
      logger.info('Sending single response:', {
        ...result,
        documentContent: undefined
      });
      return res.status(result.status).json(result);
    }

    logger.info('Sending multiple responses:', results.length);
    return res.json(results);

  } catch (error: any) {
    logger.error('Fatal error processing requests:', {
      error: error.message,
      stack: error.stack
    });
    
    return res.status(500).json({
      error: 'Failed to process requests',
      details: 'Internal server error. Please try again later.'
    } as ErrorResponse);
  }
});

// Add a test endpoint for debugging conversion issues
app.post('/test', async (req: Request, res: Response) => {
  try {
    // Only allow test endpoint in development/local environments
    if (process.env.NODE_ENV === 'production' || process.env.FUNCTIONS_EMULATOR !== 'true') {
      return res.status(404).json({ error: 'Endpoint not found' });
    }
    
    logger.info('Received test request');
    
    const { markdown, fileName } = req.body;
    if (!markdown) {
      return res.status(400).json({ error: 'Missing markdown content' });
    }
    
    // Validate markdown content length for security
    if (markdown.length > 100000) { // 100KB limit
      return res.status(400).json({ error: 'Markdown content too large' });
    }
    
    logger.info('Test conversion:', {
      markdownLength: markdown.length,
      fileName: fileName || 'test.docx'
    });
    
    const result = await convertMarkdownToDocx(markdown);
    logger.info('Test conversion complete', {
      resultSize: result.length
    });
    
    // Return the DOCX buffer directly for testing
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName || 'test.docx'}"`);
    return res.send(Buffer.from(result));
  } catch (error: any) {
    logger.error('Error in test endpoint:', error);
    return res.status(500).json({ 
      error: 'Internal server error. Please try again later.' 
    });
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