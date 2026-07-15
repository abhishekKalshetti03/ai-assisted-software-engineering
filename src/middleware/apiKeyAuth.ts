import type { NextFunction, Request, Response } from 'express';
import { config } from '../config';

/**
 * API Key authentication middleware for production use.
 * Validates x-api-key header against configured API keys.
 * Disable in development by setting NODE_ENV=development.
 */

interface AuthenticatedRequest extends Request {
  apiKey?: string;
}

const ALLOWED_ROUTES_WITHOUT_AUTH = [
  '/',
  '/api/v1/health',
];

export function apiKeyAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  // Skip auth in development
  if (!config.isProduction) {
    return next();
  }

  // Skip auth for allowed routes
  if (ALLOWED_ROUTES_WITHOUT_AUTH.includes(req.path)) {
    return next();
  }

  // For redirect routes (GET /:id), allow unauthenticated access
  if (req.method === 'GET' && /^\/[a-z0-9-]+$/.test(req.path)) {
    return next();
  }

  const apiKey = req.headers['x-api-key'] as string | undefined;

  if (!apiKey) {
    res.status(401).json({ error: 'Missing x-api-key header' });
    return;
  }

  // Validate against configured API keys
  const validKeys = config.apiKeys;
  if (!validKeys || validKeys.length === 0) {
    // No API keys configured; allow access (admin must configure)
    return next();
  }

  if (!validKeys.includes(apiKey)) {
    res.status(403).json({ error: 'Invalid API key' });
    return;
  }

  req.apiKey = apiKey;
  next();
}
