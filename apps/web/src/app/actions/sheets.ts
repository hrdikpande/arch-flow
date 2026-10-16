'use server';

import { revalidatePath } from 'next/cache';
import { buildFileName, checkFileName, decideTransition, isLive, SHEET_STATES, type SheetState, type IssuePurpose } from '@arch-flow/domain';
import { adminDb } from '@/lib/supabase/admin';
import { assertProjectRole, projectByCode, requireInternal } from '@/lib/access';
import { writeAudit } from '@/lib/audit';
import { recordEvent, usersForProject, notifyUsers } from '@/lib/events';
import { formatIst, istToday } from '@/lib/format';
import { loadSheet, revisionsOf, rolesFor, transitionContext, dueFromToday } from '@/lib/workflow';
import { errorState, type FormState } from './types';
import { apsConfig, CAD_FORMATS } from '@/lib/aps';

const CREATE_ROLES = ['project_head', 'discipline_lead', 'drafter'] as const;
const STATE_ROLES = ['project_head', 'discipline_lead', 'drafter', 'checker'] as const;

function text(form: FormData, name: string): string {
  return String(form.get(name) ?? '').trim();
}

function sheetPath(projectCode: string, sheetNumber: string): string {
  return `/projects/${encodeURIComponent(projectCode)}/sheets/${encodeURIComponent(sheetNumber)}`;
}

/** Creates a sheet with revision R0 in work (REG-02). */
export async function createSheet(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const access = await requireInternal();
    const projectCode = text(form, 'projectCode');
    const sheetNumber = text(form, 'sheetNumber');
    const title = text(form, 'title');
    const disciplineCode = text(form, 'discipline');
    const ownerEmail = text(form, 'ownerEmail').toLowerCase();
    const dueDate = text(form, 'dueDate') || null;
    const project = await projectByCode(projectCode);
    if (!project) throw new Error('Project not found.');
    assertProjectRole(access, project.id, CREATE_ROLES);
    if (!sheetNumber || !title || !disciplineCode) throw new Error('Sheet number, title and discipline are required.');

    const db = adminDb();
    let ownerId: string | null = null;
    if (ownerEmail) {
      const { data: owner } = await db.from('profiles').select('id').eq('email', ownerEmail).eq('is_active', true).maybeSingle();
      if (!owner) throw new Error(`No active user with email ${ownerEmail}.`);
      ownerId = owner.id;
    }
    const { data: sheet, error } = await db
      .from('sheets')
      .insert({
        project_id: project.id,
        sheet_number: sheetNumber,
        title,
        discipline_code: disciplineCode,
        status: ownerId ? 'assigned' : 'not_started',
        owner_id: ownerId,
        due_date: dueDate,
        created_by: access.userId,
      })
      .select('id')
      .single();
    if (error) {
      if (error.message.includes('duplicate key')) throw new Error(`Sheet ${sheetNumber} already exists in ${projectCode}.`);
      throw new Error(error.message);
    }
    const { error: revError } = await db.from('revisions').insert({ sheet_id: sheet.id, rev_code: 'R0', seq: 0, status: 'wip', created_by: access.userId });
    if (revError) throw new Error(revError.message);
    await writeAudit({ actorId: access.userId, action: 'sheet.created', entityType: 'sheet', entityId: sheet.id, projectId: project.id, after: { sheetNumber, title, disciplineCode } });
    revalidatePath(`/projects/${projectCode}/register`);
  } catch (error) {
    return errorState(error);
  }
  return { ok: 'Sheet created.' };
}

/** Moves a sheet through the internal states (LIFE-01 to LIFE-08). Issuing has its own action. */
export async function moveSheet(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const access = await requireInternal();
    const projectCode = text(form, 'projectCode');
    const sheetNumber = text(form, 'sheetNumber');
    const to = text(form, 'to') as SheetState;
    const reason = text(form, 'reason');
    const project = await projectByCode(projectCode);
    if (!project) throw new Error('Project not found.');
    assertProjectRole(access, project.id, STATE_ROLES);
    const sheet = await loadSheet(project.id, sheetNumber);
    if (!sheet) throw new Error('Sheet not found.');
    if (!SHEET_STATES.includes(to)) throw new Error('Unknown state.');
    if (isLive(sheet.status)) {
      throw new Error('This sheet is issued. Changes need an approval: use "Request change" below.');
    }
    const roles = rolesFor(access, project.id);
    const decision = decideTransition(sheet.status, to, roles, await transitionContext(sheet, reason));
    if (!decision.allowed) throw new Error(decision.reasons.join(' '));

    const { error } = await adminDb().from('sheets').update({ status: to }).eq('id', sheet.id);
    if (error) throw new Error(error.message);
    await adminDb().from('status_history').insert({ entity_type: 'sheet', entity_id: sheet.id, from_state: sheet.status, to_state: to, actor_id: access.userId, note: reason || null });
    await writeAudit({ actorId: access.userId, action: 'sheet.status_changed', entityType: 'sheet', entityId: sheet.id, projectId: project.id, before: { status: sheet.status }, after: { status: to, reason } });
    revalidatePath(sheetPath(projectCode, sheetNumber));
  } catch (error) {
    return errorState(error);
  }
  return { ok: 'Status updated.' };
}

