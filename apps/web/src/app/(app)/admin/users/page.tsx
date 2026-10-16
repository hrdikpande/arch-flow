import { notFound } from 'next/navigation';
import { requireInternal } from '@/lib/access';
import { adminDb } from '@/lib/supabase/admin';
import { inviteUser, createClientOrg } from '@/app/actions/admin';
import { ActionForm } from '@/components/ActionForm';
import { Card, FormField, PageHeader, Table, td, th, inputClass } from '@/components/ds';

export default async function UsersPage() {
  const access = await requireInternal();
  if (!access.isAdmin) notFound();
  const db = adminDb();
  const [{ data: profiles }, { data: orgs }, { data: projects }] = await Promise.all([
    db.from('profiles').select('id, full_name, email, is_active, user_roles(role, projects(code))').order('full_name'),
    db.from('client_orgs').select('id, name').order('name'),
    db.from('projects').select('code').order('code'),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow="Owner" title="Users and clients" description="Accounts are created by the admin only. The invitee sets a password from the emailed link." />
      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-lg font-semibold">Invite a user</h2>
          <ActionForm action={inviteUser} submitLabel="Send invitation">
            <FormField label="Full name" htmlFor="fullName" required><input id="fullName" name="fullName" required className={inputClass} /></FormField>
            <FormField label="Email" htmlFor="email" required><input id="email" name="email" type="email" required className={inputClass} /></FormField>
            <FormField label="Role" htmlFor="role" required>
              <select id="role" name="role" required className={inputClass} defaultValue="drafter">
                <option value="project_head">Project head</option>
                <option value="discipline_lead">Discipline lead</option>
                <option value="drafter">Drafter</option>
                <option value="checker">Checker</option>
                <option value="client">Client</option>
                <option value="admin">Admin (firm-wide)</option>
              </select>
            </FormField>
            <FormField label="Project code" htmlFor="projectCode" hint="Not needed for admin. For clients, the project they can see.">
              <select id="projectCode" name="projectCode" className={inputClass} defaultValue="">
                <option value="">—</option>
                {(projects ?? []).map((p) => <option key={p.code} value={p.code}>{p.code}</option>)}
              </select>
            </FormField>
            <FormField label="Client organisation" htmlFor="clientOrgId" hint="Required for client users.">
              <select id="clientOrgId" name="clientOrgId" className={inputClass} defaultValue="">
                <option value="">—</option>
                {(orgs ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </FormField>
          </ActionForm>
        </Card>
        <Card>
          <h2 className="mb-4 text-lg font-semibold">Add a client organisation</h2>
          <ActionForm action={createClientOrg} submitLabel="Add client" variant="secondary">
            <FormField label="Organisation name" htmlFor="orgName" required><input id="orgName" name="name" required className={inputClass} /></FormField>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="ndaRequired" /> NDA required before first login</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="allowAps" defaultChecked /> Allow converting CAD files on Autodesk&apos;s cloud (confirm O3)</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="allowNative" defaultChecked /> Allow download of native CAD files for issued sheets (A-V1)</label>
          </ActionForm>
        </Card>
      </section>
      <Table caption="Users">
        <thead><tr><th className={th} scope="col">Name</th><th className={th} scope="col">Email</th><th className={th} scope="col">Roles</th><th className={th} scope="col">Active</th></tr></thead>
        <tbody>
          {(profiles ?? []).map((p) => (
            <tr key={p.id}>
              <td className={td}>{p.full_name}</td>
              <td className={td}>{p.email}</td>
              <td className={td}>{(p.user_roles as unknown as { role: string; projects: { code: string } | null }[]).map((r) => `${r.role}${r.projects ? ` (${r.projects.code})` : ''}`).join(', ') || '—'}</td>
              <td className={td}>{p.is_active ? 'Yes' : 'No'}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
