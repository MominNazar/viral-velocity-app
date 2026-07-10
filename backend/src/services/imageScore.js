import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { config } from '../config.js';

export const SUB_SCORE_KEYS = [
  'technical_quality',
  'composition',
  'emotional_resonance',
  'storytelling',
  'color_psychology',
];

function clamp(n, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function resolvePath(filePath) {
  if (!filePath) return null;
  if (fs.existsSync(filePath)) return filePath;
  const joined = path.join(config.uploadsDir, path.basename(filePath));
  return fs.existsSync(joined) ? joined : null;
}

function hashFallback(seed, bias = 0) {
  const hash = crypto.createHash('sha256').update(String(seed)).digest();
  let a = hash.readUInt32LE(0);
  const rand = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const subScores = {};
  let sum = 0;
  for (const key of SUB_SCORE_KEYS) {
    const v = clamp(45 + rand() * 45 + bias);
    subScores[key] = v;
    sum += v;
  }
  return { score: clamp(sum / SUB_SCORE_KEYS.length), subScores, engine: 'hash-fallback' };
}

/** Map Sharp image stats → BRD-style sub-scores (free, local, no vision AI). */
function scoreFromMetrics({ width, height, stats }, bias = 0) {
  const ch = stats.channels || [];
  const r = ch[0]?.mean ?? 128;
  const g = ch[1]?.mean ?? 128;
  const b = ch[2]?.mean ?? 128;
  const rs = ch[0]?.stdev ?? 0;
  const gs = ch[1]?.stdev ?? 0;
  const bs = ch[2]?.stdev ?? 0;
  const stdevAvg = (rs + gs + bs) / 3;
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const pixels = width * height;

  // Technical: log resolution, exposure curve, detail sweet-spot (not flat, not noisy)
  let technical = 38;
  technical += Math.min(14, Math.log10(Math.max(pixels, 1)) * 1.85);
  technical += Math.max(0, 18 - Math.abs(lum - 128) * 0.14);
  let detail;
  if (stdevAvg < 12) detail = stdevAvg * 0.9;
  else if (stdevAvg <= 42) detail = 10 + (stdevAvg - 12) * 0.38;
  else if (stdevAvg <= 62) detail = 21 - (stdevAvg - 42) * 0.35;
  else detail = Math.max(6, 14 - (stdevAvg - 62) * 0.25);
  technical += detail;
  if (width < 900 || height < 900) technical -= 14;
  if (width < 640 || height < 640) technical -= 10;

  // Composition: common aspect ratios + minimum size
  const ar = width / Math.max(height, 1);
  const targets = [1, 4 / 3, 3 / 4, 3 / 2, 2 / 3, 16 / 9, 9 / 16];
  const arDist = Math.min(...targets.map((t) => Math.abs(Math.log(ar / t))));
  let composition = 78 - arDist * 42;
  if (width < 480 || height < 480) composition -= 12;

  // Emotional: warmth + lively tonal range
  const warmth = r - b;
  let emotional = 48 + warmth * 0.12 + Math.min(22, stdevAvg * 0.28);

  // Storytelling: contrast / dynamic range
  const dynRange = Math.max(r, g, b) - Math.min(r, g, b);
  let storytelling = 42 + dynRange * 0.32 + Math.min(20, stdevAvg * 0.35);

  // Color psychology: saturation spread across channels
  const colorSpread = (Math.abs(r - g) + Math.abs(g - b) + Math.abs(r - b)) / 3;
  let color_psychology = 40 + Math.min(35, colorSpread * 0.55) + Math.min(15, stdevAvg * 0.2);

  const bT = bias * 0.12;
  const subScores = {
    technical_quality: clamp(technical + bT),
    composition: clamp(composition + bias * 0.12),
    emotional_resonance: clamp(emotional + bias * 0.22),
    storytelling: clamp(storytelling + bias * 0.22),
    color_psychology: clamp(color_psychology + bias * 0.18),
  };
  const score = clamp(Object.values(subScores).reduce((a, v) => a + v, 0) / SUB_SCORE_KEYS.length);
  return { score, subScores, engine: 'sharp' };
}

/**
 * Score a photo file using Sharp pixel analysis (free, local).
 * Falls back to deterministic hash if the file is missing or unreadable.
 */
export async function scoreImageFile(filePath, bias = 0) {
  const resolved = resolvePath(filePath);
  if (!resolved) return hashFallback(filePath || 'missing', bias);

  try {
    const base = sharp(resolved).rotate();
    const meta = await base.metadata();
    const stats = await sharp(resolved)
      .rotate()
      .resize(640, 640, { fit: 'inside', withoutEnlargement: true })
      .stats();
    const width = meta.width || stats.channels?.[0]?.max || 1;
    const height = meta.height || 1;
    return scoreFromMetrics({ width, height, stats }, bias);
  } catch {
    return hashFallback(resolved, bias);
  }
}

/** Sync alias kept for tests/seed — prefers path hash fallback when no async context. */
export function scorePhoto(seed, bias = 0) {
  return hashFallback(seed, bias);
}
