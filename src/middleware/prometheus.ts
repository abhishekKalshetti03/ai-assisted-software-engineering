import type { NextFunction, Request, Response } from 'express';
import {
  Counter,
  Histogram,
  collectDefaultMetrics,
  register,
} from 'prom-client';

/**
 * Prometheus Metrics Middleware
 * 
 * Tracks:
 * - http_requests_total: Total number of HTTP requests (counter)
 * - http_request_duration_seconds: HTTP request latency histogram (seconds)
 * - shortener_urls_created_total: Total URLs shortened (counter)
 * - shortener_redirects_total: Total redirects served (counter)
 * 
 * Exported at GET /api/v1/metrics in Prometheus text format
 */

// Collect Node.js process metrics (memory, GC, event loop lag, etc.)
collectDefaultMetrics({ register });

// Counter: Total HTTP requests
const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

// Histogram: HTTP request duration in seconds
const httpRequestDurationSeconds = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request latency in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

// Counter: Total URLs shortened
const shortenerUrlsCreatedTotal = new Counter({
  name: 'shortener_urls_created_total',
  help: 'Total number of URLs shortened',
  registers: [register],
});

// Counter: Total redirects served
const shortenerRedirectsTotal = new Counter({
  name: 'shortener_redirects_total',
  help: 'Total number of redirects served',
  registers: [register],
});

// Export metrics for external use (services need to increment counters)
export const prometheusMetrics = {
  shortenerUrlsCreatedTotal,
  shortenerRedirectsTotal,
};

/**
 * Middleware to track HTTP request metrics
 * Records:
 * - Request start time
 * - Response status code
 * - Request/response cycle duration
 */
export function prometheusMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const method = req.method;
  const route = normalizeRoute(req.path);

  // Capture original res.end to intercept response
  const originalEnd = res.end.bind(res);
  res.end = function (chunk?: any, encoding?: any, cb?: any) {
    const duration = (Date.now() - startTime) / 1000; // Convert to seconds
    const status = String(res.statusCode);

    // Record metrics
    httpRequestsTotal.labels(method, route, status).inc();
    httpRequestDurationSeconds.labels(method, route, status).observe(duration);

    // Call original end with appropriate arguments
    if (typeof chunk === 'function') {
      return originalEnd(chunk);
    } else if (typeof encoding === 'function') {
      return originalEnd(chunk, encoding);
    } else {
      return originalEnd(chunk, encoding, cb);
    }
  } as any;

  next();
}

/**
 * Normalize routes to prevent cardinality explosion
 * e.g., /:id -> /:id, /api/v1/analytics/:id -> /api/v1/analytics/:id
 */
function normalizeRoute(path: string): string {
  // Normalize path segments with IDs/slugs to param placeholders
  const segments = path.split('/');
  const normalized = segments.map((segment) => {
    // Check if segment looks like an ID/slug (alphanumeric + hyphens)
    if (/^[a-z0-9-]+$/i.test(segment) && segment.length > 0) {
      return ':param';
    }
    return segment;
  });
  return normalized.join('/');
}

/**
 * Export the Prometheus registry for /api/v1/metrics endpoint
 * Renders all metrics in Prometheus text format
 */
export async function renderMetrics(): Promise<string> {
  return register.metrics();
}
