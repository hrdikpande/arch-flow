'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import * as XLSX from 'xlsx';
import {
  IMPORT_STATUS_LABELS,
  validateRegisterRows,
  validateRevisionRows,
  type ImportedRevision,
  type ImportedSheet,
  type SheetState,
} from '@arch-flow/domain';
import { adminDb } from '@/lib/supabase/admin';
import { assertProjectRole, projectByCode, requireInternal } from '@/lib/access';
import { writeAudit } from '@/lib/audit';
import { errorState, type FormState } from './types';

const IMPORT_BUCKET = 'imports';
const ISSUED_FAMILY: SheetState[] = ['issued', 'gfc', 'ifc'];
const HISTORY_SHEET_NAMES = ['revision history', 'revisions', 'history'];

interface StoredImport {
  sheets: ImportedSheet[];
  history: ImportedRevision[];
}

function gridOf(workbook: XLSX.WorkBook, name: string): string[][] {
  const sheet = workbook.Sheets[name];
  if (!sheet) return [];
  return (XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, blankrows: false, defval: '', raw: false }) as string[][]).map((row) =>
    row.map((c) => String(c ?? '')),
  );
}

/**
 * Step 1 of the register import: parse, validate, and keep the result for review (IMP-02, IMP-03).
 * The first sheet is the register (one row per sheet, current revision). An optional
 * "Revision history" sheet adds every earlier revision. Nothing is written until confirmed.
 */
export async function prepareImport(_prev: FormState, form: FormData): Promise<FormState> {
  let importId: string | null = null;
  let projectCode = '';
  try {
    const access = await requireInternal();
    projectCode = String(form.get('projectCode') ?? '').trim().toUpperCase();
    const file = form.get('file');
    const project = await projectByCode(projectCode);
    if (!project) throw new Error('Project not found.');
    assertProjectRole(access, project.id, ['project_head', 'discipline_lead']);
    if (!(file instanceof File) || file.size === 0) throw new Error('Choose the completed register file (.xlsx or .csv).');
    if (!/\.(xlsx|csv)$/i.test(file.name)) throw new Error('Only .xlsx and .csv files are accepted.');
    if (file.size > 10 * 1024 * 1024) throw new Error('The register file must be 10 MB or smaller.');

    const workbook = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: 'buffer' });
    const registerName = workbook.SheetNames[0];
    if (!registerName) throw new Error('The file has no sheets.');
    const grid = gridOf(workbook, registerName);
    const [headers = [], ...dataRows] = grid;

    const db = adminDb();
    const [{ data: existing }, { data: disciplines }, { data: users }] = await Promise.all([
      db.from('sheets').select('sheet_number').eq('project_id', project.id),
      db.from('disciplines').select('code, name'),
      db.from('profiles').select('email').eq('is_active', true),
    ]);
    const existingNumbers = new Set((existing ?? []).map((s) => s.sheet_number as string));
    const result = validateRegisterRows(headers, dataRows, {
      projectCodes: new Set([projectCode]),
      existingSheets: new Map([[projectCode, existingNumbers]]),
      disciplineNames: new Map((disciplines ?? []).map((d) => [d.name as string, d.code as string] as const)),
      userEmails: new Set((users ?? []).map((u) => (u.email as string).toLowerCase())),
    });

    const historyName = workbook.SheetNames.slice(1).find((n) => HISTORY_SHEET_NAMES.includes(n.trim().toLowerCase()));
    let history: ReturnType<typeof validateRevisionRows> = { rows: [], errors: [], missingColumns: [] };
    if (historyName) {
      const [historyHeaders = [], ...historyRows] = gridOf(workbook, historyName);
      const keys = new Set<string>([...existingNumbers].map((n) => `${projectCode}|${n}`));
      for (const row of result.rows) keys.add(`${projectCode}|${row.sheetNumber}`);
      history = validateRevisionRows(historyHeaders, historyRows, {
        projectCodes: new Set([projectCode]),
        sheetKeys: keys,
        userEmails: new Set((users ?? []).map((u) => (u.email as string).toLowerCase())),
      });
    }

    const errors = [
      ...result.errors,
      ...history.errors.map((e) => ({ ...e, message: `Revision history: ${e.message}` })),
      ...(result.missingColumns.length > 0 ? [{ rowNumber: 1, message: `Missing columns: ${result.missingColumns.join(', ')}` }] : []),
      ...(history.missingColumns.length > 0 ? [{ rowNumber: 1, message: `Revision history: missing columns ${history.missingColumns.join(', ')}` }] : []),
    ];
    const ready = errors.length === 0 && result.rows.length > 0;

    const { data: record, error } = await db
      .from('register_imports')
      .insert({
        project_id: project.id,
        uploaded_by: access.userId,
        status: ready ? 'ready' : 'failed',
        rows_total: result.total + history.rows.length,
        rows_ok: result.rows.length + history.rows.length,
        rows_failed: errors.length,
        errors,
        history_rows: history.rows.length,
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    importId = record.id;
    const stored: StoredImport = { sheets: result.rows, history: history.rows };
    const { error: storageError } = await db.storage.from(IMPORT_BUCKET).upload(`${project.id}/${record.id}.json`, new Blob([JSON.stringify(stored)], { type: 'application/json' }), { upsert: true });
    if (storageError) throw new Error(storageError.message);
    await writeAudit({ actorId: access.userId, action: 'register.import_prepared', entityType: 'register_import', entityId: record.id, projectId: project.id, after: { sheets: result.rows.length, history: history.rows.length, errors: errors.length } });
  } catch (error) {
    return errorState(error);
  }
  revalidatePath(`/projects/${projectCode}/register/import`);
  redirect(`/projects/${projectCode}/register/import/${importId}`);
}

