# Architecture

## 1. System Overview

The URL shortener is a **production-oriented Express + TypeScript service** with a **layered, modular architecture** designed for clarity, maintainability, and testability.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        HTTP Clients                              │
│         (Browser, curl, REST clients, mobile apps)              │
└────────────────┬────────────────────────────────────────────────┘
                 │ HTTP Requests
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Express Server Layer                         │
│  (src/server.ts, src/app.ts)                                    │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │           Middleware Chain (Ordered)                     │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ 1. Helmet (Security headers)                            │   │
│  │ 2. CORS (Cross-origin requests)                         │   │
│  │ 3. Morgan (Access logging)                              │   │
│  │ 4. Request ID (Tracing)                                 │   │
│  │ 5. Rate Limiter (Per-IP throttling)                     │   │
│  │ 6. API Key Auth (Production auth)                       │   │
│  │ 7. Request Logger (Structured logging)                  │   │
│  │ 8. Body Parser (JSON parsing, 100KB limit)              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │           Route Handlers                                 │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ GET  /              → Service info endpoint             │   │
│  │ POST /api/v1/shorten      → Shorten URL                │   │
│  │ GET  /:id           → Redirect to original URL          │   │
│  │ GET  /api/v1/analytics/:id → Get analytics             │   │
│  │ GET  /api/v1/health        → Health check              │   │
│  │ GET  /api/v1/metrics       → Metrics data              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │      Global Error Handler                               │   │
│  │  (Catches exceptions, returns 400/404/409/410/500)      │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────┬────────────────────────────────────────────────┘
                 │ Business Logic Delegation
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Service Layer (Business Logic)                  │
│  (src/services/)                                                 │
│                                                                   │
│  ┌──────────────────────┐  ┌──────────────────────┐             │
│  │   urlService.ts      │  │  metricsService.ts   │             │
│  ├──────────────────────┤  ├──────────────────────┤             │
│  │ shortenUrl()         │  │ incrementRequest()   │             │
│  │ redirectUrl()        │  │ incrementShorten()   │             │
│  │ getAnalytics()       │  │ getMetrics()         │             │
│  │                      │  │                      │             │
│  │ Validations:         │  │ In-memory counters   │             │
│  │ - URL format         │  │ tracking:            │             │
│  │ - Slug uniqueness    │  │ - Total requests     │             │
│  │ - Expiration date    │  │ - Shorten operations │             │
│  └──────────────────────┘  └──────────────────────┘             │
└────────────────┬────────────────────────────────────────────────┘
                 │ Database Queries
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Database Layer (Persistence)                    │
│  (src/database/db.ts)                                            │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │           SQLite Database                                │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ Table: urls                                             │   │
│  │ ┌──────────────────────────────────────────────────┐   │   │
│  │ │ id TEXT PRIMARY KEY (e.g., "abc123")            │   │   │
│  │ │ original_url TEXT (e.g., "https://example.com") │   │   │
│  │ │ click_count INTEGER DEFAULT 0                   │   │   │
│  │ │ created_at TEXT (ISO 8601 timestamp)            │   │   │
│  │ │ expires_at TEXT (optional, ISO 8601)            │   │   │
│  │ └──────────────────────────────────────────────────┘   │   │
│  │                                                          │   │
│  │ Indexes:                                                │   │
│  │ - idx_urls_created_at (for sorting)                    │   │
│  │ - idx_urls_expires_at (for expiration cleanup)         │   │
│  │                                                          │   │
│  │ File Location: ./data/shortener.db                      │   │
│  │ (Auto-created on startup if missing)                    │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Layered Architecture

### Layer 1: Entry Point (src/server.ts, src/app.ts)

**Responsibility**: Initialize Express server and configure middleware

**Key Components**:
- `server.ts`: Creates HTTP server, handles startup/shutdown, listens on PORT
- `app.ts`: Configures Express app with middleware chain and routes

**Exports**:
- `app`: Configured Express application
- `startServer()`: Async function to initialize and listen

**Error Handling**:
- Catches unhandled exceptions at process level
- Gracefully shuts down on SIGTERM/SIGINT
- Closes database connections on shutdown

---

### Layer 2: Middleware Chain (src/middleware/)

**Responsibility**: Intercept and process HTTP requests before route handlers

