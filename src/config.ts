import * as path from 'node:path';

export interface AppConfig {
  port: number;
  baseUrl: string;
  nodeEnv: string;
  isProduction: boolean;
  dbPath: string;
  rateLimitMaxRequests: number;
  rateLimitWindowMs: number;
  corsOrigin: string | string[];
  redisUrl?: string;
  apiKeys?: string[];
}

function requireInProduction(key: string, value: string | undefined, isProduction: boolean): string {
  if (isProduction && !value) {
    console.error(`[config] FATAL: environment variable "${key}" is required in production but is not set.`);
    process.exit(1);
  }
  return value ?? '';
}

function loadConfig(): AppConfig {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const isProduction = nodeEnv === 'production';
  const port = Number(process.env.PORT ?? 3000);

  if (Number.isNaN(port) || port < 1 || port > 65535) {
    console.error(`[config] FATAL: PORT "${process.env.PORT}" is not a valid port number.`);
    process.exit(1);
  }

  const defaultBaseUrl = `http://localhost:${port}`;
  const baseUrl = process.env.BASE_URL ?? defaultBaseUrl;

  // In production, BASE_URL must be explicitly set so short URLs use the real hostname.
  requireInProduction('BASE_URL', process.env.BASE_URL, isProduction);

  const defaultDbPath = path.resolve(process.cwd(), 'data', 'shortener.db');
  const dbPath = process.env.DB_PATH ?? defaultDbPath;

  const rateLimitMaxRequests = Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 120);
  const rateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);

  // CORS: default to * in dev (convenient for local testing),
  // require explicit origin list in production
  let corsOrigin: string | string[] = '*';
  if (isProduction && process.env.CORS_ORIGIN) {
    corsOrigin = process.env.CORS_ORIGIN.split(',').map((o) => o.trim());
  } else if (!isProduction && process.env.CORS_ORIGIN) {
    corsOrigin = process.env.CORS_ORIGIN.split(',').map((o) => o.trim());
  }

  // Redis URL for distributed rate limiting (optional)
  const redisUrl = process.env.REDIS_URL;

  // API keys for production authentication (comma-separated)
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
    corsOrigin,
    redisUrl,
    apiKeys,
  };
}

export const config = loadConfig();
