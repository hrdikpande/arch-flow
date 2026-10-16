/**
 * Validation of the register import (IMP-02 to IMP-05, template A4).
 * Pure: the caller parses the file (CSV or XLSX) into rows of strings, then
 * passes the lookup data. Nothing is written until the user confirms (IMP-05).
 */

import { assertCalendarDate } from './dates';
import { IMPORT_STATUS_LABELS, type SheetState } from './lifecycle';

export const REGISTER_COLUMNS = [
  'Project Code',
  'Sheet Number',
  'Title',
  'Discipline',
  'Current Revision',
  'Status',
  'Owner Email',
  'Due Date',
] as const;

export type RegisterColumn = (typeof REGISTER_COLUMNS)[number];

export interface ImportLookups {
  /** Project codes the user may import into. */
  projectCodes: ReadonlySet<string>;
  /** Sheet numbers already present, keyed by project code. */
  existingSheets: ReadonlyMap<string, ReadonlySet<string>>;
  /** Discipline display names to codes, for example "HVAC" -> "HVAC". */
  disciplineNames: ReadonlyMap<string, string>;
  /** Active user emails (lower case). */
  userEmails: ReadonlySet<string>;
}

export interface ImportedSheet {
  rowNumber: number;
  projectCode: string;
  sheetNumber: string;
  title: string;
  disciplineCode: string;
  revCode: string;
  status: SheetState;
  ownerEmail: string;
  dueDate: string | null;
}

export interface ImportRowError {
  rowNumber: number;
  column?: RegisterColumn;
  message: string;
}

export interface ImportValidation {
  rows: ImportedSheet[];
  errors: ImportRowError[];
  total: number;
  missingColumns: RegisterColumn[];
}

const REV_RE = /^R\d{1,3}$/;

export function validateRegisterRows(
  headers: readonly string[],
  dataRows: readonly (readonly string[])[],
  lookups: ImportLookups,
): ImportValidation {
  const headerIndex = new Map(headers.map((h, i) => [h.trim(), i] as const));
  const missingColumns = REGISTER_COLUMNS.filter((c) => !headerIndex.has(c));
  if (missingColumns.length > 0) {
    return { rows: [], errors: [], total: dataRows.length, missingColumns: [...missingColumns] };
  }

  const cell = (row: readonly string[], column: RegisterColumn): string =>
    (row[headerIndex.get(column) ?? -1] ?? '').trim();

  const rows: ImportedSheet[] = [];
  const errors: ImportRowError[] = [];
  const seenInFile = new Set<string>();

  dataRows.forEach((raw, index) => {
    const rowNumber = index + 2; // header is row 1
    const rowErrors: ImportRowError[] = [];
    const fail = (column: RegisterColumn | undefined, message: string): void => {
      rowErrors.push({ rowNumber, column, message });
    };

    if (raw.every((c) => (c ?? '').trim() === '')) return; // skip blank rows silently

    const projectCode = cell(raw, 'Project Code');
    const sheetNumber = cell(raw, 'Sheet Number');
    const title = cell(raw, 'Title');
    const disciplineName = cell(raw, 'Discipline');
    const revCode = cell(raw, 'Current Revision');
    const statusLabel = cell(raw, 'Status');
    const ownerEmail = cell(raw, 'Owner Email').toLowerCase();
    const dueRaw = cell(raw, 'Due Date');

    if (!lookups.projectCodes.has(projectCode)) {
      fail('Project Code', `Project "${projectCode || '(empty)'}" does not exist or you have no access to it.`);
    }
    if (!sheetNumber) fail('Sheet Number', 'Sheet Number is required.');
    if (!title) fail('Title', 'Title is required.');

    const disciplineCode = lookups.disciplineNames.get(disciplineName);
    if (!disciplineCode) fail('Discipline', `Discipline "${disciplineName || '(empty)'}" is not in the list.`);

    if (!REV_RE.test(revCode)) fail('Current Revision', `Revision "${revCode || '(empty)'}" must look like R0, R1, R2.`);

    const status = IMPORT_STATUS_LABELS[statusLabel];
    if (!status) fail('Status', `Status "${statusLabel || '(empty)'}" is not in the list.`);

    if (!lookups.userEmails.has(ownerEmail)) {
      fail('Owner Email', `Owner "${ownerEmail || '(empty)'}" is not an active user.`);
    }

    let dueDate: string | null = null;
    if (dueRaw !== '') {
      try {
        assertCalendarDate(dueRaw);
        dueDate = dueRaw;
      } catch {
        fail('Due Date', `Due date "${dueRaw}" must be a real date in the form YYYY-MM-DD.`);
      }
    }

    if (projectCode && sheetNumber) {
      const key = `${projectCode}|${sheetNumber}`;
      if (lookups.existingSheets.get(projectCode)?.has(sheetNumber)) {
        fail('Sheet Number', `Sheet "${sheetNumber}" already exists in project ${projectCode}.`);
      }
      if (seenInFile.has(key)) fail('Sheet Number', `Sheet "${sheetNumber}" appears more than once in this file.`);
      seenInFile.add(key);
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      return;
    }
    rows.push({
      rowNumber,
      projectCode,
      sheetNumber,
      title,
      disciplineCode: disciplineCode as string,
      revCode,
      status: status as SheetState,
      ownerEmail,
      dueDate,
    });
  });

  return { rows, errors, total: dataRows.length, missingColumns: [] };
}
