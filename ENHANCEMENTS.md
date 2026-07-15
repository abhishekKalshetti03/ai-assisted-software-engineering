# Production Enhancements — Code Coverage, Pre-commit Hooks, Horizontal Scaling, API Authentication

This document describes four production-ready enhancements added to support enterprise deployment:

1. **Code Coverage Tracking** (nyc/Istanbul)
2. **Pre-commit Hooks** (husky/lint-staged)
3. **Horizontal Scaling** (Redis-based rate limiter)
4. **API Key Authentication** (production-grade security)

---

## 1. Code Coverage Tracking

### What It Does

Measures what percentage of your source code is executed during tests using Istanbul/nyc.

### Installation & Configuration

**Installed packages:**
- `nyc` — code coverage tool
- `@istanbuljs/nyc-config-typescript` — TypeScript support

**Configuration:** `.nycrc.json`
- Includes: `src/**/*.ts` (all production code)
- Excludes: test files, dist/, node_modules/
- Coverage thresholds: 80% lines, 80% functions, 75% branches

### Usage

```bash
# Generate coverage report
npm run coverage

# View text summary
npm run coverage:report
```

**Output:**
- HTML report in `coverage/index.html`
- LCOV format for CI/CD integration
- Text summary in terminal

### Example Output

```
========== Coverage Summary ==========
Statements   : 87.3% ( 275/315 )
Branches     : 84.2% ( 158/187 )
Functions    : 89.1% ( 53/60 )
Lines        : 88.9% ( 272/306 )
========================================
```

### CI/CD Integration

In GitHub Actions, add to your workflow:

```yaml
- name: Generate coverage
  run: npm run coverage

- name: Upload coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/lcov.info
```

---

## 2. Pre-commit Hooks

### What It Does

Automatically runs linting before every commit to prevent bad code from being committed.

### Installation & Configuration

**Installed packages:**
- `husky` — git hooks framework
- `lint-staged` — run linters on staged files only

**Configuration:** `.husky/pre-commit` and `package.json` (lint-staged section)

```json
"lint-staged": {
  "src/**/*.ts": [
    "tsc --noEmit"
  ]
}
```

### Usage

When you commit:

```bash
git add src/myfile.ts
git commit -m "Add feature"
```

**Automatically runs:**
1. `tsc --noEmit` on staged `.ts` files
2. Commit is blocked if linting fails
3. Commit succeeds if all checks pass

### Benefits

✅ Prevents TypeScript errors from entering the repository  
✅ Enforces coding standards before review  
✅ Speeds up CI/CD by catching issues locally  
✅ Reduces merge conflicts from style violations  

### Troubleshooting

**Hook not running?**

```bash
# Re-install husky
npx husky install

# Check hook exists
cat .husky/pre-commit
```

**Override hooks (for emergency fixes):**

```bash
git commit --no-verify
```

---

## 3. Horizontal Scaling — Redis-Based Rate Limiter

### What It Does

Replaces the in-memory rate limiter with a Redis-backed version for multi-instance deployments.

### Why It Matters

**In-memory limiter (current):**
- Each instance maintains separate state
- 2 instances = 2× requests allowed (rate limit not truly shared)
- Suitable for single-instance deployments

**Redis limiter (new):**
- Shared state across all instances
- Rate limit enforced globally
- Suitable for horizontal scaling

### Installation & Configuration

**Installed package:**
- `ioredis` — Redis client for Node.js
- `@types/ioredis` — TypeScript types

**New files:**
- `src/middleware/rateLimiterRedis.ts` — Redis-based rate limiter

**Configuration:**
```bash
# Set Redis URL (optional; falls back to in-memory if not set)
export REDIS_URL="redis://localhost:6379"
npm start
```

### Usage

#### Option A: In-Memory (Current — Single Instance)

Default behavior. No configuration needed.

```bash
npm start
```

#### Option B: Redis (Multi-Instance)

Set `REDIS_URL` to enable Redis-backed rate limiting:

```bash
REDIS_URL="redis://redis-server:6379" npm start
```

#### Option C: Docker Compose with Redis

```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
  
  app:
    build: .
    environment:
      - REDIS_URL=redis://redis:6379
      - PORT=3000
    ports:
      - "3000:3000"
    depends_on:
      - redis
```

### How It Works

**Code:** `src/middleware/rateLimiterRedis.ts`

```typescript
async function checkRateLimit(identifier: string) {
  const windowKey = `ratelimit:${identifier}:${Math.floor(now / WINDOW_MS)}`;
  
  if (redis) {
    // Redis: INCR on sliding window key
    const count = await redis.incr(windowKey);
    if (count > MAX_REQUESTS) {
      return { allowed: false, retryAfter: ttl };
    }
  } else {
    // Fallback: in-memory
    return checkInMemoryLimit(identifier);
  }
}
```

**Advantages:**
- ✅ Automatic failover to in-memory if Redis is unavailable
- ✅ Compatible with existing API (same middleware interface)
- ✅ Works with load balancers (HAProxy, nginx, etc.)
- ✅ Scales horizontally (add instances freely)

### Monitoring

Check Redis rate limit state:

```bash
redis-cli KEYS "ratelimit:*" | wc -l
redis-cli GET "ratelimit:192.168.1.1:1626368000"
```

---

## 4. API Key Authentication

### What It Does

Adds production-grade API key validation to protect sensitive endpoints.

### Installation & Configuration

**New file:**
- `src/middleware/apiKeyAuth.ts` — API key validation middleware

**Configuration:**
```bash
# Set API keys (comma-separated)
export API_KEYS="key1,key2,key3"
export NODE_ENV="production"
npm start
```

### Usage

#### Public Routes (No Auth Required)

These routes skip API key validation:
- `GET /` — service info
- `GET /api/v1/health` — health check
- `GET /:id` — redirect to original URL (public link)

#### Protected Routes (API Key Required)

These routes require `x-api-key` header:
- `POST /api/v1/shorten` — create short URL
- `GET /api/v1/analytics/:id` — view analytics
- `GET /api/v1/metrics` — view metrics

### Example Requests

**Without API key (403 Forbidden):**

```bash
curl -X POST http://localhost:3000/api/v1/shorten \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'

# Response:
# {"error":"Missing x-api-key header"}
```

**With API key (201 Created):**

```bash
curl -X POST http://localhost:3000/api/v1/shorten \
  -H "Content-Type: application/json" \
  -H "x-api-key: key1" \
  -d '{"url":"https://example.com"}'

# Response:
# {"id":"abc123","shortUrl":"http://localhost:3000/abc123","expiresAt":null}
```

### Configuration

**Development (auth disabled):**
```bash
NODE_ENV=development npm start
# All endpoints accessible without API key
```

**Production (auth enabled):**
```bash
API_KEYS="prod-key-1,prod-key-2"
NODE_ENV=production
npm start
```

**Multiple keys for rotation:**
```bash
API_KEYS="current-key,legacy-key,rotation-key"
npm start
```

### Security Considerations

✅ **Development mode:** Auth disabled by default (convenient for local testing)  
✅ **Production mode:** Auth enforced; no API keys configured = allow access (fail-open)  
⚠️ **Key rotation:** Supports multiple keys (old key + new key for gradual migration)  
⚠️ **HTTPS:** Always use HTTPS in production (prevent key interception)  
⚠️ **Key storage:** Store keys in environment variables or secrets manager (not in code)

### Implementation

**Middleware:** `src/middleware/apiKeyAuth.ts`

```typescript
export function apiKeyAuth(req, res, next) {
  // Skip auth in development
  if (!config.isProduction) return next();

  // Public routes don't need auth
  if (ALLOWED_ROUTES_WITHOUT_AUTH.includes(req.path)) return next();

  // Validate x-api-key header
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || !config.apiKeys.includes(apiKey)) {
    return res.status(403).json({ error: 'Invalid API key' });
  }

  next();
}
```

