import { Router } from 'express';
import { db } from '../db.js';
import { config } from '../config.js';
import { ah } from '../middleware/error.js';
import { requireUser } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { sendMail, templates } from '../services/email.js';
import { audit } from '../lib/audit.js';
import {
  hashPassword, comparePassword, signUserToken,
  generateCode, hashCode, compareCode, randomToken,
} from '../lib/tokens.js';
import { isEmail, isDeliverableEmail, isStrongPassword, ageFromDob, HttpError } from '../lib/validate.js';

const router = Router();

function publicUser(u) {
  return {
    user_id: u.user_id,
    name: u.name,
    email: u.email,
    dob: u.dob,
    plan_type: u.plan_type,
    plan_tier: u.plan_tier || null,
    billing_cycle: u.billing_cycle || null,
    subscription_status: u.subscription_status,
    token_balance: u.token_balance ?? 0,
    trial_started_at: u.trial_started_at,
    trial_photos_used: u.trial_photos_used,
  };
}

// POST /api/auth/signup  (FR-1..FR-6)
router.post('/signup', ah(async (req, res) => {
  const { name, email, password, confirmPassword, dob, acceptTos, parentalConsent } = req.body || {};
  const errors = {};
  if (!name || !name.trim()) errors.name = 'Full name is required';
  if (!isEmail(email)) errors.email = 'A valid email is required';
  else if (!isDeliverableEmail(email)) errors.email = 'Use a real email address (not example.com)';
  if (!isStrongPassword(password)) errors.password = 'Password must be 8+ chars with letters and numbers';
  if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match';
  if (!acceptTos) errors.acceptTos = 'You must accept the Terms of Service and Privacy Policy';
  if (!dob) errors.dob = 'Date of birth is required';
  if (Object.keys(errors).length) throw new HttpError(400, 'Validation failed', errors);

  const age = ageFromDob(dob);
  if (age === null) throw new HttpError(400, 'Validation failed', { dob: 'Invalid date of birth' });
  // FR-4: under-18 requires parental supervision consent to proceed.
  if (age < 18 && !parentalConsent) {
    return res.status(403).json({ error: 'Parental supervision consent required', code: 'PARENTAL_CONSENT_REQUIRED' });
  }

  const exists = db.prepare('SELECT 1 FROM users WHERE email = ?').get(email.toLowerCase());
  if (exists) throw new HttpError(409, 'An account with this email already exists');

  const password_hash = await hashPassword(password);
  const now = new Date().toISOString();
  const info = db.prepare(
    `INSERT INTO users (name, email, password_hash, dob, tos_accepted, plan_type, subscription_status, trial_started_at)
     VALUES (?, ?, ?, ?, 1, 'Free', 'Active', ?)`
  ).run(name.trim(), email.toLowerCase(), password_hash, dob, now);

  const userId = info.lastInsertRowid;
  // FR-6: provision the one-time free trial as a subscription record.
  const end = new Date(Date.now() + config.trialDays * 86400000).toISOString().slice(0, 10);
  db.prepare(
    `INSERT INTO subscriptions (user_id, plan, start_date, end_date, status)
     VALUES (?, 'Free Trial', ?, ?, 'Active')`
  ).run(userId, now.slice(0, 10), end);

  // FR-3: welcome email (best-effort — don't block signup if mail isn't configured yet).
  const tpl = templates.welcome(name.trim());
  try {
    await sendMail({ to: email, subject: tpl.subject, text: tpl.text });
  } catch (err) {
    console.warn('[auth] Welcome email skipped:', err.message);
  }
  db.prepare(`INSERT INTO email_tokens (user_id, token, type) VALUES (?, ?, 'welcome')`)
    .run(userId, randomToken());

  const user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId);
  const token = signUserToken(user, false);
  audit('user', userId, 'signup', { email: user.email });
  res.status(201).json({ token, user: publicUser(user) });
}));

// POST /api/auth/login  (FR-1, Remember Me)
router.post('/login', ah(async (req, res) => {
  const { email, password, rememberMe } = req.body || {};
  const errors = {};
  if (!isEmail(email)) errors.email = 'A valid email is required';
  if (!password) errors.password = 'Password is required';
  if (Object.keys(errors).length) throw new HttpError(400, 'Validation failed', errors);

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user || !(await comparePassword(password, user.password_hash))) {
    throw new HttpError(401, 'Invalid email or password');
  }
  if (user.disabled) throw new HttpError(403, 'This account is disabled');

  const token = signUserToken(user, !!rememberMe);
  res.json({ token, user: publicUser(user), rememberMe: !!rememberMe });
}));

