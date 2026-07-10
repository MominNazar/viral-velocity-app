import { HttpError } from '../lib/validate.js';

export function notFound(_req, res) {
  res.status(404).json({ error: 'Not found' });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  // Multer upload errors (e.g. too many files / file too large) -> graceful 400 (NFR-3).
  if (err && typeof err.code === 'string' && err.code.startsWith('LIMIT_')) {
    const msg = err.code === 'LIMIT_FILE_SIZE'
      ? 'One of the files is too large.'
      : 'Too many files. Upload 1-5 photos per batch.';
    return res.status(400).json({ error: msg });
  }
  console.error('[error]', err);
  res.status(500).json({ error: 'Internal server error' });
}

// Wraps async route handlers so thrown errors reach the error middleware.
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
