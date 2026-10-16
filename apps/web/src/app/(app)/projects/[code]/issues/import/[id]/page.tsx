import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireInternal, projectByCode, canSee, hasProjectRole } from '@/lib/access';
import { adminDb } from '@/lib/supabase/admin';
import { confirmClashImport } from '@/app/actions/clash-import';
import { ActionForm } from '@/components/ActionForm';
import { Alert, Badge, Card, PageHeader, Table, td, th } from '@/components/ds';
import type { ImportedClash } from '@arch-flow/domain';

export default async function ClashImportReview({ params }: { params: Promise<{ code: string; id: string }> }) {
  const access = await requireInternal();
  const { code, id } = await params;
  const project = await projectByCode(code);
  if (!project || !canSee(access, project.id)) notFound();
  if (!hasProjectRole(access, project.id, ['project_head', 'discipline_lead'])) notFound();
  const db = adminDb();
  const { data: record } = await db.from('register_imports').select('id, status, rows_total, rows_ok, rows_failed, errors, project_id').eq('id', id).eq('project_id', project.id).maybeSingle();
  if (!record) notFound();

  let rows: ImportedClash[] = [];
  if (record.status === 'ready') {
    const { data: blob } = await db.storage.from('imports').download(`${project.id}/clash-${record.id}.json`);
    if (blob) rows = JSON.parse(await blob.text()) as ImportedClash[];
  }
  const errors = (record.errors ?? []) as { rowNumber: number; message: string }[];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={project.code}
        title="Review clash import"
        description={`${record.rows_total} rows read · ${record.rows_ok} ready · ${record.rows_failed} need attention`}
        actions={<Link href={`/projects/${code}/issues`} className="text-sm font-semibold text-brand-700 underline">Back to clashes</Link>}
      />
      {record.status === 'confirmed' && <Alert tone="success">This import has already been confirmed.</Alert>}
      {record.status === 'failed' && <Alert tone="error">Nothing can be imported from this file. Fix the errors below and upload it again.</Alert>}
      {errors.length > 0 && (
        <Card>
          <h2 className="mb-4 text-lg font-semibold">Rows that need attention</h2>
          <Table caption="Import errors">
            <thead><tr><th className={th} scope="col">Row</th><th className={th} scope="col">Problem</th></tr></thead>
            <tbody>{errors.map((e, i) => <tr key={i}><td className={td}>{e.rowNumber}</td><td className={td}>{e.message}</td></tr>)}</tbody>
          </Table>
        </Card>
      )}
      {rows.length > 0 && (
        <Card>
          <h2 className="mb-4 text-lg font-semibold">Clashes to create</h2>
          <Table caption="Clashes ready to import">
            <thead><tr><th className={th} scope="col">Number</th><th className={th} scope="col">Title</th><th className={th} scope="col">Disciplines</th><th className={th} scope="col">Sheets</th><th className={th} scope="col">Priority</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.number}>
                  <td className={`${td} font-medium`}>{r.number}</td>
                  <td className={td}>{r.title}</td>
                  <td className={td}>{[r.disciplineA, r.disciplineB].filter(Boolean).join(' vs ')}</td>
                  <td className={td}>{r.sheets.join(', ') || '—'}</td>
                  <td className={td}><Badge tone={r.priority === 'critical' ? 'error' : 'neutral'}>{r.priority}</Badge></td>
                </tr>
              ))}
            </tbody>
          </Table>
          <p className="mt-4 text-sm text-text-secondary">Critical priority is set by the owner's critical clash rules. Each critical clash notifies the project head.</p>
          {record.status === 'ready' && hasProjectRole(access, project.id, ['project_head', 'discipline_lead']) && (
            <div className="mt-6">
              <ActionForm action={confirmClashImport} submitLabel={`Import ${rows.length} clashes`}>
                <input type="hidden" name="importId" value={record.id} />
              </ActionForm>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
