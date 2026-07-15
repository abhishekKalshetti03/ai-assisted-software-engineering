import * as fs from 'node:fs';
import * as path from 'node:path';
import Database from 'better-sqlite3';
import { config } from '../config';

const dbDir = path.dirname(config.dbPath);

fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(config.dbPath, { fileMustExist: false });

// Production-grade SQLite tuning
db.pragma('journal_mode = WAL');       // concurrent reads while writing
db.pragma('synchronous = NORMAL');     // safe with WAL; faster than FULL
db.pragma('busy_timeout = 5000');      // wait up to 5 s on lock contention
db.pragma('cache_size = -20000');      // 20 MB page cache
db.pragma('mmap_size = 134217728');    // 128 MB memory-mapped I/O
db.pragma('foreign_keys = ON');        // enforce referential integrity

// Create base schema
db.exec(`
  CREATE TABLE IF NOT EXISTS urls (
    id TEXT PRIMARY KEY,
    original_url TEXT NOT NULL,
    click_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_urls_created_at ON urls(created_at);
`);

// Migrate existing databases: add expires_at column if absent
const columns = (db.pragma('table_info(urls)') as Array<{ name: string }>).map((c) => c.name);
if (!columns.includes('expires_at')) {
  db.exec('ALTER TABLE urls ADD COLUMN expires_at TEXT');
}

// Create index on expires_at (safe to run after migration ensures column exists)
db.exec('CREATE INDEX IF NOT EXISTS idx_urls_expires_at ON urls(expires_at);');

function generateId(): string {
  return Math.random().toString(36).slice(2, 8);
}

export interface UrlRecord {
  id: string;
  originalUrl: string;
  clicks: number;
  createdAt: string;
  expiresAt: string | null;
}

export function slugExists(slug: string): boolean {
  const row = db.prepare('SELECT 1 FROM urls WHERE id = ?').get(slug);
  return row !== undefined;
}

export function createShortUrlRecord(
  originalUrl: string,
  baseUrl: string,
  options: { slug?: string; expiresAt?: string } = {},
): { id: string; shortUrl: string; expiresAt: string | null } {
  const id = options.slug ?? generateId();

  if (options.slug) {
    // Custom slug: single insert, let UNIQUE constraint surface conflicts
    const insert = db.prepare(
      'INSERT INTO urls (id, original_url, expires_at) VALUES (?, ?, ?)',
    );
    insert.run(id, originalUrl, options.expiresAt ?? null);
    return { id, shortUrl: `${baseUrl}/${id}`, expiresAt: options.expiresAt ?? null };
  }

  // Random slug: retry on collision
  let currentId = id;
  while (true) {
    try {
      const insert = db.prepare(
        'INSERT INTO urls (id, original_url, expires_at) VALUES (?, ?, ?)',
      );
      const transaction = db.transaction(() => {
        insert.run(currentId, originalUrl, options.expiresAt ?? null);
      });
      transaction();
      return { id: currentId, shortUrl: `${baseUrl}/${currentId}`, expiresAt: options.expiresAt ?? null };
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE')) {
        currentId = generateId();
        continue;
      }
      throw error;
    }
  }
}

export function getOriginalUrlRecordById(id: string): { originalUrl: string; expiresAt: string | null } | undefined {
  const row = db
    .prepare('SELECT original_url, expires_at FROM urls WHERE id = ?')
    .get(id) as { original_url: string; expires_at: string | null } | undefined;

  if (!row?.original_url) {
    return undefined;
  }

  return { originalUrl: row.original_url, expiresAt: row.expires_at ?? null };
}

export function incrementClickCount(id: string): void {
  db.prepare('UPDATE urls SET click_count = click_count + 1 WHERE id = ?').run(id);
}

export function getAnalyticsRecordById(id: string): UrlRecord | undefined {
  const row = db
    .prepare('SELECT id, original_url, click_count, created_at, expires_at FROM urls WHERE id = ?')
    .get(id) as {
      id: string;
      original_url: string;
      click_count: number;
      created_at: string;
      expires_at: string | null;
    } | undefined;

  if (row === undefined) {
    return undefined;
  }

  return {
    id: row.id,
    originalUrl: row.original_url,
    clicks: row.click_count,
    createdAt: row.created_at,
    expiresAt: row.expires_at ?? null,
  };
}

export const getAnalyticsById = getAnalyticsRecordById;
export const getOriginalUrlById = (id: string): string | undefined => {
  const record = getOriginalUrlRecordById(id);
  return record?.originalUrl;
};
export const createShortUrl = (
  originalUrl: string,
  baseUrl: string,
  options?: { slug?: string; expiresAt?: string },
): { id: string; shortUrl: string; expiresAt: string | null } =>
  createShortUrlRecord(originalUrl, baseUrl, options);
