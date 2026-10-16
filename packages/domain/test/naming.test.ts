import { describe, expect, it } from 'vitest';
import {
  buildFileName,
  buildTransmittalNumber,
  checkFileName,
  nextRevisionCode,
  revisionForFileName,
} from '../src/naming';

const parts = { projectCode: 'NRH-BLR-01', disciplineCode: 'HVAC', sheetNumber: 'M-101', revCode: 'R2', extension: 'DWG' };

describe('file naming (FIL-03)', () => {
  it('builds the proposed name with two-digit revision', () => {
    expect(buildFileName(parts)).toBe('NRH-BLR-01_HVAC_M-101_R02.dwg');
  });

  it('accepts a matching upload regardless of case', () => {
    expect(checkFileName('nrh-blr-01_hvac_m-101_r02.DWG', parts).matches).toBe(true);
  });

  it('flags a mismatch and suggests the expected name', () => {
    const check = checkFileName('M-101 final.dwg', parts);
    expect(check.matches).toBe(false);
    expect(check.expected).toBe('NRH-BLR-01_HVAC_M-101_R02.dwg');
  });

  it('rejects unknown tokens and bad revision codes', () => {
    expect(() => buildFileName({ ...parts, pattern: '{PROJECT}_{OWNER}' })).toThrow(/Unknown token/);
    expect(() => revisionForFileName('X1')).toThrow();
  });
});

describe('revisions', () => {
  it('moves to the next revision code', () => {
    expect(nextRevisionCode(null)).toBe('R0');
    expect(nextRevisionCode('R2')).toBe('R3');
  });
});

describe('transmittal numbers (TRN-02, decision 38)', () => {
  it('uses project code, year and month, and a three-digit sequence', () => {
    expect(buildTransmittalNumber({ projectCode: 'NRH-BLR-01', yearMonth: '202611', sequence: 1 })).toBe(
      'NRH-BLR-01-TR-202611-001',
    );
  });

  it('rejects a sequence below 1 and a malformed month', () => {
    expect(() => buildTransmittalNumber({ projectCode: 'X', yearMonth: '2026-11', sequence: 1 })).toThrow();
    expect(() => buildTransmittalNumber({ projectCode: 'X', yearMonth: '202611', sequence: 0 })).toThrow();
  });
});
