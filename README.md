# URL Shortener Service

A production-ready URL shortener service built with Express, TypeScript, SQLite, and Jest.

## Overview

This is a scalable URL shortening service with the following capabilities:

- **URL Shortening:** Create short URLs with optional custom slugs and expiration dates
- **Redirects:** Redirect short URLs to original destinations with click tracking
- **Analytics:** View click counts and URL metadata
- **Health Checks:** Kubernetes-compatible health and readiness probes
- **Metrics:** Prometheus-compatible metrics endpoint (`/api/v1/metrics`) with request counters, latency histograms, and uptime
- **Security:** Rate limiting, CORS control, API key authentication, input validation, SSRF prevention
- **Production-Ready:** Structured JSON logging, graceful shutdown, database auto-migration, trust-proxy support
- **Scalability:** Redis-backed rate limiter for horizontal scaling
- **Testing:** Comprehensive test suite (70 integration tests)
- **Code Quality:** TypeScript strict mode, code coverage tracking, pre-commit hooks

## Quick Start

### Prerequisites

| Tool | Minimum Version | Check |
|------|-----------------|-------|
| Node.js | 18 | `node --version` |
| npm | 9 | `npm --version` |

### Installation & Setup

#### 1. Clone the repository

```bash
git clone <your-repo-url>
cd ai-assisted-software-engineering
```

#### 2. Install dependencies

```bash
npm install
```

#### 3. Build the application

```bash
npm run build
```

#### 4. Start the server (Development)

```bash
PORT=3000 npm start
```

Server runs on `http://localhost:3000`. Database file created at `data/shortener.db` automatically.

#### 5. Verify the server

```bash
curl http://localhost:3000/api/v1/health
```

Expected response:
```json
{"status":"ok","service":"url-shortener","uptime":10,"startedAt":"2026-07-15T08:00:00Z"}
```

### Testing

```bash
npm test
```

All 70 tests pass. Tests use actual Express app (no mocks).

### Development Mode (Live Reload)

```bash
npm run dev
```

Watches `src/` for changes and restarts automatically.

## API Examples

### Shorten a URL

```bash
curl -X POST http://localhost:3000/api/v1/shorten \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.example.com"}'
```

Response:
```json
{"id":"abc123","shortUrl":"http://localhost:3000/abc123","expiresAt":null}
```

### Shorten with Custom Slug & Expiration

```bash
curl -X POST http://localhost:3000/api/v1/shorten \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.example.com","slug":"my-link","expiresAt":"2026-12-31T23:59:59Z"}'
```

### Follow Redirect

```bash
curl -I http://localhost:3000/abc123
```

Response: `HTTP/1.1 302 Found` with `Location: https://www.example.com`

### Check Analytics

```bash
curl http://localhost:3000/api/v1/analytics/abc123
```

Response:
```json
{
  "id": "abc123",
  "originalUrl": "https://www.example.com",
  "totals": {
    "clicks": 1,
    "createdAt": "2026-07-15T08:50:00Z",
    "expiresAt": null
  },
  "timeseries": [{"date": "2026-07-15", "count": 1}],
  "topReferrers": [],
  "userAgentBreakdown": []
}
```

### View Metrics

```bash
curl http://localhost:3000/api/v1/metrics
```

Response (Prometheus text format, `Content-Type: text/plain; version=0.0.4`):
```
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",route="/api/v1/health",status="200"} 35
# HELP http_request_duration_seconds HTTP request latency in seconds
# TYPE http_request_duration_seconds histogram
# HELP shortener_urls_created_total Total number of URLs shortened
# TYPE shortener_urls_created_total counter
shortener_urls_created_total 10
# HELP shortener_redirects_total Total number of redirects served
# TYPE shortener_redirects_total counter
shortener_redirects_total 100
```

## Environment Variables

