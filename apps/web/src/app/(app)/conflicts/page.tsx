import Link from 'next/link';
import { requireInternal } from '@/lib/access';
import { adminDb } from '@/lib/supabase/admin';
import { visibleProjectIds } from '@/lib/scope';
import { Badge, EmptyState, PageHeader, Table, td, th } from '@/components/ds';
import { formatIst } from '@/lib/format';

export default async function ConflictsPage() {
  const access = await requireInternal();
  const ids = visibleProjectIds(access);
  let query = adminDb().from('conflicts').select('id, subject, status, due_at, created_at, projects(code)').order('created_at', { ascending: false }).limit(200);
  if (ids !== null) query = query.in('project_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
  const { data: conflicts } = await query;
  const now = Date.now();
  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow="Clients" title="Conflicts" description="Client conflicts are answered within the reply window. Overdue ones are flagged." />
      {(conflicts ?? []).length === 0 ? <EmptyState title="No conflicts" description="Client conflicts appear here." /> : (
        <Table caption="Client conflicts">
          <thead><tr><th className={th} scope="col">Subject</th><th className={th} scope="col">Project</th><th className={th} scope="col">Status</th><th className={th} scope="col">Reply by</th></tr></thead>
          <tbody>
            {(conflicts ?? []).map((c) => {
              const overdue = ['open', 'awaiting_client'].includes(c.status) && new Date(c.due_at).getTime() < now;
              return (
                <tr key={c.id}>
                  <td className={td}><Link href={`/conflicts/${c.id}`} className="font-medium text-brand-700 underline underline-offset-2">{c.subject}</Link></td>
                  <td className={td}>{(c.projects as unknown as { code: string } | null)?.code}</td>
                  <td className={td}><Badge tone={c.status === 'closed' ? 'neutral' : overdue ? 'error' : 'info'}>{overdue ? 'Overdue' : c.status}</Badge></td>
                  <td className={td}>{formatIst(c.due_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}
