'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import * as XLSX from 'xlsx';
import { IMPORT_STATUS_LABELS, validateRegisterRows, type ImportedSheet, type SheetState } from '@arch-flow/domain';
import { adminDb } from '@/lib/supabase/admin';
import { assertProjectRole, projectByCode, requireInternal } from '@/lib/access';
import { writeAudit } from '@/lib/audit';
import { errorState, type FormState } from './types';

const IMPORT_BUCKET = 'imports';
const ISSUED_FAMILY: SheetState[] = ['issued', 'gfc', 'ifc'];

/**
 * Step 1 of the register import: parse, validate, and store the result (IMP-02, IMP-03).
 * Nothing is written to the register until the user confirms (IMP-05).
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
    const firstSheet = workbook.SheetNames[0];
    if (!firstSheet) throw new Error('The file has no sheets.');
    const grid = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets[firstSheet] as XLSX.WorkSheet, { header: 1, blankrows: false, defval: '', raw: false }) as string[][];
    const [headers = [], ...dataRows] = grid.map((row) => row.map((c) => String(c ?? '')));

    const db = adminDb();
    const [{ data: existing }, { data: disciplines }, { data: users }] = await Promise.all([
      db.from('sheets').select('sheet_number').eq('project_id', project.id),
      db.from('disciplines').select('code, name'),
      db.from('profiles').select('email').eq('is_active', true),
    ]);
    const lookups = {
      projectCodes: new Set([projectCode]),
      existingSheets: new Map([[projectCode, new Set((existing ?? []).map((s) => s.sheet_number as string))]]),
      disciplineNames: new Map((disciplines ?? []).map((d) => [d.name as string, d.code as string] as const)),
      userEmails: new Set((users ?? []).map((u) => (u.email as string).toLowerCase())),
    };
    const result = validateRegisterRows(headers, dataRows, lookups);
    const status = result.missingColumns.length > 0 || result.errors.length > 0 || result.rows.length === 0 ? 'failed' : 'ready';

    const { data: record, error } = await db
      .from('register_imports')
      .insert({
        project_id: project.id,
        uploaded_by: access.userId,
        status,
        rows_total: result.total,
        rows_ok: result.rows.length,
        rows_failed: result.errors.length,
        errors: result.missingColumns.length > 0 ? [{ rowNumber: 1, message: `Missing columns: ${result.missingColumns.join(', ')}` }] : result.errors,
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    importId = record.id;
    const payload = new Blob([JSON.stringify(result.rows)], { type: 'application/json' });
    const { error: storageError } = await db.storage.from(IMPORT_BUCKET).upload(`${project.id}/${record.id}.json`, payload, { upsert: true });
    if (storageError) throw new Error(storageError.message);
    await writeAudit({ actorId: access.userId, action: 'register.import_prepared', entityType: 'register_import', entityId: record.id, projectId: project.id, after: { total: result.total, ok: result.rows.length, failed: result.errors.length } });
  } catch (error) {
    return errorState(error);
  }
  revalidatePath(`/projects/${projectCode}/register/import`);
  redirect(`/projects/${projectCode}/register/import/${importId}`);
}

/** Step 2: writes the validated rows to the register in one pass (IMP-05). */
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
    const rows = JSON.parse(await blob.text()) as ImportedSheet[];

    const emails = [...new Set(rows.map((r) => r.ownerEmail))];
    const { data: owners } = await db.from('profiles').select('id, email').in('email', emails);
    const ownerIds = new Map((owners ?? []).map((o) => [(o.email as string).toLowerCase(), o.id as string] as const));

    for (const row of rows) {
      const status = IMPORT_STATUS_LABELS[row.status] ?? 'wip';
      const { data: sheet, error } = await db
        .from('sheets')
        .insert({ project_id: record.project_id, sheet_number: row.sheetNumber, title: row.title, discipline_code: row.disciplineCode, status, owner_id: ownerIds.get(row.ownerEmail) ?? null, due_date: row.dueDate, created_by: access.userId })
        .select('id')
        .single();
      if (error) throw new Error(`Row ${row.rowNumber} (${row.sheetNumber}): ${error.message}`);
      const seq = Number(row.revCode.slice(1));
      const isIssued = ISSUED_FAMILY.includes(status);
      const purpose = status === 'gfc' || status === 'ifc' ? status : 'issued';
      const { data: revision, error: revError } = await db
        .from('revisions')
        .insert({
          sheet_id: sheet.id,
          rev_code: row.revCode,
          seq,
          status: isIssued ? 'issued' : 'wip',
          purpose: isIssued ? purpose : null,
          issued_at: isIssued ? new Date().toISOString() : null,
          issued_by: isIssued ? access.userId : null,
          created_by: access.userId,
        })
        .select('id')
        .single();
      if (revError) throw new Error(`Row ${row.rowNumber} (${row.sheetNumber}): ${revError.message}`);
      if (isIssued) await db.from('sheets').update({ current_revision_id: revision.id }).eq('id', sheet.id);
    }
    await db.from('register_imports').update({ status: 'confirmed', confirmed_at: new Date().toISOString() }).eq('id', record.id);
    await writeAudit({ actorId: access.userId, action: 'register.imported', entityType: 'register_import', entityId: record.id, projectId: record.project_id, after: { sheets: rows.length } });
    revalidatePath(`/projects/${project?.code}/register`);
  } catch (error) {
    return errorState(error);
  }
  return { ok: 'Register updated.' };
}
