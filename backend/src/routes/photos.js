import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { Router } from 'express';
import multer from 'multer';
import { db } from '../db.js';
import { config } from '../config.js';
import { ah } from '../middleware/error.js';
import { requireUser, requireActiveAccess } from '../middleware/auth.js';
import { generateEnhancedVersions } from '../services/ai.js';
import { scoreImageFile } from '../services/imageScore.js';
import { moderate } from '../services/moderation.js';
import { HttpError } from '../lib/validate.js';
import { audit } from '../lib/audit.js';
import { storeFileBlob, normalizeUploadFile, persistUpload } from '../lib/files.js';
import { backupDatabase } from '../lib/persist.js';

const router = Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});
// FR-7 / NFR-3: enforce the 1-5 per-batch limit at the multer layer too.
const upload = multer({ storage, limits: { files: 5, fileSize: 15 * 1024 * 1024 } });

function serialize(photo) {
  if (!photo) return photo;
  const { file_blob, ...rest } = photo;
  return { ...rest, sub_scores: rest.sub_scores ? JSON.parse(rest.sub_scores) : null };
}

function fileUrl(req, p) {
  if (!p) return null;
  const base =
    process.env.PUBLIC_BASE_URL ||
    `${req.protocol}://${req.get('host')}`;
  // Always https for public hosts (Android Image often fails on http→https redirects)
  const root = base.replace(/\/$/, '').replace(/^http:\/\//i, 'https://');
  return `${root}/uploads/${path.basename(p)}`;
}

// POST /api/photos/upload  (FR-7, FR-8, FR-17 moderation, scoring)
router.post(
  '/upload',
  requireUser,
  requireActiveAccess,
  upload.array('photos', 5),
  ah(async (req, res) => {
    const files = req.files || [];
    if (files.length < 1) throw new HttpError(400, 'Select 1-5 photos to upload');
    if (files.length > 5) throw new HttpError(400, 'You can upload at most 5 photos per batch');

    // Trial accounting (FR-6): block if batch would exceed remaining trial photos.
    if (req.access.mode === 'trial' && files.length > req.access.trialPhotosRemaining) {
      // clean up temp files
      files.forEach((f) => fs.existsSync(f.path) && fs.unlinkSync(f.path));
      throw new HttpError(402, `Free trial allows ${req.access.trialPhotosRemaining} more photo(s).`, {
        code: 'TRIAL_LIMIT',
      });
    }

    const batchId = crypto.randomBytes(8).toString('hex');
    const results = [];
    let scoredCount = 0;

    const insert = db.prepare(
      `INSERT INTO photos (user_id, batch_id, file_path, score, sub_scores, moderation, status)
       VALUES (?, ?, ?, ?, ?, ?, 'Original')`
    );

    for (const file of files) {
      const mod = moderate(file.filename, file.originalname);
      if (mod.blocked) {
        // NFR-10: blocked images are not stored or scored.
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        results.push({ originalName: file.originalname, moderation: 'blocked', risk: mod.risk });
        continue;
      }
      const normalizedPath = await normalizeUploadFile(file.path);
      file.path = normalizedPath;
      const { score, subScores } = await scoreImageFile(file.path);
      const info = insert.run(req.user.user_id, batchId, file.path, score, JSON.stringify(subScores), 'clean');
      scoredCount += 1;
      storeFileBlob('photos', 'photo_id', info.lastInsertRowid, file.path);
      await persistUpload(file.path);
      const photo = db.prepare('SELECT * FROM photos WHERE photo_id = ?').get(info.lastInsertRowid);
      results.push({ ...serialize(photo), url: fileUrl(req, photo.file_path) });
    }

    if (req.access.mode === 'trial' && scoredCount > 0) {
      db.prepare('UPDATE users SET trial_photos_used = trial_photos_used + ? WHERE user_id = ?')
        .run(scoredCount, req.user.user_id);
    }

    const blocked = results.filter((r) => r.moderation === 'blocked');
    await backupDatabase(db, { force: true });
    res.status(201).json({
      batchId,
      photos: results.filter((r) => r.photo_id),
      blocked,
      message: blocked.length ? `${blocked.length} image(s) were blocked by content moderation.` : undefined,
    });
  })
);

// GET /api/photos  -> Library list (FR-18: filter Score/Date, ASC/DESC)
router.get('/', requireUser, ah(async (req, res) => {
  const { sort = 'date', order = 'desc', status } = req.query;
  const sortCol = sort === 'score' ? 'score' : 'upload_date';
  const dir = String(order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const where = ["user_id = ?", "status != 'Deleted'"];
  const params = [req.user.user_id];
  if (status && ['Original', 'Enhanced'].includes(status)) {
    where.push('status = ?');
    params.push(status);
  }
  const rows = db.prepare(
    `SELECT * FROM photos WHERE ${where.join(' AND ')} ORDER BY ${sortCol} ${dir}, photo_id ${dir}`
  ).all(...params);
  res.json({ photos: rows.map((p) => ({ ...serialize(p), url: fileUrl(req, p.file_path) })) });
}));

// GET /api/photos/library  (FR-18/FR-20: originals + saved enhanced outputs)
router.get('/library', requireUser, ah(async (req, res) => {
  const { sort = 'date', order = 'desc', filter = 'all' } = req.query;
  const dir = String(order).toLowerCase() === 'asc' ? 1 : -1;
  const items = [];

  if (filter !== 'enhanced') {
    const photos = db.prepare(
      `SELECT * FROM photos WHERE user_id = ? AND status != 'Deleted' ORDER BY photo_id DESC`
    ).all(req.user.user_id);
    for (const p of photos) {
      items.push({
        kind: 'original',
        photo_id: p.photo_id,
        enhancement_id: null,
        score: p.score,
        date: p.upload_date,
        status: p.status,
        version_number: null,
        url: fileUrl(req, p.file_path),
        label: 'Original',
      });
    }
  }

  if (filter !== 'original') {
    const enh = db.prepare(
      `SELECT e.*, p.upload_date AS photo_upload_date
       FROM enhancements e
       JOIN photos p ON p.photo_id = e.photo_id
       WHERE p.user_id = ? AND p.status != 'Deleted' AND e.state = 'saved'
       ORDER BY e.enhancement_id DESC`
    ).all(req.user.user_id);
    for (const e of enh) {
      items.push({
        kind: 'enhanced',
        photo_id: e.photo_id,
        enhancement_id: e.enhancement_id,
        score: e.score,
        date: e.created_at || e.photo_upload_date,
        status: 'Enhanced',
        version_number: e.version_number,
        url: fileUrl(req, e.file_path),
        label: `Version ${e.version_number}`,
        prompt: e.prompt,
      });
    }
  }

  items.sort((a, b) => {
    if (sort === 'score') {
      const diff = (a.score ?? 0) - (b.score ?? 0);
      return diff * dir;
    }
    const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
    return diff * dir;
  });

  res.json({ items });
}));

async function createPromptedVersions(req, photo, count, prompt, sourcePath = photo.file_path) {
  const resolved = sourcePath || photo.file_path;
  if (!resolved) throw new HttpError(400, 'Source image file is missing');

  const existing = db.prepare('SELECT MAX(version_number) AS m FROM enhancements WHERE photo_id = ?').get(photo.photo_id);
  let next = (existing?.m || 0) + 1;
  const insert = db.prepare(
    `INSERT INTO enhancements (photo_id, version_number, file_path, score, sub_scores, prompt, state)
     VALUES (?, ?, ?, ?, ?, ?, 'pending')`
  );
  let variants;
  try {
    variants = await generateEnhancedVersions(resolved, count, prompt.trim());
  } catch (err) {
    throw new HttpError(400, err.message?.includes('unsupported image')
      ? 'Could not read the source image. Try re-uploading the photo.'
      : `Enhancement failed: ${err.message || 'unknown error'}`);
  }
  const created = [];
  let engine = 'sharp';
  let style = null;
  let notice = null;
  for (const v of variants) {
    if (v.engine) engine = v.engine;
    if (v.style) style = v.style;
    if (v.notice) notice = v.notice;
    const info = insert.run(
      photo.photo_id,
      next++,
      v.file_path,
      v.score,
      JSON.stringify(v.subScores),
      prompt.trim(),
    );
    storeFileBlob('enhancements', 'enhancement_id', info.lastInsertRowid, v.file_path);
    await persistUpload(v.file_path);
    created.push(info.lastInsertRowid);
  }
  backupDatabase(db).catch(() => {});
  const enhancements = db.prepare(`SELECT * FROM enhancements WHERE enhancement_id IN (${created.map(() => '?').join(',')})`)
    .all(...created)
    .map((e) => {
      const { file_blob, ...rest } = e;
      return { ...rest, sub_scores: JSON.parse(rest.sub_scores), url: fileUrl(req, rest.file_path) };
    });
  return { enhancements, engine, style, notice };
}

// POST /api/photos/library/prompt  (FR-20: batch prompt from Library selection)
router.post('/library/prompt', requireUser, requireActiveAccess, ah(async (req, res) => {
  const { prompt, enhancementIds } = req.body || {};
  if (!prompt || !prompt.trim()) throw new HttpError(400, 'Prompt text is required');
  const ids = Array.isArray(enhancementIds) ? enhancementIds.map(Number).filter(Boolean) : [];
  if (ids.length < 1) throw new HttpError(400, 'Select at least one enhanced image');
  if (ids.length > 5) throw new HttpError(400, 'You can prompt at most 5 enhanced images at once');

  const placeholders = ids.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT e.*, p.user_id, p.file_path AS photo_path, p.status AS photo_status
     FROM enhancements e
     JOIN photos p ON p.photo_id = e.photo_id
     WHERE e.enhancement_id IN (${placeholders})`
  ).all(...ids);

  if (rows.length !== ids.length) throw new HttpError(404, 'One or more enhanced images were not found');
  if (rows.some((r) => r.user_id !== req.user.user_id || r.photo_status === 'Deleted')) {
    throw new HttpError(404, 'One or more enhanced images were not found');
  }
  if (rows.some((r) => r.state !== 'saved')) {
    throw new HttpError(400, 'Only saved (Passed) enhanced images can be prompted from Library');
  }

  const byPhoto = new Map();
  for (const row of rows) {
    if (!byPhoto.has(row.photo_id)) byPhoto.set(row.photo_id, []);
    byPhoto.get(row.photo_id).push(row);
  }

  const allCreated = [];
  let engine = 'sharp';
  for (const [photoId, group] of byPhoto) {
    const photo = db.prepare('SELECT * FROM photos WHERE photo_id = ?').get(photoId);
    for (const row of group) {
      const source = row.file_path || photo.file_path;
      const result = await createPromptedVersions(req, photo, 1, prompt.trim(), source);
      engine = result.engine;
      allCreated.push(...result.enhancements);
    }
  }

  const notice = engine === 'sharp' && (process.env.ENHANCE_ENGINE || 'sharp') === 'replicate'
    ? 'Applied with free local enhancement (cloud AI unavailable).'
    : undefined;
  res.status(201).json({ enhancements: allCreated, count: allCreated.length, engine, notice });
}));

function ownedPhoto(req) {
  const photo = db.prepare('SELECT * FROM photos WHERE photo_id = ?').get(req.params.id);
  if (!photo || photo.user_id !== req.user.user_id || photo.status === 'Deleted') {
    throw new HttpError(404, 'Photo not found');
  }
  return photo;
}

// GET /api/photos/:id  -> detail with enhancement versions
router.get('/:id', requireUser, ah(async (req, res) => {
  const photo = ownedPhoto(req);
  const enh = db.prepare('SELECT * FROM enhancements WHERE photo_id = ? ORDER BY version_number DESC')
    .all(photo.photo_id)
    .map((e) => ({ ...e, sub_scores: e.sub_scores ? JSON.parse(e.sub_scores) : null, url: fileUrl(req, e.file_path) }));
  res.json({ photo: { ...serialize(photo), url: fileUrl(req, photo.file_path) }, enhancements: enh });
}));

// POST /api/photos/:id/enhance  (FR-12: up to 5 versions, each re-scored)
router.post('/:id/enhance', requireUser, requireActiveAccess, ah(async (req, res) => {
  const photo = ownedPhoto(req);
  if (!photo.file_path) throw new HttpError(400, 'Photo file missing');
  if (!fs.existsSync(photo.file_path)) {
    throw new HttpError(
      400,
      'Photo file was lost after the server restarted (free hosting wipes uploads). Please re-upload the photo, then enhance again.'
    );
  }
  const count = Math.max(1, Math.min(3, Number(req.body?.count) || 3));
  db.prepare("DELETE FROM enhancements WHERE photo_id = ? AND state = 'pending'").run(photo.photo_id);

  let versions;
  try {
    versions = await generateEnhancedVersions(photo.file_path, count);
  } catch (err) {
    throw new HttpError(400, err.message?.includes('unsupported image')
      ? 'Could not read the photo file. Try re-uploading.'
      : `Enhancement failed: ${err.message || 'unknown error'}`);
  }
  const existing = db.prepare('SELECT MAX(version_number) AS m FROM enhancements WHERE photo_id = ?').get(photo.photo_id);
  let nextVersion = (existing?.m || 0) + 1;
  const insert = db.prepare(
    `INSERT INTO enhancements (photo_id, version_number, file_path, score, sub_scores, state)
     VALUES (?, ?, ?, ?, ?, 'pending')`
  );
  const created = [];
  for (const v of versions) {
    const info = insert.run(
      photo.photo_id,
      nextVersion++,
      v.file_path,
      v.score,
      JSON.stringify(v.subScores),
    );
    storeFileBlob('enhancements', 'enhancement_id', info.lastInsertRowid, v.file_path);
    await persistUpload(v.file_path);
    created.push(info.lastInsertRowid);
  }
  db.prepare("UPDATE photos SET status = 'Enhanced' WHERE photo_id = ?").run(photo.photo_id);
  await backupDatabase(db, { force: true });
  const enh = db.prepare(`SELECT * FROM enhancements WHERE enhancement_id IN (${created.map(() => '?').join(',')})`)
    .all(...created)
    .map((e) => {
      const { file_blob, ...rest } = e;
      return { ...rest, sub_scores: JSON.parse(rest.sub_scores), url: fileUrl(req, rest.file_path) };
    });
  res.status(201).json({ enhancements: enh });
}));

function ownedEnhancement(req) {
  const enh = db.prepare('SELECT * FROM enhancements WHERE enhancement_id = ?').get(req.params.id);
  if (!enh) throw new HttpError(404, 'Enhancement not found');
  const photo = db.prepare('SELECT * FROM photos WHERE photo_id = ?').get(enh.photo_id);
  if (!photo || photo.user_id !== req.user.user_id) throw new HttpError(404, 'Enhancement not found');
  return { enh, photo };
}

// POST /api/enhancements/:id/save  (swipe right -> Passed; FR-13)
router.post('/enhancements/:id/save', requireUser, ah(async (req, res) => {
  const { enh } = ownedEnhancement(req);
  db.prepare("UPDATE enhancements SET state = 'saved' WHERE enhancement_id = ?").run(enh.enhancement_id);
  res.json({ enhancement_id: enh.enhancement_id, state: 'saved' });
}));

// POST /api/enhancements/:id/discard  (swipe left -> Failed; FR-13)
router.post('/enhancements/:id/discard', requireUser, ah(async (req, res) => {
  const { enh } = ownedEnhancement(req);
  db.prepare("UPDATE enhancements SET state = 'discarded' WHERE enhancement_id = ?").run(enh.enhancement_id);
  res.json({ enhancement_id: enh.enhancement_id, state: 'discarded' });
}));

// POST /api/photos/:id/prompt  (FR-15/FR-20: prompt selected enhancement ids -> new versions)
router.post('/:id/prompt', requireUser, requireActiveAccess, ah(async (req, res) => {
  const photo = ownedPhoto(req);
  const { prompt, enhancementIds } = req.body || {};
  if (!prompt || !prompt.trim()) throw new HttpError(400, 'Prompt text is required');
  const ids = Array.isArray(enhancementIds) ? enhancementIds.map(Number).filter(Boolean) : [];

  if (ids.length < 1) {
    if (!photo.file_path) throw new HttpError(400, 'Photo file missing');
    const result = await createPromptedVersions(req, photo, 1, prompt.trim(), photo.file_path);
    return res.status(201).json({
      enhancements: result.enhancements,
      engine: result.engine,
      appliedStyle: result.style,
      notice: result.notice,
    });
  }

  const placeholders = ids.map(() => '?').join(',');
  const valid = db.prepare(
    `SELECT enhancement_id FROM enhancements WHERE photo_id = ? AND enhancement_id IN (${placeholders})`
  ).all(photo.photo_id, ...ids);
  if (valid.length !== ids.length) throw new HttpError(400, 'Invalid enhancement selection');

  const enhRows = db.prepare(
    `SELECT enhancement_id, file_path FROM enhancements WHERE photo_id = ? AND enhancement_id IN (${placeholders})`
  ).all(photo.photo_id, ...ids);

  const allCreated = [];
  let engine = 'sharp';
  let appliedStyle = null;
  let notice = null;
  for (const row of enhRows) {
    const source = row.file_path || photo.file_path;
    const result = await createPromptedVersions(req, photo, 1, prompt.trim(), source);
    engine = result.engine;
    appliedStyle = result.style;
    if (result.notice) notice = result.notice;
    allCreated.push(...result.enhancements);
  }
  res.status(201).json({ enhancements: allCreated, engine, appliedStyle, notice });
}));

// DELETE /api/photos/:id  (FR-19 soft delete)
router.delete('/:id', requireUser, ah(async (req, res) => {
  const photo = ownedPhoto(req);
  db.prepare("UPDATE photos SET status = 'Deleted' WHERE photo_id = ?").run(photo.photo_id);
  audit('user', req.user.user_id, 'delete_photo', { photo_id: photo.photo_id });
  res.json({ message: 'Photo deleted' });
}));

// DELETE /api/photos/enhancements/:id  (FR-19 delete a version)
router.delete('/enhancements/:id', requireUser, ah(async (req, res) => {
  const { enh } = ownedEnhancement(req);
  db.prepare('DELETE FROM enhancements WHERE enhancement_id = ?').run(enh.enhancement_id);
  res.json({ message: 'Enhanced version deleted' });
}));

export default router;
