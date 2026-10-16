import { notFound } from 'next/navigation';
import { requireInternal, projectByCode, canSee } from '@/lib/access';
import { adminDb } from '@/lib/supabase/admin';
import { confirmImport } from '@/app/actions/import';
import { ActionForm } from '@/components/ActionForm';
import { Alert, Badge, Card, PageHeader, Table, td, th, LinkButton } from '@/components/ds';

type RowError = { rowNumber: number; column?: string; message: string };

export default async function ImportReviewPage({ params }: { params: Promise<{ code: string; id: string }> }) {
  const access = await requireInternal();
  const { code, id } = await params;
  const project = await projectByCode(code);
  if (!project || !canSee(access, project.id)) notFound();
  const { data: record } = await adminDb().from('register_imports').select('id, project_id, status, rows_total, rows_ok, rows_failed, errors, created_at').eq('id', id).eq('project_id', project.id).maybeSingle();
  if (!record) notFound();
  const errors = (record.errors ?? []) as RowError[];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={project.code} title="Review import" description="Check the counts and any row errors. Fix the file and upload again if needed." />
      <Card>
        <dl className="grid grid-cols-3 gap-4 text-center">
          <div><dt className="text-xs font-semibold text-text-muted">Rows in file</dt><dd className="text-2xl font-semibold tabular-nums">{record.rows_total}</dd></div>
          <div><dt className="text-xs font-semibold text-text-muted">Ready</dt><dd className="text-2xl font-semibold tabular-nums">{record.rows_ok}</dd></div>
          <div><dt className="text-xs font-semibold text-text-muted">With errors</dt><dd className="text-2xl font-semibold tabular-nums">{record.rows_failed}</dd></div>
        </dl>
        <p className="mt-4 text-sm"><Badge tone={record.status === 'ready' ? 'success' : record.status === 'confirmed' ? 'brand' : 'error'}>Status: {record.status}</Badge></p>
      </Card>

      {errors.length > 0 && (
        <section aria-label="Row errors" className="flex flex-col gap-3">
          <Alert tone="error">{record.status === 'ready' ? 'Some rows were skipped.' : 'The file cannot be imported until these errors are fixed.'}</Alert>
          <Table caption="Import errors by row">
            <thead><tr><th className={th} scope="col">Row</th><th className={th} scope="col">Column</th><th className={th} scope="col">Problem</th></tr></thead>
            <tbody>
              {errors.slice(0, 200).map((e, i) => (
                <tr key={`${e.rowNumber}-${i}`}><td className={td}>{e.rowNumber}</td><td className={td}>{e.column ?? '—'}</td><td className={td}>{e.message}</td></tr>
              ))}
            </tbody>
          </Table>
        </section>
      )}

      {record.status === 'ready' && (
        <Card>
          <p className="mb-4 text-sm text-text-secondary">Confirming writes the {record.rows_ok} ready sheets to the register. Rows with errors are not written.</p>
          <ActionForm action={confirmImport} submitLabel={`Add ${record.rows_ok} sheets to the register`} pendingLabel="Writing…">
            <input type="hidden" name="importId" value={record.id} />
          </ActionForm>
        </Card>
      )}
      {record.status === 'confirmed' && <LinkButton href={`/projects/${code}/register`}>Open the register</LinkButton>}
    </div>
  );
}
