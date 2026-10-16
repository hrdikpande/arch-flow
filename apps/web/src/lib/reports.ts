/**
 * Report builders: Excel (SheetJS) and PDF (pdf-lib). Pure functions over plain rows,
 * so they can be tested without a database.
 */

import * as XLSX from 'xlsx';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export type Cell = string | number | boolean | null | undefined;

export function workbookBuffer(sheets: { name: string; rows: Cell[][] }[]): Buffer {
  const book = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(sheet.rows.map((r) => r.map((c) => (c === null || c === undefined ? '' : c))));
    XLSX.utils.book_append_sheet(book, ws, sheet.name.slice(0, 31));
  }
  return Buffer.from(XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Uint8Array);
}

/** PDF text uses the standard font (WinAnsi). Characters outside it are replaced so the file never fails. */
export function pdfSafe(text: string): string {
  return text.replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');
}

export interface PdfTable {
  title: string;
  subtitle: string;
  header: string[];
  rows: string[][];
}

const PAGE_W = 842; // A4 landscape, points
const PAGE_H = 595;
const MARGIN = 36;

export async function tablePdf(table: PdfTable): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const columnCount = Math.max(1, table.header.length);
  const colW = (PAGE_W - MARGIN * 2) / columnCount;
  const fontSize = columnCount > 8 ? 7 : 8.5;
  const lineH = fontSize + 5;
  const fit = (text: string) => {
    const maxChars = Math.max(4, Math.floor(colW / (fontSize * 0.5)));
    const clean = pdfSafe(text);
    return clean.length > maxChars ? `${clean.slice(0, maxChars - 1)}…`.replace('…', '.') : clean;
  };

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;
  let pageNumber = 1;
  const drawHeader = () => {
    page.drawText(pdfSafe(table.title), { x: MARGIN, y, size: 14, font: bold, color: rgb(0.12, 0.24, 0.2) });
    y -= 18;
    page.drawText(pdfSafe(table.subtitle), { x: MARGIN, y, size: 9, font, color: rgb(0.37, 0.36, 0.33) });
    y -= 20;
    table.header.forEach((h, i) => page.drawText(fit(h), { x: MARGIN + i * colW + 2, y, size: fontSize, font: bold }));
    y -= 4;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.6, color: rgb(0.8, 0.8, 0.78) });
    y -= lineH;
  };
  const footer = () => {
    page.drawText(`Page ${pageNumber}`, { x: PAGE_W - MARGIN - 40, y: MARGIN / 2, size: 8, font, color: rgb(0.5, 0.5, 0.5) });
  };
  drawHeader();
  if (table.rows.length === 0) page.drawText('No rows.', { x: MARGIN, y, size: fontSize, font });
  for (const row of table.rows) {
    if (y < MARGIN + lineH) {
      footer();
      page = doc.addPage([PAGE_W, PAGE_H]);
      pageNumber += 1;
      y = PAGE_H - MARGIN;
      drawHeader();
    }
    row.forEach((cell, i) => page.drawText(fit(cell ?? ''), { x: MARGIN + i * colW + 2, y, size: fontSize, font }));
    y -= lineH;
  }
  footer();
  return doc.save();
}
