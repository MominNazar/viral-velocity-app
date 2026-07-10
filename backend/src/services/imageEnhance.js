import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { config } from '../config.js';

const DEFAULT_VARIANT_PROMPTS = [
  'enhance for social media with balanced lighting and clarity',
  'apply warm golden hour tones',
  'make brighter and more airy',
  'rich cinematic contrast',
  'vibrant saturated colors',
];

/** Color-channel recomb matrices (RGB rows). */
const RECOMB = {
  red: [[1.45, 0.08, 0.02], [0.04, 0.78, 0.0], [0.0, 0.02, 0.78]],
  orange: [[1.25, 0.12, 0.0], [0.06, 0.95, 0.0], [0.0, 0.03, 0.85]],
  warm: [[1.12, 0.1, 0.0], [0.04, 1.0, 0.0], [0.0, 0.02, 0.9]],
  yellow: [[1.15, 0.1, 0.0], [0.08, 1.05, 0.0], [0.0, 0.0, 0.82]],
  green: [[0.88, 0.06, 0.0], [0.05, 1.18, 0.04], [0.0, 0.08, 0.88]],
  blue: [[0.85, 0.02, 0.08], [0.0, 0.98, 0.06], [0.06, 0.1, 1.2]],
  cool: [[0.9, 0.02, 0.06], [0.0, 1.0, 0.05], [0.05, 0.08, 1.12]],
  purple: [[0.95, 0.06, 0.12], [0.04, 0.88, 0.14], [0.1, 0.06, 1.15]],
  pink: [[1.12, 0.08, 0.1], [0.06, 0.9, 0.1], [0.08, 0.06, 0.95]],
  sepia: [[1.0, 0.1, 0.05], [0.08, 0.92, 0.02], [0.02, 0.06, 0.78]],
  cinematic: [[1.08, 0.04, 0.02], [0.02, 0.95, 0.02], [0.02, 0.04, 1.05]],
};

const INTENT_RULES = [
  { key: 'red', re: /\b(red|reddish|crimson|maroon|burgundy|scarlet|ruby|cherry)\b/ },
  { key: 'orange', re: /\b(orange|tangerine|peach|coral)\b/ },
  { key: 'warm', re: /\b(warm|warmer|golden|gold|sunset|sunrise|amber|honey|cozy)\b/ },
  { key: 'yellow', re: /\b(yellow|sunny|sunlit|lemon)\b/ },
  { key: 'green', re: /\b(green|greener|lime|forest|nature|foliage)\b/ },
  { key: 'blue', re: /\b(blue|azure|navy|sky|ocean|aqua)\b/ },
  { key: 'cool', re: /\b(cool|cooler|cold|icy|winter|arctic|frost)\b/ },
  { key: 'purple', re: /\b(purple|violet|lavender|magenta)\b/ },
  { key: 'pink', re: /\b(pink|rose|blush|fuchsia)\b/ },
  { key: 'sepia', re: /\b(sepia|vintage|retro|old photo|nostalgic|film)\b/ },
  { key: 'bright', re: /\b(bright|brighter|lighten|lighter|exposure|whiter|illuminate|glow(?:ing)?|airy|luminous)\b/ },
  { key: 'dark', re: /\b(dark|darker|dim|moody|shadow|night|low.?key|underexposed)\b/ },
  { key: 'vibrant', re: /\b(vibrant|vivid|saturat(?:ed|ion)?|pop|colorful|colourful|punchy|bold|amazing|stunning)\b/ },
  { key: 'muted', re: /\b(muted|desaturat(?:ed|ion)?|pastel|subtle|faded|matte)\b/ },
  { key: 'sharp', re: /\b(sharp|sharper|crisp|crisper|detail(?:ed)?|clear(?:er)?|focus(?:ed)?|defined)\b/ },
  { key: 'blur', re: /\b(blur(?:ry)?|soft focus|dreamy|hazy|bokeh)\b/ },
  { key: 'soft', re: /\b(soft(?:er)?)\b/ },
  { key: 'contrast', re: /\b(contrast|punch|dramatic|depth|dynamic range|hdr)\b/ },
  { key: 'cinematic', re: /\b(cinematic|cinema|movie|blockbuster|teal.?orange)\b/ },
  { key: 'natural', re: /\b(natural|realistic|true.?to.?life|authentic)\b/ },
  { key: 'instagram', re: /\b(instagram|insta|tiktok|social media|feed|viral)\b/ },
  { key: 'food', re: /\b(food|meal|dish|appetizing|appetising|delicious|yummy)\b/ },
  { key: 'portrait', re: /\b(portrait|face|selfie|skin|people|person)\b/ },
  { key: 'enhance', re: /\b(enhance|improve|better|fix|polish|upgrade)\b/ },
  { key: 'bw', re: /\b(black\s+and\s+white|b\s*&\s*w|monochrome|grayscale|greyscale)\b/ },
];