/** Issues the work revision: checks the guards, supersedes the previous one and creates the transmittal (LIFE-05, REV-02). */
export async function issueSheet(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const access = await requireInternal();
    const projectCode = text(form, 'projectCode');
    const sheetNumber = text(form, 'sheetNumber');
    const purpose = text(form, 'purpose') as IssuePurpose;
    const recipient = text(form, 'recipient');
    if (!['issued', 'ifc', 'gfc'].includes(purpose)) throw new Error('Choose an issue type.');
    const project = await projectByCode(projectCode);
    if (!project) throw new Error('Project not found.');
    assertProjectRole(access, project.id, ['project_head', 'checker']);
    const sheet = await loadSheet(project.id, sheetNumber);
    if (!sheet) throw new Error('Sheet not found.');

    const ctx = { ...(await transitionContext(sheet)), transmittalSelected: recipient.length > 0 };
    const decision = decideTransition(sheet.status, purpose, rolesFor(access, project.id), ctx);
    if (!decision.allowed) throw new Error(decision.reasons.join(' '));

    const db = adminDb();
    const revisions = await revisionsOf(sheet.id);
    const wip = revisions.find((r) => r.status === 'wip');
    if (!wip) throw new Error('There is no work revision to issue. Create a new revision first.');
    const previous = revisions.find((r) => r.status === 'issued');
    const now = new Date();

    const { error: issueError } = await db
      .from('revisions')
      .update({ status: 'issued', purpose, issued_at: now.toISOString(), issued_by: access.userId })
      .eq('id', wip.id);
    if (issueError) throw new Error(issueError.message);
    if (previous) {
      const { error: supersedeError } = await db.from('revisions').update({ status: 'superseded' }).eq('id', previous.id);
      if (supersedeError) throw new Error(supersedeError.message);
    }
    const { error: sheetError } = await db.from('sheets').update({ status: purpose, current_revision_id: wip.id }).eq('id', sheet.id);
    if (sheetError) throw new Error(sheetError.message);

    const { data: number, error: numberError } = await db.rpc('next_transmittal_number', { p_project: project.id });
    if (numberError) throw new Error(numberError.message);
    const { data: transmittal, error: tError } = await db
      .from('transmittals')
      .insert({ project_id: project.id, number: String(number), recipient_text: recipient, created_by: access.userId })
      .select('id')
      .single();
    if (tError) throw new Error(tError.message);
    const { error: itemError } = await db.from('transmittal_items').insert({ transmittal_id: transmittal.id, revision_id: wip.id });
    if (itemError) throw new Error(itemError.message);

    await db.from('status_history').insert({ entity_type: 'sheet', entity_id: sheet.id, from_state: sheet.status, to_state: purpose, actor_id: access.userId, note: `${wip.rev_code} issued` });
    await db.from('change_requests').update({ status: 'implemented' }).eq('sheet_id', sheet.id).eq('status', 'approved');
    await writeAudit({ actorId: access.userId, action: 'revision.issued', entityType: 'revision', entityId: wip.id, projectId: project.id, after: { sheet: sheetNumber, rev: wip.rev_code, purpose, transmittal: number } });
    await recordEvent({
      type: 'revision.issued',
      projectId: project.id,
      entityType: 'revision',
      entityId: wip.id,
      actorId: access.userId,
      payload: {
        projectCode,
        sheet: sheetNumber,
        rev: wip.rev_code,
        title: sheet.title,
        userName: access.name,
        time: formatIst(now).replace(' IST', ''),
        previousRev: previous?.rev_code ?? null,
        path: sheetPath(projectCode, sheetNumber),
      },
    });
    const heads = await usersForProject(project.id, ['project_head'], access.userId);
    await notifyUsers(heads, 'Revision issued', `${sheetNumber} ${wip.rev_code} was issued.`, sheetPath(projectCode, sheetNumber));
    revalidatePath(sheetPath(projectCode, sheetNumber));
    revalidatePath(`/projects/${projectCode}/transmittals`);
  } catch (error) {
    return errorState(error);
  }
  return { ok: 'Revision issued and transmittal created.' };
}

