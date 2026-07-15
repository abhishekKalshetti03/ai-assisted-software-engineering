import type { NextFunction, Request, Response } from 'express';
import { config } from '../config';

const buckets = new Map<string, { count: number; windowStart: number }>();

export function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  const { rateLimitMaxRequests: MAX_REQUESTS, rateLimitWindowMs: WINDOW_MS } = config;
  const identifier = req.ip ?? 'unknown';
  const now = Date.now();
  const bucket = buckets.get(identifier);

  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    buckets.set(identifier, { count: 1, windowStart: now });
    next();
    return;
  }

  if (bucket.count >= MAX_REQUESTS) {
    res.setHeader('retry-after', `${Math.ceil((WINDOW_MS - (now - bucket.windowStart)) / 1000)}`);
    res.status(429).json({ error: 'Too many requests.' });
    return;
  }

  bucket.count += 1;
  next();
}

export function resetRateLimiter(): void {
  buckets.clear();
}