const IMPOSSIBLE_RE =
  /\b(add|remove|delete|erase|put|place|insert|swap|replace|turn into|make (?:him|her|them|it) (?:a|an)|wear(?:ing)?)\b/i;

const NEGATE_RE = /\b(no|not|less|reduce|lower|decrease|without|avoid)\s+\w*\s*$/i;
const MORE_RE = /\bmore\s+\w*\s*$/i;

function normalizePrompt(raw) {
  let p = (raw || '').toLowerCase();
  const aliases = [
    [/make (?:the |this )?(?:picture|photo|image) /g, ''],
    [/give (?:it |the photo )?/g, ''],
    [/turn (?:it )?/g, ''],
    [/add (?:a )?/g, ''],
  ];
  for (const [re, rep] of aliases) p = p.replace(re, rep);
  return p.trim();
}

function isNegated(p, idx) {
  const before = p.slice(Math.max(0, idx - 18), idx);
  if (MORE_RE.test(before)) return false;
  return NEGATE_RE.test(before);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Parse free-text into weighted effect intents (0–1 per key).
 * Unknown prompts still get a deterministic hash-based profile.
 */
export function analyzePrompt(prompt, { userPrompted = false } = {}) {
  const raw = (prompt || '').trim();
  const p = normalizePrompt(raw);
  const effects = Object.fromEntries(INTENT_RULES.map((r) => [r.key, 0]));

  for (const { key, re } of INTENT_RULES) {
    const m = p.match(re);
    if (!m || m.index === undefined) continue;
    const negated = isNegated(p, m.index);
    effects[key] = negated ? -0.6 : 0.9;
  }

  // "soft" without blur → gentle muted look; with blur → blur dominates in buildAdjustments
  if (effects.soft > 0 && effects.blur <= 0) {
    effects.muted = Math.max(effects.muted, 0.5);
  }

  let intensity = 1.1;
  if (/\b(very|super|extremely|highly|maximum|max|lot|much)\b/.test(p)) intensity = 1.55;
  else if (/\b(more|extra)\b/.test(p)) intensity = 1.3;
  else if (/\b(slightly|little|bit|subtle|gentle|softly)\b/.test(p)) intensity = 0.85;

  const active = Object.entries(effects).filter(([, v]) => Math.abs(v) > 0.1);
  const generic = active.length === 0;

  let usedAutoFallback = false;

  if (generic && (userPrompted || raw)) {
    usedAutoFallback = true;
    const hash = crypto.createHash('sha256').update(raw || 'enhance').digest();
    const presets = ['warm', 'cool', 'vibrant', 'cinematic', 'bright', 'contrast', 'sepia', 'blue', 'orange', 'red'];
    const pick = presets[hash[0] % presets.length];
    effects[pick] = 0.85;
    effects.sharp = 0.45;
    effects.enhance = 0.5;
    if (hash[1] % 2 === 0) effects.bright = 0.45;
    if (hash[2] % 3 === 0) effects.contrast = 0.4;
    if (hash[3] % 2 === 0) effects.vibrant = 0.35;
  }

  if (effects.enhance > 0 && !generic) {
    effects.sharp = Math.max(effects.sharp, 0.35);
    effects.bright = Math.max(effects.bright, 0.25);
    effects.vibrant = Math.max(effects.vibrant, 0.2);
  }

  const pos = Object.entries(effects).filter(([, v]) => v > 0.1).map(([k]) => k);
  const neg = Object.entries(effects).filter(([, v]) => v < -0.1).map(([k]) => `less-${k}`);
  const parts = [...pos, ...neg];
  let label = parts.length ? parts.join('+') : 'auto-enhance';
  if (usedAutoFallback) label = `auto:${parts.join('+') || 'color'}`;

  const unsupported = userPrompted && usedAutoFallback && IMPOSSIBLE_RE.test((raw || '').toLowerCase());

  return { effects, intensity, generic, usedAutoFallback, unsupported, label };
}

function blendRecomb(matrices, weights) {
  const out = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  let sum = 0;
  for (const [name, w] of weights) {
    const m = RECOMB[name];
    if (!m || w <= 0) continue;
    sum += w;
    for (let r = 0; r < 3; r += 1) {
      for (let c = 0; c < 3; c += 1) {
        out[r][c] += m[r][c] * w;
      }
    }
  }
  if (sum < 0.01) return null;
  for (let r = 0; r < 3; r += 1) {
    for (let c = 0; c < 3; c += 1) {
      out[r][c] /= sum;
    }
  }
  return out;
}

function buildAdjustments(effects, intensity, variantIndex, userPrompted) {
  const vi = ((variantIndex - 1) % 5) + 1;
  const boost = userPrompted ? 1.7 : 1.15;
  const w = (key) => (effects[key] || 0) * intensity * boost;
  const amp = userPrompted ? 1.35 : 1;

  let brightness = 1.04;
  let saturation = 1.1;
  let hue = 0;
  let contrast = 1.0;
  let gamma = 1.0;
  let sharpen = 0;
  let blur = 0;
  let greyscale = false;

  brightness += (w('bright') * 0.18 - w('dark') * 0.18) * amp;
  saturation += (w('vibrant') * 0.32 - w('muted') * 0.26 + w('instagram') * 0.15) * amp;
  contrast += (w('contrast') * 0.16 + w('cinematic') * 0.12) * amp;
  hue += (w('warm') * 12 + w('yellow') * 16 + w('orange') * 14 + w('red') * 22
    - w('cool') * 16 - w('blue') * 18 - w('green') * 10 + w('purple') * 12 + w('pink') * 10) * amp;
  if (w('bright') > 0.2) gamma += w('bright') * 0.1;
  sharpen += (w('sharp') * 1.3 + w('instagram') * 0.5 + w('food') * 0.35 + w('enhance') * 0.4) * amp;
  blur += w('blur') * 1.8;
  if (w('bw') > 0.15) {
    greyscale = true;
    contrast += 0.08 * amp;
    sharpen += 0.25 * amp;
  }

  if (w('natural') > 0.2) {
    brightness += 0.03;
    saturation += 0.05;
    sharpen += 0.35;
  }
  if (w('portrait') > 0.2) {
    brightness += 0.06;
    saturation += 0.08;
    sharpen += 0.35;
  }
  if (w('food') > 0.2) {
    brightness += 0.08;
    saturation += 0.2;
    hue += 10;
  }
  if (w('enhance') > 0.2 && userPrompted) {
    brightness += 0.05;
    saturation += 0.1;
    sharpen += 0.3;
    contrast += 0.05;
  }

  // Variant presets when no user prompt (Enhance flow)
  if (!userPrompted) {
    if (vi === 1) { sharpen += 0.5; contrast += 0.06; }
    if (vi === 2) { hue += 8; saturation += 0.1; }
    if (vi === 3) { brightness += 0.1; }
    if (vi === 4) { contrast += 0.1; saturation += 0.05; hue -= 6; }
    if (vi === 5) { saturation += 0.22; brightness += 0.04; }
  }

  brightness = clamp(brightness, 0.72, 1.35);
  saturation = clamp(saturation, 0.55, 1.65);
  hue = clamp(hue, -45, 45);
  contrast = clamp(contrast, 0.85, 1.28);
  gamma = clamp(gamma, 1.0, 1.25);

  const colorWeights = [
    ['red', Math.max(0, w('red'))],
    ['orange', Math.max(0, w('orange') + w('food') * 0.3)],
    ['warm', Math.max(0, w('warm') + w('portrait') * 0.2)],
    ['yellow', Math.max(0, w('yellow'))],
    ['green', Math.max(0, w('green'))],
    ['blue', Math.max(0, w('blue'))],
    ['cool', Math.max(0, w('cool'))],
    ['purple', Math.max(0, w('purple'))],
    ['pink', Math.max(0, w('pink'))],
    ['sepia', Math.max(0, w('sepia'))],
    ['cinematic', Math.max(0, w('cinematic'))],
  ].filter(([, v]) => v > 0.05);

  return { brightness, saturation, hue, contrast, gamma, sharpen, blur, greyscale, colorWeights };
}

function resolveUploadPath(filePath) {
  if (!filePath) return null;
  if (fs.existsSync(filePath)) return filePath;
  const base = path.basename(filePath);
  const joined = path.join(config.uploadsDir, base);
  return fs.existsSync(joined) ? joined : null;
}

function outPath() {
  const name = `enh-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.jpg`;
  return path.join(config.uploadsDir, name);
}

/** Free local enhancement — interprets any prompt via keyword + hash fallback. */
async function enhanceWithSharp(sourcePath, { prompt, variantIndex, userPrompted = false }) {
  const resolved = resolveUploadPath(sourcePath);
  if (!resolved) throw new Error(`Source image not found: ${sourcePath}`);

  const { effects, intensity, label, unsupported } = analyzePrompt(prompt, { userPrompted });
  const adj = buildAdjustments(effects, intensity, variantIndex, userPrompted);

  let pipeline = sharp(resolved).rotate();

  if (adj.greyscale) {
    pipeline = pipeline.greyscale();
  }

  if (adj.gamma > 1.01) {
    pipeline = pipeline.gamma(adj.gamma);
  }
  if (adj.contrast !== 1) {
    pipeline = pipeline.linear(adj.contrast, -(128 * (adj.contrast - 1)));
  }

  pipeline = pipeline.modulate({
    brightness: adj.brightness,
    saturation: adj.saturation,
    hue: Math.round(adj.hue),
  });

  const recomb = blendRecomb(RECOMB, adj.colorWeights);
  if (recomb) {
    pipeline = pipeline.recomb(recomb);
  }

  if (adj.sharpen > 0.15) {
    pipeline = pipeline.sharpen({
      sigma: clamp(0.6 + adj.sharpen * 0.35, 0.5, 2.2),
      m1: 0.5,
      m2: 0.35,
    });
  }

  if (adj.blur > 0.15) {
    pipeline = pipeline.blur(clamp(adj.blur * 0.6, 0.3, 3));
  }

  const dest = outPath();
  await pipeline.jpeg({ quality: 93, mozjpeg: true }).toFile(dest);
  return { dest, label, unsupported };
}

/**
 * Enhance a photo file. Default: Sharp only (free, no API).
 * Set ENHANCE_ENGINE=replicate + REPLICATE_API_TOKEN for optional paid AI.
 */
export async function enhanceImageFile(sourcePath, { prompt = '', variantIndex = 1, preferAi = false, userPrompted = false } = {}) {
  const enginePref = (process.env.ENHANCE_ENGINE || 'sharp').toLowerCase();
  const useAi = preferAi && enginePref === 'replicate' && Boolean(process.env.REPLICATE_API_TOKEN);

  if (useAi) {
    try {
      const filePath = await enhanceWithReplicate(sourcePath, prompt);
      return { filePath, engine: 'replicate' };
    } catch (err) {
      console.warn('[enhance] Replicate unavailable, using Sharp:', err.message);
    }
  }

  const effectivePrompt = prompt?.trim() || DEFAULT_VARIANT_PROMPTS[(variantIndex - 1) % 5];
  const sharpResult = await enhanceWithSharp(sourcePath, {
    prompt: effectivePrompt,
    variantIndex,
    userPrompted,
  });
  const { dest: filePath, label: style, unsupported } = sharpResult;
  const notice = unsupported
    ? 'This prompt needs AI image editing (add/remove objects). Applied a color/style tweak instead.'
    : undefined;
  return { filePath, engine: 'sharp', style, notice };
}

async function replicateSourceBuffer(sourcePath) {
  const resolved = resolveUploadPath(sourcePath);
  if (!resolved) throw new Error(`Source image not found: ${sourcePath}`);
  return sharp(resolved).rotate().resize(768, 768, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
}

const REPLICATE_PIX2PIX =
  'timothybrooks/instruct-pix2pix:30c1d0b916a6f8efce20493f5d61ee27491ab2a60437c13c588468b9810ec23f';

async function enhanceWithReplicate(sourcePath, prompt) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error('REPLICATE_API_TOKEN is not configured');

  const Replicate = (await import('replicate')).default;
  const replicate = new Replicate({ auth: token });
  const buf = await replicateSourceBuffer(sourcePath);
  const dataUri = `data:image/jpeg;base64,${buf.toString('base64')}`;
  const instruction = prompt?.trim() || 'enhance this photo for social media';

  const output = await replicate.run(REPLICATE_PIX2PIX, {
    input: { image: dataUri, prompt: instruction, num_inference_steps: 25, image_guidance_scale: 1.5 },
  });

  const url = Array.isArray(output) ? output[0] : output;
  if (!url || typeof url !== 'string') throw new Error('Replicate returned no image');

  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to download enhanced image');
  const dest = outPath();
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  return dest;
}

export { DEFAULT_VARIANT_PROMPTS };
