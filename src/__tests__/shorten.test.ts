import request from 'supertest';
import app from '../app';
import { getAnalyticsById } from '../database/db';

describe('Shortener API', () => {
  it('creates a short URL for a valid URL', async () => {
    const response = await request(app)
      .post('/shorten')
      .send({ url: 'https://www.google.com' })
      .expect(201);

    expect(response.body).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        shortUrl: expect.stringContaining('http://localhost:'),
      }),
    );
  });

  it('rejects invalid URLs', async () => {
    const response = await request(app)
      .post('/shorten')
      .send({ url: 'not-a-url' })
      .expect(400);

    expect(response.body).toEqual({
      error: 'A valid http(s) URL is required.',
    });
  });

  it('rejects missing URL', async () => {
    const response = await request(app)
      .post('/shorten')
      .send({})
      .expect(400);

    expect(response.body).toEqual({
      error: 'A valid http(s) URL is required.',
    });
  });

  it('redirects to the original URL', async () => {
    const createResponse = await request(app)
      .post('/shorten')
      .send({ url: 'https://example.com' })
      .expect(201);

    const id = createResponse.body.id;

    await request(app).get(`/${id}`).expect(302);
  });

  it('analytics increments on redirect', async () => {
    const createResponse = await request(app)
      .post('/shorten')
      .send({ url: 'https://example.com' })
      .expect(201);

    const id = createResponse.body.id;

    await request(app).get(`/${id}`).expect(302);
    await request(app).get(`/${id}`).expect(302);

    const analytics = getAnalyticsById(id);
    expect(analytics?.clicks).toBe(2);
  });
});
