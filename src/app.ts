import cors from 'cors';
import * as dotenv from 'dotenv';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { createHash } from 'node:crypto';

import { config } from './config';
import healthRouter from './routes/health';
import shortenRouter from './routes/shorten';
import { getAnalytics, redirectUrl } from './services/urlService';
import { recordClick } from './database/db';
import { AppError } from './utils/errors';
import { requestLogger } from './middleware/requestLogger';
import { requestIdMiddleware } from './middleware/requestId';
import { rateLimiter as rateLimiterMemory } from './middleware/rateLimiter';
import { rateLimiter as rateLimiterRedis } from './middleware/rateLimiterRedis';
import { apiKeyAuth } from './middleware/apiKeyAuth';
import { metricsService } from './services/metricsService';
import { prometheusMiddleware, renderMetrics, prometheusMetrics } from './middleware/prometheus';

dotenv.config();

const app: Express = express();

// AI: Select rate limiter based on configuration
// - "memory": In-memory rate limiting (single-instance)
// - "redis": Redis-backed rate limiting (multi-instance)
const selectedRateLimiter = config.rateLimiterBackend === 'redis' ? rateLimiterRedis : rateLimiterMemory;

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(morgan('combined'));
app.use(prometheusMiddleware);
app.use(requestIdMiddleware);
app.use(selectedRateLimiter);
app.use(apiKeyAuth);
app.use(requestLogger);

// Enforce JSON content-type for POST /api/v1/shorten
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'POST' && req.path === '/api/v1/shorten' && !req.is('application/json')) {
    return res.status(415).json({ error: 'Unsupported content type. Expected application/json.' });
  }
  return next();
});

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true }));

// ── Root info endpoint ────────────────────────────────────────────────────────
app.get('/', (_req: Request, res: Response) => {
  metricsService.incrementRequest();
  res.status(200).json({
    service: 'url-shortener',
    version: 'v1',
    docs: '/api/v1/health',
  });
});

// ── Versioned API routes ──────────────────────────────────────────────────────
app.use('/api/v1/health', healthRouter);
app.use('/api/v1/shorten', shortenRouter);

app.get('/api/v1/metrics', async (_req: Request, res: Response) => {
  try {
    const metrics = await renderMetrics();
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.status(200).send(metrics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to render metrics' });
  }
});

app.get('/api/v1/analytics/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    metricsService.incrementAnalytics();
    metricsService.incrementRequest();
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const analytics = getAnalytics(id);
    return res.status(200).json(analytics);
  } catch (error) {
    return next(error);
  }
});

// ── Short-link redirect (root level — these are the links users share) ────────
app.get('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    metricsService.incrementRedirect();
    metricsService.incrementRequest();
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { originalUrl } = redirectUrl(id);
    
    // AI: Track click analytics with HTTP metadata
    const referrer = req.get('referer') || req.get('referrer') || undefined;
    const userAgent = req.get('user-agent') || undefined;
    const clientIp = req.ip || 'unknown';
    const ipHash = createHash('sha256').update(clientIp).digest('hex').substring(0, 16);
    recordClick(id, referrer, userAgent, ipHash);
    
    // AI: Track Prometheus metrics for redirects
    prometheusMetrics.shortenerRedirectsTotal.inc();
    // Prevent caching of redirects to ensure analytics accuracy and allow URL updates
    res.setHeader('Cache-Control', 'no-store');
    return res.redirect(302, originalUrl);
  } catch (error) {
    return next(error);
  }
});

// ── 404 catch-all ─────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// ── Centralised error handler ─────────────────────────────────────────────────
app.use((err: Error & { status?: number; type?: string }, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    console.error(`[${err.code}] ${err.message}`);
    return res.status(err.statusCode).json({ error: err.message });
  }

  // body-parser / JSON syntax errors
  if (err.status === 400 || err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid request body.' });
  }

  console.error(err.stack);
  return res.status(500).json({ error: 'Internal server error' });
});

export default app;
