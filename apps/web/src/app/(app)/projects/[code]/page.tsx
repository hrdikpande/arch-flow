import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireInternal, projectByCode, canSee } from '@/lib/access';
import { adminDb } from '@/lib/supabase/admin';
import { PageHeader, Card, LinkButton } from '@/components/ds';

export default async function ProjectOverview({ params }: { params: Promise<{ code: string }> }) {
  const access = await requireInternal();
  const { code } = await params;
  const project = await projectByCode(code);
  if (!project || !canSee(access, project.id)) notFound();
  const db = adminDb();
  const [{ count: sheets }, { count: issued }, { count: openClashes }, { count: openRfis }] = await Promise.all([
    db.from('sheets').select('id', { count: 'exact', head: true }).eq('project_id', project.id),
    db.from('sheets').select('id', { count: 'exact', head: true }).eq('project_id', project.id).in('status', ['issued', 'gfc', 'ifc']),
    db.from('clashes').select('id', { count: 'exact', head: true }).eq('project_id', project.id).eq('status', 'open'),
    db.from('rfis').select('id', { count: 'exact', head: true }).eq('project_id', project.id).eq('status', 'open'),
  ]);
  const stats = [
    { label: 'Sheets', value: sheets ?? 0 },
    { label: 'Issued', value: issued ?? 0 },
    { label: 'Open clashes', value: openClashes ?? 0 },
    { label: 'Open RFIs', value: openRfis ?? 0 },
  ];
  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={project.code} title={project.name} actions={<><LinkButton href={`/projects/${code}/register`}>Register</LinkButton><LinkButton href={`/projects/${code}/issues`} variant="secondary">Issues</LinkButton><LinkButton href={`/projects/${code}/transmittals`} variant="secondary">Transmittals</LinkButton></>} />
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} padding="sm">
            <p className="text-xs font-semibold text-text-muted">{s.label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{s.value}</p>
          </Card>
        ))}
      </section>
      <Card>
        <h2 className="text-lg font-semibold">Next steps</h2>
        <ul className="mt-3 list-disc pl-5 text-sm text-text-secondary">
          <li>Load the existing register from the <Link className="underline" href={`/projects/${code}/register/import`}>import page</Link>.</li>
          <li>Add sheets, upload drawings, and move them through review and issue.</li>
        </ul>
      </Card>
    </div>
  );
}
