-- Viral Velocity Engine - initial schema
-- Mirrors BRD section 7 (SQLite dialect: ENUM -> TEXT+CHECK, JSON -> TEXT, AUTO_INCREMENT -> AUTOINCREMENT)

-- ---------- Users (BRD User Table) ----------
CREATE TABLE IF NOT EXISTS users (
  user_id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name                TEXT    NOT NULL,
  email               TEXT    NOT NULL UNIQUE,
  password_hash       TEXT    NOT NULL,
  dob                 TEXT,                 -- ISO date; used for under-18 parental popup (FR-4)
  tos_accepted        INTEGER NOT NULL DEFAULT 0,
  plan_type           TEXT    NOT NULL DEFAULT 'Free'
                        CHECK (plan_type IN ('Free','Monthly','Annual')),
  subscription_status TEXT    NOT NULL DEFAULT 'Active'
                        CHECK (subscription_status IN ('Active','Inactive','Expired')),
  trial_started_at    TEXT,                 -- set on signup (FR-6)
  trial_photos_used   INTEGER NOT NULL DEFAULT 0,
  disabled            INTEGER NOT NULL DEFAULT 0,   -- Disable Profile (FR-27)
  created_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------- Photos (BRD Photos Table) ----------
CREATE TABLE IF NOT EXISTS photos (
  photo_id     INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  batch_id     TEXT,                          -- groups a 1-5 photo upload batch
  file_path    TEXT,
  upload_date  TEXT    NOT NULL DEFAULT (datetime('now')),
  score        INTEGER,                        -- Social Score 0-100 (FR-9)
  sub_scores   TEXT,                           -- JSON: technical/composition/etc (FR-10)
  moderation   TEXT    NOT NULL DEFAULT 'clean'
                 CHECK (moderation IN ('clean','blocked')),
  status       TEXT    NOT NULL DEFAULT 'Original'
                 CHECK (status IN ('Original','Enhanced','Deleted'))
);

-- ---------- Enhancements (BRD Enhancements Table) ----------
CREATE TABLE IF NOT EXISTS enhancements (
  enhancement_id INTEGER PRIMARY KEY AUTOINCREMENT,
  photo_id       INTEGER NOT NULL REFERENCES photos(photo_id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,            -- 1-5 (FR-12)
  file_path      TEXT,
  score          INTEGER,
  sub_scores     TEXT,                         -- JSON
  prompt         TEXT,                         -- Add Prompt for Further Edit (FR-15)
  state          TEXT    NOT NULL DEFAULT 'pending'
                   CHECK (state IN ('pending','saved','discarded')),  -- saved=Passed, discarded=Failed
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------- Subscriptions (BRD Subscription Table) ----------
CREATE TABLE IF NOT EXISTS subscriptions (
  sub_id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id             INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  plan                TEXT    NOT NULL
                        CHECK (plan IN ('Free Trial','Monthly','Annual')),
  start_date          TEXT    NOT NULL,
  end_date            TEXT    NOT NULL,
  status              TEXT    NOT NULL
                        CHECK (status IN ('Active','Cancelled','Expired')),
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0,  -- FR-24
  data_delete_at      TEXT,                          -- self-deletion deadline (NFR-18)
  created_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------- Admin (BRD Admin Table) ----------
CREATE TABLE IF NOT EXISTS admins (
  admin_id      INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'Super Admin'
                  CHECK (role IN ('Super Admin','Moderator')),
  twofa_enabled INTEGER NOT NULL DEFAULT 0,   -- FR-36 / NFR-7
  twofa_secret  TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------- Supporting tables ----------

-- Password-reset OTPs (FR-1, NFR-6 rate limiting)
CREATE TABLE IF NOT EXISTS otp_codes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT    NOT NULL,
  code_hash  TEXT    NOT NULL,
  purpose    TEXT    NOT NULL DEFAULT 'password_reset',
  attempts   INTEGER NOT NULL DEFAULT 0,
  used       INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Email verification tokens (welcome / change-password verification: FR-3, FR-26)
CREATE TABLE IF NOT EXISTS email_tokens (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
  token      TEXT    NOT NULL UNIQUE,
  type       TEXT    NOT NULL,   -- 'welcome' | 'change_password'
  used       INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Pending 2FA challenge codes for admin login (NFR-7)
CREATE TABLE IF NOT EXISTS admin_2fa_codes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id   INTEGER NOT NULL REFERENCES admins(admin_id) ON DELETE CASCADE,
  code_hash  TEXT    NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0,
  used       INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- App-wide settings: moderation tolerance, retention window, plan pricing/discounts (FR-22/32/35)
CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Audit log for sensitive admin/privacy operations (NFR-8, IM-NF8, USR-NF7)
CREATE TABLE IF NOT EXISTS audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_type TEXT,
  actor_id   INTEGER,
  action     TEXT NOT NULL,
  detail     TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_photos_user      ON photos(user_id);
CREATE INDEX IF NOT EXISTS idx_enh_photo        ON enhancements(photo_id);
CREATE INDEX IF NOT EXISTS idx_subs_user        ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_otp_email        ON otp_codes(email);
