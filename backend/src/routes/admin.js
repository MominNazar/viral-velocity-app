import { Router } from 'express';
import { db } from '../db.js';
import { config } from '../config.js';
import { ah } from '../middleware/error.js';
import { requireAdmin } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { getJSON, setSetting, getSetting } from '../lib/settings.js';
import { audit } from '../lib/audit.js';
import {
  comparePassword, hashPassword, signAdminToken,
  generateCode, hashCode, compareCode,
} from '../lib/tokens.js';
import { isEmail, isStrongPassword, HttpError } from '../lib/validate.js';
import { sendMail } from '../services/email.js';

const router = Router();

function toCsv(rows, columns) {
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map((c) => esc(c.label)).join(',');
  const body = rows.map((r) => columns.map((c) => esc(r[c.key])).join(',')).join('\n');
  return `${header}\n${body}\n`;
}

function maybeCsv(req, res, rows, columns, filename) {
  if (String(req.query.format).toLowerCase() === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(toCsv(rows, columns));
  }
  return null;
}

// ---------------- Auth (FR-28, NFR-7) ----------------

// POST /api/admin/login
router.post(
  '/login',
  rateLimit({ windowMs: 15 * 60000, max: 10, keyFn: (req) => `adminlogin:${req.ip}` }),
  ah(async (req, res) => {
    const { email, password, rememberMe } = req.body || {};
    const errors = {};
    if (!isEmail(email)) errors.email = 'A valid email is required';
    if (!password) errors.password = 'Password is required';
    if (Object.keys(errors).length) throw new HttpError(400, 'Validation failed', errors);

    const admin = db.prepare('SELECT * FROM admins WHERE email = ?').get(email.toLowerCase());
    if (!admin || !(await comparePassword(password, admin.password_hash))) {
      throw new HttpError(401, 'Invalid email or password');
    }

    if (admin.twofa_enabled) {
      const code = generateCode();
      const code_hash = await hashCode(code);
      const expires = new Date(Date.now() + 10 * 60000).toISOString();
      db.prepare('INSERT INTO admin_2fa_codes (admin_id, code_hash, expires_at) VALUES (?, ?, ?)')
        .run(admin.admin_id, code_hash, expires);
      await sendMail({ to: admin.email, subject: 'Your admin 2FA code', text: `Your 2FA code is ${code} (valid 10 minutes).` });
      return res.json({ twofaRequired: true, adminId: admin.admin_id });
    }

    const token = signAdminToken(admin, !!rememberMe);
    res.json({ token, admin: publicAdmin(admin) });
  })
);

// POST /api/admin/verify-2fa
router.post('/verify-2fa', ah(async (req, res) => {
  const { adminId, code, rememberMe } = req.body || {};
  if (!adminId || !/^\d{6}$/.test(String(code || ''))) throw new HttpError(400, 'Enter the 6-digit code');
  const row = db.prepare(
    'SELECT * FROM admin_2fa_codes WHERE admin_id = ? AND used = 0 ORDER BY id DESC LIMIT 1'
  ).get(adminId);
  if (!row) throw new HttpError(400, 'Invalid or expired code');
  if (new Date(row.expires_at).getTime() < Date.now()) throw new HttpError(400, 'Code expired');
  if (row.attempts >= 5) throw new HttpError(429, 'Too many attempts');
  if (!(await compareCode(String(code), row.code_hash))) {
    db.prepare('UPDATE admin_2fa_codes SET attempts = attempts + 1 WHERE id = ?').run(row.id);
    throw new HttpError(400, 'Incorrect code');
  }
  db.prepare('UPDATE admin_2fa_codes SET used = 1 WHERE id = ?').run(row.id);
  const admin = db.prepare('SELECT * FROM admins WHERE admin_id = ?').get(adminId);
  const token = signAdminToken(admin, !!rememberMe);
  res.json({ token, admin: publicAdmin(admin) });
}));

function publicAdmin(a) {
  return { admin_id: a.admin_id, name: a.name, email: a.email, role: a.role, twofa_enabled: !!a.twofa_enabled };
}

router.get('/me', requireAdmin, (req, res) => res.json({ admin: publicAdmin(req.admin) }));

