import { db } from './db.js';
import { config } from './config.js';
import { ensureDefaults } from './lib/settings.js';
import { hashPassword } from './lib/tokens.js';
import { scorePhoto } from './services/imageScore.js';

async function seed() {
  ensureDefaults();

  // --- Default Super Admin ---
  const adminEmail = 'admin@viralvelocity.app';
  const adminPw = 'Admin123';
  if (!db.prepare('SELECT 1 FROM admins WHERE email = ?').get(adminEmail)) {
    db.prepare(
      `INSERT INTO admins (name, email, password_hash, role) VALUES (?, ?, ?, 'Super Admin')`
    ).run('Site Admin', adminEmail, await hashPassword(adminPw));
    console.log(`Seeded admin: ${adminEmail} / ${adminPw}`);
  }

  // --- Demo users with scored photos ---
  const demoUsers = [
    { name: 'Emily Carter', email: 'emily@example.com', plan: 'Monthly', status: 'Active' },
    { name: 'James Lee', email: 'james@example.com', plan: 'Annual', status: 'Active' },
    { name: 'Sofia Reyes', email: 'sofia@example.com', plan: 'Free', status: 'Active' },
  ];
  const pw = await hashPassword('Demo1234');
  for (const u of demoUsers) {
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(u.email)) continue;
    const now = new Date().toISOString();
    const info = db.prepare(
      `INSERT INTO users (name, email, password_hash, dob, tos_accepted, plan_type, subscription_status, trial_started_at)
       VALUES (?, ?, ?, '1995-05-05', 1, ?, ?, ?)`
    ).run(u.name, u.email, pw, u.plan, u.status, now);
    const userId = info.lastInsertRowid;

    const end = new Date();
    end.setMonth(end.getMonth() + 1);
    db.prepare(
      `INSERT INTO subscriptions (user_id, plan, start_date, end_date, status)
       VALUES (?, ?, ?, ?, 'Active')`
    ).run(userId, u.plan === 'Free' ? 'Free Trial' : u.plan, now.slice(0, 10), end.toISOString().slice(0, 10));

    // A few scored photos + enhancements
    for (let i = 0; i < 3; i += 1) {
      const seed = `${u.email}-photo-${i}`;
      const { score, subScores } = scorePhoto(seed);
      const p = db.prepare(
        `INSERT INTO photos (user_id, batch_id, file_path, score, sub_scores, status)
         VALUES (?, ?, ?, ?, ?, 'Original')`
      ).run(userId, `seed-${i}`, null, score, JSON.stringify(subScores));
      const photoId = p.lastInsertRowid;
      for (let idx = 0; idx < 3; idx += 1) {
        const vSeed = `${seed}::v${idx + 1}`;
        const bias = 6 + (idx + 1) * 2;
        const { score, subScores } = scorePhoto(vSeed, bias);
        db.prepare(
          `INSERT INTO enhancements (photo_id, version_number, score, sub_scores, state)
           VALUES (?, ?, ?, ?, ?)`
        ).run(photoId, idx + 1, score, JSON.stringify(subScores), idx === 0 ? 'saved' : 'discarded');
      }
    }
    console.log(`Seeded user: ${u.email} / Demo1234`);
  }

  console.log('\nSeed complete.');
  console.log(`DB: ${config.dbFile}`);
  db.close();
}

seed();