**Execution Order** (must be exact):
```
1. helmet()                 - Security headers (14+)
2. cors()                   - CORS origin validation
3. morgan()                 - HTTP access logging
4. requestIdMiddleware()    - Generate unique request ID
5. rateLimiter()            - Per-IP request throttling
6. apiKeyAuth()             - API key validation (prod only)
7. requestLogger()          - Structured request logging
8. express.json()           - Parse JSON body (100KB limit)
9. express.urlencoded()     - Parse form data
```

**Key Middleware**:

1. **Helmet** (src/app.ts)
   - Adds 14+ security headers
   - Removes x-powered-by
   - Sets CSP, X-Frame-Options, etc.

2. **CORS** (src/app.ts)
   - Configurable via CORS_ORIGIN env
   - Default: '*' (dev), requires list (prod)

3. **Morgan** (src/app.ts)
   - Logs HTTP method, path, status, duration
   - Used for debugging and monitoring

4. **Request ID** (src/middleware/requestId.ts)
   - Generates unique ID per request (UUID)
   - Stores in `req.id` and x-request-id header
   - Used for request tracing across logs

5. **Rate Limiter** (src/middleware/rateLimiter.ts)
   - In-memory Map tracking per-IP requests
   - Default: 120 requests per 60 seconds
   - Returns 429 Too Many Requests when exceeded
   - Retry-After header with seconds to reset
   - Test isolation: `resetRateLimiter()` clears buckets
   - Optional: Redis backend via `rateLimiterRedis.ts`

6. **API Key Auth** (src/middleware/apiKeyAuth.ts)
   - Production-only (NODE_ENV=production)
   - Checks x-api-key header
   - Public routes bypass auth: /, /health, GET /:id
   - Protected routes require valid key:
     - POST /api/v1/shorten
     - GET /api/v1/analytics/:id
     - GET /api/v1/metrics

7. **Request Logger** (src/middleware/requestLogger.ts)
   - Structured JSON logging (production)
   - Human-readable format (development)
   - Logs: method, path, status, duration, requestId

---

### Layer 3: Routing (src/routes/)

**Responsibility**: Map HTTP requests to handlers

**Routes**:

1. **GET /** → Service Info
   - Returns: Feature list, API version
   - No auth required
   - No rate limiting (public)

2. **POST /api/v1/shorten** → Shorten URL
   - Auth: Required in production
   - Rate limited: Yes
   - Request body:
     ```json
     {
       "url": "https://example.com",
       "slug": "optional-slug",
       "expiresAt": "2026-12-31T23:59:59Z"
     }
     ```
   - Response (201 Created):
     ```json
     {
       "id": "abc123",
       "shortUrl": "http://localhost:3000/abc123",
       "expiresAt": null
     }
     ```
   - Errors:
     - 400: Invalid URL format, slug format, expiration
     - 409: Duplicate slug
     - 429: Rate limit exceeded

3. **GET /:id** → Redirect to Original URL
   - Auth: Bypass (public redirect)
   - Rate limited: No (bypass for redirects)
   - Returns: 302 Found with Location header
   - Cache-Control: no-store (disable caching)
   - Errors:
     - 404: Short URL not found
     - 410: URL has expired

4. **GET /api/v1/analytics/:id** → Get Analytics
   - Auth: Required in production
   - Rate limited: Yes
   - Response (200 OK):
     ```json
     {
       "id": "abc123",
       "originalUrl": "https://example.com",
       "clicks": 42,
       "createdAt": "2026-01-01T00:00:00Z",
       "expiresAt": null
     }
     ```
   - Errors:
     - 404: Short URL not found

5. **GET /api/v1/health** → Health Check
   - Auth: Bypass (public)
   - Rate limited: No (for K8s probes)
   - Response (200 OK):
     ```json
     {
       "status": "healthy",
       "timestamp": "2026-07-15T21:00:00Z"
     }
     ```

6. **GET /api/v1/metrics** → Metrics
   - Auth: Required in production
   - Rate limited: Yes
   - Response (200 OK):
     ```json
     {
       "requests": 1024,
       "shortenOperations": 256,
       "redirects": 768
     }
     ```

---

### Layer 4: Services (src/services/)

**Responsibility**: Business logic and validation

**urlService.ts** (Main service)

Functions:
- `shortenUrl(url, baseUrl, options?)` → ShortenResult
  - Validates URL, slug, expiration
  - Generates unique ID
  - Inserts into database
  - Returns { id, shortUrl, expiresAt }
  
- `redirectUrl(id)` → { originalUrl }
  - Validates ID format
  - Checks if expired
  - Increments click count
  - Returns record for redirect
  
- `getAnalytics(id)` → AnalyticsResult
  - Retrieves record from database
  - Returns click count + metadata

Validation Functions (explicit AI prompts):
- `isValidHttpUrl(value)` → boolean
  - Checks: protocol (http/https), length (≤2048), hostname
  
- `isValidSlug(value)` → boolean
  - Checks: format (alphanumeric + hyphens), length (1-50)
  
- `isValidId(value)` → boolean
  - Checks: format (alphanumeric + hyphens), not empty
  
- `isExpired(expiresAt)` → boolean
  - Compares: expiresAt < now

Error Types:
- ValidationError (400): Format/length issues
- NotFoundError (404): Resource doesn't exist
- ConflictError (409): Duplicate slug
- GoneError (410): URL expired

**metricsService.ts** (Telemetry)

Functions:
- `incrementRequest()` → void (called per HTTP request)
- `incrementShorten()` → void (called per shorten operation)
- `getMetrics()` → { requests, shortenOperations, redirects }

Implementation:
- In-memory counters (not persistent)
- Resets on server restart
- Used for monitoring and debugging

---

### Layer 5: Database (src/database/db.ts)

**Responsibility**: Data persistence and queries

**Connection Settings**:
- File-based: ./data/shortener.db
- WAL mode: Write-ahead logging (concurrent reads/writes)
- busy_timeout: 5000ms (wait for locks)
- cache_size: 20MB (performance)
- mmap_size: 128MB (memory-mapped I/O)
- foreign_keys: ON (referential integrity)

**Schema**:
```sql
CREATE TABLE urls (
  id TEXT PRIMARY KEY,
  original_url TEXT NOT NULL,
  click_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT
);

CREATE INDEX idx_urls_created_at ON urls(created_at);
CREATE INDEX idx_urls_expires_at ON urls(expires_at);
```

**Key Functions**:
- `createShortUrlRecord(url, baseUrl, options)` → ShortenResult
  - Inserts new record
  - Returns short URL

- `getOriginalUrlRecordById(id)` → UrlRecord | null
  - Queries single record
  - Used for redirects

- `incrementClickCount(id)` → void
  - Updates click_count
  - Atomic operation

- `getAnalyticsRecordById(id)` → AnalyticsRecord | null
  - Retrieves record with metadata
  - Used for analytics endpoint

- `slugExists(slug)` → boolean
  - Checks database for duplicate
  - Used during shorten validation

**Auto-Migration**:
- On startup, checks if expires_at column exists
- If missing, runs: `ALTER TABLE urls ADD COLUMN expires_at TEXT`
- Ensures backward compatibility with old databases

---

### Layer 6: Configuration (src/config.ts)

**Responsibility**: Environment validation and centralized config

**Configuration Parameters**:

| Variable | Type | Default | Production | Description |
|----------|------|---------|------------|-------------|
| PORT | number | 3000 | Required | Server port (1-65535) |
| BASE_URL | string | http://localhost:3000 | Required | Base URL for short links |
| NODE_ENV | string | development | - | Environment mode |
| DB_PATH | string | ./data/shortener.db | - | SQLite file location |
| RATE_LIMIT_MAX_REQUESTS | number | 120 | - | Requests per window |
| RATE_LIMIT_WINDOW_MS | number | 60000 | - | Window duration (ms) |
| CORS_ORIGIN | string/array | '*' | list | Allowed origins |
| REDIS_URL | string | undefined | optional | Redis connection (optional) |
| API_KEYS | string | undefined | optional | Comma-separated API keys |

**Validation Strategy** (Fail-fast):
- Invalid config causes `process.exit(1)` before server starts
- PORT range checked: 1-65535
- BASE_URL required in production (fail if missing)
- CORS_ORIGIN parsed as comma-separated list
- API_KEYS parsed as comma-separated array

**Example**:
```bash
# Development
PORT=3000 npm start

# Production
PORT=8080 \
  BASE_URL=https://short.example.com \
  NODE_ENV=production \
  API_KEYS=key1,key2,key3 \
  npm start
```

---

### Layer 7: Error Handling (src/utils/errors.ts)

**Responsibility**: Consistent error responses

**Error Hierarchy**:
```
AppError (base, status 500)
├── ValidationError (400)
├── NotFoundError (404)
├── ConflictError (409)
└── GoneError (410)
```

**Error Response Format**:
```json
{
  "error": "User-friendly message",
  "code": "MACHINE_READABLE_CODE",
  "status": 400
}
```

**HTTP Status Codes**:
- **400 Bad Request**: Input validation failed
  - Examples: Invalid URL, slug too long, past expiration date
  - Error class: ValidationError
  
- **404 Not Found**: Resource doesn't exist
  - Examples: Short URL ID not in database
  - Error class: NotFoundError
  
- **409 Conflict**: Resource state conflict
  - Examples: Duplicate slug
  - Error class: ConflictError
  
- **410 Gone**: Resource expired
  - Examples: URL link expired
  - Error class: GoneError
  - Semantics: Resource existed but is now permanently unavailable
  
- **429 Too Many Requests**: Rate limit exceeded
  - Returned by: rateLimiter middleware
  - Header: Retry-After (seconds)
  
- **500 Internal Server Error**: Unexpected server error
  - Never exposes stack trace to client (security)
  - Logged server-side for debugging

**Global Error Handler** (src/app.ts):
```typescript
app.use((err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  // Unknown errors → 500
  return res.status(500).json({ error: 'Internal server error' });
});
```

---

## 3. Data Flow

### Shorten URL Request Flow

```
1. HTTP POST /api/v1/shorten
   └─> Request body: { url, slug?, expiresAt? }

2. Middleware Chain:
   ├─> Helmet: Add security headers
   ├─> CORS: Validate origin
   ├─> Morgan: Log request
   ├─> Request ID: Generate x-request-id
   ├─> Rate Limiter: Check per-IP limit
   ├─> API Key Auth: Validate API key (prod only)
   ├─> Request Logger: Log structured data
   └─> Body Parser: Parse JSON

3. Route Handler (src/routes/shorten.ts):
   ├─> Check request.body exists
   ├─> Extract { url, slug, expiresAt }
   └─> Call urlService.shortenUrl()

4. Service Layer (src/services/urlService.ts):
   ├─> Validate URL (protocol, length, hostname)
   ├─> Validate slug if provided (format, length, uniqueness)
   ├─> Validate expiration if provided (ISO 8601, future)
   └─> Call db.createShortUrlRecord()

5. Database Layer (src/database/db.ts):
   ├─> Generate random ID
   ├─> INSERT into urls table
   ├─> Return { id, shortUrl, expiresAt }
   └─> Metrics: increment shorten counter

6. Response (201 Created):
   └─> { id, shortUrl, expiresAt }
```

### Redirect Request Flow

```
1. HTTP GET /:id
   └─> URL path: /abc123

2. Middleware Chain (bypass rate limiter, auth):
   ├─> Helmet, CORS, Morgan, Request ID
   ├─> Request Logger
   └─> Body Parser (not needed)

3. Route Handler:
   └─> Call urlService.redirectUrl(id)

4. Service Layer:
   ├─> Validate ID format
   ├─> Query database for record
   ├─> Check if expired
   ├─> Increment click_count
   └─> Return originalUrl

5. Database Layer:
   ├─> SELECT from urls WHERE id = ?
   ├─> UPDATE click_count
   └─> Return record

6. Response (302 Found):
   ├─> Location: https://example.com
   └─> Cache-Control: no-store
```

### Analytics Request Flow

```
1. HTTP GET /api/v1/analytics/:id
   └─> URL path: /api/v1/analytics/abc123

2. Middleware Chain:
   ├─> Helmet, CORS, Morgan, Request ID
   ├─> Rate Limiter (check per-IP)
   ├─> API Key Auth (validate key)
   ├─> Request Logger
   └─> Body Parser

3. Route Handler:
   └─> Call urlService.getAnalytics(id)

4. Service Layer:
   ├─> Validate ID format
   └─> Query database

5. Database Layer:
   └─> SELECT * FROM urls WHERE id = ?

6. Response (200 OK):
   └─> { id, originalUrl, clicks, createdAt, expiresAt }
```

---

## 4. Request Processing

### Request Context

Each request flows through:

1. **Entry**: HTTP request arrives at Express
2. **Middleware**: Processed by 9 middleware in order
3. **Routing**: Matched to route handler
4. **Validation**: Input validated in service layer
5. **Processing**: Business logic executes
6. **Persistence**: Data written to SQLite
7. **Response**: JSON returned to client
8. **Tracking**: Metrics updated

### Request Isolation

- Each request gets unique ID (x-request-id)
- Request context maintained via Express locals
- Rate limiting per IP (not per user)
- Metrics tracked globally (not per request)

### Request Timeout

- Default: No timeout configured
- Database queries: busy_timeout = 5000ms
- Body parsing: 100KB limit enforced

---

## 5. Validation Strategy

### Input Validation (4 layers)

1. **Body Parser Layer**
   - Max size: 100KB
   - Content-Type: application/json
   - Rejects if not valid JSON

2. **Route Handler Layer**
   - Body existence check
   - Type check (must be object)

3. **Service Layer** (Main validation)
   - URL validation (protocol, length, hostname)
   - Slug validation (format, length, uniqueness)
   - Expiration validation (ISO 8601, future)

4. **Database Layer**
   - Constraint enforcement (PRIMARY KEY, NOT NULL)
   - Transaction atomicity

### Validation Rules

**URL Input** (from AI prompt):
```
- Protocol: http or https only
- Length: max 2048 characters
- Hostname: must be present
- Valid format: must parse via URL constructor
```

**Custom Slug** (from AI prompt):
```
- Format: alphanumeric + hyphens only (^[a-z0-9-]+$i)
- Length: 1-50 characters
- Uniqueness: must not exist in database
```

**Expiration** (from AI prompt):
```
- Format: ISO 8601 datetime (e.g., "2026-12-31T23:59:59Z")
- Value: must be a future date (not past, not now)
- Timezone: accepts Z or +/- offset notation
```

### Error Messages (User-friendly)

```
"A valid http(s) URL is required."
"Slug must be 1–50 characters and contain only letters, numbers, and hyphens."
"A link with slug "xyz" already exists."
"expiresAt must be a valid ISO 8601 date string."
"expiresAt must be a future date."
"Short URL not found."
"This link has expired."
```

---

## 6. Security Architecture

### Defense Layers

1. **HTTP Headers** (Helmet)
   - X-Content-Type-Options: nosniff
   - X-Frame-Options: DENY
   - X-XSS-Protection: 1; mode=block
   - Strict-Transport-Security (HSTS)

2. **Input Validation**
   - URL format validation (prevent XSS)
   - Slug format validation (alphanumeric only)
   - Expiration date validation
   - Body size limit (100KB, prevent DoS)

3. **Rate Limiting**
   - Per-IP throttling (120/60s default)
   - Prevents brute force attacks
   - Returns 429 with Retry-After header

4. **API Key Authentication** (Production)
   - Required header: x-api-key
   - Validated against configured keys
   - Public routes bypass (/, /health, redirects)
   - Protected routes require key (shorten, analytics, metrics)

5. **CORS**
   - Configurable origin (env-based)
   - Default: * (dev), list (prod)
   - Prevents unauthorized cross-origin requests

6. **Database**
   - Parameterized queries (prevent SQL injection)
   - Transactions atomic (prevent data corruption)
   - Foreign keys enabled (referential integrity)

7. **Logging**
   - Structured JSON logging (prod)
   - No sensitive data logged (passwords, keys)
   - Request IDs for audit trail

---

## 7. Testing Architecture

### Test Structure (src/__tests__/shorten.test.ts)

**Test Categories** (54 total tests):

1. **Input Validation** (16 tests)
   - Valid URLs (HTTP, HTTPS, with query, with port)
   - Invalid URLs (FTP, no hostname, > 2048 chars)
   - Valid slugs, invalid slugs, duplicates
   - Null/undefined body handling

2. **Expiration** (3 tests)
   - Valid future dates
   - Past dates rejected
   - Invalid ISO format

3. **Redirects** (3 tests)
   - Valid redirect (302)
   - Expired URL (410)
   - Missing URL (404)

4. **Analytics** (4 tests)
   - Retrieve valid analytics
   - Missing URL (404)
   - Click count increments
   - Expiration tracking

5. **Security** (4 tests)
   - Security headers present
   - X-Powered-By removed
   - CORS headers
   - X-Request-ID tracking

6. **Headers** (2 tests)
   - Cache-Control: no-store (redirects)
   - CORS headers

7. **Operations** (5 tests)
   - Service info endpoint
   - Health check
   - Metrics endpoint
   - Request tracking
   - Rate limiting

### Test Setup

```typescript
beforeEach(() => {
  resetRateLimiter(); // Isolate rate limit state
});

afterAll(async () => {
  await app.close(); // Clean shutdown
});
```

### Test Execution

```bash
npm test                    # Run all tests
npm run test:coverage      # With coverage report
npm test -- --watch       # Watch mode
npm test -- shorten.test   # Single file
```

**Coverage Target**: 80% (current: 87.38%)

---

## 8. Deployment Architecture

### Local Development

```bash
npm install
npm run build      # Compile TypeScript
npm start         # Start server
npm test          # Run tests
```

**Environment**: development (default)

### Docker Deployment

```dockerfile
# Multi-stage build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
EXPOSE 3000
CMD ["npm", "start"]
```

**Benefits**:
- Smaller image (alpine base)
- Multi-stage (excludes build tools)
- Production-ready

### Docker Compose

```yaml
version: '3'
services:
  api:
    build: .
    ports: [3000:3000]
    environment:
      PORT: 3000
      BASE_URL: http://localhost:3000
      NODE_ENV: production
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/v1/health"]
      interval: 10s
      timeout: 5s
  
  redis:
    image: redis:7-alpine
    ports: [6379:6379]
    (optional for distributed rate limiting)
```

### Environment Configuration

**Development**:
```bash
NODE_ENV=development
PORT=3000
BASE_URL=http://localhost:3000
CORS_ORIGIN=*
```

**Production**:
```bash
NODE_ENV=production
PORT=8080
BASE_URL=https://short.example.com
CORS_ORIGIN=https://example.com,https://www.example.com
API_KEYS=key1,key2,key3
RATE_LIMIT_MAX_REQUESTS=120
RATE_LIMIT_WINDOW_MS=60000
REDIS_URL=redis://redis:6379  # Optional
```

---

## 9. Scalability Considerations

### Current Scale

**In-Memory**:
- Rate limit buckets: Per IP (typical: 100s-1000s)
- Metrics counters: Single instance
- Request ID generation: Per request

**Database**:
- SQLite is single-writer (not multi-process safe)
- WAL mode enables concurrent reads
- Suitable for: Single server, moderate load

**Limits**:
- Database: 100GB+ files possible (better-sqlite3 supports it)
- Connections: One (SQLite is file-based)
- QPS: ~100-1000 depends on hardware

### Horizontal Scaling (Future)

**If needing multiple servers**:

1. **Switch database**: PostgreSQL or MySQL
   - Multi-writer support
   - Better concurrency
   - Network accessible

2. **Distributed rate limiting**: Redis
   - Configured via REDIS_URL env
   - `rateLimiterRedis.ts` already implemented
   - Shares rate limit state across servers

3. **Load balancer**: Nginx or AWS ELB
   - Distributes traffic across instances
   - Sticky sessions not needed (stateless design)

4. **Metrics aggregation**: Prometheus + Grafana
   - Expose metrics endpoint (/api/v1/metrics)
   - Scrape from multiple instances

### Caching Strategy

**HTTP Caching**:
- Redirects (302): Cache-Control: no-store (disable)
- Analytics: Cache-Control: no-cache (revalidate)
- Health: Cache-Control: no-cache

**Database Caching**:
- SQLite cache_size: 20MB (configured)
- Connection pooling: N/A (single connection)

**Application Caching**:
- Metrics: In-memory only (no persistence)
- Redirects: No caching (hit database every time)

---

## 10. Monitoring & Observability

### Logging

**Request Logs** (Morgan):
```
127.0.0.1 - - [15/Jul/2026:21:00:00 +0000] "POST /api/v1/shorten HTTP/1.1" 201 74 "-" "-"
```

**Structured Logs** (Request Logger):
```json
{
  "level": "info",
  "type": "request",
  "method": "POST",
  "path": "/api/v1/shorten",
  "status": 201,
  "durationMs": 10,
  "requestId": "abc123...",
  "timestamp": "2026-07-15T21:00:00.000Z"
}
```

### Metrics

**Available Endpoint**: GET /api/v1/metrics
```json
{
  "requests": 1024,
  "shortenOperations": 256,
  "redirects": 768
}
```

**Tracking**:
- incrementRequest(): Called per HTTP request
- incrementShorten(): Called per POST /shorten
- Redirect tracking: Implicit via click_count

### Health Check

**Endpoint**: GET /api/v1/health
```json
{
  "status": "healthy",
  "timestamp": "2026-07-15T21:00:00Z"
}
```

**Used by**: Kubernetes liveness/readiness probes

---

## 11. Design Patterns

### Pattern 1: Service Layer Abstraction
- Route handlers delegate to services
- Services contain business logic
- Database accessed only through service layer
- Benefit: Testability, separation of concerns

### Pattern 2: Validation at Multiple Layers
- Input validation (body parser)
- Route validation (body check)
- Service validation (format, uniqueness)
- Database constraints (PRIMARY KEY, NOT NULL)
- Benefit: Defense in depth

### Pattern 3: Custom Error Types
- Extend AppError base class
- Each error type has semantic HTTP status
- Error messages are user-friendly
- Benefit: Consistent error handling

### Pattern 4: Middleware Chain
- Each middleware does one thing
- Order matters (helmet before auth, etc.)
- Middleware can be tested independently
- Benefit: Composability, reusability

### Pattern 5: Graceful Shutdown
- Listens for SIGTERM/SIGINT
- Closes database connections
- Completes in-flight requests
- Benefit: Zero data loss on deployment

---

## 12. File Structure

```
src/
├── server.ts              # Entry point, HTTP server
├── app.ts                 # Express app configuration, middleware chain
├── config.ts              # Environment validation, configuration
│
├── routes/
│   ├── shorten.ts         # POST /api/v1/shorten
│   └── health.ts          # GET /api/v1/health, GET /, GET /api/v1/metrics
│
├── services/
│   ├── urlService.ts      # Business logic (shorten, redirect, analytics)
│   └── metricsService.ts  # Request metrics tracking
│
├── middleware/
│   ├── rateLimiter.ts     # Per-IP rate limiting (in-memory)
│   ├── rateLimiterRedis.ts # Distributed rate limiting (Redis)
│   ├── apiKeyAuth.ts      # API key validation (production)
│   ├── requestId.ts       # Generate request ID
│   └── requestLogger.ts   # Structured logging
│
├── database/
│   └── db.ts              # SQLite queries, schema, auto-migration
│
├── utils/
│   └── errors.ts          # Error classes (ValidationError, etc.)
│
└── __tests__/
    └── shorten.test.ts    # Integration tests (54 tests)

dist/                      # Compiled JavaScript (after npm run build)
data/
└── shortener.db           # SQLite database file
```

---

## 13. AI-Assisted Development Workflow

The architecture supports AI-assisted engineering:

### Prompt-to-Code Flow

1. **Requirement Prompt**
   - User provides requirement or user story
   - AI decomposes into tasks

2. **Implementation Prompts**
   - AI generates code for each task
   - Engineer reviews and validates
   - Adjustments made as needed

3. **Testing Prompts**
   - AI generates test cases
   - Engineer verifies coverage
   - Edge cases added as needed

4. **Documentation Prompts**
   - AI generates documentation
   - Engineer reviews for accuracy
   - Examples added as needed

### Validation Points

- Every AI-generated function has explicit prompts documented
- Test cases validate prompt requirements
- Documentation links code to prompts
- Error messages explain validation rules

---

## 14. Key Architectural Decisions

| Decision | Rationale | Trade-off |
|----------|-----------|-----------|
| SQLite | Simplicity, portability, no ops | Single-writer, not distributed |
| Express | Lightweight, ecosystem | Not as opinionated as frameworks |
| TypeScript | Type safety, IDE support | Compilation step needed |
| In-memory metrics | Fast, simple | Lost on restart |
| Per-IP rate limiting | Fair, simple | Can't track per-user |
| UUID IDs | Collision-proof, random | Longer than sequential |
| Layered architecture | Separation of concerns | More files/indirection |
| Middleware chain | Composable, testable | Order dependency |
| Fail-fast config | Explicit errors | Process exit on bad config |
| Semantic HTTP codes | RESTful, client-friendly | More error types |

---

## Summary

This architecture provides:
- ✅ **Clarity**: Explicit layers with clear responsibilities
- ✅ **Maintainability**: Modular design, easy to understand
- ✅ **Testability**: Layered design enables unit/integration tests
- ✅ **Security**: Defense in depth with validation, auth, rate limiting
- ✅ **Performance**: Optimized database, caching strategy
- ✅ **Observability**: Structured logging, metrics, health checks
- ✅ **Scalability**: Foundation for horizontal scaling
- ✅ **Production-ready**: Error handling, graceful shutdown, monitoring
