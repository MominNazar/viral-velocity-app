import { enhanceImageFile } from './imageEnhance.js';
import { scoreImageFile, scorePhoto, SUB_SCORE_KEYS } from './imageScore.js';

export { scorePhoto, SUB_SCORE_KEYS };

/**
 * Generate enhanced image files (Sharp / optional Replicate) with Sharp-based scores.
 */
export async function generateEnhancedVersions(sourcePath, count = 5, userPrompt = '') {
  const n = Math.max(1, Math.min(5, count));
  const hasUserPrompt = Boolean(userPrompt?.trim());
  const useReplicate = (process.env.ENHANCE_ENGINE || 'sharp').toLowerCase() === 'replicate';
  const preferAi = hasUserPrompt && useReplicate;

  // Sequential on free hosts — parallel Sharp OOMs / times out on Render free tier
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const version_number = i + 1;
    const { filePath, engine, style, notice } = await enhanceImageFile(sourcePath, {
      prompt: userPrompt,
      variantIndex: version_number,
      preferAi,
      userPrompted: hasUserPrompt,
    });
    const bias = 4 + version_number * 1.5;
    const { score, subScores } = await scoreImageFile(filePath, bias);
    out.push({
      version_number,
      file_path: filePath,
      engine,
      style: style || null,
      notice: notice || null,
      score,
      subScores,
      prompt: hasUserPrompt ? userPrompt.trim() : null,
    });
  }
  return out;
}

/** @deprecated use generateEnhancedVersions */
export function enhancePhoto(baseSeed, count = 5, prompt = '') {
  void baseSeed;
  const n = Math.max(1, Math.min(5, count));
  return Array.from({ length: n }, (_, i) => {
    const version_number = i + 1;
    const bias = 4 + version_number * 1.5;
    const { score, subScores } = scorePhoto(`${prompt}::v${version_number}`, bias);
    return { version_number, score, subScores, prompt: prompt || null };
  });
}