/** A change to an issued sheet needs project-head approval first (decision 6d, LIFE-06). */
export async function requestChange(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const access = await requireInternal();
    const projectCode = text(form, 'projectCode');
    const sheetNumber = text(form, 'sheetNumber');
    const reason = text(form, 'reason');
    if (!reason) throw new Error('Say what needs to change and why.');
    const costRaw = text(form, 'costImpact');
    const daysRaw = text(form, 'timeImpactDays');
    const costImpact = costRaw === '' ? null : Number(costRaw);
    const timeImpactDays = daysRaw === '' ? null : Number(daysRaw);
    if (costImpact !== null && (!Number.isFinite(costImpact) || costImpact < 0)) throw new Error('Cost impact must be a positive amount.');
    if (timeImpactDays !== null && (!Number.isInteger(timeImpactDays) || timeImpactDays < 0)) throw new Error('Time impact must be whole working days.');
    const project = await projectByCode(projectCode);
    if (!project) throw new Error('Project not found.');
    assertProjectRole(access, project.id, CREATE_ROLES);
    const sheet = await loadSheet(project.id, sheetNumber);
    if (!sheet) throw new Error('Sheet not found.');
    if (!isLive(sheet.status)) throw new Error('Only issued sheets need a change approval.');

    const heads = await usersForProject(project.id, ['project_head']);
    const assignee = heads.find((id) => id !== access.userId) ?? heads[0] ?? null;
    if (!assignee) throw new Error('No project head is assigned to approve this change.');
    const today = istToday();
    const due = await dueFromToday(project.id, 'internal_review', today);
    const current = (await revisionsOf(sheet.id)).find((r) => r.status === 'issued');
    const db = adminDb();
    const { data: approval, error } = await db
      .from('approvals')
      .insert({
        project_id: project.id,
        entity_type: 'sheet',
        entity_id: sheet.id,
        transition: 'change_live_sheet',
        requested_by: access.userId,
        assignee_id: assignee,
        due_at: `${due}T23:59:59+05:30`,
        reason,
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    const { error: changeError } = await db.from('change_requests').insert({
      project_id: project.id,
      sheet_id: sheet.id,
      revision_id: current?.id ?? null,
      reason,
      cost_impact: costImpact,
      time_impact_days: timeImpactDays,
      status: 'requested',
      requested_by: access.userId,
      approval_id: approval.id,
      sheet_status_at_request: sheet.status,
    });
    if (changeError) throw new Error(changeError.message);
    const { data: assigneeProfile } = await db.from('profiles').select('full_name').eq('id', assignee).maybeSingle();
    await recordEvent({
      type: 'approval.requested',
      projectId: project.id,
      entityType: 'approval',
      entityId: approval.id,
      actorId: access.userId,
      payload: { projectCode, sheet: sheetNumber, rev: current?.rev_code ?? '', transition: 'change to issued sheet', assignee: assigneeProfile?.full_name ?? 'project head', due, path: '/approvals' },
    });
    await notifyUsers([assignee], 'Change approval needed', `${sheetNumber} ${current?.rev_code ?? ''}: ${reason}`, '/approvals');
    await writeAudit({ actorId: access.userId, action: 'approval.requested', entityType: 'approval', entityId: approval.id, projectId: project.id, after: { sheet: sheetNumber, reason } });
    revalidatePath(sheetPath(projectCode, sheetNumber));
    revalidatePath('/approvals');
  } catch (error) {
    return errorState(error);
  }
  return { ok: 'Change request sent to the project head.' };
}

const FILE_FORMATS: Record<string, 'pdf' | 'dwg' | 'rvt' | 'ifc' | 'nwd' | 'other'> = {
  pdf: 'pdf', dwg: 'dwg', rvt: 'rvt', ifc: 'ifc', nwd: 'nwd',
};
const MAX_UPLOAD_MB = Number(process.env.UPLOAD_MAX_MB ?? 500);
const BUCKET = 'drawings';

/** Step 1 of an upload: returns a one-time upload URL for Supabase Storage (FIL-01). */
export async function prepareUpload(input: { projectCode: string; sheetNumber: string; fileName: string; sizeBytes: number }): Promise<{ url: string; path: string; token: string } | { error: string }> {
  try {
    const access = await requireInternal();
    const project = await projectByCode(input.projectCode);
    if (!project) return { error: 'Project not found.' };
    assertProjectRole(access, project.id, ['project_head', 'discipline_lead', 'drafter']);
    if (input.sizeBytes > MAX_UPLOAD_MB * 1024 * 1024) return { error: `Files must be ${MAX_UPLOAD_MB} MB or smaller.` };
    const ext = input.fileName.split('.').pop()?.toLowerCase() ?? '';
    if (!FILE_FORMATS[ext]) return { error: 'Only PDF, DWG, RVT, IFC and NWD files can be uploaded.' };
    const sheet = await loadSheet(project.id, input.sheetNumber);
    if (!sheet) return { error: 'Sheet not found.' };
    const wip = (await revisionsOf(sheet.id)).find((r) => r.status === 'wip');
    if (!wip) return { error: 'Create a work revision before uploading.' };
    const safe = input.fileName.replace(/[^A-Za-z0-9._-]/g, '_');
    const path = `${input.projectCode}/${input.sheetNumber}/${wip.rev_code}/${Date.now()}-${safe}`;
    const { data, error } = await adminDb().storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) return { error: error?.message ?? 'Could not prepare the upload.' };
    return { url: data.signedUrl, path: data.path, token: data.token };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Upload failed.' };
  }
}

