import Link from 'next/link';
import { requireInternal } from '@/lib/access';
import { adminDb } from '@/lib/supabase/admin';
import { istToday, formatDateOnly } from '@/lib/format';
import { visibleProjectIds } from '@/lib/scope';
import { Card, EmptyState, PageHeader, Badge, Table, th, td } from '@/components/ds';

const OPEN_SHEET_STATES = ['not_started', 'assigned', 'wip', 'internal_check', 'coordination', 'approved', 'client_review', 'commented', 'revised'];

/** Limits a query to the projects the user can see. Query builders are loosely typed here to keep inference shallow. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function scoped(query: any, ids: string[] | null): any {
  return ids === null ? query : query.in('project_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
}

export default async function DashboardPage() {
  const access = await requireInternal();
  const ids = visibleProjectIds(access);
  const db = adminDb();
  const today = istToday();
  const now = new Date().toISOString();

  const [sheetsOverdue, rfisOverdue, clashesCritical, approvalsPending, conflictsOverdue, mySheets, myApprovals] = await Promise.all([
    scoped(db.from('sheets').select('id', { count: 'exact', head: true }).in('status', OPEN_SHEET_STATES).lt('due_date', today), ids),
    scoped(db.from('rfis').select('id', { count: 'exact', head: true }).eq('status', 'open').lt('due_date', today), ids),
    scoped(db.from('clashes').select('id', { count: 'exact', head: true }).eq('status', 'open').eq('priority', 'critical'), ids),
    scoped(db.from('approvals').select('id', { count: 'exact', head: true }).eq('status', 'pending'), ids),
    scoped(db.from('conflicts').select('id', { count: 'exact', head: true }).in('status', ['open', 'awaiting_client']).lt('due_at', now), ids),
    db.from('sheets').select('id, sheet_number, title, status, due_date, projects(code)').eq('owner_id', access.userId).in('status', OPEN_SHEET_STATES).order('due_date', { ascending: true, nullsFirst: false }).limit(10),
    db.from('approvals').select('id, transition, due_at, entity_id, project_id').eq('assignee_id', access.userId).eq('status', 'pending').order('due_at').limit(10),
  ]);

  const tiles = [
    { label: 'Overdue sheets', value: sheetsOverdue.count ?? 0, href: '/projects' },
    { label: 'Overdue RFIs', value: rfisOverdue.count ?? 0, href: '/projects' },
    { label: 'Open critical clashes', value: clashesCritical.count ?? 0, href: '/projects' },
    { label: 'Approvals pending', value: approvalsPending.count ?? 0, href: '/approvals' },
    { label: 'Client conflicts overdue', value: conflictsOverdue.count ?? 0, href: '/conflicts' },
  ];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={access.isAdmin ? 'Owner' : 'My work'} title="Home" description="Status across the projects you can see. Times are IST." />
      {access.isAdmin && (
        <section aria-label="Status tiles" className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {tiles.map((t) => (
            <Link key={t.label} href={t.href} className="rounded-md border border-border bg-surface p-4 shadow-xs hover:border-border-strong">
              <p className="text-xs font-semibold text-text-muted">{t.label}</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{t.value}</p>
            </Link>
          ))}
        </section>
      )}
      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Waiting for your approval</h2>
          {(myApprovals.data ?? []).length === 0 ? (
            <EmptyState title="Nothing waiting" description="Approvals assigned to you appear here." />
          ) : (
            <ul className="flex flex-col gap-2">
              {(myApprovals.data ?? []).map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 text-sm">
                  <Link href="/approvals" className="font-medium text-brand-700 underline underline-offset-2">{a.transition}</Link>
                  <Badge tone="warning">Due {formatDateOnly(String(a.due_at).slice(0, 10))}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Sheets you own</h2>
          {(mySheets.data ?? []).length === 0 ? (
            <EmptyState title="No open sheets" description="Sheets you are assigned as owner appear here." />
          ) : (
            <Table caption="Sheets you own">
              <thead><tr><th className={th} scope="col">Sheet</th><th className={th} scope="col">Status</th><th className={th} scope="col">Due</th></tr></thead>
              <tbody>
                {(mySheets.data ?? []).map((s) => {
                  const project = s.projects as unknown as { code: string } | null;
                  return (
                    <tr key={s.id}>
                      <td className={td}><Link className="font-medium text-brand-700 underline underline-offset-2" href={`/projects/${project?.code}/sheets/${s.sheet_number}`}>{s.sheet_number}</Link><div className="text-xs text-text-muted">{s.title}</div></td>
                      <td className={td}>{s.status}</td>
                      <td className={td}>{formatDateOnly(s.due_date)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>
      </section>
    </div>
  );
}
