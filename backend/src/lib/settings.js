import { db } from '../db.js';
import { config } from '../config.js';

const DEFAULTS = {
  moderation_tolerance: String(config.moderationTolerance),
  data_retention_days: String(config.dataRetentionDays),
  // Pricing / discount config (FR-22, FR-35). Discounts are percentages.
  pricing: JSON.stringify({
    monthly: { price: 9.99, discount: 0 },
    annual: { price: 99.99, discount: 20 },
  }),
};

export function getSetting(key) {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key);
  if (row) return row.value;
  return DEFAULTS[key] ?? null;
}

export function getJSON(key) {
  const v = getSetting(key);
  try {
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}

export function setSetting(key, value) {
  const v = typeof value === 'string' ? value : JSON.stringify(value);
  db.prepare(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, v);
  return v;
}

export function ensureDefaults() {
  for (const [k, v] of Object.entries(DEFAULTS)) {
    const exists = db.prepare('SELECT 1 FROM app_settings WHERE key = ?').get(k);
    if (!exists) setSetting(k, v);
  }
}
