'use server';

import { revalidatePath } from 'next/cache';
import { adminDb } from '@/lib/supabase/admin';
import { projectByCode, requireAccess, requireInternal, hasProjectRole } from '@/lib/access';
import { writeAudit } from '@/lib/audit';
import { recordEvent, notifyUsers, usersForProject } from '@/lib/events';
import { formatIst, istToday } from '@/lib/format';
import { dueAtFromToday } from '@/lib/workflow';
import { errorState, type FormState } from './types';

const SUBJECT_MAX = 200;
const CONTENT_MAX = 10000;

function text(form: FormData, name: string): string {
  return String(form.get(name) ?? '').trim();
}

/**
 * Client raises a conflict on an issued sheet or transmittal of their project (CFL-01).
 * The notice to the firm contains no subject and no content (CFL-07, decision 10).
 */
export async function raiseConflict(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const access = await requireAccess();
    if (!access.isClient || !access.clientOrgId) throw new Error('Only client users can raise a conflict.');
    const projectCode = text(form, 'projectCode');
    const subject = text(form, 'subject');
    const content = text(form, 'content');
    if (!subject || subject.length > SUBJECT_MAX) throw new Error(`Subject is required (up to ${SUBJECT_MAX} characters).`);
    if (!content || content.length > CONTENT_MAX) throw new Error(`Content is required (up to ${CONTENT_MAX} characters).`);
    const project = await projectByCode(projectCode);
    if (!project || !hasProjectRole(access, project.id, ['client']) || project.client_org_id !== access.clientOrgId) {
      throw new Error('Project not found.');
    }
    const db = adminDb();
    const today = istToday();
    const due = await dueAtFromToday(project.id, 'conflict_reply', today);
    const { data: conflict, error } = await db
      .from('conflicts')
      .insert({ project_id: project.id, client_org_id: access.clientOrgId, subject, raised_by: access.userId, status: 'open', due_at: due })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    const { error: msgError } = await db.from('conflict_messages').insert({ conflict_id: conflict.id, author_id: access.userId, body: content });
    if (msgError) throw new Error(msgError.message);
    await recordEvent({
      type: 'conflict.raised',
      projectId: project.id,
      entityType: 'conflict',
      entityId: conflict.id,
      actorId: access.userId,
      payload: { projectCode, clientUser: access.name, time: formatIst(new Date()).replace(' IST', ''), path: `/conflicts/${conflict.id}` },
    });
    const recipients = await usersForProject(project.id, ['project_head']);
    await notifyUsers(recipients, 'New client conflict', `${projectCode}: a conflict was raised.`, `/conflicts/${conflict.id}`);
    await writeAudit({ actorId: access.userId, action: 'conflict.raised', entityType: 'conflict', entityId: conflict.id, projectId: project.id });
    revalidatePath('/portal');
  } catch (error) {
    return errorState(error);
  }
  return { ok: 'Conflict sent to the firm.' };
}

/** Reply in the conflict thread. Clients reply on their own conflicts; the firm replies as project head or the sheet's drafter. */
export async function replyConflict(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const access = await requireAccess();
    const conflictId = text(form, 'conflictId');
    const body = text(form, 'body');
    if (!body || body.length > CONTENT_MAX) throw new Error(`Reply is required (up to ${CONTENT_MAX} characters).`);
    const db = adminDb();
    const { data: conflict } = await db
      .from('conflicts')
      .select('id, project_id, client_org_id, status, first_response_at, projects(code)')
      .eq('id', conflictId)
      .maybeSingle();
    if (!conflict) throw new Error('Conflict not found.');
    if (conflict.status === 'closed') throw new Error('This conflict is closed.');
    const projectCode = (conflict.projects as unknown as { code: string }).code;

    if (access.isClient) {
      if (conflict.client_org_id !== access.clientOrgId) throw new Error('Conflict not found.');
    } else {
      const drafter = await db.from('user_roles').select('id').eq('user_id', access.userId).eq('project_id', conflict.project_id).eq('role', 'drafter').maybeSingle();
      if (!access.isAdmin && !hasProjectRole(access, conflict.project_id, ['project_head']) && !drafter.data) {
        throw new Error('Only the project head or the drafter on this sheet can reply.');
      }
    }

    const { error } = await db.from('conflict_messages').insert({ conflict_id: conflict.id, author_id: access.userId, body });
    if (error) throw new Error(error.message);
    if (access.isClient) {
      await db.from('conflicts').update({ status: 'open' }).eq('id', conflict.id);
    } else {
      const update: Record<string, unknown> = { status: 'awaiting_client' };
      if (!conflict.first_response_at) update.first_response_at = new Date().toISOString();
      await db.from('conflicts').update(update).eq('id', conflict.id);
      await recordEvent({ type: 'conflict.responded', projectId: conflict.project_id, entityType: 'conflict', entityId: conflict.id, actorId: access.userId, payload: { projectCode, userName: access.name, path: `/conflicts/${conflict.id}` } });
    }
    await writeAudit({ actorId: access.userId, action: 'conflict.replied', entityType: 'conflict', entityId: conflict.id, projectId: conflict.project_id, after: { by: access.isClient ? 'client' : 'firm' } });
    revalidatePath(`/conflicts/${conflictId}`);
    revalidatePath(`/portal/conflicts/${conflictId}`);
  } catch (error) {
    return errorState(error);
  }
  return { ok: 'Reply sent.' };
}

export async function closeConflict(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const access = await requireInternal();
    const conflictId = text(form, 'conflictId');
    const { data: conflict } = await adminDb().from('conflicts').select('id, project_id').eq('id', conflictId).maybeSingle();
    if (!conflict) throw new Error('Conflict not found.');
    if (!access.isAdmin && !hasProjectRole(access, conflict.project_id, ['project_head'])) throw new Error('Only the project head can close a conflict.');
    const { error } = await adminDb().from('conflicts').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', conflictId);
    if (error) throw new Error(error.message);
    await writeAudit({ actorId: access.userId, action: 'conflict.closed', entityType: 'conflict', entityId: conflictId, projectId: conflict.project_id });
    revalidatePath(`/conflicts/${conflictId}`);
  } catch (error) {
    return errorState(error);
  }
  return { ok: 'Conflict closed. The client can still see it.' };
}
