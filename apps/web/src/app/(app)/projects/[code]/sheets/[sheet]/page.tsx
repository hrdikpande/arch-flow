import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireInternal, projectByCode, canSee } from '@/lib/access';
import { adminDb } from '@/lib/supabase/admin';
import { transitionsFrom, STATE_LABELS, isLive, type SheetState, type Role } from '@arch-flow/domain';
import { loadSheet, revisionsOf, rolesFor } from '@/lib/workflow';
import { formatIst, formatDateOnly } from '@/lib/format';
import { moveSheet, issueSheet, requestChange } from '@/app/actions/sheets';
import { addReviewComment, resolveReviewComment } from '@/app/actions/features';
import { ActionForm } from '@/components/ActionForm';
import { FileUploadForm } from '@/components/FileUploadForm';
import { Badge, Card, FormField, PageHeader, Table, td, th, inputClass, textareaClass } from '@/components/ds';

export default async function SheetPage({ params }: { params: Promise<{ code: string; sheet: string }> }) {
  const access = await requireInternal();
  const { code, sheet: sheetParam } = await params;
  const project = await projectByCode(code);
  if (!project || !canSee(access, project.id)) notFound();
  const sheetNumber = decodeURIComponent(sheetParam);
  const sheet = await loadSheet(project.id, sheetNumber);
  if (!sheet) notFound();

  const roles = rolesFor(access, project.id) as Role[];
  const revisions = await revisionsOf(sheet.id);
  const wip = revisions.find((r) => r.status === 'wip');
  const db = adminDb();
  const [{ data: files }, { data: approvals }, { data: history }, { data: discipline }, { data: comments }, { data: changes }] = await Promise.all([
    db.from('files').select('id, original_name, size_bytes, state, uploaded_at, format, aps_status').eq('sheet_id', sheet.id).order('uploaded_at', { ascending: false }),
    db.from('approvals').select('id, transition, status, due_at, reason').eq('entity_id', sheet.id).order('created_at', { ascending: false }),
    db.from('status_history').select('from_state, to_state, note, created_at').eq('entity_id', sheet.id).order('created_at', { ascending: false }).limit(20),
    db.from('disciplines').select('name').eq('code', sheet.discipline_code).maybeSingle(),
    db.from('review_comments').select('id, body, status, resolution_note, created_at, revision_id, profiles:author_id(full_name)').in('revision_id', revisions.map((r) => r.id)).order('created_at', { ascending: false }),
    db.from('change_requests').select('id, reason, status, cost_impact, time_impact_days, created_at').eq('sheet_id', sheet.id).order('created_at', { ascending: false }),
  ]);
  const options = transitionsFrom(sheet.status, roles.length ? roles : ['drafter']);
  const live = isLive(sheet.status);
  const canIssue = access.isAdmin || roles.some((r) => r === 'project_head' || r === 'checker');
  const canUpload = access.isAdmin || roles.some((r) => ['project_head', 'discipline_lead', 'drafter'].includes(r));
  const canReview = access.isAdmin || roles.some((r) => ['project_head', 'discipline_lead', 'drafter', 'checker'].includes(r));
  const base = `/projects/${code}`;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={`${project.code} · ${discipline?.name ?? sheet.discipline_code}`}
        title={`${sheet.sheet_number} ${sheet.title}`}
        description={`Current state: ${STATE_LABELS[sheet.status as SheetState]}. Work revision: ${wip?.rev_code ?? 'none'}.`}
        actions={<Link href={`${base}/register`} className="text-sm font-semibold text-brand-700 underline">Back to register</Link>}
      />

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <h2 className="mb-4 text-lg font-semibold">Revisions</h2>
            <Table caption="Revisions of this sheet">
              <thead><tr><th className={th} scope="col">Revision</th><th className={th} scope="col">Status</th><th className={th} scope="col">Issued</th></tr></thead>
              <tbody>
                {revisions.map((r) => (
                  <tr key={r.id}>
                    <td className={`${td} font-medium tabular-nums`}>{r.rev_code}</td>
                    <td className={td}><Badge tone={r.status === 'issued' ? 'success' : r.status === 'superseded' ? 'neutral' : 'info'}>{r.status}{r.purpose ? ` (${r.purpose})` : ''}</Badge></td>
                    <td className={td}>{r.status === 'wip' ? '—' : 'Issued revision, unchanged'}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>

          <Card>
            <h2 className="mb-4 text-lg font-semibold">Files</h2>
            {canUpload && wip && <div className="mb-6"><FileUploadForm projectCode={code} sheetNumber={sheet.sheet_number} /></div>}
            {!wip && <p className="mb-4 text-sm text-text-secondary">Create a work revision before uploading files.</p>}
            {(files ?? []).length === 0 ? <p className="text-sm text-text-secondary">No files yet.</p> : (
              <ul className="divide-y divide-border">
                {(files ?? []).map((f) => (
                  <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                    <span className="font-medium">{f.original_name}</span>
                    <span className="flex flex-wrap items-center gap-3 text-text-muted">
                      {f.format.toUpperCase()} · {(f.size_bytes / 1024 / 1024).toFixed(1)} MB · {formatIst(f.uploaded_at)}
                      {f.format !== 'other' && <Link className="font-semibold text-brand-700 underline" href={`${base}/sheets/${encodeURIComponent(sheet.sheet_number)}/files/${f.id}`}>View</Link>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="mb-4 text-lg font-semibold">Review comments</h2>
            {(comments ?? []).length === 0 ? <p className="text-sm text-text-secondary">No comments on this sheet.</p> : (
              <ul className="flex flex-col gap-3">
                {(comments ?? []).map((c) => (
                  <li key={c.id} className="rounded-sm border border-border p-3 text-sm">
                    <p className="text-xs text-text-muted">{(c.profiles as unknown as { full_name: string } | null)?.full_name} · {formatIst(c.created_at)} · <Badge tone={c.status === 'open' ? 'warning' : 'success'}>{c.status}</Badge></p>
                    <p className="mt-1">{c.body}</p>
                    {c.resolution_note && <p className="mt-1 text-text-secondary">Resolved: {c.resolution_note}</p>}
                    {c.status === 'open' && canReview && (
                      <div className="mt-3">
                        <ActionForm action={resolveReviewComment} submitLabel="Resolve" variant="secondary">
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="projectCode" value={code} />
                          <input type="hidden" name="sheetNumber" value={sheet.sheet_number} />
                          <FormField label="How was it resolved?" htmlFor={`note-${c.id}`} required>
                            <input id={`note-${c.id}`} name="note" required className={inputClass} />
                          </FormField>
                        </ActionForm>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {canReview && wip && (
              <div className="mt-6">
                <ActionForm action={addReviewComment} submitLabel="Add comment" variant="secondary">
                  <input type="hidden" name="projectCode" value={code} />
                  <input type="hidden" name="sheetNumber" value={sheet.sheet_number} />
                  <FormField label="Comment on the work revision" htmlFor="body" required>
                    <textarea id="body" name="body" required rows={3} className={textareaClass} />
                  </FormField>
                </ActionForm>
              </div>
            )}
          </Card>

          <Card>
            <h2 className="mb-4 text-lg font-semibold">Changes</h2>
            {(changes ?? []).length === 0 ? <p className="text-sm text-text-secondary">No changes logged for this sheet.</p> : (
              <Table caption="Changes logged for this sheet">
                <thead><tr><th className={th} scope="col">Reason</th><th className={th} scope="col">Cost</th><th className={th} scope="col">Days</th><th className={th} scope="col">Status</th></tr></thead>
                <tbody>
                  {(changes ?? []).map((c) => (
                    <tr key={c.id}><td className={td}>{c.reason}</td><td className={td}>{c.cost_impact ?? '—'}</td><td className={td}>{c.time_impact_days ?? '—'}</td><td className={td}>{c.status}</td></tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          <Card>
            <h2 className="mb-4 text-lg font-semibold">Approvals and history</h2>
            {(approvals ?? []).length > 0 && (
              <ul className="mb-4 flex flex-col gap-2 text-sm">
                {(approvals ?? []).map((a) => (
                  <li key={a.id}><Badge tone={a.status === 'approved' ? 'success' : a.status === 'rejected' ? 'error' : 'warning'}>{a.status}</Badge> {a.transition} · due {formatDateOnly(String(a.due_at).slice(0, 10))}{a.reason ? ` · ${a.reason}` : ''}</li>
                ))}
              </ul>
            )}
            <ol className="flex flex-col gap-2 text-sm text-text-secondary">
              {(history ?? []).map((h, i) => <li key={i}>{formatIst(h.created_at)}: {h.from_state ?? 'new'} → {h.to_state}{h.note ? ` (${h.note})` : ''}</li>)}
            </ol>
          </Card>
        </div>

        <aside className="flex flex-col gap-6">
          {live ? (
            <Card>
              <h2 className="mb-2 text-lg font-semibold">Request a change</h2>
              <p className="mb-4 text-sm text-text-secondary">This sheet is issued. A project head must approve any change before a new work revision is opened.</p>
              <ActionForm action={requestChange} submitLabel="Send for approval">
                <input type="hidden" name="projectCode" value={code} />
                <input type="hidden" name="sheetNumber" value={sheet.sheet_number} />
                <FormField label="What needs to change, and why" htmlFor="reason" required>
                  <textarea id="reason" name="reason" required rows={4} className={textareaClass} />
                </FormField>
                <FormField label="Cost impact (optional)" htmlFor="costImpact"><input id="costImpact" name="costImpact" type="number" min={0} step="0.01" className={inputClass} /></FormField>
                <FormField label="Time impact in working days (optional)" htmlFor="timeImpactDays"><input id="timeImpactDays" name="timeImpactDays" type="number" min={0} step={1} className={inputClass} /></FormField>
              </ActionForm>
            </Card>
          ) : (
            <Card>
              <h2 className="mb-2 text-lg font-semibold">Move the sheet</h2>
              {options.length === 0 ? (
                <p className="text-sm text-text-secondary">No moves are available to your role from {STATE_LABELS[sheet.status as SheetState]}.</p>
              ) : (
                <ActionForm action={moveSheet} submitLabel="Move sheet">
                  <input type="hidden" name="projectCode" value={code} />
                  <input type="hidden" name="sheetNumber" value={sheet.sheet_number} />
                  <FormField label="Move to" htmlFor="to" required>
                    <select id="to" name="to" required className={inputClass} defaultValue={options[0]?.to}>
                      {options.map((o) => <option key={`${o.from}-${o.to}`} value={o.to}>{o.name} → {STATE_LABELS[o.to]}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Reason (needed when returning to the drafter)" htmlFor="reason">
                    <textarea id="reason" name="reason" rows={3} className={textareaClass} />
                  </FormField>
                </ActionForm>
              )}
            </Card>
          )}

          {sheet.status === 'approved' && canIssue && (
            <Card>
              <h2 className="mb-2 text-lg font-semibold">Issue</h2>
              <p className="mb-4 text-sm text-text-secondary">Issuing supersedes the previous issued revision and creates a transmittal for this revision.</p>
              <ActionForm action={issueSheet} submitLabel="Issue revision">
                <input type="hidden" name="projectCode" value={code} />
                <input type="hidden" name="sheetNumber" value={sheet.sheet_number} />
                <FormField label="Issue type" htmlFor="purpose" required>
                  <select id="purpose" name="purpose" required className={inputClass} defaultValue="issued">
                    <option value="issued">Issued</option>
                    <option value="ifc">Issued for construction (IFC)</option>
                    <option value="gfc">Good for construction (GFC)</option>
                  </select>
                </FormField>
                <FormField label="Sent to" htmlFor="recipient" required hint="Client, contractor or consultant name.">
                  <input id="recipient" name="recipient" required className={inputClass} />
                </FormField>
              </ActionForm>
            </Card>
          )}

          <Card padding="sm">
            <p className="text-xs text-text-muted">Sheet owner</p>
            <p className="text-sm font-medium">{sheet.owner_id ? 'Assigned' : 'Not assigned yet'}</p>
            <p className="mt-2 text-xs text-text-muted">Due</p>
            <p className="text-sm font-medium">{formatDateOnly(sheet.due_date)}</p>
          </Card>
        </aside>
      </section>
    </div>
  );
}
