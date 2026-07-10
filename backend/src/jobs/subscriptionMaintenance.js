import fs from 'node:fs';
import { db } from '../db.js';
import { config } from '../config.js';

/** Expire ended subscriptions and purge user data past retention (SB-F10, SB-F11). */
export function runSubscriptionMaintenance() {
  const today = new Date().toISOString().slice(0, 10);
  let expired = 0;
  let purged = 0;

  const ended = db.prepare(
    `SELECT s.*, u.user_id FROM subscriptions s
     JOIN users u ON u.user_id = s.user_id
     WHERE s.end_date < ? AND s.status IN ('Active', 'Cancelled')`
  ).all(today);

  for (const sub of ended) {
    db.prepare(`UPDATE subscriptions SET status = 'Expired' WHERE sub_id = ?`).run(sub.sub_id);
    db.prepare(
      `UPDATE users SET plan_type = 'Free', subscription_status = 'Expired', plan_tier = NULL, billing_cycle = NULL WHERE user_id = ?`
    ).run(sub.user_id);
    expired += 1;
  }

  const due = db.prepare(
    `SELECT DISTINCT user_id FROM subscriptions WHERE data_delete_at IS NOT NULL AND data_delete_at <= ? AND status = 'Expired'`
  ).all(today);

  for (const { user_id } of due) {
    const photos = db.prepare(`SELECT photo_id, file_path FROM photos WHERE user_id = ?`).all(user_id);
    for (const p of photos) {
      if (p.file_path && fs.existsSync(p.file_path)) {
        try { fs.unlinkSync(p.file_path); } catch { /* ignore */ }
      }
      const enh = db.prepare('SELECT file_path FROM enhancements WHERE photo_id = ?').all(p.photo_id);
      for (const e of enh) {
        if (e.file_path && fs.existsSync(e.file_path)) {
          try { fs.unlinkSync(e.file_path); } catch { /* ignore */ }
        }
      }
    }
    db.prepare(`DELETE FROM enhancements WHERE photo_id IN (SELECT photo_id FROM photos WHERE user_id = ?)`).run(user_id);
    db.prepare('DELETE FROM photos WHERE user_id = ?').run(user_id);
    purged += 1;
  }

  if (expired || purged) {
    console.log(`[subscriptions] maintenance: expired=${expired} purgedUsers=${purged}`);
  }
  return { expired, purged };
}

export function startSubscriptionMaintenance(intervalMs = 3600000) {
  runSubscriptionMaintenance();
  return setInterval(runSubscriptionMaintenance, intervalMs);
}