| Variable | Default | Required (Production) | Description |
|----------|---------|----------------------|-------------|
| `PORT` | `3000` | No | Server port |
| `BASE_URL` | `http://localhost:<PORT>` | **Yes** | Base URL for short links (must match public hostname) |
| `NODE_ENV` | `development` | No | Set to `production` for JSON logging and auth |
| `DB_PATH` | `data/shortener.db` | No | SQLite database file path |
| `RATE_LIMIT_MAX_REQUESTS` | `120` | No | Max requests per IP per window |
| `RATE_LIMIT_WINDOW_MS` | `60000` | No | Rate limit window in milliseconds |
| `RATE_LIMITER_BACKEND` | `memory` | No | Rate limiter backend: `memory` (single-instance) or `redis` (multi-instance) |
| `TRUST_PROXY` | `false` | No | Trust reverse proxy headers for real client IP (`true`, `1`, `loopback`, etc.) |
| `CORS_ORIGIN` | `*` | No | Allowed CORS origins (comma-separated) |
| `REDIS_URL` | unset | No | Redis URL for distributed rate limiting (requires `RATE_LIMITER_BACKEND=redis`) |
| `API_KEYS` | unset | No | Comma-separated API keys for production auth |

### Configuration File

Create `.env` in project root:

```
PORT=3000
BASE_URL=http://localhost:3000
NODE_ENV=development
RATE_LIMIT_MAX_REQUESTS=120
RATE_LIMIT_WINDOW_MS=60000
```

## Production Deployment

### Local Deployment (Single Instance)

```bash
BASE_URL="https://short.example.com" \
NODE_ENV="production" \
npm start
```

### Multi-Instance with Redis (Horizontal Scaling)

```bash
REDIS_URL="redis://localhost:6379" \
RATE_LIMITER_BACKEND="redis" \
BASE_URL="https://short.example.com" \
API_KEYS="prod-key-1,prod-key-2" \
NODE_ENV="production" \
npm start
```

### Docker

```bash
docker build -t url-shortener .
docker run -p 3000:3000 \
  -e BASE_URL="https://short.example.com" \
  -e NODE_ENV="production" \
  url-shortener
```

### With Docker Compose

Default (in-memory rate limiting):
```bash
docker-compose up
```

With Redis rate limiting:
```bash
docker-compose --profile redis up
```

## npm Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Development mode with live reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled server |
| `npm test` | Run test suite (70 tests) |
| `npm run coverage` | Run tests with coverage report (outputs to `coverage/`) |
| `npm run lint` | Type check without build |

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| `Cannot find module` on start | Missing build output | Run `npm run build` |
| `EADDRINUSE: address already in use` | Port 3000 taken | Use `PORT=3001 npm start` |
| `database disk image is malformed` | Corrupt SQLite file | Delete `data/shortener.db` and restart |
| Tests fail with `429 Too Many Requests` | Rate limiter state leaking | Run `npm test -- --runInBand` |
| `REDIS_URL connection failed` | Redis not running | Start Redis or switch to `RATE_LIMITER_BACKEND=memory` |
| `500 Authentication not properly configured` | `NODE_ENV=production` with no `API_KEYS` set | Set `API_KEYS` env var before deploying to production |
| `401 Missing x-api-key` in production | Auth required but no API key | Set `API_KEYS` env var in production |
| Git commit blocked by pre-commit hook | TypeScript errors in staged files | Run `npm run lint` to see errors |

## Documentation

- **[ARCHITECTURE.md](ARCHITECTURE.md)** — Design decisions and system architecture
- **[SRE.md](SRE.md)** — Reliability targets, SLOs, and incident runbook
- **[DEPLOYMENT.md](DEPLOYMENT.md)** — Deployment guidance
- **[RISK_ANALYSIS.md](RISK_ANALYSIS.md)** — Risk assessment and mitigations

## API Documentation

Full OpenAPI specification available in [docs/swagger.yaml](docs/swagger.yaml)