// ---------------- Dashboard (FR-29) ----------------
router.get('/dashboard', requireAdmin, ah(async (_req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  const activeSubs = db.prepare(
    "SELECT COUNT(*) AS c FROM users WHERE plan_type != 'Free' AND subscription_status = 'Active'"
  ).get().c;
  const avgScore = db.prepare("SELECT AVG(score) AS a FROM photos WHERE score IS NOT NULL AND status != 'Deleted'").get().a;
  const pricing = getJSON('pricing') || {};
  // Simple revenue model: active monthly + annual final prices.
  const monthlyCount = db.prepare("SELECT COUNT(*) AS c FROM users WHERE plan_type='Monthly' AND subscription_status='Active'").get().c;
  const annualCount = db.prepare("SELECT COUNT(*) AS c FROM users WHERE plan_type='Annual' AND subscription_status='Active'").get().c;
  const mPrice = (pricing.monthly?.price ?? 9.99) * (1 - (pricing.monthly?.discount ?? 0) / 100);
  const aPrice = (pricing.annual?.price ?? 99.99) * (1 - (pricing.annual?.discount ?? 0) / 100);
  const revenue = +(monthlyCount * mPrice + annualCount * aPrice).toFixed(2);

  const recent = db.prepare(
    `SELECT u.name AS user, u.plan_type AS plan,
            COUNT(p.photo_id) AS images_scored,
            ROUND(AVG(p.score)) AS avg_score,
            MAX(p.upload_date) AS last_active
     FROM users u LEFT JOIN photos p ON p.user_id = u.user_id AND p.status != 'Deleted'
     GROUP BY u.user_id ORDER BY last_active DESC NULLS LAST LIMIT 10`
  ).all();

  res.json({
    kpis: {
      totalUsers,
      activeSubscribers: activeSubs,
      revenue,
      avgImageScore: avgScore ? Math.round(avgScore) : 0,
    },
    recentActivity: recent,
  });
}));

// ---------------- Images Matched (FR-30, FR-31) ----------------
router.get('/images-matched', requireAdmin, ah(async (req, res) => {
  const { user = '', plan = '', minAvg = '' } = req.query;
  const rows = db.prepare(
    `SELECT u.user_id, u.name AS user, u.email, u.plan_type AS plan,
            COUNT(p.photo_id) AS images_scored,
            ROUND(AVG(p.score)) AS avg_score,
            MAX(p.upload_date) AS last_active
     FROM users u LEFT JOIN photos p ON p.user_id = u.user_id AND p.status != 'Deleted'
     GROUP BY u.user_id`
  ).all();
  let filtered = rows;
  if (user) filtered = filtered.filter((r) => r.user.toLowerCase().includes(String(user).toLowerCase()));
  if (plan) filtered = filtered.filter((r) => r.plan === plan);
  if (minAvg) filtered = filtered.filter((r) => (r.avg_score || 0) >= Number(minAvg));

  const columns = [
    { key: 'user', label: 'User' }, { key: 'plan', label: 'Plan' },
    { key: 'images_scored', label: 'Images Scored' }, { key: 'avg_score', label: 'Avg Score' },
    { key: 'last_active', label: 'Last Active' },
  ];
  if (maybeCsv(req, res, filtered, columns, 'images-matched.csv')) return;
  res.json({ rows: filtered });
}));

router.get('/images-matched/:userId', requireAdmin, ah(async (req, res) => {
  const u = db.prepare('SELECT user_id, name, email, plan_type FROM users WHERE user_id = ?').get(req.params.userId);
  if (!u) throw new HttpError(404, 'User not found');
  const photos = db.prepare(
    "SELECT photo_id, score, upload_date, status FROM photos WHERE user_id = ? AND status != 'Deleted' ORDER BY upload_date DESC"
  ).all(u.user_id);
  const enhancements = db.prepare(
    `SELECT e.enhancement_id, e.photo_id, e.version_number, e.score, e.state
     FROM enhancements e JOIN photos p ON p.photo_id = e.photo_id
     WHERE p.user_id = ? AND e.state != 'pending'`
  ).all(u.user_id).map((e) => ({ ...e, result: e.state === 'saved' ? 'Passed' : 'Failed' }));
  res.json({ user: u, uploaded: photos, enhancements });
}));

