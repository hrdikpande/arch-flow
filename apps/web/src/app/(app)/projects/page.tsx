import Link from 'next/link';
import { requireInternal } from '@/lib/access';
import { adminDb } from '@/lib/supabase/admin';
import { visibleProjectIds } from '@/lib/scope';
import { createProject } from '@/app/actions/admin';
import { ActionForm } from '@/components/ActionForm';
import { Card, EmptyState, FormField, PageHeader, Table, td, th, inputClass, LinkButton } from '@/components/ds';

export default async function ProjectsPage() {
  const access = await requireInternal();
  const ids = visibleProjectIds(access);
  const db = adminDb();
  let query = db.from('projects').select('id, code, name, status, start_date, client_org_id, client_orgs(name)').order('code');
  if (ids !== null) query = query.in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
  const { data: projects } = await query;
  const { data: orgs } = access.isAdmin ? await db.from('client_orgs').select('id, name').order('name') : { data: [] };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow="Workspace" title="Projects" description="Each hospital project has its own register, issues, transmittals and conflicts." />
      {(projects ?? []).length === 0 ? (
        <EmptyState title="No projects yet" description={access.isAdmin ? 'Create the first project below.' : 'Ask the admin to add you to a project.'} />
      ) : (
        <Table caption="Projects">
          <thead>
            <tr><th className={th} scope="col">Code</th><th className={th} scope="col">Name</th><th className={th} scope="col">Client</th><th className={th} scope="col">Status</th><th className={th} scope="col"><span className="sr-only">Open</span></th></tr>
          </thead>
          <tbody>
            {(projects ?? []).map((p) => (
              <tr key={p.id}>
                <td className={td}><span className="font-mono text-xs">{p.code}</span></td>
                <td className={td}>{p.name}</td>
                <td className={td}>{(p.client_orgs as unknown as { name: string } | null)?.name ?? '—'}</td>
                <td className={td}>{p.status}</td>
                <td className={td}><Link className="font-medium text-brand-700 underline underline-offset-2" href={`/projects/${p.code}`}>Open</Link></td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {access.isAdmin && (
        <section className="grid gap-6 lg:grid-cols-2">
          <Card>
            <h2 className="mb-4 text-lg font-semibold">New project</h2>
            <ActionForm action={createProject} submitLabel="Create project">
              <FormField label="Project code" htmlFor="code" required hint="Capitals, digits and hyphens, for example NRH-BLR-01.">
                <input id="code" name="code" required className={inputClass} />
              </FormField>
              <FormField label="Project name" htmlFor="name" required>
                <input id="name" name="name" required className={inputClass} />
              </FormField>
              <FormField label="Client" htmlFor="clientOrgId">
                <select id="clientOrgId" name="clientOrgId" className={inputClass} defaultValue="">
                  <option value="">No client linked yet</option>
                  {(orgs ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </FormField>
            </ActionForm>
          </Card>
          <Card>
            <h2 className="text-lg font-semibold">Clients</h2>
            <p className="mt-1 text-sm text-text-secondary">Add a client organisation first, then link it to a project and invite its users from Users.</p>
            <div className="mt-4"><LinkButton href="/admin/users" variant="secondary">Manage clients and users</LinkButton></div>
          </Card>
        </section>
      )}
    </div>
  );
}
