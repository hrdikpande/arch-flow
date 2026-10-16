import { notFound } from 'next/navigation';
import { requireInternal } from '@/lib/access';
import { adminDb } from '@/lib/supabase/admin';
import { firmSetting } from '@/lib/settings';
import { saveSettings, addHoliday, removeHoliday } from '@/app/actions/admin';
import { ActionForm } from '@/components/ActionForm';
import { Card, FormField, PageHeader, Table, td, th, inputClass, LinkButton } from '@/components/ds';
import { formatDateOnly } from '@/lib/format';

export default async function AdminSettingsPage() {
  const access = await requireInternal();
  if (!access.isAdmin) notFound();
  const db = adminDb();
  const [sla, cap, digestTime, escalation, weekend, filePattern, transmittalPattern, { data: holidays }] = await Promise.all([
    Promise.all([
      firmSetting<number>('sla.internal_review_days', 3),
      firmSetting<number>('sla.client_review_days', 5),
      firmSetting<number>('sla.rfi_response_days', 7),
      firmSetting<number>('sla.submittal_approval_days', 10),
      firmSetting<number>('sla.conflict_reply_days', 3),
    ]),
    firmSetting<number>('whatsapp.daily_cap', 30),
    firmSetting<string>('digest.time_local', '09:00'),
    firmSetting<number>('approval.escalation_days', 2),
    firmSetting<number[]>('calendar.weekend_days', [0, 6]),
    firmSetting<string>('naming.file_pattern', '{PROJECT}_{DISCIPLINE}_{SHEET}_{REV}'),
    firmSetting<string>('naming.transmittal_pattern', '{PROJECT}-TR-{YYYYMM}-{NNN}'),
    db.from('holidays').select('day, name').order('day'),
  ]);
  const [internal, client, rfi, submittal, conflict] = sla;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow="Owner" title="Settings" description="Firm defaults. A project can override its service levels from the project page." />
      <Card>
        <h2 className="mb-4 text-lg font-semibold">Service levels and alerts</h2>
        <ActionForm action={saveSettings} submitLabel="Save settings">
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Internal review (working days)" htmlFor="internal"><input id="internal" name="internal" type="number" min={1} max={200} defaultValue={internal} className={inputClass} /></FormField>
            <FormField label="Client review (working days)" htmlFor="client"><input id="client" name="client" type="number" min={1} max={200} defaultValue={client} className={inputClass} /></FormField>
            <FormField label="RFI response (working days)" htmlFor="rfi"><input id="rfi" name="rfi" type="number" min={1} max={200} defaultValue={rfi} className={inputClass} /></FormField>
            <FormField label="Submittal approval (working days)" htmlFor="submittal"><input id="submittal" name="submittal" type="number" min={1} max={200} defaultValue={submittal} className={inputClass} /></FormField>
            <FormField label="Conflict reply (working days)" htmlFor="conflict"><input id="conflict" name="conflict" type="number" min={1} max={200} defaultValue={conflict} className={inputClass} /></FormField>
            <FormField label="Approval escalates to owner after (working days)" htmlFor="escalation"><input id="escalation" name="escalation" type="number" min={1} max={200} defaultValue={escalation} className={inputClass} /></FormField>
            <FormField label="Daily WhatsApp cap per person" htmlFor="cap"><input id="cap" name="cap" type="number" min={1} max={200} defaultValue={cap} className={inputClass} /></FormField>
            <FormField label="Morning digest time (IST)" htmlFor="digestTime" hint="24-hour format, for example 09:00."><input id="digestTime" name="digestTime" pattern="([01]\d|2[0-3]):[0-5]\d" defaultValue={digestTime.replace(/"/g, '')} className={inputClass} /></FormField>
            <FormField label="Weekend days" htmlFor="weekend" hint="0 = Sunday ... 6 = Saturday. Placeholder until the firm confirms (O-A1)."><input id="weekend" name="weekend" defaultValue={weekend.join(',')} className={inputClass} /></FormField>
            <FormField label="File name pattern" htmlFor="filePattern" hint="Tokens: PROJECT, DISCIPLINE, SHEET, REV."><input id="filePattern" name="filePattern" defaultValue={filePattern.replace(/"/g, '')} className={inputClass} /></FormField>
            <FormField label="Transmittal pattern" htmlFor="transmittalPattern" hint="Tokens: PROJECT, YYYYMM, NNN."><input id="transmittalPattern" name="transmittalPattern" defaultValue={transmittalPattern.replace(/"/g, '')} className={inputClass} /></FormField>
          </div>
        </ActionForm>
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-semibold">Holidays</h2>
        <p className="mb-4 text-sm text-text-secondary">Working-day deadlines skip these dates. The list is not confirmed yet (O-A1): add the firm&apos;s real holidays before go-live.</p>
        {(holidays ?? []).length > 0 && (
          <Table caption="Holidays">
            <thead><tr><th className={th} scope="col">Date</th><th className={th} scope="col">Name</th><th className={th} scope="col"><span className="sr-only">Remove</span></th></tr></thead>
            <tbody>
              {(holidays ?? []).map((h) => (
                <tr key={h.day}>
                  <td className={td}>{formatDateOnly(h.day)}</td>
                  <td className={td}>{h.name}</td>
                  <td className={td}>
                    <form action={removeHoliday}>
                      <input type="hidden" name="day" value={h.day} />
                      <button type="submit" className="min-h-10 rounded-sm px-3 text-sm font-semibold text-error hover:bg-error-bg">Remove</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <div className="mt-6">
          <ActionForm action={addHoliday} submitLabel="Add holiday" variant="secondary">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Date" htmlFor="day" required><input id="day" name="day" type="date" required className={inputClass} /></FormField>
              <FormField label="Name" htmlFor="holidayName" required><input id="holidayName" name="name" required className={inputClass} /></FormField>
            </div>
          </ActionForm>
        </div>
      </Card>

      <div className="flex flex-wrap gap-3">
        <LinkButton href="/admin/users" variant="secondary">Users and clients</LinkButton>
        <LinkButton href="/admin/whatsapp" variant="secondary">WhatsApp</LinkButton>
        <LinkButton href="/admin/rules" variant="secondary">Critical rules</LinkButton>
      </div>
    </div>
  );
}
