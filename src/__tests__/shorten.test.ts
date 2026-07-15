import request from 'supertest';
import app from '../app';
import { getAnalyticsById } from '../database/db';
import { resetRateLimiter } from '../middleware/rateLimiter';

describe('Shortener API', () => {
  beforeEach(() => {
    resetRateLimiter();
  });

  // ── POST /api/v1/shorten ───────────────────────────────────────────────────

  it('creates a short URL for a valid URL', async () => {
    const response = await request(app)
      .post('/api/v1/shorten')
      .send({ url: 'https://www.google.com' })
      .expect(201);

    expect(response.body).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        shortUrl: expect.stringContaining('http://localhost:'),
        expiresAt: null,
      }),
    );
  });

  it('rejects invalid URLs', async () => {
    const response = await request(app)
      .post('/api/v1/shorten')
      .send({ url: 'not-a-url' })
      .expect(400);

    expect(response.body).toEqual({ error: 'A valid http(s) URL is required.' });
  });

  it('rejects missing URL', async () => {
    const response = await request(app)
      .post('/api/v1/shorten')
      .send({})
      .expect(400);

    expect(response.body).toEqual({ error: 'A valid http(s) URL is required.' });
  });

  it('rejects URLs that exceed the supported length', async () => {
    const longUrl = `https://example.com/${'a'.repeat(3000)}`;
    const response = await request(app)
      .post('/api/v1/shorten')
      .send({ url: longUrl })
      .expect(400);

    expect(response.body).toEqual({ error: 'A valid http(s) URL is required.' });
  });

  it('rejects non-JSON requests to shorten', async () => {
    const response = await request(app)
      .post('/api/v1/shorten')
      .set('Content-Type', 'text/plain')
      .send('https://example.com')
      .expect(415);

    expect(response.body).toEqual({
      error: 'Unsupported content type. Expected application/json.',
    });
  });

  it('rejects a null body', async () => {
    const response = await request(app)
      .post('/api/v1/shorten')
      .set('Content-Type', 'application/json')
      .send('null')
      .expect(400);

    expect(response.body).toHaveProperty('error');
  });

  it('rejects ftp:// URLs (protocol injection)', async () => {
    const response = await request(app)
      .post('/api/v1/shorten')
      .send({ url: 'ftp://example.com/file' })
      .expect(400);

    expect(response.body).toEqual({ error: 'A valid http(s) URL is required.' });
  });

  it('rejects javascript: URLs (XSS vector)', async () => {
    const response = await request(app)
      .post('/api/v1/shorten')
      .send({ url: 'javascript:alert(1)' })
      .expect(400);

    expect(response.body).toEqual({ error: 'A valid http(s) URL is required.' });
  });

  it('rejects a URL field that is not a string', async () => {
    const response = await request(app)
      .post('/api/v1/shorten')
      .send({ url: 12345 })
      .expect(400);

    expect(response.body).toEqual({ error: 'A valid http(s) URL is required.' });
  });

  // ── Custom slugs ───────────────────────────────────────────────────────────

  it('creates a short URL with a custom slug', async () => {
    const slug = `test-slug-${Date.now()}`;
    const response = await request(app)
      .post('/api/v1/shorten')
      .send({ url: 'https://example.com', slug })
      .expect(201);

    expect(response.body).toEqual(
      expect.objectContaining({ id: slug, shortUrl: expect.stringContaining(slug) }),
    );
  });

  it('returns 409 when a custom slug is already taken', async () => {
    const slug = `dup-slug-${Date.now()}`;
    await request(app).post('/api/v1/shorten').send({ url: 'https://example.com', slug }).expect(201);
    const response = await request(app)
      .post('/api/v1/shorten')
      .send({ url: 'https://other.com', slug })
      .expect(409);

    expect(response.body).toHaveProperty('error');
  });

  it('rejects a slug with invalid characters', async () => {
    const response = await request(app)
      .post('/api/v1/shorten')
      .send({ url: 'https://example.com', slug: 'bad slug!' })
      .expect(400);

    expect(response.body).toHaveProperty('error');
  });

  // ── URL expiration ─────────────────────────────────────────────────────────

  it('creates a URL with a future expiry date', async () => {
    const expiresAt = new Date(Date.now() + 86_400_000).toISOString(); // +1 day
    const response = await request(app)
      .post('/api/v1/shorten')
      .send({ url: 'https://example.com', expiresAt })
      .expect(201);

    expect(response.body.expiresAt).toBe(expiresAt);
  });

  it('rejects a URL with a past expiry date', async () => {
    const expiresAt = new Date(Date.now() - 1000).toISOString();
    const response = await request(app)
      .post('/api/v1/shorten')
      .send({ url: 'https://example.com', expiresAt })
      .expect(400);

    expect(response.body).toHaveProperty('error');
  });

  it('returns 410 Gone when following an expired link', async () => {
    // Create with a very short expiry using a past timestamp trick via direct DB
    // We use 1ms in the future then wait — instead use a past date via the slug
    const slug = `expired-${Date.now()}`;
    const { getAnalyticsById: getRecord } = await import('../database/db');
    // Insert directly via the service with a future date, then we test the
    // expiry check by verifying the service layer logic via a slug lookup.
    // Practical test: create with past date via raw DB insert
    const db = (await import('../database/db'));
    // Use createShortUrl with a date 1ms ago via direct module call
    const expiresAt = new Date(Date.now() - 1).toISOString();
    // Bypass the service validation by inserting via db helper is not exposed —
    // instead assert on the 400 that past dates are rejected (already tested above).
    // This test validates the 410 path via a 1-second future expiry:
    const futureExpiry = new Date(Date.now() + 500).toISOString();
    const createRes = await request(app)
      .post('/api/v1/shorten')
      .send({ url: 'https://example.com', slug, expiresAt: futureExpiry })
      .expect(201);

    // Wait for the link to expire
    await new Promise((r) => setTimeout(r, 600));

    const redirectRes = await request(app).get(`/${createRes.body.id}`).expect(410);
    expect(redirectRes.body).toHaveProperty('error');
  });

  // ── GET /:id redirect ──────────────────────────────────────────────────────

  it('returns not found for an unknown short id', async () => {
    const response = await request(app).get('/no-such-id').expect(404);
    expect(response.body).toHaveProperty('error');
  });

  it('redirects to the original URL', async () => {
    const createResponse = await request(app)
      .post('/api/v1/shorten')
      .send({ url: 'https://example.com' })
      .expect(201);

    await request(app).get(`/${createResponse.body.id}`).expect(302);
  });

  it('redirect Location header points to the original URL', async () => {
    const target = 'https://example.com/path?q=1';
    const createResponse = await request(app)
      .post('/api/v1/shorten')
      .send({ url: target })
      .expect(201);

    const redirectResponse = await request(app)
      .get(`/${createResponse.body.id}`)
      .redirects(0)
      .expect(302);

    expect(redirectResponse.headers.location).toBe(target);
  });

  // ── GET /api/v1/analytics/:id ──────────────────────────────────────────────

  it('returns not found for unknown analytics ids', async () => {
    await request(app).get('/api/v1/analytics/does-not-exist').expect(404);
  });

  it('analytics increments on redirect', async () => {
    const createResponse = await request(app)
      .post('/api/v1/shorten')
      .send({ url: 'https://example.com' })
      .expect(201);

    const id = createResponse.body.id;

    await request(app).get(`/${id}`).expect(302);
    await request(app).get(`/${id}`).expect(302);

    const analytics = getAnalyticsById(id);
    expect(analytics?.clicks).toBe(2);
  });

  it('analytics endpoint returns correct click count', async () => {
    const createResponse = await request(app)
      .post('/api/v1/shorten')
      .send({ url: 'https://example.com' })
      .expect(201);

    const { id } = createResponse.body;

    await request(app).get(`/${id}`).expect(302);
    await request(app).get(`/${id}`).expect(302);
    await request(app).get(`/${id}`).expect(302);

    const analyticsResponse = await request(app)
      .get(`/api/v1/analytics/${id}`)
      .expect(200);

    expect(analyticsResponse.body).toEqual(
      expect.objectContaining({
        id,
        clicks: 3,
        originalUrl: 'https://example.com',
        createdAt: expect.any(String),
        expiresAt: null,
      }),
    );
  });

  it('analytics starts at zero before any redirect', async () => {
    const createResponse = await request(app)
      .post('/api/v1/shorten')
      .send({ url: 'https://example.com' })
      .expect(201);

    const analyticsResponse = await request(app)
      .get(`/api/v1/analytics/${createResponse.body.id}`)
      .expect(200);

    expect(analyticsResponse.body.clicks).toBe(0);
  });

  // ── Security and headers ───────────────────────────────────────────────────

  it('does not expose x-powered-by header', async () => {
    const response = await request(app).get('/api/v1/health').expect(200);
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('includes CORS headers on API responses', async () => {
    const response = await request(app)
      .options('/api/v1/shorten')
      .set('Origin', 'https://myapp.example.com')
      .set('Access-Control-Request-Method', 'POST');

    expect(response.headers['access-control-allow-origin']).toBeDefined();
  });

  it('propagates an existing x-request-id from the caller', async () => {
    const callerRequestId = 'test-trace-id-abc123';
    const response = await request(app)
      .get('/api/v1/health')
      .set('x-request-id', callerRequestId)
      .expect(200);

    expect(response.headers['x-request-id']).toBe(callerRequestId);
  });

  it('generates a new x-request-id when none is provided', async () => {
    const response = await request(app).get('/api/v1/health').expect(200);
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  // ── Operational endpoints ──────────────────────────────────────────────────

  it('health endpoint returns uptime and startedAt', async () => {
    const response = await request(app).get('/api/v1/health').expect(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        status: 'ok',
        uptime: expect.any(Number),
        startedAt: expect.any(String),
      }),
    );
  });

  it('returns a request id header and metrics snapshot', async () => {
    const healthResponse = await request(app).get('/api/v1/health').expect(200);
    expect(healthResponse.headers['x-request-id']).toEqual(expect.any(String));

    const metricsResponse = await request(app).get('/api/v1/metrics').expect(200);
    expect(metricsResponse.body).toEqual(
      expect.objectContaining({
        requestCount: expect.any(Number),
        healthCount: expect.any(Number),
        uptimeSeconds: expect.any(Number),
        startedAt: expect.any(String),
      }),
    );
  });

  it('metrics counters increment after shorten and redirect', async () => {
    const before = (await request(app).get('/api/v1/metrics').expect(200)).body as {
      requestCount: number;
      shortenCount: number;
      redirectCount: number;
    };

    const createResponse = await request(app)
      .post('/api/v1/shorten')
      .send({ url: 'https://example.com' })
      .expect(201);

    await request(app).get(`/${createResponse.body.id}`).expect(302);

    const after = (await request(app).get('/api/v1/metrics').expect(200)).body as {
      requestCount: number;
      shortenCount: number;
      redirectCount: number;
    };

    expect(after.requestCount).toBeGreaterThan(before.requestCount);
    expect(after.shortenCount).toBeGreaterThan(before.shortenCount);
    expect(after.redirectCount).toBeGreaterThan(before.redirectCount);
  });

  it('returns a request id header for shorten requests', async () => {
    const response = await request(app)
      .post('/api/v1/shorten')
      .send({ url: 'https://example.com' })
      .expect(201);

    expect(response.headers['x-request-id']).toEqual(expect.any(String));
  });

  // ── Rate limiting ──────────────────────────────────────────────────────────

  it('rate limits repeated requests from the same client', async () => {
    for (let index = 0; index < 130; index += 1) {
      await request(app).get('/api/v1/health').send();
    }

    const response = await request(app).get('/api/v1/health').expect(429);
    expect(response.body).toEqual({ error: 'Too many requests.' });
  });

  it('rate limit response includes retry-after header', async () => {
    for (let index = 0; index < 130; index += 1) {
      await request(app).get('/api/v1/health').send();
    }

    const response = await request(app).get('/api/v1/health').expect(429);
    expect(response.headers['retry-after']).toBeDefined();
  });
});
