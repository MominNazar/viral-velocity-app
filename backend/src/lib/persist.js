/**
 * Optional remote backup of the SQLite DB via Upstash Redis REST (free tier).
 * Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN on Render.
 *
 * Prefer a Render persistent disk (DATA_DIR=/var/data) when possible.
 */
import fs from 'node:fs';
import { config } from '../config.js';

const META_KEY = 'viral_velocity_sqlite_meta';
const CHUNK_KEY = (i) => `viral_velocity_sqlite_chunk_${i}`;
const CHUNK = 700_000; // stay under Upstash free request limits

function upstashConfigured() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function upstash(command) {
  const base = process.env.UPSTASH_REDIS_REST_URL.replace(/\/$/, '');
  const res = await fetch(base, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Upstash HTTP ${res.status}`);
  return data;
}

export async function restoreDatabaseIfNeeded() {
  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.mkdirSync(config.uploadsDir, { recursive: true });

  const exists = fs.existsSync(config.dbFile) && fs.statSync(config.dbFile).size > 0;
  if (exists) {
    console.log(`[persist] Local DB present: ${config.dbFile}`);
    return;
  }

  if (!upstashConfigured()) {
    console.warn(
      '[persist] No local DB and no UPSTASH_* env. Render free disk is ephemeral — data resets on sleep. Add Upstash Redis (free) or a Render persistent disk.'
    );
    return;
  }

  try {
    console.log('[persist] Restoring SQLite from Upstash…');
    const metaRes = await upstash(['GET', META_KEY]);
    const metaRaw = metaRes?.result;
    if (!metaRaw) {
      console.log('[persist] No remote DB snapshot yet');
      return;
    }
    const meta = typeof metaRaw === 'string' ? JSON.parse(metaRaw) : metaRaw;
    const parts = [];
    for (let i = 0; i < meta.chunks; i += 1) {
      const part = await upstash(['GET', CHUNK_KEY(i)]);
      if (!part?.result) throw new Error(`Missing chunk ${i}`);
      parts.push(part.result);
    }
    fs.writeFileSync(config.dbFile, Buffer.from(parts.join(''), 'base64'));
    console.log(`[persist] Restored DB (${fs.statSync(config.dbFile).size} bytes, ${meta.chunks} chunks)`);
  } catch (err) {
    console.error('[persist] Restore failed:', err.message);
  }
}

export async function backupDatabase(db) {
  if (!upstashConfigured()) return;
  try {
    if (db) db.pragma('wal_checkpoint(TRUNCATE)');
    if (!fs.existsSync(config.dbFile)) return;
    const b64 = fs.readFileSync(config.dbFile).toString('base64');
    const chunks = Math.ceil(b64.length / CHUNK) || 1;
    for (let i = 0; i < chunks; i += 1) {
      const slice = b64.slice(i * CHUNK, (i + 1) * CHUNK);
      await upstash(['SET', CHUNK_KEY(i), slice]);
    }
    await upstash(['SET', META_KEY, JSON.stringify({ chunks, size: b64.length, at: new Date().toISOString() })]);
    console.log(`[persist] Backed up DB to Upstash (${b64.length} b64 chars, ${chunks} chunks)`);
  } catch (err) {
    console.error('[persist] Backup failed:', err.message);
  }
}

export function startBackupScheduler(db) {
  if (!upstashConfigured()) {
    console.log('[persist] Upstash not configured — relying on local DATA_DIR only');
    return;
  }
  const mins = Number(process.env.BACKUP_INTERVAL_MINUTES || 2);
  const ms = Math.max(60_000, mins * 60_000);
  setInterval(() => {
    backupDatabase(db).catch(() => {});
  }, ms);
  setTimeout(() => backupDatabase(db).catch(() => {}), 15_000);
}
