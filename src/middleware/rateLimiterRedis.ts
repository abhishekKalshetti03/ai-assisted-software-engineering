import type { NextFunction, Request, Response } from 'express';
import Redis from 'ioredis';
import { config } from '../config';

/**
 * Redis-based rate limiter for horizontal scaling.
 * When REDIS_URL is set, this limiter stores state in Redis instead of in-memory.
 * Suitable for multi-instance deployments.
 */

const redis = config.redisUrl ? new Redis(config.redisUrl) : null;
const buckets = new Map<string, { count: number; windowStart: number }>();

async function checkRateLimit(identifier: string): Promise<{ allowed: boolean; retryAfter?: number }> {
  const { rateLimitMaxRequests: MAX_REQUESTS, rateLimitWindowMs: WINDOW_MS } = config;
  const now = Date.now();
  const windowKey = `ratelimit:${identifier}:${Math.floor(now / WINDOW_MS)}`;

  if (redis) {
    // Redis-backed: suitable for distributed deployments
    try {
      const count = await redis.incr(windowKey);
      if (count === 1) {
        await redis.expire(windowKey, Math.ceil(WINDOW_MS / 1000));
      }

      if (count > MAX_REQUESTS) {
        const ttl = await redis.ttl(windowKey);
        const retryAfter = Math.max(ttl, 1);
        return { allowed: false, retryAfter };
      }

      return { allowed: true };
    } catch (error) {
      // Fallback to in-memory if Redis fails (fail-open approach)
      console.error('[rate-limiter] Redis error, falling back to in-memory:', error);
      return checkInMemoryLimit(identifier);
    }
  }

  // In-memory: suitable for single-instance deployments
  return checkInMemoryLimit(identifier);
}

function checkInMemoryLimit(identifier: string): { allowed: boolean; retryAfter?: number } {
  const { rateLimitMaxRequests: MAX_REQUESTS, rateLimitWindowMs: WINDOW_MS } = config;
  const now = Date.now();
  const bucket = buckets.get(identifier);

  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    buckets.set(identifier, { count: 1, windowStart: now });
    return { allowed: true };
  }

  if (bucket.count >= MAX_REQUESTS) {
    const retryAfter = Math.ceil((WINDOW_MS - (now - bucket.windowStart)) / 1000);
    return { allowed: false, retryAfter };
  }

  bucket.count += 1;
  return { allowed: true };
}

export async function rateLimiter(req: Request, res: Response, next: NextFunction): Promise<void> {
  const identifier = req.ip ?? 'unknown';
  const { allowed, retryAfter } = await checkRateLimit(identifier);

  if (!allowed) {
    res.setHeader('retry-after', `${retryAfter}`);
    res.status(429).json({ error: 'Too many requests.' });
    return;
  }

  next();
}

export function resetRateLimiter(): void {
  buckets.clear();
}

export async function closeRedisConnection(): Promise<void> {
  if (redis) {
    await redis.quit();
  }
}
