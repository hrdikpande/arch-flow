import { describe, expect, it } from 'vitest';
import { validateClashRows, CLASH_COLUMNS, type ClashLookups } from '../src/clash-import';

const lookups: ClashLookups = {
  disciplineNames: new Map([['Structure', 'STR'], ['HVAC', 'HVAC'], ['Fire', 'FIR']]),
  sheetNumbers: new Set(['M-101', 'S-204']),
  existingNumbers: new Set(['CL-001']),
  existingSourceRefs: new Set(['NW-OLD']),
};
const header = [...CLASH_COLUMNS];

describe('clash import (CLS-04)', () => {
  it('accepts a valid row and maps disciplines to codes', () => {
    const r = validateClashRows(header, [['CL-010', 'Duct vs beam', 'critical', 'HVAC', 'Structure', 'M-101, S-204', 'NW-101', '']], lookups);
    expect(r.errors).toEqual([]);
    expect(r.rows[0]).toMatchObject({ number: 'CL-010', priority: 'critical', disciplineA: 'HVAC', disciplineB: 'STR', sheets: ['M-101', 'S-204'], sourceRef: 'NW-101' });
  });

  it('skips a source reference that is already imported, without an error', () => {
    const r = validateClashRows(header, [['CL-011', 'Again', 'minor', '', '', '', 'NW-OLD', '']], lookups);
    expect(r.rows).toEqual([]);
    expect(r.errors).toEqual([]);
    expect(r.skipped[0]?.reason).toMatch(/already imported/);
  });

  it('reports bad priority, unknown discipline, unknown sheet and duplicate numbers', () => {
    const r = validateClashRows(header, [
      ['CL-001', 'Clash', 'urgent', 'Plumbing', '', 'Z-9', '', ''],
      ['CL-020', 'One', 'minor', '', '', '', 'NW-1', ''],
      ['CL-020', 'Two', 'minor', '', '', '', 'NW-2', ''],
    ], lookups);
    const messages = r.errors.map((e) => e.message).join(' | ');
    expect(messages).toMatch(/Priority "urgent"/);
    expect(messages).toMatch(/Discipline "Plumbing"/);
    expect(messages).toMatch(/Sheet\(s\) not in the register: Z-9/);
    expect(messages).toMatch(/CL-001 already exists/);
    expect(messages).toMatch(/Clash CL-020 already exists/);
  });

  it('reports missing template columns', () => {
    expect(validateClashRows(['Clash Number'], [], lookups).missingColumns).toContain('Title');
  });
});
