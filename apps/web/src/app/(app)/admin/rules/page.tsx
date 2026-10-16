import { notFound } from 'next/navigation';
import { requireInternal } from '@/lib/access';
import { adminDb } from '@/lib/supabase/admin';
import { loadDraftRules, saveRule } from '@/app/actions/admin';
import { ActionForm } from '@/components/ActionForm';
import { Badge, Button, Card, EmptyState, FormField, PageHeader, textareaClass } from '@/components/ds';
import { RULE_FIELDS } from '@arch-flow/domain';

export default async function RulesPage() {
  const access = await requireInternal();
  if (!access.isAdmin) notFound();
  const { data: rules } = await adminDb().from('rules').select('id, kind, name, definition, active, version').order('kind').order('name');
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Owner"
        title="Critical rules"
        description="You define what counts as critical. Draft rules are a starting point to edit. Changes apply to new events only; past events keep the version they were checked against."
        actions={(rules ?? []).length === 0 ? <form action={loadDraftRules}><Button type="submit">Load draft rules</Button></form> : undefined}
      />
      {(rules ?? []).length === 0 ? (
        <EmptyState title="No rules yet" description="Load the draft rules, then edit them until they match your definition of critical." />
      ) : (
        (rules ?? []).map((r) => (
          <Card key={r.id}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold">{r.name}</h2>
              <Badge tone="brand">{r.kind}</Badge>
              <Badge tone={r.active ? 'success' : 'neutral'}>{r.active ? 'Active' : 'Off'}</Badge>
              <span className="text-xs text-text-muted">version {r.version}</span>
            </div>
            <ActionForm action={saveRule} submitLabel="Save as new version" variant="secondary">
              <input type="hidden" name="id" value={r.id} />
              <FormField label="Name" htmlFor={`name-${r.id}`} required><input id={`name-${r.id}`} name="name" defaultValue={r.name} required className="min-h-10 w-full rounded-sm border border-border-strong bg-surface px-3 text-sm" /></FormField>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={r.active} /> Active</label>
              <FormField label="Definition (JSON)" htmlFor={`def-${r.id}`} hint={`Fields for ${r.kind}: ${(RULE_FIELDS[r.kind as keyof typeof RULE_FIELDS] as readonly string[]).join(', ')}. Operators: eq, in, contains, includes, gt, lte.`}>
                <textarea id={`def-${r.id}`} name="definition" rows={5} defaultValue={JSON.stringify(r.definition, null, 2)} className={`${textareaClass} font-mono text-xs`} />
              </FormField>
            </ActionForm>
          </Card>
        ))
      )}
    </div>
  );
}
