import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { db } from '../db.js';

/** Save image bytes into SQLite so photos survive if the uploads folder is wiped. */
export function storeFileBlob(table, idColumn, id, filePath) {
  if (!filePath || !fs.existsSync(filePath)) return;
  try {
    const blob = fs.readFileSync(filePath);
    db.prepare(`UPDATE ${table} SET file_blob = ? WHERE ${idColumn} = ?`).run(blob, id);
  } catch (err) {
    console.warn('[persist] storeFileBlob failed:', err.message);
  }
}

/** Recreate a missing upload file from SQLite blob. */
export function hydrateUploadFile(basename) {
  const name = path.basename(basename);
  const dest = path.join(config.uploadsDir, name);
  if (fs.existsSync(dest)) return dest;

  const row =
    db.prepare('SELECT file_blob FROM photos WHERE file_path LIKE ? AND file_blob IS NOT NULL LIMIT 1').get(`%${name}`) ||
    db.prepare('SELECT file_blob FROM enhancements WHERE file_path LIKE ? AND file_blob IS NOT NULL LIMIT 1').get(`%${name}`);

  if (!row?.file_blob) return null;
  fs.mkdirSync(config.uploadsDir, { recursive: true });
  fs.writeFileSync(dest, row.file_blob);
  return dest;
}

/** Restore any known photo/enhancement files that are missing on disk. */
export function hydrateAllMissingFiles() {
  const photos = db.prepare('SELECT photo_id, file_path, file_blob FROM photos WHERE file_blob IS NOT NULL').all();
  const enh = db.prepare('SELECT enhancement_id, file_path, file_blob FROM enhancements WHERE file_blob IS NOT NULL').all();
  let n = 0;
  for (const row of [...photos, ...enh]) {
    if (!row.file_path) continue;
    const dest = path.join(config.uploadsDir, path.basename(row.file_path));
    if (fs.existsSync(dest)) continue;
    try {
      fs.mkdirSync(config.uploadsDir, { recursive: true });
      fs.writeFileSync(dest, row.file_blob);
      n += 1;
    } catch {
      /* ignore */
    }
  }
  if (n) console.log(`[persist] Restored ${n} image file(s) from database blobs`);
}
