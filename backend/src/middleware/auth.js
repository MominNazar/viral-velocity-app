import { db } from '../db.js';
import { verifyToken } from '../lib/tokens.js';
import { HttpError } from '../lib/validate.js';

function getBearer(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

export function requireUser(req, _res, next) {
  try {
    const token = getBearer(req);
    if (!token) throw new HttpError(401, 'Authentication required');
    const payload = verifyToken(token);
    if (payload.kind !== 'user') throw new HttpError(401, 'Invalid token');
    const user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(payload.sub);
    if (!user) throw new HttpError(401, 'User not found');
    if (user.disabled) throw new HttpError(403, 'Account disabled');
    req.user = user;
    next();
  } catch (e) {
    next(e instanceof HttpError ? e : new HttpError(401, 'Invalid or expired token'));
  }
}

export function requireAdmin(req, _res, next) {
  try {
    const token = getBearer(req);
    if (!token) throw new HttpError(401, 'Authentication required');
    const payload = verifyToken(token);
    if (payload.kind !== 'admin') throw new HttpError(401, 'Invalid token');
    const admin = db.prepare('SELECT * FROM admins WHERE admin_id = ?').get(payload.sub);
    if (!admin) throw new HttpError(401, 'Admin not found');
    req.admin = admin;
    next();
  } catch (e) {
    next(e instanceof HttpError ? e : new HttpError(401, 'Invalid or expired token'));
  }
}

function getBearerSub(userId) {
  return db.prepare(
    `SELECT * FROM subscriptions WHERE user_id = ? ORDER BY sub_id DESC LIMIT 1`
  ).get(userId);
}

export function requireActiveAccess(req, _res, next) {
  const user = req.user;
  if (!user) return next(new HttpError(401, 'Authentication required'));
  const status = computeAccess(user);
  if (!status.allowed) {
    return next(new HttpError(402, status.reason, { code: 'SUBSCRIPTION_REQUIRED', ...status }));
  }
  req.access = status;
  next();
}

export function computeAccess(user) {
  const today = new Date().toISOString().slice(0, 10);
  const sub = getBearerSub(user.user_id);

  if (sub && (sub.status === 'Active' || sub.status === 'Cancelled')) {
    if (sub.end_date >= today) {
      return {
        allowed: true,
        mode: 'subscription',
        cancelled: sub.status === 'Cancelled',
        accessUntil: sub.end_date,
        dataDeleteAt: sub.data_delete_at || null,
      };
    }
    return {
      allowed: false,
      reason: 'Your subscription has ended. Please subscribe again.',
      accessUntil: sub.end_date,
      dataDeleteAt: sub.data_delete_at || null,
    };
  }

  if (user.plan_type !== 'Free' && user.subscription_status === 'Active') {
    return { allowed: true, mode: 'subscription' };
  }

  if (user.trial_started_at) {
    const started = new Date(user.trial_started_at).getTime();
    const days = (Date.now() - started) / 86400000;
    const within = days <= Number(process.env.TRIAL_DAYS || 30);
    const remaining = Number(process.env.TRIAL_PHOTO_LIMIT || 5) - user.trial_photos_used;
    if (within && remaining > 0) {
      return { allowed: true, mode: 'trial', trialPhotosRemaining: remaining };
    }
    if (!within) return { allowed: false, reason: 'Free trial period has ended. Please subscribe.' };
    return { allowed: false, reason: 'Free trial photo limit reached. Please subscribe.' };
  }
  return { allowed: false, reason: 'Subscription required.' };
}
