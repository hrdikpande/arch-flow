/**
 * Validation of Gemini-written digest text (DIG-04, DIG-05, ARCHITECTURE.md 3.9).
 *
 * Rule: every number in the AI text must appear in the source data the model
 * was given. If anything fails, the caller sends the deterministic text instead.
 * This does not make the model correct. It stops invented figures, sheet numbers,
 * dates and links from reaching the owner.
 */

export const AI_TEXT_MAX_CHARS = 800;

/** Words that should never appear in a digest paragraph. */
const FORBIDDEN_PATTERNS: readonly RegExp[] = [
  /https?:\/\//i,
  /\bwww\./i,
  /api[\s_-]?key/i,
  /password/i,
  /ignore (all|previous|the above)/i,
  /\bsend (this|all|the) (data|files?|drawings?)\b/i,
];

export interface AiValidationResult {
  ok: boolean;
  reason?: string;
}

/** Every digit run that appears anywhere in the structured input. */
export function allowedNumbersFrom(source: unknown): Set<string> {
  const json = JSON.stringify(source) ?? '';
  return new Set(json.match(/\d+/g) ?? []);
}

export function validateAiText(aiText: string, sourceData: unknown): AiValidationResult {
  const text = aiText.trim();
  if (text.length === 0) return { ok: false, reason: 'empty' };
  if (text.length > AI_TEXT_MAX_CHARS) return { ok: false, reason: 'too long' };
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(text)) return { ok: false, reason: `contains forbidden content (${pattern.source})` };
  }
  const allowed = allowedNumbersFrom(sourceData);
  const numbersInText = text.match(/\d+/g) ?? [];
  const invented = numbersInText.filter((n) => !allowed.has(n));
  if (invented.length > 0) {
    return { ok: false, reason: `numbers not in source data: ${[...new Set(invented)].join(', ')}` };
  }
  return { ok: true };
}
