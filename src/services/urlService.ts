import {
  createShortUrlRecord,
  getAnalyticsRecordById,
  getOriginalUrlRecordById,
  incrementClickCount,
  slugExists,
} from '../database/db';
import { ConflictError, GoneError, NotFoundError, ValidationError } from '../utils/errors';

const MAX_URL_LENGTH = 2048;
const MAX_SLUG_LENGTH = 50;
const ID_PATTERN = /^[a-z0-9-]+$/i;
const SLUG_PATTERN = /^[a-z0-9-]+$/i;

function isValidHttpUrl(value: string): boolean {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return false;
  }

  if (value.length > MAX_URL_LENGTH) {
    return false;
  }

  try {
    const parsed = new URL(value);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.hostname.length > 0;
  } catch {
    return false;
  }
}

function isValidId(value: string): boolean {
  return typeof value === 'string' && value.length > 0 && ID_PATTERN.test(value);
}

function isValidSlug(value: string): boolean {
  return (
    typeof value === 'string' &&
    value.length >= 1 &&
    value.length <= MAX_SLUG_LENGTH &&
    SLUG_PATTERN.test(value)
  );
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

export interface ShortenOptions {
  slug?: string;
  expiresAt?: string;
}

export interface ShortenResult {
  id: string;
  shortUrl: string;
  expiresAt: string | null;
}

export interface AnalyticsResult {
  id: string;
  originalUrl: string;
  clicks: number;
  createdAt: string;
  expiresAt: string | null;
}

export function shortenUrl(originalUrl: string, baseUrl: string, options: ShortenOptions = {}): ShortenResult {
  if (!isValidHttpUrl(originalUrl)) {
    throw new ValidationError('A valid http(s) URL is required.');
  }

  if (options.slug !== undefined) {
    if (!isValidSlug(options.slug)) {
      throw new ValidationError(
        `Slug must be 1–${MAX_SLUG_LENGTH} characters and contain only letters, numbers, and hyphens.`,
      );
    }
    if (slugExists(options.slug)) {
      throw new ConflictError(`A link with slug "${options.slug}" already exists.`);
    }
  }

  if (options.expiresAt !== undefined) {
    const expiry = new Date(options.expiresAt);
    if (Number.isNaN(expiry.getTime())) {
      throw new ValidationError('expiresAt must be a valid ISO 8601 date string.');
    }
    if (expiry <= new Date()) {
      throw new ValidationError('expiresAt must be a future date.');
    }
  }

  return createShortUrlRecord(originalUrl, baseUrl, options);
}

export function redirectUrl(id: string): { originalUrl: string } {
  if (!isValidId(id)) {
    throw new NotFoundError('Not found');
  }

  const record = getOriginalUrlRecordById(id);
  if (!record) {
    throw new NotFoundError('Not found');
  }

  if (isExpired(record.expiresAt)) {
    throw new GoneError('This link has expired.');
  }

  incrementClickCount(id);

  return { originalUrl: record.originalUrl };
}

export function getAnalytics(id: string): AnalyticsResult {
  if (!isValidId(id)) {
    throw new NotFoundError('Not found');
  }

  const record = getAnalyticsRecordById(id);
  if (!record) {
    throw new NotFoundError('Not found');
  }

  return {
    id: record.id,
    originalUrl: record.originalUrl,
    clicks: record.clicks,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
  };
}
