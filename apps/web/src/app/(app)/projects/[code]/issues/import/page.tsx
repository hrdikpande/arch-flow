import { notFound } from 'next/navigation';
import { requireInternal, projectByCode, canSee, hasProjectRole } from '@/lib/access';
import { prepareClashImport } from '@/app/actions/clash-import';
import { ActionForm } from '@/components/ActionForm';
import { Card, FormField, PageHeader, inputClass } from '@/components/ds';

export default async function ClashImportPage({ params }: { params: Promise<{ code: string }> }) {
  const access = await requireInternal();
  const { code } = await params;
  const project = await projectByCode(code);
  if (!project || !canSee(access, project.id)) notFound();
  if (!hasProjectRole(access, project.id, ['project_head', 'discipline_lead'])) notFound();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={project.code}
        title="Import clashes"
        description="Upload the clash export from the coordination tool (CSV or XLSX). You review every row before anything is written."
      />
      <Card>
        <ActionForm action={prepareClashImport} submitLabel="Check file">
          <input type="hidden" name="projectCode" value={code} />
          <FormField label="Clash export file" htmlFor="file" required hint="CSV or XLSX, up to 10 MB. Required columns are listed on the next screen.">
            <input id="file" name="file" type="file" accept=".csv,.xlsx" required className={inputClass} />
          </FormField>
        </ActionForm>
      </Card>
    </div>
  );
}