// POST /api/auth/forgot-password  -> send OTP (FR-5, NFR-6 rate limited)
router.post(
  '/forgot-password',
  rateLimit({ windowMs: config.otpWindowMinutes * 60000, max: config.otpMaxAttempts, keyFn: (req) => `otp:${req.ip}` }),
  ah(async (req, res) => {
    const { email } = req.body || {};
    if (!isEmail(email)) throw new HttpError(400, 'Validation failed', { email: 'A valid email is required' });
    if (!isDeliverableEmail(email)) {
      throw new HttpError(400, 'Validation failed', {
        email: 'Use a real email address (not example.com / test addresses).',
      });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
    // Always respond the same way when account missing (don't reveal existence).
    if (user) {
      const code = generateCode();
      const code_hash = await hashCode(code);
      const expires = new Date(Date.now() + config.otpTtlMinutes * 60000).toISOString();
      db.prepare(
        `INSERT INTO otp_codes (email, code_hash, purpose, expires_at) VALUES (?, ?, 'password_reset', ?)`
      ).run(email.toLowerCase(), code_hash, expires);
      const tpl = templates.otp(code);
      try {
        await sendMail({ to: email, subject: tpl.subject, text: tpl.text, html: tpl.html });
      } catch (err) {
        console.error('[auth] OTP email failed:', err.message);
        throw new HttpError(
          503,
          err.code === 'EMAIL_NOT_CONFIGURED'
            ? 'Email delivery is not set up on the server yet. Please try again later.'
            : 'Could not send the verification email. Please try again in a few minutes.'
        );
      }
    }
    res.json({ message: 'If an account exists for that email, an OTP has been sent.' });
  })
);

async function verifyResetOtp(email, otp) {
  const errors = {};
  if (!isEmail(email)) errors.email = 'A valid email is required';
  if (!otp || !/^\d{6}$/.test(String(otp))) errors.otp = 'Enter the 6-digit code';
  if (Object.keys(errors).length) throw new HttpError(400, 'Validation failed', errors);

  const row = db.prepare(
    `SELECT * FROM otp_codes WHERE email = ? AND purpose = 'password_reset' AND used = 0
     ORDER BY id DESC LIMIT 1`
  ).get(email.toLowerCase());

  if (!row) throw new HttpError(400, 'Invalid or expired code');
  if (new Date(row.expires_at).getTime() < Date.now()) throw new HttpError(400, 'Code has expired');
  if (row.attempts >= config.otpMaxAttempts) throw new HttpError(429, 'Too many attempts. Request a new code.');

  const ok = await compareCode(String(otp), row.code_hash);
  if (!ok) {
    db.prepare('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?').run(row.id);
    throw new HttpError(400, 'Incorrect code', { otp: 'Incorrect code' });
  }
  return row;
}

// POST /api/auth/verify-reset-otp  -> check OTP before new-password step (FR-5)
router.post('/verify-reset-otp', ah(async (req, res) => {
  const { email, otp } = req.body || {};
  await verifyResetOtp(email, otp);
  res.json({ message: 'Code verified' });
}));

// POST /api/auth/reset-password  -> verify OTP + set new password (FR-5)
router.post('/reset-password', ah(async (req, res) => {
  const { email, otp, newPassword, confirmPassword } = req.body || {};
  const errors = {};
  if (!isEmail(email)) errors.email = 'A valid email is required';
  if (!otp || !/^\d{6}$/.test(String(otp))) errors.otp = 'Enter the 6-digit code';
  if (!isStrongPassword(newPassword)) errors.newPassword = 'Password must be 8+ chars with letters and numbers';
  if (newPassword !== confirmPassword) errors.confirmPassword = 'Passwords do not match';
  if (Object.keys(errors).length) throw new HttpError(400, 'Validation failed', errors);

  const row = await verifyResetOtp(email, otp);

  const password_hash = await hashPassword(newPassword);
  db.prepare('UPDATE users SET password_hash = ? WHERE email = ?').run(password_hash, email.toLowerCase());
  db.prepare('UPDATE otp_codes SET used = 1 WHERE id = ?').run(row.id);
  audit('user', null, 'password_reset', { email });
  res.json({ message: 'Password updated. You can now log in.' });
}));

// GET /api/auth/me
router.get('/me', requireUser, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// PUT /api/auth/profile  (FR-26: edit Full Name and Email)
router.put('/profile', requireUser, ah(async (req, res) => {
  const { name, email } = req.body || {};
  const errors = {};
  if (!name || !name.trim()) errors.name = 'Full name is required';
  if (!isEmail(email)) errors.email = 'A valid email is required';
  if (Object.keys(errors).length) throw new HttpError(400, 'Validation failed', errors);

  const normalized = email.toLowerCase();
  const taken = db.prepare('SELECT user_id FROM users WHERE email = ? AND user_id != ?').get(normalized, req.user.user_id);
  if (taken) throw new HttpError(409, 'An account with this email already exists');

  db.prepare('UPDATE users SET name = ?, email = ? WHERE user_id = ?').run(name.trim(), normalized, req.user.user_id);
  const user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(req.user.user_id);
  audit('user', user.user_id, 'update_profile', { email: user.email });
  res.json({ user: publicUser(user) });
}));

// POST /api/auth/disable-profile  (FR-27: user disables own profile; credentials retained)
router.post('/disable-profile', requireUser, ah(async (req, res) => {
  db.prepare("UPDATE users SET disabled = 1, subscription_status = 'Inactive' WHERE user_id = ?")
    .run(req.user.user_id);
  audit('user', req.user.user_id, 'disable_profile', {});
  res.json({
    message: 'Profile disabled. Your login credentials are retained but this account cannot be used until reactivated.',
  });
}));

// POST /api/auth/change-password (authenticated, FR-26 verification email)
router.post('/change-password', requireUser, ah(async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body || {};
  const errors = {};
  if (!currentPassword) errors.currentPassword = 'Current password is required';
  if (!isStrongPassword(newPassword)) errors.newPassword = 'Password must be 8+ chars with letters and numbers';
  if (newPassword !== confirmPassword) errors.confirmPassword = 'Passwords do not match';
  if (Object.keys(errors).length) throw new HttpError(400, 'Validation failed', errors);

  const ok = await comparePassword(currentPassword, req.user.password_hash);
  if (!ok) throw new HttpError(401, 'Current password is incorrect');

  const password_hash = await hashPassword(newPassword);
  db.prepare('UPDATE users SET password_hash = ? WHERE user_id = ?').run(password_hash, req.user.user_id);

  const tpl = templates.changePassword('(verification link)');
  await sendMail({ to: req.user.email, subject: tpl.subject, text: tpl.text });
  audit('user', req.user.user_id, 'change_password', {});
  res.json({ message: 'Password changed. A confirmation email has been sent.' });
}));

export default router;
