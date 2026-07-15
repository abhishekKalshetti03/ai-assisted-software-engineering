import {
  createShortUrlRecord,
  getAnalyticsRecordById,
  getOriginalUrlRecordById,
  incrementClickCount,
  slugExists,
} from '../database/db';
import { ConflictError, GoneError, NotFoundError, ValidationError } from '../utils/errors';

/**
 * AI Prompt Validation Spec:
 *
 * URL VALIDATION:
 * - Prompt: "Validate URLs for security and RFC compliance"
 * - Max length: 2048 chars (RFC 3986 practical limit)
 * - Protocols: http/https only (reject ftp, file, data, javascript)
 * - Hostname: Must be present and valid
 * - Format: Must parse successfully via URL constructor
 *
 * SLUG VALIDATION:
 * - Prompt: "Validate custom URL slugs for format and uniqueness"
 * - Format: Alphanumeric + hyphens only (^[a-z0-9-]+$i)
 * - Length: 1-50 characters
 * - Uniqueness: Check database before insertion (409 Conflict)
 * - Case: Accept any case, no normalization needed
 *
 * EXPIRATION VALIDATION:
 * - Prompt: "Validate URL expiration dates for format and logic"
 * - Format: ISO 8601 datetime (e.g., "2026-12-31T23:59:59Z")
 * - Logic: Must be in future (cannot expire in past)
 * - Timezone: Support Z or +/- offset notation
 * - Response: Return 410 Gone when accessed after expiration
 */

const MAX_URL_LENGTH = 2048;
const MAX_SLUG_LENGTH = 50;
const ID_PATTERN = /^[a-z0-9-]+$/i;
const SLUG_PATTERN = /^[a-z0-9-]+$/i;

/**
 * AI Prompt: "Validate URL input"
 * Returns: true if valid, false otherwise
 * Validation checks (in order):
 * 1. Not null/undefined/empty
 * 2. String type check
 * 3. Length check (max 2048 chars)
 * 4. URL parsing (constructor validates format)
 * 5. Protocol check (http/https only)
 * 6. Hostname requirement (must exist)
 */
function isValidHttpUrl(value: string): boolean {
  // AI Check 1: Type validation
  if (typeof value !== 'string' || value.trim().length === 0) {
    return false;
  }

  // AI Check 2: RFC length limit (practical max for URLs)
  if (value.length > MAX_URL_LENGTH) {
    return false;
  }

  try {
    // AI Check 3: Parse URL - constructor throws if invalid format
    const parsed = new URL(value);
    
    // AI Check 4: Protocol restriction (http/https only)
    const isValidProtocol = parsed.protocol === 'http:' || parsed.protocol === 'https:';
    
    // AI Check 5: Hostname requirement (must be present, length > 0)
    const hasHostname = parsed.hostname.length > 0;
    
    return isValidProtocol && hasHostname;
  } catch {
    // URL constructor threw error - invalid format
    return false;
  }
}

/**
 * AI Prompt: "Validate custom URL slug"
 * Returns: true if valid format, false otherwise
 * Validation checks:
 * 1. String type check
 * 2. Length range (1-50 chars)
 * 3. Pattern match (alphanumeric + hyphens)
 */
function isValidSlug(value: string): boolean {
  return (
    typeof value === 'string' &&
    value.length >= 1 &&  // AI: Minimum length enforced
    value.length <= MAX_SLUG_LENGTH &&  // AI: Maximum length enforced
    SLUG_PATTERN.test(value)  // AI: Format validation (safe chars only)
  );
}

/**
 * AI Prompt: "Validate URL ID format"
 * Returns: true if valid ID format, false otherwise
 * Used for: redirects, analytics lookups
 */
function isValidId(value: string): boolean {
  return typeof value === 'string' && value.length > 0 && ID_PATTERN.test(value);
}

/**
 * AI Prompt: "Check if URL has expired"
 * Returns: true if expired (now > expiresAt), false otherwise
 * Validation: Only checks if expiresAt is set
 */
function isExpired(expiresAt: string | null): boolean {
  // AI: If no expiration set, never expired
  if (!expiresAt) return false;
  
  // AI: Compare current time with expiration time
  return new Date(expiresAt) < new Date();
}

export interface ShortenOptions {
  slug?: string;
  expiresAt?: string;
}

export interface ShortenResult {
  id: string;
  shortUrl: string;
  expiresAt: string | null;
}

