import { db } from '../db.js';

export function audit(actorType, actorId, action, detail) {
  db.prepare(
    'INSERT INTO audit_log (actor_type, actor_id, action, detail) VALUES (?, ?, ?, ?)'
  ).run(actorType, actorId ?? null, action, detail ? JSON.stringify(detail) : null);
}
