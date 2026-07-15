import { Router, type Request, type Response } from 'express';
import { metricsService } from '../services/metricsService';

const router = Router();

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

export default router;
