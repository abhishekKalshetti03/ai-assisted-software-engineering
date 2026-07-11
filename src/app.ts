import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

import healthRouter from './routes/health';
import shortenRouter from './routes/shorten';
import { getAnalyticsById, getOriginalUrlById } from './database/db';

dotenv.config();

const app: Express = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'express-typescript-starter',
  });
});

app.use('/health', healthRouter);
app.use('/shorten', shortenRouter);

app.get('/analytics/:id', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const analytics = getAnalyticsById(id);

  if (!analytics) {
    return res.status(404).json({ error: 'Not found' });
  }

  return res.status(200).json(analytics);
});

app.get('/:id', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const originalUrl = getOriginalUrlById(id);

  if (!originalUrl) {
    return res.status(404).json({ error: 'Not found' });
  }

  return res.redirect(302, originalUrl);
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