// DELETE /api/admin/users/:id/images  (admin-side deletion; NFR-9)
router.delete('/users/:id/images', requireAdmin, ah(async (req, res) => {
  db.prepare("UPDATE photos SET status = 'Deleted' WHERE user_id = ?").run(req.params.id);
  audit('admin', req.admin.admin_id, 'admin_delete_user_images', { user_id: Number(req.params.id) });
  res.json({ message: 'User images deleted per retention policy' });
}));

// ---------------- Data self-deletion setting (FR-32, NFR-8) ----------------
router.get('/settings/retention', requireAdmin, (req, res) => {
  const days = Number(getSetting('data_retention_days')) || config.dataRetentionDays;
  res.json({ retentionDays: days, months: Math.floor(days / 30), days: days % 30 });
});

router.put('/settings/retention', requireAdmin, ah(async (req, res) => {
  const { months = 0, days = 0, retentionDays } = req.body || {};
  const total = retentionDays != null ? Number(retentionDays) : Number(months) * 30 + Number(days);
  if (!Number.isFinite(total) || total < 0) throw new HttpError(400, 'Invalid retention window');
  setSetting('data_retention_days', String(total));
  audit('admin', req.admin.admin_id, 'update_retention', { retentionDays: total });
  res.json({ message: 'Retention policy updated', retentionDays: total });
}));

// ---------------- Subscribers (FR-33, FR-34) ----------------
router.get('/subscribers', requireAdmin, ah(async (req, res) => {
  const { q = '', plan = '', status = '' } = req.query;
  let rows = db.prepare(
    `SELECT u.user_id, u.name AS username, u.email, u.plan_type,
            (SELECT end_date FROM subscriptions s WHERE s.user_id = u.user_id ORDER BY sub_id DESC LIMIT 1) AS renewal_date,
            CASE WHEN u.disabled = 1 THEN 'Inactive' ELSE u.subscription_status END AS status
     FROM users u`
  ).all();
  if (q) rows = rows.filter((r) => r.username.toLowerCase().includes(String(q).toLowerCase()) || r.email.toLowerCase().includes(String(q).toLowerCase()));
  if (plan) rows = rows.filter((r) => r.plan_type === plan);
  if (status) rows = rows.filter((r) => (status === 'Active' ? r.status === 'Active' : r.status !== 'Active'));

  const columns = [
    { key: 'username', label: 'User Name' }, { key: 'email', label: 'Email' },
    { key: 'plan_type', label: 'Plan Type' }, { key: 'renewal_date', label: 'Renewal Date' },
    { key: 'status', label: 'Status' },
  ];
  if (maybeCsv(req, res, rows, columns, 'subscribers.csv')) return;
  res.json({ rows });
}));

router.post('/users/:id/activate', requireAdmin, ah(async (req, res) => {
  db.prepare("UPDATE users SET disabled = 0, subscription_status = 'Active' WHERE user_id = ?").run(req.params.id);
  audit('admin', req.admin.admin_id, 'activate_user', { user_id: Number(req.params.id) });
  res.json({ message: 'User activated' });
}));

router.post('/users/:id/deactivate', requireAdmin, ah(async (req, res) => {
  db.prepare("UPDATE users SET disabled = 1, subscription_status = 'Inactive' WHERE user_id = ?").run(req.params.id);
  audit('admin', req.admin.admin_id, 'deactivate_user', { user_id: Number(req.params.id) });
  res.json({ message: 'User deactivated' });
}));

// ---------------- Discount / pricing config (FR-22, FR-35) ----------------
router.get('/pricing', requireAdmin, (_req, res) => {
  res.json({
    pricing: getJSON('pricing'),
    tierPricing: getJSON('tier_pricing'),
    oneTimePacks: getJSON('one_time_packs'),
  });
});

