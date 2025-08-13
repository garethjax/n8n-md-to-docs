# Security Policy

## Overview

This document outlines the security measures implemented in the n8n Markdown to Google Docs converter service.

## Security Features

### 1. Input Validation and Sanitization
- **Markdown Content**: Validated for size (max 1MB) and sanitized to remove control characters
- **File Names**: Validated for length (max 255 chars) and dangerous characters are filtered
- **Access Tokens**: Basic format validation to ensure proper OAuth token structure
- **Request Batching**: Limited to maximum 10 requests per batch to prevent abuse

### 2. Authentication and Authorization
- **OAuth Token Validation**: Requires valid Google OAuth2 Bearer tokens
- **Token Security**: Tokens are not logged or exposed in error messages
- **Scope Validation**: Validates token format before making API calls

### 3. Rate Limiting
- **Per-IP Limits**: 100 requests per 15-minute window per IP address
- **In-Memory Tracking**: Simple rate limiting to prevent API abuse
- **Graceful Degradation**: Returns 429 status with retry information

### 4. CORS and Headers
- **Production CORS**: Restricted to Google domains and n8n.io in production
- **Security Headers**: 
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `X-XSS-Protection: 1; mode=block`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Strict-Transport-Security` (production only)

### 5. Request Size Limits
- **JSON Body**: Limited to 10MB to prevent memory exhaustion
- **Processing Limits**: Markdown content limited to 1MB text

### 6. Error Handling
- **Information Disclosure**: Error messages sanitized in production
- **Logging**: Sensitive information (tokens) excluded from logs
- **Graceful Failures**: Proper HTTP status codes and user-friendly messages

### 7. Test Endpoint Security
- **Production Disabled**: Test endpoint completely disabled in production
- **Input Validation**: Same validation as main endpoint
- **Secure Headers**: Proper content-type headers for file downloads

## Security Best Practices for Users

### For n8n Users
1. **Token Scope**: Ensure your Google OAuth tokens have minimal required scopes
2. **Token Rotation**: Regularly rotate your OAuth tokens
3. **Network Security**: Use HTTPS for all requests
4. **Content Validation**: Validate markdown content before sending

### For Self-Hosting
1. **Environment Variables**: Properly configure `NODE_ENV=production`
2. **HTTPS**: Always use HTTPS in production
3. **Firewall**: Restrict access to authorized networks only
4. **Monitoring**: Monitor for unusual request patterns
5. **Updates**: Keep dependencies updated regularly

## Reporting Security Issues

If you discover a security vulnerability, please:

1. **Do not** create a public GitHub issue
2. Email the maintainer directly at [security contact]
3. Include detailed information about the vulnerability
4. Allow reasonable time for the issue to be addressed

## Security Checklist for Deployment

- [ ] `NODE_ENV=production` is set
- [ ] HTTPS is configured and enforced
- [ ] CORS origins are properly configured
- [ ] Rate limiting is enabled
- [ ] Monitoring and logging are in place
- [ ] Dependencies are up to date
- [ ] Test endpoint is disabled in production
- [ ] Security headers are configured

## Version History

- **v1.1.0**: Added comprehensive security measures
  - Input validation and sanitization
  - Rate limiting
  - Security headers
  - CORS restrictions
  - Error message sanitization
  - Test endpoint security

- **v1.0.0**: Initial release