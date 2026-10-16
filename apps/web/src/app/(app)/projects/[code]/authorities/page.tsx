import { notFound } from 'next/navigation';
import { requireInternal, projectByCode, canSee, hasProjectRole } from '@/lib/access';
import { adminDb } from '@/lib/supabase/admin';
import { loadAuthorityChecklist, setChecklistStatus } from '@/app/actions/features';
import { ActionForm } from '@/components/ActionForm';
import { Badge, Card, EmptyState, PageHeader, Table, td, th, inputClass } from '@/components/ds';
import { formatDateOnly, istToday } from '@/lib/format';

const STATUSES = ['pending', 'submitted', 'approved', 'not_applicable'] as const;

export default async function AuthoritiesPage({ params }: { params: Promise<{ code: string }> }) {
  const access = await requireInternal();
  const { code } = await params;
  const project = await projectByCode(code);
  if (!project || !canSee(access, project.id)) notFound();
  const { data: items } = await adminDb().from('authority_checklists').select('id, authority, item, required, status, due_date, responsible_id').eq('project_id', project.id).order('authority').order('item');
  const today = istToday();
  const isHead = hasProjectRole(access, project.id, ['project_head']);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={project.code}
        title="Authority checklists"
        description="What each authority needs before approval: building sanction, fire NOC, AERB and others. Items come from the firm's template."
        actions={isHead ? <ActionForm action={loadAuthorityChecklist} submitLabel="Load template items" variant="secondary"><input type="hidden" name="projectCode" value={code} /></ActionForm> : undefined}
      />
      {(items ?? []).length === 0 ? <EmptyState title="No checklist yet" description={isHead ? 'Load the firm template to start the checklist for this project.' : 'The project head loads the checklist from the template.'} /> : (
        <Table caption="Authority checklist items">
          <thead><tr><th className={th} scope="col">Authority</th><th className={th} scope="col">Item</th><th className={th} scope="col">Due</th><th className={th} scope="col">Status</th></tr></thead>
          <tbody>
            {(items ?? []).map((i) => {
              const overdue = i.required && i.due_date && i.due_date < today && !['approved', 'not_applicable'].includes(i.status);
              return (
                <tr key={i.id}>
                  <td className={td}>{i.authority}</td>
                  <td className={td}>{i.item}{i.required ? '' : ' (optional)'}</td>
                  <td className={td}>{overdue ? <Badge tone="error">Overdue</Badge> : formatDateOnly(i.due_date)}</td>
                  <td className={td}>
                    <ActionForm action={setChecklistStatus} submitLabel="Save" variant="secondary" className="flex items-center gap-2">
                      <input type="hidden" name="id" value={i.id} />
                      <input type="hidden" name="projectCode" value={code} />
                      <select name="status" defaultValue={i.status} aria-label={`Status of ${i.item}`} className={inputClass}>
                        {STATUSES.map((st) => <option key={st} value={st}>{st.replace(/_/g, ' ')}</option>)}
                      </select>
                    </ActionForm>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
      <Card padding="sm"><p className="text-sm text-text-secondary">Each item records who ticked it and when. Only the responsible person or the project head can change an item.</p></Card>
    </div>
  );
}
