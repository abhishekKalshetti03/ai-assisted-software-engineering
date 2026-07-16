import { Router, type Request, type Response } from 'express';
import { metricsService } from '../services/metricsService';

const router = Router();

// Combined health endpoint (for backward compatibility and testing)
router.get('/', (_req: Request, res: Response) => {
  metricsService.incrementHealth();
  metricsService.incrementRequest();
  res.status(200).json({
    status: 'ok',
    service: 'url-shortener',
    uptime: Math.floor(process.uptime()),
    startedAt: metricsService.startedAt(),
  });
});

// Readiness probe: service is ready to accept traffic
router.get('/ready', (_req: Request, res: Response) => {
  metricsService.incrementHealth();
  metricsService.incrementRequest();
  res.status(200).json({
    status: 'ok',
  });
});

// Liveness probe: process is still alive
router.get('/live', (_req: Request, res: Response) => {
  metricsService.incrementHealth();
  metricsService.incrementRequest();
  res.status(200).json({
    status: 'ok',
  });
});

export default router;
