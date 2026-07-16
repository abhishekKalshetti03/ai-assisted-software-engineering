import * as path from 'node:path';

/**
 * AI Prompt Validation Spec: Configuration Management
 *
 * Configuration Loading Principles:
 * 1. Fail-fast: Invalid config causes immediate exit (process.exit(1))
 * 2. Environment-aware: Different validation rules for dev vs production
 * 3. Defaults: Provide sensible defaults where possible
 * 4. Security: Stricter validation in production
 *
 * Environment Variables Validated:
 * - PORT: Range 1-65535 (required, defaults to 3000)
 * - BASE_URL: Must be set in production (not required in dev)
 * - DB_PATH: Database file location (defaults to ./data/shortener.db)
 * - RATE_LIMIT_MAX_REQUESTS: Default 120 requests
 * - RATE_LIMIT_WINDOW_MS: Default 60000ms (1 minute)
 * - RATE_LIMITER_BACKEND: "memory" (default) or "redis" for distributed rate limiting
 * - CORS_ORIGIN: Default '*' in dev, comma-separated list in prod
 * - REDIS_URL: Optional, for distributed rate limiting
 * - API_KEYS: Optional, comma-separated list for production auth
 */

export interface AppConfig {
  port: number;
  baseUrl: string;
  nodeEnv: string;
  isProduction: boolean;
  dbPath: string;
  rateLimitMaxRequests: number;
  rateLimitWindowMs: number;
  rateLimiterBackend: 'memory' | 'redis';
  corsOrigin: string | string[];
  redisUrl?: string;
  apiKeys?: string[];
}

/**
 * AI Prompt: "Validate required config in production"
 * Helper to enforce production-only requirements
 */
function requireInProduction(key: string, value: string | undefined, isProduction: boolean): string {
  if (isProduction && !value) {
    console.error(`[config] FATAL: environment variable "${key}" is required in production but is not set.`);
    process.exit(1);
  }
  return value ?? '';
}

function loadConfig(): AppConfig {
  // AI: Read environment
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const isProduction = nodeEnv === 'production';

  // AI Validation: PORT must be number in range 1-65535
  const port = Number(process.env.PORT ?? 3000);
  if (Number.isNaN(port) || port < 1 || port > 65535) {
    console.error(`[config] FATAL: PORT "${process.env.PORT}" is not a valid port number.`);
    process.exit(1);
  }

  // AI: BASE_URL defaults to localhost in dev, required in prod
  const defaultBaseUrl = `http://localhost:${port}`;
  const baseUrl = process.env.BASE_URL ?? defaultBaseUrl;

  // AI: Enforce BASE_URL in production for correct short URL generation
  requireInProduction('BASE_URL', process.env.BASE_URL, isProduction);

  // AI: DB_PATH defaults to ./data/shortener.db
  const defaultDbPath = path.resolve(process.cwd(), 'data', 'shortener.db');
  const dbPath = process.env.DB_PATH ?? defaultDbPath;

  // AI: Rate limiting configuration (per-IP, per-window)
  const rateLimitMaxRequests = Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 120);
  const rateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);

  // AI: Rate limiter backend selection
  // - "memory": In-memory rate limiting (default, suitable for single-instance)
  // - "redis": Redis-backed rate limiting (requires REDIS_URL, suitable for multi-instance)
  const rateLimiterBackendEnv = process.env.RATE_LIMITER_BACKEND ?? 'memory';
  if (!['memory', 'redis'].includes(rateLimiterBackendEnv)) {
    console.error(`[config] FATAL: RATE_LIMITER_BACKEND must be "memory" or "redis", got "${rateLimiterBackendEnv}".`);
    process.exit(1);
  }
  const rateLimiterBackend = rateLimiterBackendEnv as 'memory' | 'redis';

  // AI: CORS configuration (environment-aware)
  // - Dev: default to '*' for convenience
  // - Prod: require explicit origin list for security (fail-secure)
  let corsOrigin: string | string[] = '*';
  if (isProduction) {
    // AI Security: Fail-closed in production
    // Require explicit CORS_ORIGIN env var, never default to '*'
    if (!process.env.CORS_ORIGIN) {
      throw new Error(
        'FATAL: Production mode requires CORS_ORIGIN env var. ' +
        'Unset CORS_ORIGIN is a security misconfiguration. ' +
        'Set to comma-separated origins (e.g., "https://example.com,https://app.example.com")'
      );
    }
    corsOrigin = process.env.CORS_ORIGIN.split(',').map((o) => o.trim());
  } else if (process.env.CORS_ORIGIN) {
    corsOrigin = process.env.CORS_ORIGIN.split(',').map((o) => o.trim());
  }

  // AI: Redis URL for distributed rate limiting (optional)
  // If set, enables Redis-backed rate limiting instead of in-memory
  const redisUrl = process.env.REDIS_URL;

  // AI: API keys for production API authentication
  // Format: comma-separated list, stored as string[]
  // Checked by apiKeyAuth middleware (production-only)
  const apiKeysEnv = process.env.API_KEYS;
  const apiKeys = apiKeysEnv ? apiKeysEnv.split(',').map((k) => k.trim()) : undefined;

  return {
    port,
    baseUrl,
    nodeEnv,
    isProduction,
    dbPath,
    rateLimitMaxRequests,
    rateLimitWindowMs,
    rateLimiterBackend,
    corsOrigin,
    redisUrl,
    apiKeys,
  };
}

// AI: Load and validate config at module import time (fail-fast)
export const config = loadConfig();
