import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { db } from './db.js';

db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
  name TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);`);

const applied = new Set(db.prepare('SELECT name FROM _migrations').all().map((r) => r.name));
const files = fs
  .readdirSync(config.migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort();

let count = 0;
for (const file of files) {
  if (applied.has(file)) continue;
  const sql = fs.readFileSync(path.join(config.migrationsDir, file), 'utf8');
  const run = db.transaction(() => {
    db.exec(sql);
    db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
  });
  run();
  count += 1;
  console.log(`Applied migration: ${file}`);
}

if (count === 0) console.log('No pending migrations. Database is up to date.');
else console.log(`Done. Applied ${count} migration(s).`);

db.close();
