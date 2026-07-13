import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const num = (v, d) => (v === undefined || v === '' ? d : Number(v));

// Prefer DATA_DIR (Render persistent disk mounts here, e.g. /var/data)
const dataDir = process.env.DATA_DIR || path.join(root, 'data');
const uploadsDir = process.env.UPLOADS_DIR || path.join(dataDir, 'uploads');

export const config = {
  root,
  port: num(process.env.PORT, 4000),
  dataDir,
  uploadsDir,
  dbFile: path.join(dataDir, 'viral_velocity.sqlite'),
  migrationsDir: path.join(root, 'migrations'),

  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  jwtRememberExpiresIn: process.env.JWT_REMEMBER_EXPIRES_IN || '30d',

  trialDays: num(process.env.TRIAL_DAYS, 30),
  trialPhotoLimit: num(process.env.TRIAL_PHOTO_LIMIT, 5),

  otpTtlMinutes: num(process.env.OTP_TTL_MINUTES, 10),
  otpMaxAttempts: num(process.env.OTP_MAX_ATTEMPTS, 5),
  otpWindowMinutes: num(process.env.OTP_WINDOW_MINUTES, 15),

  moderationTolerance: num(process.env.MODERATION_TOLERANCE, 70),
  dataRetentionDays: num(process.env.DATA_RETENTION_DAYS, 30),

  replicateApiToken: process.env.REPLICATE_API_TOKEN || '',

  smtp: {
    host: process.env.SMTP_HOST || '',
    port: num(process.env.SMTP_PORT, 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || 'Viral Velocity <no-reply@viralvelocity.app>',
  },
};
