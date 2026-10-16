/**
 * Revision history import (IMP, section "Importing revision history").
 * One row per revision of a sheet. Only issued revisions carry an issue date and purpose.
 */

export const HISTORY_COLUMNS = ['Project Code', 'Sheet Number', 'Rev Code', 'Status', 'Issued Date', 'Purpose', 'Issued By Email'] as const;
export type HistoryColumn = (typeof HISTORY_COLUMNS)[number];
export type HistoryStatus = 'wip' | 'issued' | 'superseded';
export type HistoryPurpose = 'issued' | 'ifc' | 'gfc';

export interface ImportedRevision {
  rowNumber: number;
  projectCode: string;
  sheetNumber: string;
  revCode: string;
  seq: number;
  status: HistoryStatus;
  issuedDate: string | null;
  purpose: HistoryPurpose | null;
  issuedByEmail: string | null;
}

export interface HistoryLookups {
  projectCodes: ReadonlySet<string>;
  /** Sheets that exist in the project, or are in the same import. Key: "PROJECT|SHEET". */
  sheetKeys: ReadonlySet<string>;
  userEmails: ReadonlySet<string>;
}

export interface HistoryValidation {
  rows: ImportedRevision[];
  errors: { rowNumber: number; column?: HistoryColumn; message: string }[];
  missingColumns: HistoryColumn[];
}

const STATUSES: readonly HistoryStatus[] = ['wip', 'issued', 'superseded'];
const PURPOSES: readonly HistoryPurpose[] = ['issued', 'ifc', 'gfc'];

export function validateRevisionRows(
  headers: readonly string[],
  dataRows: readonly (readonly string[])[],
  lookups: HistoryLookups,
): HistoryValidation {
  const index = new Map(headers.map((h, i) => [h.trim(), i] as const));
  const missingColumns = HISTORY_COLUMNS.filter((c) => !index.has(c));
  if (missingColumns.length > 0) return { rows: [], errors: [], missingColumns: [...missingColumns] };

  const cell = (row: readonly string[], column: HistoryColumn): string => (row[index.get(column) ?? -1] ?? '').trim();
  const rows: ImportedRevision[] = [];
  const errors: HistoryValidation['errors'] = [];
  const seen = new Set<string>();

  dataRows.forEach((raw, i) => {
    const rowNumber = i + 2;
    if (raw.every((c) => (c ?? '').trim() === '')) return;
    const rowErrors: HistoryValidation['errors'] = [];
    const fail = (column: HistoryColumn | undefined, message: string) => rowErrors.push({ rowNumber, column, message });

    const projectCode = cell(raw, 'Project Code').toUpperCase();
    const sheetNumber = cell(raw, 'Sheet Number');
    const revCode = cell(raw, 'Rev Code').toUpperCase();
    const status = cell(raw, 'Status').toLowerCase() as HistoryStatus;
    const issuedDate = cell(raw, 'Issued Date') || null;
    const purpose = (cell(raw, 'Purpose').toLowerCase() || null) as HistoryPurpose | null;
    const issuedByEmail = cell(raw, 'Issued By Email').toLowerCase() || null;

    if (!lookups.projectCodes.has(projectCode)) fail('Project Code', `Project "${projectCode || '(empty)'}" is not available to you.`);
    if (!lookups.sheetKeys.has(`${projectCode}|${sheetNumber}`)) fail('Sheet Number', `Sheet "${sheetNumber}" is not in the register for ${projectCode}.`);
    const match = /^R(\d{1,3})$/.exec(revCode);
    if (!match) fail('Rev Code', `Revision "${revCode || '(empty)'}" must look like R0, R1, R2.`);
    if (!STATUSES.includes(status)) fail('Status', 'Status must be wip, issued or superseded.');
    const key = `${projectCode}|${sheetNumber}|${revCode}`;
    if (seen.has(key)) fail('Rev Code', `${revCode} appears twice for sheet ${sheetNumber}.`);
    seen.add(key);
    if (status !== 'wip') {
      if (!issuedDate || !/^\d{4}-\d{2}-\d{2}$/.test(issuedDate)) fail('Issued Date', 'Issued revisions need an issued date (YYYY-MM-DD).');
      if (!purpose || !PURPOSES.includes(purpose)) fail('Purpose', 'Issued revisions need a purpose: issued, ifc or gfc.');
      if (!issuedByEmail || !lookups.userEmails.has(issuedByEmail)) fail('Issued By Email', 'Issued revisions need an active user as issuer.');
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      return;
    }
    rows.push({
      rowNumber,
      projectCode,
      sheetNumber,
      revCode,
      seq: Number(match?.[1] ?? 0),
      status,
      issuedDate,
      purpose: status === 'wip' ? null : purpose,
      issuedByEmail: status === 'wip' ? null : issuedByEmail,
    });
  });

  // Revision codes for one sheet must form a sequence with no gaps (R0, R1, R2 ...).
  const bySheet = new Map<string, number[]>();
  for (const r of rows) {
    const k = `${r.projectCode}|${r.sheetNumber}`;
    bySheet.set(k, [...(bySheet.get(k) ?? []), r.seq]);
  }
  // Only the newest issued revision of a sheet is current; earlier issued ones must be "superseded".
  const issuedBySheet = new Map<string, ImportedRevision[]>();
  for (const r of rows) {
    if (r.status !== 'issued') continue;
    const k = `${r.projectCode}|${r.sheetNumber}`;
    issuedBySheet.set(k, [...(issuedBySheet.get(k) ?? []), r]);
  }
  for (const [k, list] of issuedBySheet) {
    const newest = Math.max(...list.map((r) => r.seq));
    for (const r of list) {
      if (r.seq < newest) errors.push({ rowNumber: r.rowNumber, column: 'Status', message: `${r.revCode} of ${k.split('|')[1]} is older than the newest revision, so it must be "superseded".` });
    }
  }
  for (const [k, seqs] of bySheet) {
    const sorted = [...seqs].sort((a, b) => a - b);
    if (sorted.some((s, i) => s !== i)) errors.push({ rowNumber: 0, message: `Revisions of ${k.replace('|', ' ')} have a gap (expected R0, R1, R2 ... with no missing number).` });
  }

  return { rows, errors, missingColumns: [] };
}
