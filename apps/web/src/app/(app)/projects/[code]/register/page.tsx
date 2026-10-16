import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireInternal, projectByCode, canSee } from '@/lib/access';
import { adminDb } from '@/lib/supabase/admin';
import { STATE_LABELS, type SheetState } from '@arch-flow/domain';
import { createSheet } from '@/app/actions/sheets';
import { ActionForm } from '@/components/ActionForm';
import { Badge, Card, EmptyState, FormField, PageHeader, Table, td, th, inputClass, LinkButton } from '@/components/ds';
import { formatDateOnly, istToday } from '@/lib/format';

type SearchParams = { q?: string; state?: string; discipline?: string };

export default async function RegisterPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<SearchParams> }) {
  const access = await requireInternal();
  const { code } = await params;
  const filters = await searchParams;
  const project = await projectByCode(code);
  if (!project || !canSee(access, project.id)) notFound();
  const db = adminDb();
  let query = db
    .from('sheets')
    .select('id, sheet_number, title, status, due_date, discipline_code, owner_id, profiles(full_name), current_revision_id, revisions:current_revision_id(rev_code)')
    .eq('project_id', project.id)
    .order('sheet_number');
  if (filters.state) query = query.eq('status', filters.state);
  if (filters.discipline) query = query.eq('discipline_code', filters.discipline);
  if (filters.q) query = query.or(`sheet_number.ilike.%${filters.q}%,title.ilike.%${filters.q}%`);
  const [{ data: sheets }, { data: disciplines }] = await Promise.all([query.limit(500), db.from('disciplines').select('code, name').order('sort_order')]);
  const today = istToday();
  const canCreate = access.isAdmin || ['project_head', 'discipline_lead', 'drafter'].some((r) => access.projectRoles.get(project.id)?.has(r as never));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={project.code}
        title="Register"
        description="Every sheet in this project, its current revision and its state."
        actions={<LinkButton href={`/projects/${code}/register/import`} variant="secondary">Import register</LinkButton>}
      />
      <form className="grid gap-3 sm:grid-cols-[1fr_180px_180px_auto]" role="search" aria-label="Filter sheets">
        <FormField label="Search" htmlFor="q"><input id="q" name="q" defaultValue={filters.q ?? ''} placeholder="Sheet number or title" className={inputClass} /></FormField>
        <FormField label="State" htmlFor="state">
          <select id="state" name="state" defaultValue={filters.state ?? ''} className={inputClass}>
            <option value="">All states</option>
            {(Object.keys(STATE_LABELS) as SheetState[]).map((s) => <option key={s} value={s}>{STATE_LABELS[s]}</option>)}
          </select>
        </FormField>
        <FormField label="Discipline" htmlFor="discipline">
          <select id="discipline" name="discipline" defaultValue={filters.discipline ?? ''} className={inputClass}>
            <option value="">All disciplines</option>
            {(disciplines ?? []).map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
          </select>
        </FormField>
        <div className="flex items-end"><button type="submit" className="min-h-10 rounded-sm border border-border-strong px-4 text-sm font-semibold">Apply</button></div>
      </form>

      {(sheets ?? []).length === 0 ? (
        <EmptyState title="No sheets match" description="Change the filters, or add the first sheet below." />
      ) : (
        <Table caption="Register sheets">
          <thead>
            <tr>
              <th className={th} scope="col">Sheet</th>
              <th className={th} scope="col">Revision</th>
              <th className={th} scope="col">State</th>
              <th className={th} scope="col">Owner</th>
              <th className={th} scope="col">Due</th>
            </tr>
          </thead>
          <tbody>
            {(sheets ?? []).map((s) => {
              const overdue = s.due_date && s.due_date < today && !['issued', 'gfc', 'ifc', 'superseded'].includes(s.status);
              const owner = (s.profiles as unknown as { full_name: string } | null)?.full_name ?? '—';
              const rev = (s.revisions as unknown as { rev_code: string } | null)?.rev_code ?? '—';
              return (
                <tr key={s.id}>
                  <td className={td}>
                    <Link href={`/projects/${code}/sheets/${s.sheet_number}`} className="font-medium text-brand-700 underline underline-offset-2">{s.sheet_number}</Link>
                    <div className="text-xs text-text-muted">{s.title}</div>
                  </td>
                  <td className={`${td} tabular-nums`}>{rev}</td>
                  <td className={td}><Badge tone={s.status === 'approved' || s.status === 'issued' ? 'success' : 'neutral'}>{STATE_LABELS[s.status as SheetState]}</Badge></td>
                  <td className={td}>{owner}</td>
                  <td className={td}>{overdue ? <Badge tone="error">Overdue {formatDateOnly(s.due_date)}</Badge> : formatDateOnly(s.due_date)}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}

      {canCreate && (
        <Card>
          <h2 className="mb-4 text-lg font-semibold">Add a sheet</h2>
          <ActionForm action={createSheet} submitLabel="Add sheet">
            <input type="hidden" name="projectCode" value={code} />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Sheet number" htmlFor="sheetNumber" required hint="Unique in the project, for example M-101.">
                <input id="sheetNumber" name="sheetNumber" required className={inputClass} />
              </FormField>
              <FormField label="Title" htmlFor="title" required>
                <input id="title" name="title" required className={inputClass} />
              </FormField>
              <FormField label="Discipline" htmlFor="discipline" required>
                <select id="discipline" name="discipline" required className={inputClass} defaultValue="">
                  <option value="" disabled>Choose a discipline</option>
                  {(disciplines ?? []).map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
                </select>
              </FormField>
              <FormField label="Owner email" htmlFor="ownerEmail" hint="Optional. The active user responsible for this sheet.">
                <input id="ownerEmail" name="ownerEmail" type="email" className={inputClass} />
              </FormField>
              <FormField label="Due date" htmlFor="dueDate" hint="Optional.">
                <input id="dueDate" name="dueDate" type="date" className={inputClass} />
              </FormField>
            </div>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
