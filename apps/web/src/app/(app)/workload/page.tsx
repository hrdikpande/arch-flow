import { notFound } from 'next/navigation';
import { requireInternal } from '@/lib/access';
import { adminDb } from '@/lib/supabase/admin';
import { setCapacity } from '@/app/actions/features';
import { ActionForm } from '@/components/ActionForm';
import { Badge, PageHeader, Table, td, th, inputClass } from '@/components/ds';
import { istToday } from '@/lib/format';

export default async function WorkloadPage() {
  const access = await requireInternal();
  if (!access.isAdmin) notFound();
  const db = adminDb();
  const today = istToday();
  const [{ data: people }, { data: sheets }, { data: capacity }] = await Promise.all([
    db.from('profiles').select('id, full_name').eq('is_active', true).order('full_name'),
    db.from('sheets').select('owner_id, status, due_date').not('owner_id', 'is', null).neq('status', 'issued'),
    db.from('user_capacity').select('user_id, sheets_per_week, hours_per_week'),
  ]);
  const capByUser = new Map((capacity ?? []).map((c) => [c.user_id as string, c] as const));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow="Owner" title="Workload" description="Open sheets per person against weekly capacity. Overdue counts are sheets past their due date." />
      <Table caption="Workload by person">
        <thead><tr><th className={th} scope="col">Person</th><th className={th} scope="col">Open sheets</th><th className={th} scope="col">Overdue</th><th className={th} scope="col">Capacity (sheets/week)</th><th className={th} scope="col">Load</th><th className={th} scope="col"><span className="sr-only">Save</span></th></tr></thead>
        <tbody>
          {(people ?? []).map((p) => {
            const mine = (sheets ?? []).filter((s) => s.owner_id === p.id);
            const overdue = mine.filter((s) => s.due_date && s.due_date < today).length;
            const cap = capByUser.get(p.id);
            const weeklyCap = cap?.sheets_per_week ?? 0;
            const ratio = weeklyCap > 0 ? Math.round((mine.length / weeklyCap) * 100) : null;
            return (
              <tr key={p.id}>
                <td className={`${td} font-medium`}>{p.full_name}</td>
                <td className={td}>{mine.length}</td>
                <td className={td}>{overdue > 0 ? <Badge tone="error">{overdue}</Badge> : '0'}</td>
                <td className={td}>{weeklyCap || 'Not set'}</td>
                <td className={td}>{ratio === null ? '—' : <Badge tone={ratio > 100 ? 'error' : ratio > 80 ? 'warning' : 'success'}>{ratio}%</Badge>}</td>
                <td className={td}>
                  <ActionForm action={setCapacity} submitLabel="Save" variant="secondary" className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="userId" value={p.id} />
                    <input name="sheets" type="number" min={0} step={1} defaultValue={cap?.sheets_per_week ?? 0} aria-label={`Sheets per week for ${p.full_name}`} className={`${inputClass} w-24`} />
                    <input name="hours" type="number" min={0} step={0.5} defaultValue={cap?.hours_per_week ?? 0} aria-label={`Hours per week for ${p.full_name}`} className={`${inputClass} w-24`} />
                  </ActionForm>
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}
