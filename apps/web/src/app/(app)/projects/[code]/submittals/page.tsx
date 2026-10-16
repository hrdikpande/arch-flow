import { notFound } from 'next/navigation';
import { requireInternal, projectByCode, canSee } from '@/lib/access';
import { adminDb } from '@/lib/supabase/admin';
import { createSubmittal, setSubmittalStatus } from '@/app/actions/features';
import { ActionForm } from '@/components/ActionForm';
import { Badge, Card, EmptyState, FormField, PageHeader, Table, td, th, inputClass } from '@/components/ds';
import { formatDateOnly, istToday } from '@/lib/format';

const STATUSES = ['submitted', 'under_review', 'approved', 'approved_with_comments', 'rejected'] as const;

export default async function SubmittalsPage({ params }: { params: Promise<{ code: string }> }) {
  const access = await requireInternal();
  const { code } = await params;
  const project = await projectByCode(code);
  if (!project || !canSee(access, project.id)) notFound();
  const { data: rows } = await adminDb().from('submittals').select('id, number, item, status, due_date, sheets:sheet_id(sheet_number)').eq('project_id', project.id).order('due_date', { nullsFirst: false });
  const today = istToday();
  const canEdit = access.isAdmin || ['project_head', 'discipline_lead'].some((r) => access.projectRoles.get(project.id)?.has(r as never));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={project.code} title="Submittals" description="Material and equipment submitted to the contractor for approval. Overdue items are flagged." />
      {(rows ?? []).length === 0 ? <EmptyState title="No submittals logged" description="Log a submittal below." /> : (
        <Table caption="Submittals">
          <thead><tr><th className={th} scope="col">Number</th><th className={th} scope="col">Item</th><th className={th} scope="col">Sheet</th><th className={th} scope="col">Due</th><th className={th} scope="col">Status</th></tr></thead>
          <tbody>
            {(rows ?? []).map((s) => {
              const overdue = s.due_date && s.due_date < today && !['approved', 'rejected'].includes(s.status);
              return (
                <tr key={s.id}>
                  <td className={`${td} font-medium`}>{s.number}</td>
                  <td className={td}>{s.item}</td>
                  <td className={td}>{(s.sheets as unknown as { sheet_number: string } | null)?.sheet_number ?? '—'}</td>
                  <td className={td}>{overdue ? <Badge tone="error">Overdue {formatDateOnly(s.due_date)}</Badge> : formatDateOnly(s.due_date)}</td>
                  <td className={td}>
                    {canEdit ? (
                      <ActionForm action={setSubmittalStatus} submitLabel="Save" variant="secondary" className="flex items-center gap-2">
                        <input type="hidden" name="id" value={s.id} />
                        <input type="hidden" name="projectCode" value={code} />
                        <select name="status" defaultValue={s.status} aria-label={`Status of ${s.number}`} className={inputClass}>
                          {STATUSES.map((st) => <option key={st} value={st}>{st.replace(/_/g, ' ')}</option>)}
                        </select>
                      </ActionForm>
                    ) : s.status.replace(/_/g, ' ')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
      {canEdit && (
        <Card>
          <h2 className="mb-4 text-lg font-semibold">Log a submittal</h2>
          <ActionForm action={createSubmittal} submitLabel="Log submittal">
            <input type="hidden" name="projectCode" value={code} />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Submittal number" htmlFor="number" required><input id="number" name="number" required className={inputClass} /></FormField>
              <FormField label="Item" htmlFor="item" required><input id="item" name="item" required className={inputClass} /></FormField>
              <FormField label="Related sheet" htmlFor="sheet"><input id="sheet" name="sheet" className={inputClass} /></FormField>
              <FormField label="Due date" htmlFor="dueDate" hint="Leave empty to use the 10-working-day default."><input id="dueDate" name="dueDate" type="date" className={inputClass} /></FormField>
            </div>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
