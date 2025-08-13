# Security Guidelines

This document outlines the security measures implemented in the n8n Markdown to Google Docs converter service.

## Security Features

### 1. Credential Protection
- **OAuth Token Security**: Access tokens are never logged or exposed in error messages
- **Secure Authentication**: Only Bearer token authentication is accepted
- **Token Validation**: Proper validation of authorization headers before processing

### 2. Input Validation and Sanitization
- **Content Size Limits**: Markdown content is limited to 10MB to prevent DoS attacks
- **File Name Sanitization**: File names are sanitized to remove potentially dangerous characters
- **Input Validation**: All user inputs are validated before processing

### 3. Error Handling
- **Information Disclosure Prevention**: Error messages don't expose sensitive system information
- **Secure Logging**: Sensitive data is never logged, including partial tokens or user content
- **Consistent Error Responses**: Standardized error responses that don't leak implementation details

### 4. Environment Security
- **Test Endpoint Protection**: Test endpoints are only available in development environments
- **Production Hardening**: Additional security measures are enforced in production
- **Environment Validation**: Proper checks for environment configuration

### 5. Security Headers
- **X-Content-Type-Options**: Set to `nosniff` to prevent MIME type sniffing
- **X-Frame-Options**: Set to `DENY` to prevent clickjacking
- **X-XSS-Protection**: Enabled with blocking mode
- **Referrer-Policy**: Set to `strict-origin-when-cross-origin`

## Best Practices for n8n Users

### 1. OAuth Token Management
- Use n8n's built-in Google OAuth2 credentials
- Don't hardcode access tokens in workflows
- Regularly review and rotate OAuth applications if needed

### 2. Input Handling
- Validate markdown content before sending to the service
- Be mindful of file naming to avoid conflicts
- Keep markdown content within reasonable size limits

### 3. Error Monitoring
- Monitor for authentication failures which may indicate credential issues
- Watch for rate limiting or quota errors from Google APIs
- Implement proper error handling in your n8n workflows

## Security Considerations

### Data Processing
- Markdown content is processed in memory and not stored
- Google Docs are created directly via Google Drive API
- No persistent storage of user data or credentials

### Network Security
- All communication uses HTTPS
- CORS is properly configured for cross-origin requests
- Request size limits prevent resource exhaustion

### Logging and Monitoring
- No sensitive data is logged (tokens, content, etc.)
- Error logging focuses on operational metrics
- Security-relevant events are logged for monitoring

## Reporting Security Issues

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public issue
2. Contact the maintainer directly via email
3. Provide detailed information about the vulnerability
4. Allow time for the issue to be addressed before public disclosure

## Security Updates

This service follows security best practices and will be updated as needed to address any security concerns. Regular security reviews are conducted to ensure ongoing protection.