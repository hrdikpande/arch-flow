import { notFound } from 'next/navigation';
import { requireInternal } from '@/lib/access';
import { adminDb } from '@/lib/supabase/admin';
import { addAuthorityItem, removeAuthorityItem } from '@/app/actions/features';
import { ActionForm } from '@/components/ActionForm';
import { Button, Card, FormField, PageHeader, Table, td, th, inputClass } from '@/components/ds';

export default async function AuthorityTemplatePage() {
  const access = await requireInternal();
  if (!access.isAdmin) notFound();
  const { data: items } = await adminDb().from('authority_templates').select('id, authority, item, required').order('authority').order('item');
  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow="Owner" title="Authority template" description="The standard checklist loaded into each new project." />
      <Table caption="Template items">
        <thead><tr><th className={th} scope="col">Authority</th><th className={th} scope="col">Item</th><th className={th} scope="col">Required</th><th className={th} scope="col"><span className="sr-only">Remove</span></th></tr></thead>
        <tbody>
          {(items ?? []).map((i) => (
            <tr key={i.id}>
              <td className={td}>{i.authority}</td><td className={td}>{i.item}</td><td className={td}>{i.required ? 'Yes' : 'No'}</td>
              <td className={td}><form action={removeAuthorityItem}><input type="hidden" name="id" value={i.id} /><Button type="submit" variant="ghost">Remove</Button></form></td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Card>
        <h2 className="mb-4 text-lg font-semibold">Add an item</h2>
        <ActionForm action={addAuthorityItem} submitLabel="Add item" variant="secondary">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Authority" htmlFor="authority" required hint="For example Building sanction, Fire NOC, AERB."><input id="authority" name="authority" required className={inputClass} /></FormField>
            <FormField label="Item" htmlFor="item" required><input id="item" name="item" required className={inputClass} /></FormField>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="required" defaultChecked /> Required before approval</label>
        </ActionForm>
      </Card>
    </div>
  );
}
