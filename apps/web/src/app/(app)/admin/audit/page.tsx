import { notFound } from 'next/navigation';
import { requireInternal } from '@/lib/access';
import { adminDb } from '@/lib/supabase/admin';
import { PageHeader, Table, td, th } from '@/components/ds';
import { formatIst } from '@/lib/format';

export default async function AuditPage() {
  const access = await requireInternal();
  if (!access.isAdmin) notFound();
  const { data } = await adminDb()
    .from('audit_log')
    .select('id, action, entity_type, entity_id, created_at, after, profiles:actor_id(full_name)')
    .order('created_at', { ascending: false })
    .limit(200);
  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow="Owner" title="Audit log" description="Append-only record of changes. The latest 200 entries are shown." />
      <Table caption="Audit log">
        <thead><tr><th className={th} scope="col">When</th><th className={th} scope="col">Who</th><th className={th} scope="col">Action</th><th className={th} scope="col">Details</th></tr></thead>
        <tbody>
          {(data ?? []).map((row) => (
            <tr key={row.id}>
              <td className={td}>{formatIst(row.created_at)}</td>
              <td className={td}>{(row.profiles as unknown as { full_name: string } | null)?.full_name ?? 'System'}</td>
              <td className={td}><span className="font-mono text-xs">{row.action}</span></td>
              <td className={`${td} max-w-[420px] break-words text-xs text-text-secondary`}>{row.after ? JSON.stringify(row.after) : row.entity_type ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
