import { notFound } from 'next/navigation';
import { requireInternal, projectByCode, canSee } from '@/lib/access';
import { prepareImport } from '@/app/actions/import';
import { ActionForm } from '@/components/ActionForm';
import { Card, FormField, PageHeader, inputClass } from '@/components/ds';

export default async function ImportPage({ params }: { params: Promise<{ code: string }> }) {
  const access = await requireInternal();
  const { code } = await params;
  const project = await projectByCode(code);
  if (!project || !canSee(access, project.id)) notFound();
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={project.code}
        title="Import register"
        description="Fill in the downloadable template, then upload it. You review the result before anything is saved."
      />
      <Card>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-text-secondary">
          <li>Download the template from <a className="font-semibold text-brand-700 underline" href="/templates/drawing_register_template.xlsx">drawing_register_template.xlsx</a>.</li>
          <li>Fill one row per sheet. Use the dropdowns for discipline and status. Keep the project code exactly as shown.</li>
          <li>Upload the file. Errors are listed by row. Nothing is saved until you confirm.</li>
        </ol>
      </Card>
      <Card>
        <ActionForm action={prepareImport} submitLabel="Check file" pendingLabel="Checking…">
          <input type="hidden" name="projectCode" value={code} />
          <FormField label="Completed register (.xlsx or .csv)" htmlFor="file" required>
            <input id="file" name="file" type="file" accept=".xlsx,.csv" required className={inputClass} />
          </FormField>
        </ActionForm>
      </Card>
    </div>
  );
}
