import { notFound } from 'next/navigation';
import { requireInternal } from '@/lib/access';
import { adminDb } from '@/lib/supabase/admin';
import { addRecipient, confirmOptIn, setEventEnabled } from '@/app/actions/admin';
import { ActionForm } from '@/components/ActionForm';
import { Badge, Button, Card, FormField, PageHeader, Table, td, th, inputClass } from '@/components/ds';
import { ALERT_EVENT_TYPES_LIST, EVENT_LABELS } from '@/lib/alert-events';
import { formatIst } from '@/lib/format';
import { messagingStatus } from '@/lib/messaging';

export default async function WhatsAppPage() {
  const access = await requireInternal();
  if (!access.isAdmin) notFound();
  const db = adminDb();
  const [{ data: recipients }, { data: toggles }] = await Promise.all([
    db.from('whatsapp_recipients').select('id, phone_e164, opted_in, opt_in_confirmed_at, opted_out_at, active, profiles(full_name)').order('created_at'),
    db.from('whatsapp_event_settings').select('event_type, enabled'),
  ]);
  const status = messagingStatus();
  const enabled = new Set((toggles ?? []).filter((t) => t.enabled).map((t) => t.event_type));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow="Owner" title="WhatsApp" description="The owner and up to four internal people receive alerts on the test number. Clients never receive WhatsApp." />

      <Card>
        <h2 className="mb-2 text-lg font-semibold">WhatsApp Cloud API</h2>
        {status.whatsappCloud ? (
          <p className="text-sm"><Badge tone="success">Configured</Badge> <span className="text-text-secondary">Messages go through the Meta Cloud API. Inbound replies arrive at the webhook. Secrets are read from the server environment and never shown here.</span></p>
        ) : (
          <p className="text-sm"><Badge tone="warning">Not configured</Badge> <span className="text-text-secondary">Missing environment variables: {status.missing.join(', ')}.</span></p>
        )}
        <p className="mt-2 text-xs text-text-muted">Messages sent outside the 24-hour customer window use the approved template. Gemini digest text: {status.gemini ? 'configured' : 'not configured (deterministic text is used)'}.</p>
      </Card>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Recipients</h2>
        <Table caption="WhatsApp recipients">
          <thead><tr><th className={th} scope="col">Name</th><th className={th} scope="col">Number</th><th className={th} scope="col">Opt-in</th><th className={th} scope="col"><span className="sr-only">Action</span></th></tr></thead>
          <tbody>
            {(recipients ?? []).map((r) => {
              const confirmed = Boolean(r.opt_in_confirmed_at && r.opted_in && !r.opted_out_at);
              return (
                <tr key={r.id}>
                  <td className={td}>{(r.profiles as unknown as { full_name: string } | null)?.full_name}</td>
                  <td className={`${td} font-mono text-xs`}>{r.phone_e164}</td>
                  <td className={td}>{confirmed ? <Badge tone="success">Confirmed {formatIst(r.opt_in_confirmed_at)}</Badge> : r.opted_out_at ? <Badge tone="neutral">Opted out</Badge> : <Badge tone="warning">Not confirmed</Badge>}</td>
                  <td className={td}>
                    {!confirmed && (
                      <form action={confirmOptIn}>
                        <input type="hidden" name="id" value={r.id} />
                        <Button type="submit" variant="secondary">Record written opt-in</Button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        <Card>
          <h3 className="mb-4 text-base font-semibold">Add a recipient</h3>
          <ActionForm action={addRecipient} submitLabel="Add recipient" variant="secondary">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Their user email" htmlFor="email" required hint="They must already have an account."><input id="email" name="email" type="email" required className={inputClass} /></FormField>
              <FormField label="WhatsApp number" htmlFor="phone" required hint="International format, for example +919876543210."><input id="phone" name="phone" required className={inputClass} /></FormField>
            </div>
          </ActionForm>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Which events send a WhatsApp message</h2>
        <p className="text-sm text-text-secondary">Switch on the events you want. Every upload and every decision is on by default, as agreed. Daily cap: see Settings.</p>
        <Card>
          <ul className="grid gap-3 sm:grid-cols-2">
            {ALERT_EVENT_TYPES_LIST.map((type) => (
              <li key={type}>
                <form action={setEventEnabled} className="flex items-center justify-between gap-3 rounded-sm border border-border px-3 py-2">
                  <input type="hidden" name="eventType" value={type} />
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="enabled" defaultChecked={enabled.has(type)} className="size-4" />
                    {EVENT_LABELS[type] ?? type}
                  </label>
                  <Button type="submit" variant="ghost">Save</Button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </div>
  );
}
