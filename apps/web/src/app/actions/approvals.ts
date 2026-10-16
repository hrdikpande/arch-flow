'use server';

import { revalidatePath } from 'next/cache';
import { nextRevisionCode } from '@arch-flow/domain';
import { adminDb } from '@/lib/supabase/admin';
import { requireInternal, hasProjectRole } from '@/lib/access';
import { writeAudit } from '@/lib/audit';
import { recordEvent, notifyUsers } from '@/lib/events';
import { revisionsOf } from '@/lib/workflow';
import { errorState, type FormState } from './types';

/**
 * Approve or reject a request (APR-03, APR-04). The assignee or an admin decides.
 * Approving a change to an issued sheet opens a new work revision; the issued
 * revision stays unchanged (REG-04).
 */
export async function decideApproval(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const access = await requireInternal();
    const approvalId = String(form.get('approvalId') ?? '');
    const decision = String(form.get('decision') ?? '');
    const reason = String(form.get('reason') ?? '').trim();
    if (decision !== 'approve' && decision !== 'reject') throw new Error('Choose approve or reject.');
    if (decision === 'reject' && !reason) throw new Error('Give a reason when rejecting. The drafter will see it.');

    const db = adminDb();
    const { data: approval } = await db
      .from('approvals')
      .select('id, project_id, entity_id, transition, requested_by, assignee_id, status, reason')
      .eq('id', approvalId)
      .maybeSingle();
    if (!approval) throw new Error('Approval not found.');
    if (approval.status !== 'pending') throw new Error('This request has already been decided.');
    const isAssignee = approval.assignee_id === access.userId;
    if (!isAssignee && !access.isAdmin) throw new Error('Only the assignee or the admin can decide this request.');
    if (!access.isAdmin && !hasProjectRole(access, approval.project_id, ['project_head'])) {
      throw new Error('Only a project head can approve changes to issued sheets.');
    }

    const { data: sheet } = await db
      .from('sheets')
      .select('id, sheet_number, project_id, status, title, projects(code)')
      .eq('id', approval.entity_id)
      .maybeSingle();
    if (!sheet) throw new Error('Sheet not found.');
    const projectCode = (sheet.projects as unknown as { code: string }).code;
    const revisions = await revisionsOf(sheet.id);
    const current = revisions.find((r) => r.status === 'issued') ?? revisions[revisions.length - 1];
    const path = `/projects/${projectCode}/sheets/${sheet.sheet_number}`;

    const samePerson = approval.requested_by === access.userId;
    const { error: updateError } = await db
      .from('approvals')
      .update({ status: decision === 'approve' ? 'approved' : 'rejected', decided_by: access.userId, decided_at: new Date().toISOString(), reason: reason || null })
      .eq('id', approval.id)
      .eq('status', 'pending');
    if (updateError) throw new Error(updateError.message);

    await db
      .from('change_requests')
      .update({ status: decision === 'approve' ? 'approved' : 'rejected' })
      .eq('approval_id', approval.id);

    if (decision === 'approve' && approval.transition === 'change_live_sheet') {
      const latest = revisions[revisions.length - 1];
      const newCode = nextRevisionCode(latest?.rev_code ?? null);
      const { error: revError } = await db
        .from('revisions')
        .insert({ sheet_id: sheet.id, rev_code: newCode, seq: (latest?.seq ?? -1) + 1, status: 'wip', created_by: access.userId });
      if (revError) throw new Error(revError.message);
      const { error: sheetError } = await db.from('sheets').update({ status: 'wip' }).eq('id', sheet.id);
      if (sheetError) throw new Error(sheetError.message);
    }

    await writeAudit({
      actorId: access.userId,
      action: decision === 'approve' ? 'approval.approved' : 'approval.rejected',
      entityType: 'approval',
      entityId: approval.id,
      projectId: approval.project_id,
      after: { reason: reason || null, samePerson },
    });
    await recordEvent({
      type: decision === 'approve' ? 'approval.approved' : 'approval.rejected',
      projectId: approval.project_id,
      entityType: 'approval',
      entityId: approval.id,
      actorId: access.userId,
      payload: { projectCode, sheet: sheet.sheet_number, rev: current?.rev_code ?? '', userName: access.name, reason: reason || null, path },
    });
    await notifyUsers([approval.requested_by], decision === 'approve' ? 'Change approved' : 'Change rejected', `${sheet.sheet_number}: ${reason || 'approved'}`, path);
    revalidatePath('/approvals');
    revalidatePath(path);
  } catch (error) {
    return errorState(error);
  }
  return { ok: 'Decision recorded.' };
}
