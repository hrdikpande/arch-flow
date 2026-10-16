import { describe, expect, it } from 'vitest';
import { ImportLookups, REGISTER_COLUMNS, validateRegisterRows } from '../src/register-import';

const lookups: ImportLookups = {
  projectCodes: new Set(['NRH-BLR-01']),
  existingSheets: new Map([['NRH-BLR-01', new Set(['A-001'])]]),
  disciplineNames: new Map([['HVAC', 'HVAC'], ['Architecture', 'ARC']]),
  userEmails: new Set(['owner@example.com']),
};

const good = ['NRH-BLR-01', 'M-101', 'Ground floor HVAC', 'HVAC', 'R1', 'Issued', 'owner@example.com', '2026-11-30'];

describe('register import validation (IMP-03, IMP-04)', () => {
  it('accepts a valid row and maps the status label to the state', () => {
    const result = validateRegisterRows([...REGISTER_COLUMNS], [good], lookups);
    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toMatchObject({ sheetNumber: 'M-101', disciplineCode: 'HVAC', status: 'issued', dueDate: '2026-11-30' });
  });

  it('reports every problem per row with its column', () => {
    const bad = ['NRH-XXX', '', '', 'Plumbing', 'Rev1', 'Done', 'nobody@example.com', '30/11/2026'];
    const result = validateRegisterRows([...REGISTER_COLUMNS], [bad], lookups);
    expect(result.rows).toEqual([]);
    const columns = result.errors.map((e) => e.column);
    expect(columns).toEqual(
      expect.arrayContaining(['Project Code', 'Sheet Number', 'Title', 'Discipline', 'Current Revision', 'Status', 'Owner Email', 'Due Date']),
    );
    expect(result.errors.every((e) => e.rowNumber === 2)).toBe(true);
  });

  it('rejects a sheet number already in the project and duplicates within the file', () => {
    const existing = ['NRH-BLR-01', 'A-001', 'Existing', 'Architecture', 'R0', 'WIP', 'owner@example.com', ''];
    const dup1 = ['NRH-BLR-01', 'M-200', 'One', 'HVAC', 'R0', 'WIP', 'owner@example.com', ''];
    const dup2 = ['NRH-BLR-01', 'M-200', 'Two', 'HVAC', 'R0', 'WIP', 'owner@example.com', ''];
    const result = validateRegisterRows([...REGISTER_COLUMNS], [existing, dup1, dup2], lookups);
    expect(result.errors.map((e) => e.message)).toEqual([
      'Sheet "A-001" already exists in project NRH-BLR-01.',
      'Sheet "M-200" appears more than once in this file.',
    ]);
    expect(result.rows.map((r) => r.sheetNumber)).toEqual(['M-200']);
  });

  it('reports missing template columns before reading rows', () => {
    const result = validateRegisterRows(['Project Code', 'Sheet Number'], [], lookups);
    expect(result.missingColumns).toContain('Discipline');
  });

  it('skips blank rows without an error', () => {
    const result = validateRegisterRows([...REGISTER_COLUMNS], [['', '', '', '', '', '', '', '']], lookups);
    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([]);
  });
});
