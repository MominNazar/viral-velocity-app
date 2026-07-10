import crypto from 'node:crypto';
import { getSetting } from '../lib/settings.js';

// Mock moderation (see docs/DECISIONS.md D-6). Produces a deterministic
// "risk" score 0-100 from the file identity/name. An image is BLOCKED when its
// risk exceeds the admin-configured tolerance (NFR-10). Filenames containing
// obvious keywords are forced high-risk so the flow can be demonstrated.

const FLAG_WORDS = ['nsfw', 'violent', 'vulgar', 'gore', 'explicit', 'blocked'];

export function moderate(seed, originalName = '') {
  const tolerance = Number(getSetting('moderation_tolerance')) || 70;
  const lower = String(originalName).toLowerCase();
  let risk;
  if (FLAG_WORDS.some((w) => lower.includes(w))) {
    risk = 95;
  } else {
    const h = crypto.createHash('sha256').update(String(seed)).digest();
    risk = h[0] % 60; // most real images land 0-59 risk -> clean
  }
  const blocked = risk > tolerance;
  return { blocked, risk, tolerance };
}
