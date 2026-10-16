import { requireInternal } from '@/lib/access';
import { adminDb } from '@/lib/supabase/admin';
import { decideApproval } from '@/app/actions/approvals';
import { ActionForm } from '@/components/ActionForm';
import { Badge, Card, EmptyState, FormField, PageHeader, textareaClass } from '@/components/ds';
import { formatDateOnly } from '@/lib/format';

export default async function ApprovalsPage() {
  const access = await requireInternal();
  const db = adminDb();
  const { data: approvals } = await db
    .from('approvals')
    .select('id, transition, due_at, reason, status, entity_id, requested_by, assignee_id, project_id, projects(code)')
    .eq('assignee_id', access.userId)
    .eq('status', 'pending')
    .order('due_at');
  const sheetIds = (approvals ?? []).map((a) => a.entity_id as string);
  const { data: sheets } = sheetIds.length ? await db.from('sheets').select('id, sheet_number, title').in('id', sheetIds) : { data: [] };
  const sheetById = new Map((sheets ?? []).map((s) => [s.id, s]));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow="Your queue" title="Approvals" description="Requests waiting for your decision. A rejection needs a reason; the drafter will see it." />
      {(approvals ?? []).length === 0 ? (
        <EmptyState title="Nothing to approve" description="When a change to an issued sheet needs your decision, it appears here." />
      ) : (
        <div className="flex flex-col gap-4">
          {(approvals ?? []).map((a) => {
            const sheet = sheetById.get(a.entity_id);
            const project = a.projects as unknown as { code: string } | null;
            return (
              <Card key={a.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold">{sheet ? `${sheet.sheet_number} ${sheet.title}` : 'Sheet'}</h2>
                    <p className="text-sm text-text-secondary">{a.transition} · {project?.code}</p>
                    {a.reason && <p className="mt-2 text-sm"><span className="font-semibold">Reason: </span>{a.reason}</p>}
                  </div>
                  <Badge tone="warning">Due {formatDateOnly(String(a.due_at).slice(0, 10))}</Badge>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <ActionForm action={decideApproval} submitLabel="Approve" className="flex flex-col gap-3">
                    <input type="hidden" name="approvalId" value={a.id} />
                    <input type="hidden" name="decision" value="approve" />
                  </ActionForm>
                  <ActionForm action={decideApproval} submitLabel="Reject" variant="danger" className="flex flex-col gap-3">
                    <input type="hidden" name="approvalId" value={a.id} />
                    <input type="hidden" name="decision" value="reject" />
                    <FormField label="Reason for rejection" htmlFor={`reason-${a.id}`} required>
                      <textarea id={`reason-${a.id}`} name="reason" required rows={2} className={textareaClass} />
                    </FormField>
                  </ActionForm>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
