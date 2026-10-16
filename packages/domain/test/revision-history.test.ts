import { describe, expect, it } from 'vitest';
import { validateRevisionRows, HISTORY_COLUMNS, type HistoryLookups } from '../src/revision-history';

const lookups: HistoryLookups = {
  projectCodes: new Set(['NRH-BLR-01']),
  sheetKeys: new Set(['NRH-BLR-01|M-101']),
  userEmails: new Set(['owner@example.com']),
};
const header = [...HISTORY_COLUMNS];

describe('revision history import', () => {
  it('imports a complete sequence: R0 issued, R1 issued, R2 in progress', () => {
    const r = validateRevisionRows(header, [
      ['NRH-BLR-01', 'M-101', 'R0', 'superseded', '2026-09-01', 'issued', 'owner@example.com'],
      ['NRH-BLR-01', 'M-101', 'R1', 'issued', '2026-09-20', 'ifc', 'owner@example.com'],
      ['NRH-BLR-01', 'M-101', 'R2', 'wip', '', '', ''],
    ], lookups);
    expect(r.errors).toEqual([]);
    expect(r.rows.map((x) => [x.revCode, x.seq, x.status, x.purpose])).toEqual([['R0', 0, 'superseded', 'issued'], ['R1', 1, 'issued', 'ifc'], ['R2', 2, 'wip', null]]);
  });

  it('requires date, purpose and issuer for issued revisions', () => {
    const r = validateRevisionRows(header, [['NRH-BLR-01', 'M-101', 'R0', 'issued', '', '', '']], lookups);
    const messages = r.errors.map((e) => e.message).join(' | ');
    expect(messages).toMatch(/issued date/);
    expect(messages).toMatch(/purpose/);
    expect(messages).toMatch(/issuer/);
  });

  it('rejects a gap in the revision sequence', () => {
    const r = validateRevisionRows(header, [
      ['NRH-BLR-01', 'M-101', 'R0', 'issued', '2026-09-01', 'issued', 'owner@example.com'],
      ['NRH-BLR-01', 'M-101', 'R2', 'wip', '', '', ''],
    ], lookups);
    expect(r.errors.some((e) => /gap/.test(e.message))).toBe(true);
  });

  it('rejects a sheet that is not in the register', () => {
    const r = validateRevisionRows(header, [['NRH-BLR-01', 'Z-1', 'R0', 'wip', '', '', '']], lookups);
    expect(r.errors[0]?.message).toMatch(/not in the register/);
  });

  it('requires older revisions to be superseded', () => {
    const r = validateRevisionRows(header, [
      ['NRH-BLR-01', 'M-101', 'R0', 'issued', '2026-09-01', 'issued', 'owner@example.com'],
      ['NRH-BLR-01', 'M-101', 'R1', 'issued', '2026-09-20', 'issued', 'owner@example.com'],
    ], lookups);
    expect(r.errors.map((e) => e.message).join(' ')).toMatch(/R0 of M-101 is older/);
  });
});
