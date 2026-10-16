import { requireClient } from '@/lib/access';
import { adminDb } from '@/lib/supabase/admin';
import { raiseConflict } from '@/app/actions/conflicts';
import { ActionForm } from '@/components/ActionForm';
import { Card, FormField, PageHeader, inputClass, textareaClass } from '@/components/ds';

export default async function NewConflictPage() {
  const access = await requireClient();
  const { data: projects } = await adminDb().from('projects').select('code, name').eq('client_org_id', access.clientOrgId ?? '').order('code');
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Raise a conflict" description="Tell the firm what is wrong with a drawing you have been sent: for example, a newer drawing is needed, or a change does not match. The firm replies in the thread." />
      <Card>
        <ActionForm action={raiseConflict} submitLabel="Send to the firm">
          <FormField label="Project" htmlFor="projectCode" required>
            <select id="projectCode" name="projectCode" required className={inputClass} defaultValue="">
              <option value="" disabled>Choose a project</option>
              {(projects ?? []).map((p) => <option key={p.code} value={p.code}>{p.code} · {p.name}</option>)}
            </select>
          </FormField>
          <FormField label="Subject" htmlFor="subject" required hint="One line, up to 200 characters.">
            <input id="subject" name="subject" required maxLength={200} className={inputClass} />
          </FormField>
          <FormField label="Details" htmlFor="content" required hint="Up to 10,000 characters. Plain text.">
            <textarea id="content" name="content" required rows={6} maxLength={10000} className={textareaClass} />
          </FormField>
        </ActionForm>
      </Card>
    </div>
  );
}
