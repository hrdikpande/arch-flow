import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireInternal, projectByCode, canSee } from '@/lib/access';
import { adminDb } from '@/lib/supabase/admin';
import { createClash, resolveClash, createRfi, answerRfi } from '@/app/actions/issues';
import { ActionForm } from '@/components/ActionForm';
import { Badge, Card, EmptyState, FormField, PageHeader, Table, td, th, inputClass, textareaClass } from '@/components/ds';
import { formatDateOnly, istToday } from '@/lib/format';

export default async function IssuesPage({ params }: { params: Promise<{ code: string }> }) {
  const access = await requireInternal();
  const { code } = await params;
  const project = await projectByCode(code);
  if (!project || !canSee(access, project.id)) notFound();
  const db = adminDb();
  const [{ data: clashes }, { data: rfis }, { data: disciplines }] = await Promise.all([
    db.from('clashes').select('id, number, title, priority, status, discipline_a, discipline_b').eq('project_id', project.id).order('created_at', { ascending: false }).limit(200),
    db.from('rfis').select('id, number, subject, priority, status, due_date, answer').eq('project_id', project.id).order('created_at', { ascending: false }).limit(200),
    db.from('disciplines').select('code, name').order('sort_order'),
  ]);
  const today = istToday();
  const discOptions = (
    <>
      <option value="">—</option>
      {(disciplines ?? []).map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
    </>
  );

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={project.code} title="Issues" description="Clashes between disciplines and contractor queries (RFIs)." />

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Clashes</h2>
        {(clashes ?? []).length === 0 ? <EmptyState title="No clashes logged" description="Log a clash from coordination below." /> : (
          <Table caption="Clashes">
            <thead><tr><th className={th} scope="col">Clash</th><th className={th} scope="col">Disciplines</th><th className={th} scope="col">Priority</th><th className={th} scope="col">Status</th><th className={th} scope="col">Action</th></tr></thead>
            <tbody>
              {(clashes ?? []).map((c) => (
                <tr key={c.id}>
                  <td className={td}><Link className="font-medium underline" href={`/projects/${code}/issues/${c.id}`}>{c.number}</Link><div className="text-xs text-text-muted">{c.title}</div></td>
                  <td className={td}>{c.discipline_a ?? '—'} / {c.discipline_b ?? '—'}</td>
                  <td className={td}><Badge tone={c.priority === 'critical' ? 'error' : 'neutral'}>{c.priority}</Badge></td>
                  <td className={td}>{c.status}</td>
                  <td className={td}>
                    {c.status === 'open' && (
                      <ActionForm action={resolveClash} submitLabel="Mark resolved" variant="secondary" className="flex flex-col gap-2">
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="projectCode" value={code} />
                        <textarea name="note" required rows={2} aria-label={`Resolution note for ${c.number}`} placeholder="How it was resolved" className={textareaClass} />
                      </ActionForm>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <Card>
          <h3 className="mb-4 text-base font-semibold">Log a clash</h3>
          <ActionForm action={createClash} submitLabel="Log clash">
            <input type="hidden" name="projectCode" value={code} />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Clash number" htmlFor="number" required><input id="number" name="number" required className={inputClass} /></FormField>
              <FormField label="Title" htmlFor="title" required><input id="title" name="title" required className={inputClass} /></FormField>
              <FormField label="Discipline A" htmlFor="disciplineA"><select id="disciplineA" name="disciplineA" className={inputClass}>{discOptions}</select></FormField>
              <FormField label="Discipline B" htmlFor="disciplineB"><select id="disciplineB" name="disciplineB" className={inputClass}>{discOptions}</select></FormField>
              <FormField label="Priority" htmlFor="priority" required hint="Critical is also set automatically by the owner's rules."><select id="priority" name="priority" className={inputClass} defaultValue="minor"><option value="minor">Minor</option><option value="major">Major</option><option value="critical">Critical</option></select></FormField>
              <FormField label="Sheets (comma separated)" htmlFor="sheets"><input id="sheets" name="sheets" placeholder="M-101, S-204" className={inputClass} /></FormField>
            </div>
            <FormField label="Description" htmlFor="description"><textarea id="description" name="description" rows={3} className={textareaClass} /></FormField>
          </ActionForm>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">RFIs</h2>
        {(rfis ?? []).length === 0 ? <EmptyState title="No RFIs logged" description="Log a contractor query below." /> : (
          <Table caption="RFIs">
            <thead><tr><th className={th} scope="col">RFI</th><th className={th} scope="col">Due</th><th className={th} scope="col">Status</th><th className={th} scope="col">Answer</th></tr></thead>
            <tbody>
              {(rfis ?? []).map((r) => {
                const overdue = r.status === 'open' && r.due_date && r.due_date < today;
                return (
                  <tr key={r.id}>
                    <td className={td}><span className="font-medium">{r.number}</span><div className="text-xs text-text-muted">{r.subject}</div></td>
                    <td className={td}>{overdue ? <Badge tone="error">Overdue {formatDateOnly(r.due_date)}</Badge> : formatDateOnly(r.due_date)}</td>
                    <td className={td}>{r.status}</td>
                    <td className={td}>
                      {r.status === 'open' ? (
                        <ActionForm action={answerRfi} submitLabel="Save answer" variant="secondary" className="flex flex-col gap-2">
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="projectCode" value={code} />
                          <textarea name="answer" required rows={2} aria-label={`Answer to ${r.number}`} className={textareaClass} />
                        </ActionForm>
                      ) : <span className="text-text-secondary">{r.answer}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
        <Card>
          <h3 className="mb-4 text-base font-semibold">Log an RFI</h3>
          <ActionForm action={createRfi} submitLabel="Log RFI">
            <input type="hidden" name="projectCode" value={code} />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="RFI number" htmlFor="rfiNumber" required><input id="rfiNumber" name="number" required className={inputClass} /></FormField>
              <FormField label="Subject" htmlFor="subject" required><input id="subject" name="subject" required className={inputClass} /></FormField>
              <FormField label="Related sheet" htmlFor="sheet"><input id="sheet" name="sheet" className={inputClass} /></FormField>
              <FormField label="Priority" htmlFor="rfiPriority"><select id="rfiPriority" name="priority" className={inputClass} defaultValue="minor"><option value="minor">Minor</option><option value="major">Major</option><option value="critical">Critical</option></select></FormField>
              <FormField label="Response due" htmlFor="rfiDue" hint="Leave empty for 7 working days."><input id="rfiDue" name="dueDate" type="date" className={inputClass} /></FormField>
            </div>
            <FormField label="Question" htmlFor="body"><textarea id="body" name="body" rows={3} className={textareaClass} /></FormField>
          </ActionForm>
        </Card>
      </section>
    </div>
  );
}
