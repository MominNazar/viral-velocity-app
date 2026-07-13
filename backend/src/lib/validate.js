export const isEmail = (v) => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

/** Reject placeholder / non-deliverable domains (e.g. example.com used in seed data). */
const BLOCKED_EMAIL_DOMAINS = new Set([
  'example.com',
  'example.org',
  'example.net',
  'test.com',
  'test.org',
  'localhost',
  'invalid',
  'email.com',
  'mailinator.com',
]);

export function isDeliverableEmail(v) {
  if (!isEmail(v)) return false;
  const domain = v.trim().toLowerCase().split('@')[1] || '';
  if (BLOCKED_EMAIL_DOMAINS.has(domain)) return false;
  if (domain.endsWith('.local') || domain.endsWith('.test')) return false;
  return true;
}

export const isStrongPassword = (v) =>
  typeof v === 'string' && v.length >= 8 && /[A-Za-z]/.test(v) && /\d/.test(v);

export function ageFromDob(dob) {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age;
}

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}
