/**
 * File names, revision codes and transmittal numbers.
 * Patterns are the proposals in FEATURES.md (SET-03, SET-04) and are configurable.
 */

export const DEFAULT_FILE_PATTERN = '{PROJECT}_{DISCIPLINE}_{SHEET}_{REV}';
export const DEFAULT_TRANSMITTAL_PATTERN = '{PROJECT}-TR-{YYYYMM}-{NNN}';

const FILE_PATTERN_TOKENS = ['PROJECT', 'DISCIPLINE', 'SHEET', 'REV'] as const;
const TRANSMITTAL_TOKENS = ['PROJECT', 'YYYYMM', 'NNN'] as const;

export interface FileNameParts {
  projectCode: string;
  disciplineCode: string;
  sheetNumber: string;
  /** Revision as stored, for example "R2". */
  revCode: string;
  extension: string;
  pattern?: string;
}

/** 'R2' -> 'R02'. Revision codes in file names use two digits. */
export function revisionForFileName(revCode: string): string {
  const match = /^R(\d{1,3})$/.exec(revCode);
  if (!match) throw new RangeError(`Revision code must look like R2, got "${revCode}"`);
  return `R${String(Number(match[1])).padStart(2, '0')}`;
}

export function validatePattern(pattern: string, allowedTokens: readonly string[]): void {
  const tokens = [...pattern.matchAll(/\{([A-Z0-9]+)\}/g)].map((m) => m[1] as string);
  if (tokens.length === 0) throw new RangeError('Pattern must contain at least one token');
  const unknown = tokens.filter((t) => !allowedTokens.includes(t));
  if (unknown.length > 0) throw new RangeError(`Unknown token(s) in pattern: ${unknown.join(', ')}`);
  if (/[\s/\\]/.test(pattern.replace(/\{[A-Z0-9]+\}/g, ''))) {
    throw new RangeError('Pattern literals may not contain spaces or path separators');
  }
}

export function buildFileName(parts: FileNameParts): string {
  const pattern = parts.pattern ?? DEFAULT_FILE_PATTERN;
  validatePattern(pattern, FILE_PATTERN_TOKENS);
  const extension = parts.extension.replace(/^\./, '').toLowerCase();
  if (!/^[a-z0-9]+$/.test(extension)) throw new RangeError('Extension must be letters or digits');
  const base = pattern
    .replace('{PROJECT}', parts.projectCode)
    .replace('{DISCIPLINE}', parts.disciplineCode)
    .replace('{SHEET}', parts.sheetNumber)
    .replace('{REV}', revisionForFileName(parts.revCode));
  return `${base}.${extension}`;
}

export interface FileNameCheck {
  matches: boolean;
  expected: string;
}

/** Compares an uploaded name with the expected one, ignoring case and extension case (FIL-03). */
export function checkFileName(uploadedName: string, parts: FileNameParts): FileNameCheck {
  const expected = buildFileName(parts);
  const uploadedBase = uploadedName.replace(/\.[^.]+$/, '').toLowerCase();
  const expectedBase = expected.replace(/\.[^.]+$/, '').toLowerCase();
  const uploadedExt = (uploadedName.split('.').pop() ?? '').toLowerCase();
  const expectedExt = expected.split('.').pop() ?? '';
  return {
    matches: uploadedBase === expectedBase && uploadedExt === expectedExt,
    expected,
  };
}

export function revisionCode(seq: number): string {
  if (!Number.isInteger(seq) || seq < 0) throw new RangeError('Revision sequence must be a non-negative integer');
  return `R${seq}`;
}

export function nextRevisionCode(currentCode: string | null): string {
  if (currentCode === null) return 'R0';
  const match = /^R(\d{1,3})$/.exec(currentCode);
  if (!match) throw new RangeError(`Revision code must look like R2, got "${currentCode}"`);
  return `R${Number(match[1]) + 1}`;
}

export interface TransmittalNumberParts {
  projectCode: string;
  /** IST year and month, for example "202611". */
  yearMonth: string;
  /** Sequence within the project and month, starting at 1. */
  sequence: number;
  pattern?: string;
}

export function buildTransmittalNumber(parts: TransmittalNumberParts): string {
  const pattern = parts.pattern ?? DEFAULT_TRANSMITTAL_PATTERN;
  validatePattern(pattern, TRANSMITTAL_TOKENS);
  if (!/^\d{6}$/.test(parts.yearMonth)) throw new RangeError('yearMonth must be YYYYMM');
  if (!Number.isInteger(parts.sequence) || parts.sequence < 1) throw new RangeError('sequence must start at 1');
  return pattern
    .replace('{PROJECT}', parts.projectCode)
    .replace('{YYYYMM}', parts.yearMonth)
    .replace('{NNN}', String(parts.sequence).padStart(3, '0'));
}