/** Step 2: records the stored file, checks the name and raises the upload event (FIL-03, FIL-04, FIL-08). */
export async function recordUpload(input: { projectCode: string; sheetNumber: string; path: string; fileName: string; sizeBytes: number; sha256: string }): Promise<{ ok: string; nameWarning: string | null; fileId: string; needsAutodesk: boolean } | { error: string }> {
  try {
    const access = await requireInternal();
    const project = await projectByCode(input.projectCode);
    if (!project) return { error: 'Project not found.' };
    assertProjectRole(access, project.id, ['project_head', 'discipline_lead', 'drafter']);
    const sheet = await loadSheet(project.id, input.sheetNumber);
    if (!sheet) return { error: 'Sheet not found.' };
    const wip = (await revisionsOf(sheet.id)).find((r) => r.status === 'wip');
    if (!wip) return { error: 'Create a work revision before uploading.' };
    const ext = input.fileName.split('.').pop()?.toLowerCase() ?? '';
    const parts = { projectCode: input.projectCode, disciplineCode: sheet.discipline_code, sheetNumber: input.sheetNumber, revCode: wip.rev_code, extension: ext };
    const check = checkFileName(input.fileName, parts);
    const db = adminDb();
    const { data: file, error } = await db
      .from('files')
      .insert({
        project_id: project.id,
        sheet_id: sheet.id,
        revision_id: wip.id,
        storage_bucket: BUCKET,
        storage_path: input.path,
        original_name: input.fileName,
        format: FILE_FORMATS[ext] ?? 'other',
        size_bytes: input.sizeBytes,
        sha256: input.sha256,
        state: 'stored',
        uploaded_by: access.userId,
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    await writeAudit({ actorId: access.userId, action: 'file.uploaded', entityType: 'file', entityId: file.id, projectId: project.id, after: { sheet: input.sheetNumber, rev: wip.rev_code, name: input.fileName, nameMatches: check.matches } });
    await recordEvent({
      type: 'file.uploaded',
      projectId: project.id,
      entityType: 'file',
      entityId: file.id,
      actorId: access.userId,
      payload: { projectCode: input.projectCode, fileName: input.fileName, userName: access.name, time: formatIst(new Date()).replace(' IST', ''), path: sheetPath(input.projectCode, input.sheetNumber) },
    });
    revalidatePath(sheetPath(input.projectCode, input.sheetNumber));
    return {
      ok: 'File stored.',
      nameWarning: check.matches ? null : `The name does not follow the standard. Suggested name: ${buildFileName(parts)}`,
      fileId: file.id,
      needsAutodesk: (CAD_FORMATS as readonly string[]).includes(ext) && apsConfig() !== null,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not record the file.' };
  }
}

