'use server';

import { revalidatePath } from 'next/cache';
import { adminDb } from '@/lib/supabase/admin';
import { assertAdmin, assertProjectRole, projectByCode, requireInternal } from '@/lib/access';
import { writeAudit } from '@/lib/audit';
import { istToday } from '@/lib/format';
import { loadSheet, revisionsOf } from '@/lib/workflow';
import { errorState, type FormState } from './types';

const REVIEW_ROLES = ['project_head', 'discipline_lead', 'drafter', 'checker'] as const;
const SUBMITTAL_ROLES = ['project_head', 'discipline_lead', 'drafter'] as const;
const SUBMITTAL_STATUSES = ['submitted', 'under_review', 'approved', 'approved_with_comments', 'rejected'] as const;
const CHECKLIST_STATUSES = ['pending', 'submitted', 'approved', 'not_applicable'] as const;

function text(form: FormData, name: string): string {
  return String(form.get(name) ?? '').trim();
}

function sheetPath(projectCode: string, sheetNumber: string): string {
  return `/projects/${encodeURIComponent(projectCode)}/sheets/${encodeURIComponent(sheetNumber)}`;
}

/** Review comment on the work revision of a sheet (RVW-01). */
export async function addReviewComment(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const access = await requireInternal();
    const projectCode = text(form, 'projectCode');
    const sheetNumber = text(form, 'sheetNumber');
    const body = text(form, 'body');
    if (!body) throw new Error('Write the comment.');
    const project = await projectByCode(projectCode);
    if (!project) throw new Error('Project not found.');
    assertProjectRole(access, project.id, REVIEW_ROLES);
    const sheet = await loadSheet(project.id, sheetNumber);
    if (!sheet) throw new Error('Sheet not found.');
    const revision = (await revisionsOf(sheet.id)).find((r) => r.status === 'wip') ?? (await revisionsOf(sheet.id)).slice(-1)[0];
    if (!revision) throw new Error('This sheet has no revision to comment on.');
    const { data, error } = await adminDb()
      .from('review_comments')
      .insert({ revision_id: revision.id, author_id: access.userId, body, status: 'open' })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    await writeAudit({ actorId: access.userId, action: 'review.comment_added', entityType: 'review_comment', entityId: data.id, projectId: project.id, after: { sheet: sheetNumber, rev: revision.rev_code } });
    revalidatePath(sheetPath(projectCode, sheetNumber));
  } catch (error) {
    return errorState(error);
  }
  return { ok: 'Comment added.' };
}

/** Resolves a review comment with a note (RVW-02). The revision's drafter or a project lead may resolve. */
export async function resolveReviewComment(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const access = await requireInternal();
    const id = text(form, 'id');
    const projectCode = text(form, 'projectCode');
    const sheetNumber = text(form, 'sheetNumber');
    const note = text(form, 'note');
    if (!note) throw new Error('Write how the comment was resolved.');
    const project = await projectByCode(projectCode);
    if (!project) throw new Error('Project not found.');
    assertProjectRole(access, project.id, REVIEW_ROLES);
    const { error } = await adminDb()
      .from('review_comments')
      .update({ status: 'closed', resolved_by: access.userId, resolved_at: new Date().toISOString(), resolution_note: note })
      .eq('id', id);
    if (error) throw new Error(error.message);
    await writeAudit({ actorId: access.userId, action: 'review.comment_resolved', entityType: 'review_comment', entityId: id, projectId: project.id, after: { note } });
    revalidatePath(sheetPath(projectCode, sheetNumber));
  } catch (error) {
    return errorState(error);
  }
  return { ok: 'Comment resolved.' };
}

/** Submittal log (SUB-01). Default due date: 10 working days. */
export async function createSubmittal(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const access = await requireInternal();
    const projectCode = text(form, 'projectCode');
    const project = await projectByCode(projectCode);
    if (!project) throw new Error('Project not found.');
    assertProjectRole(access, project.id, SUBMITTAL_ROLES);
    const number = text(form, 'number');
    const item = text(form, 'item');
    if (!number || !item) throw new Error('Submittal number and item are required.');
    const sheetNumber = text(form, 'sheet');
    const sheet = sheetNumber ? await loadSheet(project.id, sheetNumber) : null;
    if (sheetNumber && !sheet) throw new Error(`Sheet ${sheetNumber} was not found.`);
    const due = text(form, 'dueDate') || null;
    const { data, error } = await adminDb()
      .from('submittals')
      .insert({ project_id: project.id, number, item, sheet_id: sheet?.id ?? null, status: 'submitted', due_date: due, submitted_by: access.userId })
      .select('id')
      .single();
    if (error) throw new Error(error.message.includes('duplicate key') ? `Submittal ${number} already exists.` : error.message);
    await writeAudit({ actorId: access.userId, action: 'submittal.created', entityType: 'submittal', entityId: data.id, projectId: project.id, after: { number, item } });
    revalidatePath(`/projects/${projectCode}/submittals`);
  } catch (error) {
    return errorState(error);
  }
  return { ok: 'Submittal logged.' };
}

