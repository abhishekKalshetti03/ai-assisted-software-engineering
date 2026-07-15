import type { NextFunction, Request, Response } from 'express';
import { config } from '../config';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startedAt = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    const requestId = res.getHeader('x-request-id') as string | undefined;

    if (config.isProduction) {
      // Structured JSON — machine-parseable for log aggregators (Loki, CloudWatch, etc.)
      console.info(JSON.stringify({
        level: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
        type: 'request',
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs,
        requestId,
        timestamp: new Date().toISOString(),
      }));
    } else {
      // Human-readable for local development
      console.info(`[request] ${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms`);
    }
  });

  next();
}
