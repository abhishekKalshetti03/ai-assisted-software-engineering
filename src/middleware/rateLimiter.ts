import type { NextFunction, Request, Response } from 'express';
import { config } from '../config';

/**
 * AI Prompt Validation: Rate Limiting Middleware
 *
 * Purpose: Prevent abuse by limiting requests per client IP
 *
 * Validation Flow:
 * 1. Extract client IP from request
 * 2. Check if IP exists in rate limit bucket
 * 3. If bucket expired or missing, create new bucket (1 request)
 * 4. If within limit, increment counter
 * 5. If exceeded, return 429 with Retry-After header
 *
 * Configuration (from config.ts):
 * - rateLimitMaxRequests: Default 120 requests per IP
 * - rateLimitWindowMs: Default 60000ms (1 minute window)
 *
 * Implementation Notes:
 * - In-memory Map storage (cleared on app restart)
 * - Per-IP tracking (different limit for each IP)
 * - Window-based (not sliding window, fixed window)
 * - Test support via resetRateLimiter() for isolation
 */

const buckets = new Map<string, { count: number; windowStart: number }>();

export function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  // AI: Get configuration
  const { rateLimitMaxRequests: MAX_REQUESTS, rateLimitWindowMs: WINDOW_MS } = config;

  // AI Validation Step 1: Extract client IP (fallback to 'unknown')
  // Note: In proxied environments, use x-forwarded-for header
  const identifier = req.ip ?? 'unknown';
  const now = Date.now();

  // AI Validation Step 2: Get existing bucket for this IP
  const bucket = buckets.get(identifier);

  // AI Validation Step 3a: New IP or window expired - reset bucket
  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    // AI: Create new bucket with first request
    buckets.set(identifier, { count: 1, windowStart: now });
    return next();
  }

  // AI Validation Step 3b: Window still active - check limit
  if (bucket.count >= MAX_REQUESTS) {
    // AI: Calculate seconds until window resets
    const secondsUntilReset = Math.ceil((WINDOW_MS - (now - bucket.windowStart)) / 1000);
    
    // AI: Set Retry-After header (RFC 7231)
    res.setHeader('retry-after', `${secondsUntilReset}`);
    
    // AI: Return 429 Too Many Requests
    res.status(429).json({ error: 'Too many requests.' });
    return;
  }

  // AI Validation Step 4: Within limit - increment and allow
  bucket.count += 1;
  next();
}

/**
 * AI Prompt: "Reset rate limiter for test isolation"
 * 
 * Purpose: Clear all rate limit buckets before each test
 * Ensures: Tests don't interfere with each other
 * Used by: Test setup (beforeEach hook)
 */
export function resetRateLimiter(): void {
  // AI: Clear all buckets for clean test state
  buckets.clear();
}
