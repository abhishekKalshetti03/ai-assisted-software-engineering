import { Router, type Request, type Response } from 'express';

import { createShortUrl } from '../database/db';

const router = Router();

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

router.post('/', (req: Request, res: Response) => {
  const { url } = req.body as { url?: string };

  if (typeof url !== 'string' || !isValidHttpUrl(url)) {
    return res.status(400).json({ error: 'A valid http(s) URL is required.' });
  }

  const { id, shortUrl } = createShortUrl(url, process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`);

  return res.status(201).json({
    id,
    shortUrl,
  });
});

export default router;
