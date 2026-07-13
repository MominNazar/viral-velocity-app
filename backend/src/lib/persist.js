/**
 * Persist SQLite + upload files across Render free-tier restarts via Upstash.
 * Avoids loading huge image blobs into SQLite (that caused OOM kills).
 */
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

const META_KEY = 'viral_velocity_sqlite_meta';
const CHUNK_KEY = (i) => `viral_velocity_sqlite_chunk_${i}`;
const FILES_KEY = 'viral_velocity_files_index';
const FILE_CHUNK = (name, i) => `viral_velocity_file:${name}:${i}`;
const FILE_META = (name) => `viral_velocity_filemeta:${name}`;
const CHUNK = 400_000; // smaller chunks = less peak RAM

let lastBackupAt = null;
let lastRestoreAt = null;
let lastError = null;
let backupsEnabled = false;
let backupInFlight = false;

export function persistStatus() {
  return {
    upstashConfigured: upstashConfigured(),
    backupsEnabled,
    lastBackupAt,
    lastRestoreAt,
    lastError,
    dbFile: config.dbFile,
    dbExists: fs.existsSync(config.dbFile),
    dbBytes: fs.existsSync(config.dbFile) ? fs.statSync(config.dbFile).size : 0,
  };
}

export function enableBackups() {
  backupsEnabled = true;
}

function upstashConfigured() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function upstash(command) {
  const base = String(process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/$/, '');
  if (!base) throw new Error('UPSTASH_REDIS_REST_URL missing');
  const res = await fetch(base, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || data?.result || `Upstash HTTP ${res.status}`);
  return data;
}

async function readRemoteMeta() {
  if (!upstashConfigured()) return null;
  const metaRes = await upstash(['GET', META_KEY]);
  const metaRaw = metaRes?.result;
  if (!metaRaw) return null;
  return typeof metaRaw === 'string' ? JSON.parse(metaRaw) : metaRaw;
}

/** Backup one image file to Upstash in small chunks (low RAM). */
export async function backupUploadFile(filePath) {
  if (!upstashConfigured() || !filePath || !fs.existsSync(filePath)) return;
  const name = path.basename(filePath);
  try {
    const buf = fs.readFileSync(filePath);
    // Skip huge originals — should already be resized on upload
    if (buf.length > 2_500_000) {
      console.warn(`[persist] Skip file backup ${name} (${buf.length} bytes too large)`);
      return;
    }
    const b64 = buf.toString('base64');
    const chunks = Math.ceil(b64.length / CHUNK) || 1;
    for (let i = 0; i < chunks; i += 1) {
      await upstash(['SET', FILE_CHUNK(name, i), b64.slice(i * CHUNK, (i + 1) * CHUNK)]);
    }
    await upstash(['SET', FILE_META(name), JSON.stringify({ chunks, size: buf.length })]);
    const idx = await upstash(['GET', FILES_KEY]);
    let list = [];
    try {
      list = idx?.result ? JSON.parse(idx.result) : [];
    } catch {
      list = [];
    }
    if (!list.includes(name)) {
      list.push(name);
      await upstash(['SET', FILES_KEY, JSON.stringify(list)]);
    }
  } catch (err) {
    console.warn('[persist] file backup failed:', name, err.message);
  }
}

export async function restoreUploadFiles() {
  if (!upstashConfigured()) return 0;
  fs.mkdirSync(config.uploadsDir, { recursive: true });
  try {
    const idx = await upstash(['GET', FILES_KEY]);
    if (!idx?.result) return 0;
    const list = JSON.parse(idx.result);
    let n = 0;
    for (const name of list) {
      const dest = path.join(config.uploadsDir, name);
      if (fs.existsSync(dest) && fs.statSync(dest).size > 0) continue;
      const metaRaw = await upstash(['GET', FILE_META(name)]);
      if (!metaRaw?.result) continue;
      const meta = typeof metaRaw.result === 'string' ? JSON.parse(metaRaw.result) : metaRaw.result;
      const parts = [];
      for (let i = 0; i < meta.chunks; i += 1) {
        const part = await upstash(['GET', FILE_CHUNK(name, i)]);
        if (!part?.result) break;
        parts.push(String(part.result));
      }
      if (parts.length !== meta.chunks) continue;
      fs.writeFileSync(dest, Buffer.from(parts.join(''), 'base64'));
      n += 1;
    }
    if (n) console.log(`[persist] Restored ${n} upload file(s) from Upstash`);
    return n;
  } catch (err) {
    console.warn('[persist] restoreUploadFiles failed:', err.message);
    return 0;
  }
}

