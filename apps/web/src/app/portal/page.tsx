import { requireClient } from '@/lib/access';
import { adminDb } from '@/lib/supabase/admin';
import { formatDateOnly, formatIst } from '@/lib/format';
import { Badge, Card, EmptyState, PageHeader, Table, td, th, LinkButton } from '@/components/ds';

/** Client home: issued drawings (download links expire in 5 minutes), transmittals and conflicts. */
export default async function PortalHome() {
  const access = await requireClient();
  const db = adminDb();
  const { data: projects } = await db.from('projects').select('id, code, name').eq('client_org_id', access.clientOrgId ?? '').order('code');
  const projectIds = (projects ?? []).map((p) => p.id);
  const allowedProjects = new Set(projectIds.filter((id) => access.projectRoles.has(id)));

  // An empty list would produce an invalid filter, so a placeholder id is used when the client has no projects.
  const scopeIds = [...allowedProjects];
  const scope = scopeIds.length ? scopeIds : ['00000000-0000-0000-0000-000000000000'];
  const { data: sheets } = await db
    .from('sheets')
    .select('id, sheet_number, title, status, project_id, current_revision_id, revisions:current_revision_id(rev_code, purpose, issued_at)')
    .in('project_id', scope)
    .in('status', ['issued', 'gfc', 'ifc'])
    .order('sheet_number');

  const sheetIds = (sheets ?? []).map((s) => s.current_revision_id).filter(Boolean) as string[];
  const { data: files } = sheetIds.length
    ? await db.from('files').select('id, revision_id, storage_path, original_name, format').in('revision_id', sheetIds)
    : { data: [] as { id: string; revision_id: string; storage_path: string; original_name: string; format: string }[] };
  const { data: conflicts } = await db.from('conflicts').select('id, subject, status, created_at').eq('client_org_id', access.clientOrgId ?? '').order('created_at', { ascending: false }).limit(50);
  const { data: transmittals } = await db.from('transmittals').select('id, number, sent_at, project_id').in('project_id', scope).not('sent_at', 'is', null).order('sent_at', { ascending: false }).limit(50);

  const downloadUrls = new Map<string, string>();
  for (const f of files ?? []) {
    const { data } = await db.storage.from('drawings').createSignedUrl(f.storage_path, 300, { download: f.original_name });
    if (data) downloadUrls.set(f.id, data.signedUrl);
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Your drawings" description="Issued drawings for your projects. Downloads expire after a few minutes." actions={<LinkButton href="/portal/conflicts/new" variant="secondary">Raise a conflict</LinkButton>} />

      <section className="flex flex-col gap-4" aria-labelledby="issued">
        <h2 id="issued" className="text-lg font-semibold">Issued sheets</h2>
        {(sheets ?? []).length === 0 ? <EmptyState title="No issued drawings yet" description="Drawings appear here once the firm issues them." /> : (
          <Table caption="Issued drawings">
            <thead><tr><th className={th} scope="col">Sheet</th><th className={th} scope="col">Revision</th><th className={th} scope="col">Issue</th><th className={th} scope="col">Issued</th><th className={th} scope="col">File</th></tr></thead>
            <tbody>
              {(sheets ?? []).map((s) => {
                const rev = s.revisions as unknown as { rev_code: string; purpose: string | null; issued_at: string | null } | null;
                const file = (files ?? []).find((f) => f.revision_id === s.current_revision_id);
                const url = file ? downloadUrls.get(file.id) : undefined;
                return (
                  <tr key={s.id}>
                    <td className={td}><span className="font-medium">{s.sheet_number}</span><div className="text-xs text-text-muted">{s.title}</div></td>
                    <td className={`${td} tabular-nums`}>{rev?.rev_code}</td>
                    <td className={td}>{rev?.purpose ? <Badge tone="success">{rev.purpose.toUpperCase()}</Badge> : '—'}</td>
                    <td className={td}>{formatIst(rev?.issued_at ?? null)}</td>
                    <td className={td}>{url ? <a className="font-semibold text-brand-700 underline" href={url}>Download {file?.format.toUpperCase()}</a> : <span className="text-text-muted">Not available</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Transmittals</h2>
          {(transmittals ?? []).length === 0 ? <p className="text-sm text-text-secondary">No transmittals yet.</p> : (
            <ul className="divide-y divide-border text-sm">
              {(transmittals ?? []).map((t) => <li key={t.id} className="flex justify-between py-2"><span className="font-mono text-xs">{t.number}</span><span className="text-text-muted">{formatDateOnly(String(t.sent_at).slice(0, 10))}</span></li>)}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Your conflicts</h2>
          {(conflicts ?? []).length === 0 ? <p className="text-sm text-text-secondary">You have not raised any conflicts.</p> : (
            <ul className="divide-y divide-border text-sm">
              {(conflicts ?? []).map((c) => <li key={c.id} className="flex items-center justify-between gap-3 py-2"><a className="font-medium text-brand-700 underline" href={`/portal/conflicts/${c.id}`}>{c.subject}</a><Badge tone={c.status === 'closed' ? 'neutral' : 'info'}>{c.status}</Badge></li>)}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}
