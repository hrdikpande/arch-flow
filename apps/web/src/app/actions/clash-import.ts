'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import * as XLSX from 'xlsx';
import { DRAFT_CRITICAL_RULES, isCriticalClash, validateClashRows, type ImportedClash, type NamedRule } from '@arch-flow/domain';
import { adminDb } from '@/lib/supabase/admin';
import { assertProjectRole, projectByCode, requireInternal } from '@/lib/access';
import { writeAudit } from '@/lib/audit';
import { recordEvent } from '@/lib/events';
import { errorState, type FormState } from './types';

const BUCKET = 'imports';

/** Step 1: parse and validate a clash export (CSV or XLSX), keep the result for review (CLS-04). */
export async function prepareClashImport(_prev: FormState, form: FormData): Promise<FormState> {
  let importId: string | null = null;
  let projectCode = '';
  try {
    const access = await requireInternal();
    projectCode = String(form.get('projectCode') ?? '').trim().toUpperCase();
    const file = form.get('file');
    const project = await projectByCode(projectCode);
    if (!project) throw new Error('Project not found.');
    assertProjectRole(access, project.id, ['project_head', 'discipline_lead']);
    if (!(file instanceof File) || file.size === 0) throw new Error('Choose the clash export file (.csv or .xlsx).');
    if (!/\.(xlsx|csv)$/i.test(file.name)) throw new Error('Only .csv and .xlsx files are accepted.');
    if (file.size > 10 * 1024 * 1024) throw new Error('The clash file must be 10 MB or smaller.');
    const workbook = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: 'buffer' });
    const first = workbook.SheetNames[0];
    if (!first) throw new Error('The file has no sheets.');
    const grid = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets[first] as XLSX.WorkSheet, { header: 1, blankrows: false, defval: '', raw: false }) as string[][];
    const [headers = [], ...dataRows] = grid.map((row) => row.map((c) => String(c ?? '')));

    const db = adminDb();
    const [{ data: disciplines }, { data: sheets }, { data: clashes }, { data: refs }] = await Promise.all([
      db.from('disciplines').select('code, name'),
      db.from('sheets').select('sheet_number').eq('project_id', project.id),
      db.from('clashes').select('number, source_ref').eq('project_id', project.id),
      db.from('clashes').select('source_ref').eq('project_id', project.id).not('source_ref', 'is', null),
    ]);
    const result = validateClashRows(headers, dataRows, {
      disciplineNames: new Map((disciplines ?? []).map((d) => [d.name as string, d.code as string] as const)),
      sheetNumbers: new Set((sheets ?? []).map((s) => s.sheet_number as string)),
      existingNumbers: new Set((clashes ?? []).map((c) => c.number as string)),
      existingSourceRefs: new Set((refs ?? []).map((r) => r.source_ref as string)),
    });
    const status = result.missingColumns.length > 0 || result.rows.length === 0 && result.errors.length > 0 ? 'failed' : 'ready';
    const { data: record, error } = await db
      .from('register_imports')
      .insert({
        project_id: project.id,
        uploaded_by: access.userId,
        status,
        rows_total: result.total,
        rows_ok: result.rows.length,
        rows_failed: result.errors.length,
        errors: result.missingColumns.length > 0 ? [{ rowNumber: 1, message: `Missing columns: ${result.missingColumns.join(', ')}` }] : [...result.errors, ...result.skipped.map((s) => ({ rowNumber: s.rowNumber, message: `Skipped: ${s.reason}` }))],
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    importId = record.id;
    const { error: storageError } = await db.storage.from(BUCKET).upload(`${project.id}/clash-${record.id}.json`, new Blob([JSON.stringify(result.rows)], { type: 'application/json' }), { upsert: true });
    if (storageError) throw new Error(storageError.message);
    await writeAudit({ actorId: access.userId, action: 'clash.import_prepared', entityType: 'register_import', entityId: record.id, projectId: project.id, after: { total: result.total, ok: result.rows.length, skipped: result.skipped.length } });
  } catch (error) {
    return errorState(error);
  }
  revalidatePath(`/projects/${projectCode}/issues`);
  redirect(`/projects/${projectCode}/issues/import/${importId}`);
}

/** Step 2: writes the clashes and their sheet links. Critical priority is set by the owner's rules. */
export async function confirmClashImport(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const access = await requireInternal();
    const importId = String(form.get('importId') ?? '');
    const db = adminDb();
    const { data: record } = await db.from('register_imports').select('id, project_id, status').eq('id', importId).maybeSingle();
    if (!record) throw new Error('Import not found.');
    if (record.status !== 'ready') throw new Error('Only a ready import can be confirmed.');
    assertProjectRole(access, record.project_id, ['project_head', 'discipline_lead']);
    const { data: project } = await db.from('projects').select('code').eq('id', record.project_id).single();
    const { data: blob, error: downloadError } = await db.storage.from(BUCKET).download(`${record.project_id}/clash-${record.id}.json`);
    if (downloadError || !blob) throw new Error('The validated rows could not be loaded. Upload the file again.');
    const rows = JSON.parse(await blob.text()) as ImportedClash[];

    const { data: ruleRows } = await db.from('rules').select('id, name, kind, definition').eq('kind', 'critical_clash').eq('active', true);
    const rules: NamedRule[] = (ruleRows && ruleRows.length > 0)
      ? ruleRows.map((r) => ({ id: r.id, label: r.name, kind: 'clash' as const, definition: r.definition as NamedRule['definition'] }))
      : DRAFT_CRITICAL_RULES.filter((r) => r.kind === 'clash');

    for (const row of rows) {
      const critical = isCriticalClash({ priority: row.priority, disciplines: [row.disciplineA ?? '', row.disciplineB ?? ''], title: row.title }, rules);
      const { data: clash, error } = await db
        .from('clashes')
        .insert({ project_id: record.project_id, number: row.number, title: row.title, description: row.description, priority: critical ? 'critical' : row.priority, discipline_a: row.disciplineA, discipline_b: row.disciplineB, owner_id: access.userId, status: 'open', source_ref: row.sourceRef })
        .select('id')
        .single();
      if (error) throw new Error(`Row ${row.rowNumber} (${row.number}): ${error.message}`);
      for (const sheetNumber of row.sheets) {
        const { data: sheet } = await db.from('sheets').select('id').eq('project_id', record.project_id).eq('sheet_number', sheetNumber).maybeSingle();
        if (sheet) await db.from('clash_sheets').insert({ clash_id: clash.id, sheet_id: sheet.id });
      }
      if (critical) {
        await recordEvent({ type: 'clash.opened', projectId: record.project_id, entityType: 'clash', entityId: clash.id, actorId: access.userId, payload: { number: row.number, projectCode: project?.code, title: row.title, path: `/projects/${project?.code}/issues` } });
      }
    }
    await db.from('register_imports').update({ status: 'confirmed', confirmed_at: new Date().toISOString() }).eq('id', record.id);
    await writeAudit({ actorId: access.userId, action: 'clash.imported', entityType: 'register_import', entityId: record.id, projectId: record.project_id, after: { clashes: rows.length } });
    revalidatePath(`/projects/${project?.code}/issues`);
  } catch (error) {
    return errorState(error);
  }
  return { ok: 'Clashes imported.' };
}
