/**
 * AI Prompt Validation: Error Handling Strategy
 *
 * Error Classification:
 * - ValidationError (400): User input validation failed
 * - NotFoundError (404): Resource doesn't exist
 * - ConflictError (409): Resource conflict (e.g., duplicate slug)
 * - GoneError (410): Resource expired (URL link expired)
 * - AppError (500+): Server errors (default)
 *
 * Validation Principles:
 * 1. Semantic HTTP status codes (not everything is 400 or 500)
 * 2. Clear error messages (user-facing, not technical)
 * 3. Error code for logging (server-side tracking)
 * 4. Optional details for debugging (never sent to client in prod)
 * 5. Consistent JSON response format
 */

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_SERVER_ERROR', details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;  // AI: HTTP status code for response
    this.code = code;  // AI: Machine-readable error code for logging
    this.details = details;  // AI: Optional debugging details (not sent to client)
  }
}

/**
 * AI Prompt: "Validation Error (400)"
 * 
 * When to use:
 * - URL format invalid
 * - Slug format invalid
 * - Expiration date invalid
 * - Request body missing/malformed
 * 
 * Example triggers:
 * - "A valid http(s) URL is required."
 * - "Slug must be 1-50 characters"
 * - "expiresAt must be a future date"
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

/**
 * AI Prompt: "Not Found Error (404)"
 * 
 * When to use:
 * - Short URL ID doesn't exist
 * - Analytics for unknown short URL
 * - Redirect for missing short URL
 * 
 * Semantics: Resource was never created or has been deleted
 */
export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

/**
 * AI Prompt: "Gone Error (410)"
 * 
 * When to use:
 * - URL has expired (expiration date passed)
 * 
 * Difference from 404:
 * - 410 explicitly signals resource existed but is now gone
 * - Clients can cache 410 (resource won't come back)
 * - 404 signals permanent or indefinite unavailability
 * 
 * Example: User tries to redirect via expired short URL
 */
export class GoneError extends AppError {
  constructor(message = 'This link has expired.') {
    super(message, 410, 'GONE');
  }
}

/**
 * AI Prompt: "Conflict Error (409)"
 * 
 * When to use:
 * - Custom slug already exists in database
 * - Request conflicts with existing resource state
 * 
 * Semantics: Request cannot be completed due to conflict with existing state
 * 
 * Example: "A link with slug 'my-link' already exists"
 */
export class ConflictError extends AppError {
  constructor(message = 'A link with this slug already exists.') {
    super(message, 409, 'CONFLICT');
  }
}
