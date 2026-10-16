import { notFound } from 'next/navigation';
import { requireInternal, projectByCode, canSee, hasProjectRole } from '@/lib/access';
import { adminDb } from '@/lib/supabase/admin';
import { markTransmittalSent } from '@/app/actions/transmittals';
import { ActionForm } from '@/components/ActionForm';
import { Badge, EmptyState, PageHeader, Table, td, th } from '@/components/ds';
import { formatIst } from '@/lib/format';

export default async function TransmittalsPage({ params }: { params: Promise<{ code: string }> }) {
  const access = await requireInternal();
  const { code } = await params;
  const project = await projectByCode(code);
  if (!project || !canSee(access, project.id)) notFound();
  const { data: rows } = await adminDb()
    .from('transmittals')
    .select('id, number, recipient_text, sent_at, created_at, transmittal_items(revision_id)')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false })
    .limit(200);
  const canMark = hasProjectRole(access, project.id, ['project_head']);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={project.code} title="Transmittals" description="Numbered packages of issued revisions, with the date they were sent." />
      {(rows ?? []).length === 0 ? <EmptyState title="No transmittals yet" description="A transmittal is created when a revision is issued." /> : (
        <Table caption="Transmittals">
          <thead><tr><th className={th} scope="col">Number</th><th className={th} scope="col">Sent to</th><th className={th} scope="col">Revisions</th><th className={th} scope="col">Sent</th><th className={th} scope="col"><span className="sr-only">Action</span></th></tr></thead>
          <tbody>
            {(rows ?? []).map((t) => (
              <tr key={t.id}>
                <td className={`${td} font-mono text-xs`}>{t.number}</td>
                <td className={td}>{t.recipient_text ?? '—'}</td>
                <td className={td}>{(t.transmittal_items ?? []).length}</td>
                <td className={td}>{t.sent_at ? <Badge tone="success">{formatIst(t.sent_at)}</Badge> : <Badge tone="warning">Not sent</Badge>}</td>
                <td className={td}>
                  {!t.sent_at && canMark && (
                    <ActionForm action={markTransmittalSent} submitLabel="Mark as sent" variant="secondary" className="flex flex-col gap-2">
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="projectCode" value={code} />
                    </ActionForm>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
