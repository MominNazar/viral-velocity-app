import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { config } from '../config.js';
import { backupUploadFile } from './persist.js';

// Cap Sharp RAM on Render free (512MB)
try {
  sharp.cache(false);
  sharp.concurrency(1);
} catch {
  /* ignore */
}

const MAX_EDGE = Number(process.env.MAX_IMAGE_EDGE || 1024);

/**
 * Downscale + recompress uploads so enhance + backup fit in free-tier RAM.
 * Returns the (possibly replaced) file path.
 */
export async function normalizeUploadFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return filePath;
  try {
    const dest = path.join(
      config.uploadsDir,
      `${path.basename(filePath, path.extname(filePath))}-n.jpg`
    );
    await sharp(filePath)
      .rotate()
      .resize(MAX_EDGE, MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toFile(dest);
    if (dest !== filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        /* ignore */
      }
    }
    return dest;
  } catch (err) {
    console.warn('[files] normalizeUploadFile failed:', err.message);
    return filePath;
  }
}

/** Persist image to Upstash (not SQLite — blobs caused OOM). */
export async function persistUpload(filePath) {
  await backupUploadFile(filePath);
}

/** No-op kept for call sites that previously wrote SQLite blobs. */
export function storeFileBlob() {
  /* intentionally disabled — caused Render OOM */
}

export function hydrateUploadFile(basename) {
  const name = path.basename(basename);
  const dest = path.join(config.uploadsDir, name);
  return fs.existsSync(dest) ? dest : null;
}

export function hydrateAllMissingFiles() {
  /* files restored via persist.restoreUploadFiles() */
}