/** Step 2: writes the validated sheets and revision history in one pass (IMP-05). */
export async function confirmImport(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const access = await requireInternal();
    const importId = String(form.get('importId') ?? '');
    const db = adminDb();
    const { data: record } = await db.from('register_imports').select('id, project_id, status').eq('id', importId).maybeSingle();
    if (!record) throw new Error('Import not found.');
    if (record.status !== 'ready') throw new Error('Only a ready import can be confirmed.');
    assertProjectRole(access, record.project_id, ['project_head', 'discipline_lead']);
    const { data: project } = await db.from('projects').select('code').eq('id', record.project_id).single();
    const { data: blob, error: downloadError } = await db.storage.from(IMPORT_BUCKET).download(`${record.project_id}/${record.id}.json`);
    if (downloadError || !blob) throw new Error('The validated rows could not be loaded. Upload the file again.');
    const stored = JSON.parse(await blob.text()) as StoredImport;

    const emails = [...new Set(stored.sheets.map((r) => r.ownerEmail))];
    const { data: owners } = await db.from('profiles').select('id, email').in('email', emails.length ? emails : ['none']);
    const ownerIds = new Map((owners ?? []).map((o) => [(o.email as string).toLowerCase(), o.id as string] as const));
    const emailIds = new Map<string, string>();
    const issuers = [...new Set(stored.history.map((h) => h.issuedByEmail).filter((e): e is string => Boolean(e)))];
    if (issuers.length) {
      const { data: rows } = await db.from('profiles').select('id, email').in('email', issuers);
      for (const r of rows ?? []) emailIds.set((r.email as string).toLowerCase(), r.id as string);
    }

    const mainSheetIds = new Map<string, string>();
    for (const row of stored.sheets) {
      const status = IMPORT_STATUS_LABELS[row.status] ?? 'wip';
      const { data: sheet, error } = await db
        .from('sheets')
        .insert({ project_id: record.project_id, sheet_number: row.sheetNumber, title: row.title, discipline_code: row.disciplineCode, status, owner_id: ownerIds.get(row.ownerEmail) ?? null, due_date: row.dueDate, created_by: access.userId })
        .select('id')
        .single();
      if (error) throw new Error(`Row ${row.rowNumber} (${row.sheetNumber}): ${error.message}`);
      mainSheetIds.set(row.sheetNumber, sheet.id);
      const history = stored.history.filter((h) => h.sheetNumber === row.sheetNumber);
      if (history.length > 0) continue; // revisions come from the history rows below
      const seq = Number(row.revCode.slice(1));
      const isIssued = ISSUED_FAMILY.includes(status);
      const purpose = status === 'gfc' || status === 'ifc' ? status : 'issued';
      const { data: revision, error: revError } = await db
        .from('revisions')
        .insert({ sheet_id: sheet.id, rev_code: row.revCode, seq, status: isIssued ? 'issued' : 'wip', purpose: isIssued ? purpose : null, issued_at: isIssued ? new Date().toISOString() : null, issued_by: isIssued ? access.userId : null, created_by: access.userId })
        .select('id')
        .single();
      if (revError) throw new Error(`Row ${row.rowNumber} (${row.sheetNumber}): ${revError.message}`);
      if (isIssued) await db.from('sheets').update({ current_revision_id: revision.id }).eq('id', sheet.id);
    }

    // Revision history: every row becomes a revision. Issued rows keep their date, purpose and issuer.
    for (const h of stored.history) {
      const sheetId = mainSheetIds.get(h.sheetNumber) ?? (await db.from('sheets').select('id').eq('project_id', record.project_id).eq('sheet_number', h.sheetNumber).maybeSingle()).data?.id;
      if (!sheetId) throw new Error(`Revision ${h.revCode} of ${h.sheetNumber}: sheet not found.`);
      const issuerId = h.issuedByEmail ? emailIds.get(h.issuedByEmail) ?? null : null;
      const { data: revision, error } = await db
        .from('revisions')
        .insert({
          sheet_id: sheetId,
          rev_code: h.revCode,
          seq: h.seq,
          status: h.status === 'wip' ? 'wip' : h.status,
          purpose: h.status === 'wip' ? null : h.purpose,
          issued_at: h.issuedDate ? new Date(`${h.issuedDate}T09:00:00+05:30`).toISOString() : null,
          issued_by: h.status === 'wip' ? null : issuerId ?? access.userId,
          created_by: access.userId,
        })
        .select('id')
        .single();
      if (error) throw new Error(`Revision ${h.revCode} of ${h.sheetNumber}: ${error.message}`);
      const current = stored.sheets.find((s) => s.sheetNumber === h.sheetNumber);
      if (current && current.revCode === h.revCode && ISSUED_FAMILY.includes(IMPORT_STATUS_LABELS[current.status] ?? 'wip')) {
        await db.from('sheets').update({ current_revision_id: revision.id }).eq('id', sheetId);
      }
    }

    await db.from('register_imports').update({ status: 'confirmed', confirmed_at: new Date().toISOString() }).eq('id', record.id);
    await writeAudit({ actorId: access.userId, action: 'register.imported', entityType: 'register_import', entityId: record.id, projectId: record.project_id, after: { sheets: stored.sheets.length, revisions: stored.history.length } });
    revalidatePath(`/projects/${project?.code}/register`);
  } catch (error) {
    return errorState(error);
  }
  return { ok: 'Register updated.' };
}