export interface AnalyticsResult {
  id: string;
  originalUrl: string;
  clicks: number;
  createdAt: string;
  expiresAt: string | null;
}

export function shortenUrl(originalUrl: string, baseUrl: string, options: ShortenOptions = {}): ShortenResult {
  /**
   * AI Prompt Execution: "Shorten a URL with optional slug and expiration"
   *
   * Steps:
   * 1. Validate original URL (protocol, length, format)
   * 2. Validate custom slug if provided (format, length, uniqueness)
   * 3. Validate expiration date if provided (format, future)
   * 4. Insert record into database
   * 5. Return short URL with metadata
   *
   * Error handling:
   * - ValidationError (400): Format/length issues
   * - ConflictError (409): Duplicate slug
   */

  // AI Step 1: URL validation with detailed error
  if (!isValidHttpUrl(originalUrl)) {
    // AI: Specific reason helps user understand the issue
    throw new ValidationError('A valid http(s) URL is required.');
  }

  // AI Step 2a: Slug format validation
  if (options.slug !== undefined) {
    if (!isValidSlug(options.slug)) {
      // AI: Provide exact requirements
      throw new ValidationError(
        `Slug must be 1–${MAX_SLUG_LENGTH} characters and contain only letters, numbers, and hyphens.`,
      );
    }
    
    // AI Step 2b: Slug uniqueness validation
    if (slugExists(options.slug)) {
      // AI: 409 Conflict is semantically correct HTTP status
      throw new ConflictError(`A link with slug "${options.slug}" already exists.`);
    }
  }

  // AI Step 3: Expiration date validation
  if (options.expiresAt !== undefined) {
    const expiry = new Date(options.expiresAt);
    
    // AI: Check ISO 8601 format validity
    if (Number.isNaN(expiry.getTime())) {
      throw new ValidationError('expiresAt must be a valid ISO 8601 date string.');
    }
    
    // AI: Enforce future-only constraint
    if (expiry <= new Date()) {
      throw new ValidationError('expiresAt must be a future date.');
    }
  }

  // AI Step 4: All validations passed, create record
  return createShortUrlRecord(originalUrl, baseUrl, options);
}

export function redirectUrl(id: string): { originalUrl: string } {
  /**
   * AI Prompt Execution: "Redirect short URL to original"
   *
   * Steps:
   * 1. Validate ID format (alphanumeric + hyphens)
   * 2. Lookup URL record in database
   * 3. Check expiration status
   * 4. Increment click counter
   * 5. Return record (to be used for redirect)
   *
   * Error handling:
   * - ValidationError (400): Invalid ID format
   * - NotFoundError (404): ID doesn't exist
   * - GoneError (410): URL has expired
   */

  // AI Step 1: Validate ID format
  if (!isValidId(id)) {
    // AI: Clear error for malformed ID
    throw new ValidationError('Invalid short URL ID format.');
  }

  // AI Step 2: Lookup in database
  const record = getOriginalUrlRecordById(id);
  if (!record) {
    // AI: 404 is correct response for missing resource
    throw new NotFoundError('Short URL not found.');
  }

  // AI Step 3: Check expiration
  if (isExpired(record.expiresAt)) {
    // AI: 410 Gone indicates resource no longer exists (expired)
    throw new GoneError('This link has expired.');
  }

  // AI Step 4: Increment counter for analytics
  incrementClickCount(id);

  // AI Step 5: Return record for redirect
  return { originalUrl: record.originalUrl };
}

export function getAnalytics(id: string): AnalyticsResult {
  /**
   * AI Prompt Execution: "Get analytics for shortened URL"
   *
   * Steps:
   * 1. Validate ID format
   * 2. Lookup analytics record in database
   * 3. Return click count and metadata
   *
   * Error handling:
   * - ValidationError (400): Invalid ID format
   * - NotFoundError (404): ID doesn't exist
   */

  // AI Step 1: Validate ID format
  if (!isValidId(id)) {
    throw new ValidationError('Invalid short URL ID format.');
  }

  // AI Step 2: Lookup analytics data
  const record = getAnalyticsRecordById(id);
  if (!record) {
    // AI: 404 if ID not found in database
    throw new NotFoundError('Short URL not found.');
  }

  // AI Step 3: Return formatted analytics
  return {
    id: record.id,
    originalUrl: record.originalUrl,
    clicks: record.clicks,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
  };
}