export async function setSubmittalStatus(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const access = await requireInternal();
    const id = text(form, 'id');
    const projectCode = text(form, 'projectCode');
    const status = text(form, 'status');
    if (!SUBMITTAL_STATUSES.includes(status as (typeof SUBMITTAL_STATUSES)[number])) throw new Error('Unknown status.');
    const project = await projectByCode(projectCode);
    if (!project) throw new Error('Project not found.');
    assertProjectRole(access, project.id, ['project_head', 'discipline_lead']);
    const { error } = await adminDb().from('submittals').update({ status }).eq('id', id).eq('project_id', project.id);
    if (error) throw new Error(error.message);
    await writeAudit({ actorId: access.userId, action: 'submittal.status_changed', entityType: 'submittal', entityId: id, projectId: project.id, after: { status } });
    revalidatePath(`/projects/${projectCode}/submittals`);
  } catch (error) {
    return errorState(error);
  }
  return { ok: 'Status saved.' };
}

/** Admin: add an item to the authority checklist template (AUT-01). */
export async function addAuthorityItem(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const access = await requireInternal();
    assertAdmin(access);
    const authority = text(form, 'authority');
    const item = text(form, 'item');
    if (!authority || !item) throw new Error('Authority and item are required.');
    const { error } = await adminDb().from('authority_templates').insert({ authority, item, required: form.get('required') !== null });
    if (error) throw new Error(error.message.includes('duplicate key') ? 'That item is already in the template.' : error.message);
    await writeAudit({ actorId: access.userId, action: 'authority.template_item_added', entityType: 'authority_template', after: { authority, item } });
    revalidatePath('/admin/authorities');
  } catch (error) {
    return errorState(error);
  }
  return { ok: 'Item added to the template.' };
}

export async function removeAuthorityItem(form: FormData): Promise<void> {
  const access = await requireInternal();
  assertAdmin(access);
  await adminDb().from('authority_templates').delete().eq('id', text(form, 'id'));
  await writeAudit({ actorId: access.userId, action: 'authority.template_item_removed', entityType: 'authority_template', entityId: text(form, 'id') });
  revalidatePath('/admin/authorities');
}

/** Copies the template into a project's checklist (AUT-02). Existing items are kept, nothing is duplicated. */
export async function loadAuthorityChecklist(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const access = await requireInternal();
    const projectCode = text(form, 'projectCode');
    const project = await projectByCode(projectCode);
    if (!project) throw new Error('Project not found.');
    assertProjectRole(access, project.id, ['project_head']);
    const db = adminDb();
    const [{ data: template }, { data: existing }] = await Promise.all([
      db.from('authority_templates').select('authority, item, required'),
      db.from('authority_checklists').select('authority, item').eq('project_id', project.id),
    ]);
    const have = new Set((existing ?? []).map((e) => `${e.authority}|${e.item}`));
    const toAdd = (template ?? []).filter((t) => !have.has(`${t.authority}|${t.item}`));
    if (toAdd.length === 0) return { ok: 'The checklist already has every template item.' };
    const due = istToday();
    const { error } = await db.from('authority_checklists').insert(toAdd.map((t) => ({ project_id: project.id, authority: t.authority, item: t.item, required: t.required, status: 'pending', responsible_id: access.userId, due_date: due })));
    if (error) throw new Error(error.message);
    await writeAudit({ actorId: access.userId, action: 'authority.checklist_loaded', entityType: 'project', entityId: project.id, projectId: project.id, after: { added: toAdd.length } });
    revalidatePath(`/projects/${projectCode}/authorities`);
  } catch (error) {
    return errorState(error);
  }
  return { ok: 'Checklist updated.' };
}

/** Sets an authority item's status and records who ticked it (AUT-03). */
export async function setChecklistStatus(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const access = await requireInternal();
    const id = text(form, 'id');
    const projectCode = text(form, 'projectCode');
    const status = text(form, 'status');
    if (!CHECKLIST_STATUSES.includes(status as (typeof CHECKLIST_STATUSES)[number])) throw new Error('Unknown status.');
    const project = await projectByCode(projectCode);
    if (!project) throw new Error('Project not found.');
    const db = adminDb();
    const { data: item } = await db.from('authority_checklists').select('id, responsible_id').eq('id', id).eq('project_id', project.id).maybeSingle();
    if (!item) throw new Error('Checklist item not found.');
    if (item.responsible_id !== access.userId) assertProjectRole(access, project.id, ['project_head']);
    const { error } = await db.from('authority_checklists').update({ status, ticked_by: access.userId, ticked_at: new Date().toISOString() }).eq('id', id);
    if (error) throw new Error(error.message);
    await writeAudit({ actorId: access.userId, action: 'authority.item_updated', entityType: 'authority_checklist', entityId: id, projectId: project.id, after: { status } });
    revalidatePath(`/projects/${projectCode}/authorities`);
  } catch (error) {
    return errorState(error);
  }
  return { ok: 'Saved.' };
}

/** Admin: sets the weekly capacity of a person (SET-07). */
export async function setCapacity(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const access = await requireInternal();
    assertAdmin(access);
    const userId = text(form, 'userId');
    const sheets = Number(text(form, 'sheets'));
    const hours = Number(text(form, 'hours'));
    if (!Number.isInteger(sheets) || sheets < 0 || !Number.isFinite(hours) || hours < 0) throw new Error('Capacity must be zero or more.');
    const { error } = await adminDb().from('user_capacity').upsert({ user_id: userId, sheets_per_week: sheets, hours_per_week: hours, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    await writeAudit({ actorId: access.userId, action: 'capacity.set', entityType: 'profile', entityId: userId, after: { sheets, hours } });
    revalidatePath('/workload');
  } catch (error) {
    return errorState(error);
  }
  return { ok: 'Capacity saved.' };
}
