'use server';

import { revalidatePath } from 'next/cache';
import { addWorkingDays, DRAFT_CRITICAL_RULES, isCriticalClash, type NamedRule } from '@arch-flow/domain';
import { adminDb } from '@/lib/supabase/admin';
import { projectByCode, assertProjectRole, requireInternal } from '@/lib/access';
import { writeAudit } from '@/lib/audit';
import { recordEvent } from '@/lib/events';
import { istToday } from '@/lib/format';
import { loadSheet } from '@/lib/workflow';
import { workingCalendar } from '@/lib/settings';
import { errorState, type FormState } from './types';

const ISSUE_ROLES = ['project_head', 'discipline_lead', 'drafter'] as const;
const PRIORITIES = ['critical', 'major', 'minor'] as const;

function text(form: FormData, name: string): string {
  return String(form.get(name) ?? '').trim();
}

/** Active critical rules for a project (firm-wide plus project-specific). Falls back to the draft set when none are stored. */
async function activeClashRules(projectId: string): Promise<NamedRule[]> {
  const { data } = await adminDb()
    .from('rules')
    .select('id, name, kind, definition, active, project_id')
    .eq('kind', 'critical_clash')
    .eq('active', true)
    .or(`project_id.is.null,project_id.eq.${projectId}`);
  if (!data || data.length === 0) return DRAFT_CRITICAL_RULES.filter((r) => r.kind === 'clash');
  return data.map((r) => ({ id: r.id, label: r.name, kind: 'clash' as const, definition: r.definition as NamedRule['definition'] }));
}

/** Logs a clash. Critical priority is set by the owner's rules (CLS-02). */
export async function createClash(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const access = await requireInternal();
    const projectCode = text(form, 'projectCode');
    const project = await projectByCode(projectCode);
    if (!project) throw new Error('Project not found.');
    assertProjectRole(access, project.id, ISSUE_ROLES);
    const number = text(form, 'number');
    const title = text(form, 'title');
    const disciplineA = text(form, 'disciplineA');
    const disciplineB = text(form, 'disciplineB');
    const chosen = text(form, 'priority');
    if (!number || !title) throw new Error('Clash number and title are required.');
    if (!PRIORITIES.includes(chosen as (typeof PRIORITIES)[number])) throw new Error('Choose a priority.');
    const rules = await activeClashRules(project.id);
    const critical = isCriticalClash({ priority: chosen, disciplines: [disciplineA, disciplineB], title }, rules);
    const priority = critical ? 'critical' : chosen;

    const db = adminDb();
    const { data: clash, error } = await db
      .from('clashes')
      .insert({ project_id: project.id, number, title, description: text(form, 'description') || null, priority, discipline_a: disciplineA || null, discipline_b: disciplineB || null, owner_id: access.userId, status: 'open' })
      .select('id')
      .single();
    if (error) throw new Error(error.message.includes('duplicate key') ? `Clash ${number} already exists in ${projectCode}.` : error.message);

    const sheetNumbers = text(form, 'sheets').split(',').map((s) => s.trim()).filter(Boolean);
    for (const sheetNumber of sheetNumbers) {
      const sheet = await loadSheet(project.id, sheetNumber);
      if (!sheet) throw new Error(`Sheet ${sheetNumber} was not found in ${projectCode}.`);
      const { error: linkError } = await db.from('clash_sheets').insert({ clash_id: clash.id, sheet_id: sheet.id });
      if (linkError) throw new Error(linkError.message);
    }
    if (critical) {
      await recordEvent({ type: 'clash.opened', projectId: project.id, entityType: 'clash', entityId: clash.id, actorId: access.userId, payload: { number, projectCode, title, path: `/projects/${projectCode}/issues` } });
    }
    await writeAudit({ actorId: access.userId, action: 'clash.created', entityType: 'clash', entityId: clash.id, projectId: project.id, after: { number, priority, critical } });
    revalidatePath(`/projects/${projectCode}/issues`);
  } catch (error) {
    return errorState(error);
  }
  return { ok: 'Clash logged.' };
}

export async function resolveClash(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const access = await requireInternal();
    const id = text(form, 'id');
    const projectCode = text(form, 'projectCode');
    const project = await projectByCode(projectCode);
    if (!project) throw new Error('Project not found.');
    assertProjectRole(access, project.id, ['project_head', 'discipline_lead']);
    const note = text(form, 'note');
    if (!note) throw new Error('Write how the clash was resolved.');
    const { error } = await adminDb().from('clashes').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', id).eq('project_id', project.id);
    if (error) throw new Error(error.message);
    await writeAudit({ actorId: access.userId, action: 'clash.resolved', entityType: 'clash', entityId: id, projectId: project.id, after: { note } });
    revalidatePath(`/projects/${projectCode}/issues`);
  } catch (error) {
    return errorState(error);
  }
  return { ok: 'Clash marked resolved.' };
}

/** Logs a contractor query. Default due date is 7 working days (SLA rfi_response). */
export async function createRfi(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const access = await requireInternal();
    const projectCode = text(form, 'projectCode');
    const project = await projectByCode(projectCode);
    if (!project) throw new Error('Project not found.');
    assertProjectRole(access, project.id, ISSUE_ROLES);
    const number = text(form, 'number');
    const subject = text(form, 'subject');
    if (!number || !subject) throw new Error('RFI number and subject are required.');
    const priority = text(form, 'priority') || 'minor';
    if (!PRIORITIES.includes(priority as (typeof PRIORITIES)[number])) throw new Error('Choose a priority.');
    const calendar = await workingCalendar();
    const due = text(form, 'dueDate') || addWorkingDays(istToday(), 7, calendar);
    const sheetNumber = text(form, 'sheet');
    const sheet = sheetNumber ? await loadSheet(project.id, sheetNumber) : null;
    if (sheetNumber && !sheet) throw new Error(`Sheet ${sheetNumber} was not found.`);
    const { data: rfi, error } = await adminDb()
      .from('rfis')
      .insert({ project_id: project.id, number, subject, body: text(form, 'body') || null, sheet_id: sheet?.id ?? null, priority, status: 'open', raised_by: access.userId, due_date: due })
      .select('id')
      .single();
    if (error) throw new Error(error.message.includes('duplicate key') ? `RFI ${number} already exists in ${projectCode}.` : error.message);
    await writeAudit({ actorId: access.userId, action: 'rfi.created', entityType: 'rfi', entityId: rfi.id, projectId: project.id, after: { number, due } });
    revalidatePath(`/projects/${projectCode}/issues`);
  } catch (error) {
    return errorState(error);
  }
  return { ok: 'RFI logged.' };
}

export async function answerRfi(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const access = await requireInternal();
    const id = text(form, 'id');
    const projectCode = text(form, 'projectCode');
    const project = await projectByCode(projectCode);
    if (!project) throw new Error('Project not found.');
    assertProjectRole(access, project.id, ISSUE_ROLES);
    const answer = text(form, 'answer');
    if (!answer) throw new Error('Write the answer.');
    const { error } = await adminDb()
      .from('rfis')
      .update({ answer, status: 'answered', answered_at: new Date().toISOString() })
      .eq('id', id)
      .eq('project_id', project.id);
    if (error) throw new Error(error.message);
    await writeAudit({ actorId: access.userId, action: 'rfi.answered', entityType: 'rfi', entityId: id, projectId: project.id });
    revalidatePath(`/projects/${projectCode}/issues`);
  } catch (error) {
    return errorState(error);
  }
  return { ok: 'Answer saved.' };
}
