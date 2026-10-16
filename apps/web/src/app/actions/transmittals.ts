'use server';

import { revalidatePath } from 'next/cache';
import { adminDb } from '@/lib/supabase/admin';
import { projectByCode, assertProjectRole, requireInternal } from '@/lib/access';
import { writeAudit } from '@/lib/audit';
import { recordEvent } from '@/lib/events';
import { errorState, type FormState } from './types';

/** Marks a transmittal as sent (TRN-03). The system records sending; it does not email (Q-P9). */
export async function markTransmittalSent(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const access = await requireInternal();
    const id = String(form.get('id') ?? '');
    const projectCode = String(form.get('projectCode') ?? '');
    const project = await projectByCode(projectCode);
    if (!project) throw new Error('Project not found.');
    assertProjectRole(access, project.id, ['project_head']);
    const db = adminDb();
    const { data: transmittal } = await db.from('transmittals').select('id, number, sent_at').eq('id', id).eq('project_id', project.id).maybeSingle();
    if (!transmittal) throw new Error('Transmittal not found.');
    if (transmittal.sent_at) throw new Error('This transmittal is already marked as sent.');
    const { count } = await db.from('transmittal_items').select('revision_id', { count: 'exact', head: true }).eq('transmittal_id', id);
    const now = new Date();
    const { error } = await db.from('transmittals').update({ sent_at: now.toISOString() }).eq('id', id);
    if (error) throw new Error(error.message);
    await writeAudit({ actorId: access.userId, action: 'transmittal.sent', entityType: 'transmittal', entityId: id, projectId: project.id, after: { number: transmittal.number } });
    await recordEvent({ type: 'transmittal.sent', projectId: project.id, entityType: 'transmittal', entityId: id, actorId: access.userId, payload: { number: transmittal.number, projectCode, revisionCount: count ?? 0, path: `/projects/${projectCode}/transmittals` } });
    revalidatePath(`/projects/${projectCode}/transmittals`);
  } catch (error) {
    return errorState(error);
  }
  return { ok: 'Transmittal marked as sent.' };
}
