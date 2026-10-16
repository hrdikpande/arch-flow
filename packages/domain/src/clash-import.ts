/**
 * Clash import (CLS-04). One row per clash. Columns follow the coordination export
 * (Navisworks clash report, saved as CSV or XLSX). Duplicates are matched by the source reference.
 */

export const CLASH_COLUMNS = [
  'Clash Number',
  'Title',
  'Priority',
  'Discipline A',
  'Discipline B',
  'Sheets',
  'Source Reference',
  'Description',
] as const;

export type ClashColumn = (typeof CLASH_COLUMNS)[number];
export type ClashPriority = 'critical' | 'major' | 'minor';

export interface ClashLookups {
  /** Discipline display names to codes. */
  disciplineNames: ReadonlyMap<string, string>;
  /** Sheet numbers in the project. */
  sheetNumbers: ReadonlySet<string>;
  /** Clash numbers already in the project. */
  existingNumbers: ReadonlySet<string>;
  /** Source references already imported, so re-imports are skipped. */
  existingSourceRefs: ReadonlySet<string>;
}

export interface ImportedClash {
  rowNumber: number;
  number: string;
  title: string;
  priority: ClashPriority;
  disciplineA: string | null;
  disciplineB: string | null;
  sheets: string[];
  sourceRef: string | null;
  description: string | null;
}

export interface ClashRowError {
  rowNumber: number;
  column?: ClashColumn;
  message: string;
}

export interface ClashValidation {
  rows: ImportedClash[];
  errors: ClashRowError[];
  skipped: { rowNumber: number; reason: string }[];
  total: number;
  missingColumns: ClashColumn[];
}

const PRIORITIES: readonly ClashPriority[] = ['critical', 'major', 'minor'];

export function validateClashRows(
  headers: readonly string[],
  dataRows: readonly (readonly string[])[],
  lookups: ClashLookups,
): ClashValidation {
  const index = new Map(headers.map((h, i) => [h.trim(), i] as const));
  const missingColumns = CLASH_COLUMNS.filter((c) => !index.has(c));
  if (missingColumns.length > 0) return { rows: [], errors: [], skipped: [], total: dataRows.length, missingColumns: [...missingColumns] };

  const cell = (row: readonly string[], column: ClashColumn): string => (row[index.get(column) ?? -1] ?? '').trim();
  const rows: ImportedClash[] = [];
  const errors: ClashRowError[] = [];
  const skipped: { rowNumber: number; reason: string }[] = [];
  const seenNumbers = new Set<string>();
  const seenRefs = new Set<string>();

  dataRows.forEach((raw, i) => {
    const rowNumber = i + 2;
    if (raw.every((c) => (c ?? '').trim() === '')) return;
    const rowErrors: ClashRowError[] = [];
    const fail = (column: ClashColumn | undefined, message: string) => rowErrors.push({ rowNumber, column, message });

    const number = cell(raw, 'Clash Number');
    const title = cell(raw, 'Title');
    const priorityRaw = cell(raw, 'Priority').toLowerCase() || 'minor';
    const discA = cell(raw, 'Discipline A');
    const discB = cell(raw, 'Discipline B');
    const sourceRef = cell(raw, 'Source Reference') || null;
    const sheetsRaw = cell(raw, 'Sheets');

    if (!number) fail('Clash Number', 'Clash Number is required.');
    if (!title) fail('Title', 'Title is required.');
    if (!PRIORITIES.includes(priorityRaw as ClashPriority)) fail('Priority', `Priority "${priorityRaw}" must be critical, major or minor.`);
    const codeA = discA ? lookups.disciplineNames.get(discA) : undefined;
    const codeB = discB ? lookups.disciplineNames.get(discB) : undefined;
    if (discA && !codeA) fail('Discipline A', `Discipline "${discA}" is not in the list.`);
    if (discB && !codeB) fail('Discipline B', `Discipline "${discB}" is not in the list.`);
    const sheets = sheetsRaw.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
    const unknownSheets = sheets.filter((s) => !lookups.sheetNumbers.has(s));
    if (unknownSheets.length > 0) fail('Sheets', `Sheet(s) not in the register: ${unknownSheets.join(', ')}.`);

    if (sourceRef && lookups.existingSourceRefs.has(sourceRef)) {
      skipped.push({ rowNumber, reason: `Source reference ${sourceRef} is already imported.` });
      return;
    }
    if (number && (lookups.existingNumbers.has(number) || seenNumbers.has(number))) fail('Clash Number', `Clash ${number} already exists.`);
    if (sourceRef && seenRefs.has(sourceRef)) fail('Source Reference', `Source reference ${sourceRef} appears more than once.`);
    if (number) seenNumbers.add(number);
    if (sourceRef) seenRefs.add(sourceRef);

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      return;
    }
    rows.push({
      rowNumber,
      number,
      title,
      priority: priorityRaw as ClashPriority,
      disciplineA: codeA ?? null,
      disciplineB: codeB ?? null,
      sheets,
      sourceRef,
      description: cell(raw, 'Description') || null,
    });
  });

  return { rows, errors, skipped, total: dataRows.length, missingColumns: [] };
}
