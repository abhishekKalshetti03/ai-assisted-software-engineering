import type { NextFunction, Request, Response } from 'express';
import { config } from '../config';

/**
 * AI Prompt: "Production API Key Authentication Middleware"
 *
 * Authentication Flow (in order):
 * 1. Skip auth if NODE_ENV !== production
 * 2. Skip auth for public routes (/, /health)
 * 3. Skip auth for redirect routes (GET /:id)
 * 4. Check if API keys are configured
 *    - If NOT configured: allow access (no auth required)
 *    - If configured: require x-api-key header
 * 5. Validate x-api-key against configured keys
 *    - Valid: attach to req.apiKey and proceed
 *    - Invalid: return 403 Forbidden
 *
 * Protected Routes (require valid API key in production):
 * - POST /api/v1/shorten
 * - GET /api/v1/analytics/:id
 * - GET /api/v1/metrics
 */

interface AuthenticatedRequest extends Request {
  apiKey?: string;
}

const ALLOWED_ROUTES_WITHOUT_AUTH = [
  '/',
  '/api/v1/health',
];

export function apiKeyAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  // AI Step 1: Skip auth in development mode
  if (!config.isProduction) {
    return next();
  }

  // AI Step 2: Skip auth for explicitly allowed public routes
  if (ALLOWED_ROUTES_WITHOUT_AUTH.includes(req.path)) {
    return next();
  }

  // AI Step 3: Skip auth for redirect routes (GET /:id)
  // Pattern matches: /abc123, /my-link, /x
  // Does NOT match: /api/v1/shorten, /api/v1/analytics/abc123
  if (req.method === 'GET' && /^\/[a-z0-9-]+$/.test(req.path)) {
    return next();
  }

  // AI Step 4a: Check if API keys are configured in production
  const validKeys = config.apiKeys;
  if (!validKeys || validKeys.length === 0) {
    // AI Security: Fail-closed (fail-safe)
    // In production, empty API_KEYS on protected route is a misconfiguration
    // Return 500 to signal deployment issue, not allow access
    console.error(
      '[SECURITY] Production mode with no API_KEYS configured. ' +
      'Protected endpoint accessed without authentication. This is a deployment error.'
    );
    res.status(500).json({ error: 'Authentication not properly configured' });
    return;
  }

  // AI Step 4b: API keys ARE configured, require authentication
  const apiKey = req.headers['x-api-key'] as string | undefined;

  // AI: Check if header is missing
  if (!apiKey) {
    // AI: Return 401 Unauthorized - missing credential
    res.status(401).json({ error: 'Missing x-api-key header' });
    return;
  }

  // AI Step 5: Validate the key
  if (!validKeys.includes(apiKey)) {
    // AI: Return 403 Forbidden - invalid credential
    res.status(403).json({ error: 'Invalid API key' });
    return;
  }

  // AI: Key is valid, attach to request and proceed
  req.apiKey = apiKey;
  next();
}
