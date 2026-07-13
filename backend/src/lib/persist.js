/**
 * Persist SQLite across Render free-tier restarts via Upstash Redis REST.
 * Env: UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 */
import fs from 'node:fs';
import { config } from '../config.js';

const META_KEY = 'viral_velocity_sqlite_meta';
const CHUNK_KEY = (i) => `viral_velocity_sqlite_chunk_${i}`;
const CHUNK = 700_000;

let lastBackupAt = null;
let lastRestoreAt = null;
let lastError = null;
let backupsEnabled = false;

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

async function remoteHasSnapshot() {
  try {
    const meta = await readRemoteMeta();
    return Boolean(meta && meta.chunks > 0);
  } catch {
    return false;
  }
}

export async function restoreDatabaseIfNeeded() {
  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.mkdirSync(config.uploadsDir, { recursive: true });

  if (!upstashConfigured()) {
    console.warn(
      '[persist] UPSTASH_REDIS_REST_URL / TOKEN not set on Render. Data WILL reset when the free server sleeps.'
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

  // Prefer remote when local is missing OR remote is clearly newer/larger
  const shouldRestore =
    remoteMeta?.chunks > 0 &&
    (!localExists || (remoteMeta.size && remoteMeta.size > fs.statSync(config.dbFile).size * 1.05));

  if (!shouldRestore) {
    if (localExists) console.log(`[persist] Keeping local DB: ${config.dbFile}`);
    else console.log('[persist] No remote snapshot yet — starting fresh');
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
    // Remove stale local files before replace
    for (const suffix of ['', '-wal', '-shm']) {
      const p = `${config.dbFile}${suffix}`;
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    fs.writeFileSync(config.dbFile, Buffer.from(parts.join(''), 'base64'));
    lastRestoreAt = new Date().toISOString();
    lastError = null;
    console.log(`[persist] Restored DB (${fs.statSync(config.dbFile).size} bytes, ${remoteMeta.chunks} chunks)`);
    return { restored: true };
  } catch (err) {
    lastError = err.message;
    console.error('[persist] Restore failed:', err.message);
    // If remote has data but restore failed, refuse to continue with empty DB
    // (prevents seed+backup from wiping the remote snapshot).
    if (!localExists && (await remoteHasSnapshot())) {
      throw new Error(
        `Remote backup exists but restore failed (${err.message}). Fix Upstash credentials — refusing to wipe backup with an empty DB.`
      );
    }
    return { restored: false, reason: 'restore_failed' };
  }
}

export async function backupDatabase(db, { force = false } = {}) {
  if (!upstashConfigured()) return { ok: false, reason: 'upstash_not_configured' };
  if (!backupsEnabled && !force) return { ok: false, reason: 'backups_disabled' };

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
    const b64 = buf.toString('base64');

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

    // Never clobber a richer remote snapshot with a tiny local/seed DB
    if (!force) {
      try {
        const remote = await readRemoteMeta();
        if (remote && typeof remote.userCount === 'number') {
          if (remote.userCount > userCount + 0 || (remote.photoCount || 0) > photoCount + 0) {
            if (userCount <= 3 && photoCount <= 9) {
              console.warn(
                `[persist] Skip backup — remote has more data (users ${remote.userCount}/${userCount}, photos ${remote.photoCount}/${photoCount})`
              );
              return { ok: false, reason: 'remote_has_more_data' };
            }
          }
        }
      } catch {
        /* proceed */
      }
    }

    const chunks = Math.ceil(b64.length / CHUNK) || 1;
    for (let i = 0; i < chunks; i += 1) {
      const slice = b64.slice(i * CHUNK, (i + 1) * CHUNK);
      await upstash(['SET', CHUNK_KEY(i), slice]);
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
  }
}

export function startBackupScheduler(db) {
  if (!upstashConfigured()) {
    console.log('[persist] Upstash not configured — data will NOT survive Render sleep');
    return;
  }
  enableBackups();
  const mins = Number(process.env.BACKUP_INTERVAL_MINUTES || 1);
  const ms = Math.max(30_000, mins * 60_000);
  setInterval(() => {
    backupDatabase(db).catch(() => {});
  }, ms);
  // First backup after a short delay (let seed finish; skip-clobber protects remote)
  setTimeout(() => backupDatabase(db).catch(() => {}), 20_000);
}