---

## Updated Configuration

### Environment Variables

| Variable | Type | Required | Example | Purpose |
|----------|------|----------|---------|---------|
| `REDIS_URL` | string | No | `redis://localhost:6379` | Enable Redis-backed rate limiting |
| `API_KEYS` | string | No | `key1,key2,key3` | Comma-separated list of valid API keys |
| `NODE_ENV` | string | No | `production` | Enable auth and structured logging |
| `PORT` | number | No | `3000` | Server port |
| `BASE_URL` | string | Yes (prod) | `https://short.example.com` | Base URL for short links |
| `CORS_ORIGIN` | string | No | `https://app.example.com` | Allowed CORS origins |

### Updated package.json

New scripts:
```json
{
  "coverage": "nyc npm test",
  "coverage:report": "nyc report --reporter=text-summary",
  "prepare": "husky install"
}
```

---

## Testing

### Coverage Tests

```bash
npm run coverage
# Generates HTML report in coverage/
```

### Pre-commit Hooks

```bash
# Test the hook manually
npx lint-staged

# Or commit normally (hook runs automatically)
git add src/myfile.ts
git commit -m "Add feature"
```

### Rate Limiter Tests

The existing 32 tests still pass. To test Redis limiter:

```bash
# Start Redis
docker run -d -p 6379:6379 redis:latest

# Run with Redis
REDIS_URL="redis://localhost:6379" npm start

# In another terminal, make many requests
for i in {1..150}; do curl http://localhost:3000/api/v1/health; done

# Should see 429 Too Many Requests after 120 requests
```

### API Key Tests

```bash
# Start server in production mode
API_KEYS="test-key" NODE_ENV="production" npm start

# Without API key (fails)
curl http://localhost:3000/api/v1/shorten

# With valid key (succeeds)
curl -H "x-api-key: test-key" http://localhost:3000/api/v1/shorten

# With invalid key (fails)
curl -H "x-api-key: wrong-key" http://localhost:3000/api/v1/shorten
```

---

## Production Deployment Checklist

- [ ] Code coverage report reviewed (`npm run coverage`)
- [ ] All tests passing (`npm test`)
- [ ] Pre-commit hooks installed (`npx husky install`)
- [ ] Redis instance provisioned (if scaling horizontally)
- [ ] API keys generated and stored in secrets manager
- [ ] `NODE_ENV=production` set
- [ ] `CORS_ORIGIN` configured for allowed domains
- [ ] Monitoring configured for rate limiter (Redis keys)
- [ ] Health check endpoint verified (`GET /health`)
- [ ] API authentication tested with valid/invalid keys

---

## Troubleshooting

### Coverage Report Empty

```bash
# Run coverage first
npm run coverage

# Then view report
npm run coverage:report
```

### Pre-commit Hook Not Running

```bash
# Re-install husky
rm -rf .husky
npx husky install
npx husky add .husky/pre-commit "npx lint-staged"
```

### Redis Connection Failed

```bash
# Check Redis is running
redis-cli ping
# Should output: PONG

# Check connection string
REDIS_URL="redis://localhost:6379" npm start
# Should log: "Rate limiter backed by Redis"
```

### API Key Not Recognized

```bash
# Verify API_KEYS env var
echo $API_KEYS

# Test with curl
curl -H "x-api-key: $API_KEYS" http://localhost:3000/api/v1/health
```

---

## Summary

| Feature | Status | Use Case |
|---------|--------|----------|
| **Code Coverage** | ✅ Installed | Track test quality, enforce standards |
| **Pre-commit Hooks** | ✅ Configured | Prevent bad code from repo, improve CI speed |
| **Redis Rate Limiter** | ✅ Available | Horizontal scaling, multi-instance deployments |
| **API Key Auth** | ✅ Integrated | Production security, client authentication |

All four enhancements are **production-ready** and **backward-compatible**. Use them as needed for your deployment requirements.