export async function restoreDatabaseIfNeeded() {
  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.mkdirSync(config.uploadsDir, { recursive: true });

  if (!upstashConfigured()) {
    console.warn(
      '[persist] UPSTASH_* not set. Data WILL reset when Render free tier sleeps/OOM-restarts.'
    );
    return { restored: false, reason: 'upstash_not_configured' };
  }

  const localExists = fs.existsSync(config.dbFile) && fs.statSync(config.dbFile).size > 1000;
  let remoteMeta = null;
  try {
    remoteMeta = await readRemoteMeta();
  } catch (err) {
    lastError = err.message;
    console.error('[persist] Could not read remote meta:', err.message);
  }

  const shouldRestore =
    remoteMeta?.chunks > 0 &&
    (!localExists || (remoteMeta.size && localExists && remoteMeta.size > fs.statSync(config.dbFile).size * 1.05));

  if (!shouldRestore) {
    if (localExists) console.log(`[persist] Keeping local DB: ${config.dbFile}`);
    else console.log('[persist] No remote snapshot yet — starting fresh');
    await restoreUploadFiles();
    return { restored: false, reason: localExists ? 'local_ok' : 'no_remote' };
  }

  try {
    console.log('[persist] Restoring SQLite from Upstash…');
    const parts = [];
    for (let i = 0; i < remoteMeta.chunks; i += 1) {
      const part = await upstash(['GET', CHUNK_KEY(i)]);
      if (!part?.result) throw new Error(`Missing chunk ${i}`);
      parts.push(String(part.result));
    }
    for (const suffix of ['', '-wal', '-shm']) {
      const p = `${config.dbFile}${suffix}`;
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    fs.writeFileSync(config.dbFile, Buffer.from(parts.join(''), 'base64'));
    lastRestoreAt = new Date().toISOString();
    lastError = null;
    console.log(`[persist] Restored DB (${fs.statSync(config.dbFile).size} bytes)`);
    await restoreUploadFiles();
    return { restored: true };
  } catch (err) {
    lastError = err.message;
    console.error('[persist] Restore failed:', err.message);
    if (!localExists && remoteMeta?.chunks > 0) {
      throw new Error(`Remote backup exists but restore failed (${err.message}).`);
    }
    return { restored: false, reason: 'restore_failed' };
  }
}

export async function backupDatabase(db, { force = false } = {}) {
  if (!upstashConfigured()) return { ok: false, reason: 'upstash_not_configured' };
  if (!backupsEnabled && !force) return { ok: false, reason: 'backups_disabled' };
  if (backupInFlight) return { ok: false, reason: 'in_flight' };
  backupInFlight = true;

  try {
    if (db) {
      try {
        db.pragma('wal_checkpoint(TRUNCATE)');
      } catch {
        /* ignore */
      }
    }
    if (!fs.existsSync(config.dbFile)) return { ok: false, reason: 'no_local_db' };

    const buf = fs.readFileSync(config.dbFile);
    // Keep DB backup small — no image blobs in SQLite anymore
    if (buf.length > 4_000_000) {
      console.warn('[persist] DB unexpectedly large; backup may be slow');
    }

    let userCount = 0;
    let photoCount = 0;
    try {
      if (db) {
        userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get()?.c || 0;
        photoCount = db.prepare('SELECT COUNT(*) AS c FROM photos').get()?.c || 0;
      }
    } catch {
      /* ignore */
    }

    if (!force) {
      try {
        const remote = await readRemoteMeta();
        if (remote && typeof remote.userCount === 'number') {
          if (remote.userCount > userCount && userCount <= 3 && photoCount <= 9) {
            console.warn('[persist] Skip backup — remote has more users (would clobber)');
            return { ok: false, reason: 'remote_has_more_data' };
          }
        }
      } catch {
        /* proceed */
      }
    }

    const b64 = buf.toString('base64');
    const chunks = Math.ceil(b64.length / CHUNK) || 1;
    for (let i = 0; i < chunks; i += 1) {
      await upstash(['SET', CHUNK_KEY(i), b64.slice(i * CHUNK, (i + 1) * CHUNK)]);
    }
    await upstash([
      'SET',
      META_KEY,
      JSON.stringify({
        chunks,
        size: b64.length,
        userCount,
        photoCount,
        at: new Date().toISOString(),
      }),
    ]);
    lastBackupAt = new Date().toISOString();
    lastError = null;
    console.log(`[persist] Backed up DB (${buf.length} bytes, users=${userCount}, photos=${photoCount})`);
    return { ok: true };
  } catch (err) {
    lastError = err.message;
    console.error('[persist] Backup failed:', err.message);
    return { ok: false, reason: err.message };
  } finally {
    backupInFlight = false;
  }
}

export function startBackupScheduler(db) {
  if (!upstashConfigured()) {
    console.log('[persist] Upstash not configured — data will NOT survive Render restarts');
    return;
  }
  enableBackups();
  // Frequent backups — OOM kills happen before 2-minute intervals
  const ms = Math.max(20_000, Number(process.env.BACKUP_INTERVAL_MS || 20_000));
  setInterval(() => {
    backupDatabase(db).catch(() => {});
  }, ms);
  setTimeout(() => backupDatabase(db, { force: true }).catch(() => {}), 8_000);
}
