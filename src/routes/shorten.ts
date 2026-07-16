import { Router, type NextFunction, type Request, type Response } from 'express';

import { shortenUrl } from '../services/urlService';
import { metricsService } from '../services/metricsService';
import { prometheusMetrics } from '../middleware/prometheus';
import { config } from '../config';

const router = Router();

/**
 * AI Prompt Validation: URL Shortening Endpoint
 *
 * Validation Flow:
 * 1. Request body validation (not null, is object)
 * 2. Extract and sanitize inputs (url, slug, expiresAt)
 * 3. Pass to service layer for full validation
 * 4. Return 201 Created with result
 *
 * Error responses:
 * - 400: Bad request (missing body, invalid format)
 * - 409: Conflict (duplicate slug)
 * - 410: Gone (if validation fails)
 */
router.post('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    // AI: Track request metrics
    metricsService.incrementShorten();
    metricsService.incrementRequest();

    // AI Validation Step 1: Request body must exist and be object
    // Prevents: null body, undefined body, primitive types
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'A valid http(s) URL is required.' });
    }

    // AI Validation Step 2: Extract inputs (defaults to empty string if missing)
    const { url, slug, expiresAt } = req.body as { url?: string; slug?: string; expiresAt?: string };

    // AI Validation Step 3: Delegate to service layer for comprehensive validation
    // shortenUrl will validate:
    // - URL format, protocol, length
    // - Slug format, length, uniqueness
    // - Expiration format, future date requirement
    const result = shortenUrl(url ?? '', config.baseUrl, { slug, expiresAt });

    // AI: Track Prometheus metrics for URL creation
    prometheusMetrics.shortenerUrlsCreatedTotal.inc();

    // AI: Return 201 Created with result (REST semantics)
    return res.status(201).json(result);
  } catch (error) {
    // AI: Pass validation errors to global error handler
    return next(error);
  }
});

export default router;