router.put('/pricing', requireAdmin, ah(async (req, res) => {
  const { monthly, annual, tierPricing } = req.body || {};
  if (tierPricing) {
    for (const tier of ['Starter', 'Pro', 'Expert']) {
      const t = tierPricing[tier];
      if (!t) continue;
      for (const cycle of ['monthly', 'annual']) {
        const p = t[cycle];
        if (!p) continue;
        const d = Number(p.discount);
        if (!(d >= 0 && d <= 100)) throw new HttpError(400, `${tier} ${cycle} discount must be 0–100`);
        if (!(Number(p.price) >= 0)) throw new HttpError(400, `${tier} ${cycle} price must be ≥ 0`);
      }
    }
    setSetting('tier_pricing', tierPricing);
    audit('admin', req.admin.admin_id, 'update_tier_pricing', tierPricing);
  }
  if (monthly && annual) {
    const validate = (p, name) => {
      if (!p) throw new HttpError(400, `${name} pricing is required`);
      if (!(Number(p.price) >= 0)) throw new HttpError(400, `${name} price must be a positive number`);
      const d = Number(p.discount);
      if (!(d >= 0 && d <= 100)) throw new HttpError(400, `${name} discount must be between 0 and 100`);
    };
    validate(monthly, 'Monthly');
    validate(annual, 'Annual');
    const pricing = {
      monthly: { price: Number(monthly.price), discount: Number(monthly.discount) },
      annual: { price: Number(annual.price), discount: Number(annual.discount) },
    };
    setSetting('pricing', pricing);
    audit('admin', req.admin.admin_id, 'update_pricing', pricing);
  }
  res.json({
    message: 'Pricing updated',
    pricing: getJSON('pricing'),
    tierPricing: getJSON('tier_pricing'),
  });
}));

// ---------------- Moderation tolerance (NFR-10) ----------------
router.get('/settings/moderation', requireAdmin, (_req, res) =>
  res.json({ tolerance: Number(getSetting('moderation_tolerance')) }));
router.put('/settings/moderation', requireAdmin, ah(async (req, res) => {
  const t = Number(req.body?.tolerance);
  if (!(t >= 0 && t <= 100)) throw new HttpError(400, 'Tolerance must be 0-100');
  setSetting('moderation_tolerance', String(t));
  res.json({ message: 'Moderation tolerance updated', tolerance: t });
}));

// ---------------- Admin profile (FR-36) ----------------
router.put('/profile', requireAdmin, ah(async (req, res) => {
  const { name, email } = req.body || {};
  if (!name || !name.trim()) throw new HttpError(400, 'Validation failed', { name: 'Name is required' });
  if (!isEmail(email)) throw new HttpError(400, 'Validation failed', { email: 'A valid email is required' });
  db.prepare('UPDATE admins SET name = ?, email = ? WHERE admin_id = ?').run(name.trim(), email.toLowerCase(), req.admin.admin_id);
  const admin = db.prepare('SELECT * FROM admins WHERE admin_id = ?').get(req.admin.admin_id);
  res.json({ admin: publicAdmin(admin) });
}));

router.post('/profile/change-password', requireAdmin, ah(async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body || {};
  if (!(await comparePassword(currentPassword || '', req.admin.password_hash))) {
    throw new HttpError(401, 'Current password is incorrect');
  }
  if (!isStrongPassword(newPassword)) throw new HttpError(400, 'Validation failed', { newPassword: '8+ chars with letters and numbers' });
  if (newPassword !== confirmPassword) throw new HttpError(400, 'Validation failed', { confirmPassword: 'Passwords do not match' });
  const hash = await hashPassword(newPassword);
  db.prepare('UPDATE admins SET password_hash = ? WHERE admin_id = ?').run(hash, req.admin.admin_id);
  audit('admin', req.admin.admin_id, 'admin_change_password', {});
  res.json({ message: 'Password changed' });
}));

router.post('/profile/2fa/enable', requireAdmin, ah(async (req, res) => {
  db.prepare('UPDATE admins SET twofa_enabled = 1 WHERE admin_id = ?').run(req.admin.admin_id);
  audit('admin', req.admin.admin_id, 'enable_2fa', {});
  res.json({ message: '2FA enabled. Your next login will require a verification code.', twofa_enabled: true });
}));

router.post('/profile/2fa/disable', requireAdmin, ah(async (req, res) => {
  db.prepare('UPDATE admins SET twofa_enabled = 0 WHERE admin_id = ?').run(req.admin.admin_id);
  audit('admin', req.admin.admin_id, 'disable_2fa', {});
  res.json({ message: '2FA disabled.', twofa_enabled: false });
}));

export default router;
