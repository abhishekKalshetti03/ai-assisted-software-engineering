import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const dbDir = path.resolve(__dirname, '..', '..', 'data');
const dbPath = path.join(dbDir, 'shortener.db');

fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(dbPath);

db.prepare(`
  CREATE TABLE IF NOT EXISTS urls (
    id TEXT PRIMARY KEY,
    original_url TEXT NOT NULL,
    click_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`).run();

function generateId(): string {
  return Math.random().toString(36).slice(2, 8);
}

export function createShortUrl(originalUrl: string, baseUrl: string): { id: string; shortUrl: string } {
  let id = generateId();

  while (true) {
    try {
      db.prepare('INSERT INTO urls (id, original_url) VALUES (?, ?)').run(id, originalUrl);
      return { id, shortUrl: `${baseUrl}/${id}` };
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE')) {
        id = generateId();
        continue;
      }
      throw error;
    }
  }
}

export function getOriginalUrlById(id: string): string | undefined {
  const row = db.prepare('SELECT original_url FROM urls WHERE id = ?').get(id) as { original_url: string } | undefined;

  if (!row?.original_url) {
    return undefined;
  }

  db.prepare('UPDATE urls SET click_count = click_count + 1 WHERE id = ?').run(id);

  return row.original_url;
}

export function getAnalyticsById(id: string): { clicks: number } | undefined {
  const row = db.prepare('SELECT click_count FROM urls WHERE id = ?').get(id) as { click_count: number } | undefined;

  if (row === undefined) {
    return undefined;
  }

  return { clicks: row.click_count };
}
