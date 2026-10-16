import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { pdfSafe, tablePdf, workbookBuffer } from '../src/lib/reports';

describe('Excel reports', () => {
  it('writes one sheet per table with the header and rows', () => {
    const buffer = workbookBuffer([{ name: 'Register', rows: [['Sheet', 'Rev'], ['M-101', 'R2'], ['A-201', null]] }]);
    const book = XLSX.read(buffer, { type: 'buffer' });
    expect(book.SheetNames).toEqual(['Register']);
    const rows = XLSX.utils.sheet_to_json<string[]>(book.Sheets['Register'] as XLSX.WorkSheet, { header: 1 });
    expect(rows).toEqual([['Sheet', 'Rev'], ['M-101', 'R2'], ['A-201', '']]);
  });
});

describe('PDF reports', () => {
  it('replaces characters the standard font cannot draw', () => {
    expect(pdfSafe('Ground ✓ floor')).toBe('Ground ? floor');
  });

  it('produces a valid PDF and paginates long tables', async () => {
    const rows = Array.from({ length: 120 }, (_, i) => [`M-${i}`, 'Ground floor layout', 'HVAC', 'R1']);
    const bytes = await tablePdf({ title: 'Register', subtitle: 'NRH-BLR-01', header: ['Sheet', 'Title', 'Discipline', 'Rev'], rows });
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe('%PDF-');
    const { PDFDocument } = await import('pdf-lib');
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(1);
  });
});
