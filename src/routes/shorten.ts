import { Router, type NextFunction, type Request, type Response } from 'express';

import { shortenUrl } from '../services/urlService';
import { metricsService } from '../services/metricsService';
import { config } from '../config';

const router = Router();

router.post('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    metricsService.incrementShorten();
    metricsService.incrementRequest();
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'A valid http(s) URL is required.' });
    }
    const { url, slug, expiresAt } = req.body as { url?: string; slug?: string; expiresAt?: string };
    const result = shortenUrl(url ?? '', config.baseUrl, { slug, expiresAt });

    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
});

export default router;
