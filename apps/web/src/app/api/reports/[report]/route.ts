import { currentAccess, canSee, projectByCode } from '@/lib/access';
import { adminDb } from '@/lib/supabase/admin';
import { STATE_LABELS, type SheetState } from '@arch-flow/domain';
import { tablePdf, workbookBuffer, type Cell } from '@/lib/reports';
import { istToday, formatIst } from '@/lib/format';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const REPORTS = ['register', 'issues', 'transmittals', 'changes', 'dashboard'] as const;
type Report = (typeof REPORTS)[number];

function download(body: Buffer | Uint8Array, contentType: string, name: string): Response {
  return new Response(new Uint8Array(body), { headers: { 'content-type': contentType, 'content-disposition': `attachment; filename="${name}"` } });
}

/** PDF and Excel reports (REP-01 to REP-04, CHG-03). Internal users only; the admin for the dashboard. */
export async function GET(request: Request, { params }: { params: Promise<{ report: string }> }) {
  const access = await currentAccess();
  if (!access || access.isClient) return Response.json({ error: 'sign in as an internal user' }, { status: 401 });
  const { report } = await params;
  if (!(REPORTS as readonly string[]).includes(report)) return Response.json({ error: 'unknown report' }, { status: 404 });
  const url = new URL(request.url);
  const format = url.searchParams.get('format') === 'pdf' ? 'pdf' : 'xlsx';
  const today = istToday();
  const stamp = `${today} ${formatIst(new Date()).replace(' IST', '')} IST`;
  const db = adminDb();

  if (report === 'dashboard') {
    if (!access.isAdmin) return Response.json({ error: 'owner only' }, { status: 403 });
    const now = new Date().toISOString();
    const counts: [string, number][] = [];
    const count = async (label: string, query: PromiseLike<{ count: number | null }>) => counts.push([label, (await query).count ?? 0]);
    await count('Overdue sheets', db.from('sheets').select('id', { count: 'exact', head: true }).lt('due_date', today).not('status', 'in', '(issued,gfc,ifc,superseded)'));
    await count('Overdue RFIs', db.from('rfis').select('id', { count: 'exact', head: true }).eq('status', 'open').lt('due_date', today));
    await count('Open critical clashes', db.from('clashes').select('id', { count: 'exact', head: true }).eq('status', 'open').eq('priority', 'critical'));
    await count('Approvals pending', db.from('approvals').select('id', { count: 'exact', head: true }).eq('status', 'pending'));
    await count('Client conflicts overdue', db.from('conflicts').select('id', { count: 'exact', head: true }).in('status', ['open', 'awaiting_client']).lt('due_at', now));
    const rows = counts.map(([label, value]) => [label, String(value)]);
    const bytes = await tablePdf({ title: 'Owner dashboard snapshot', subtitle: `All projects · ${stamp}`, header: ['Measure', 'Value'], rows });
    return download(bytes, 'application/pdf', `dashboard-${today}.pdf`);
  }

  const code = (url.searchParams.get('project') ?? '').trim().toUpperCase();
  const project = await projectByCode(code);
  if (!project || !canSee(access, project.id)) return Response.json({ error: 'project not found' }, { status: 404 });

  if (report === 'register') {
    const { data } = await db
      .from('sheets')
      .select('sheet_number, title, status, due_date, discipline_code, owner_id, profiles(full_name), revisions:current_revision_id(rev_code)')
      .eq('project_id', project.id)
      .order('sheet_number');
    const header = ['Sheet', 'Title', 'Discipline', 'Revision', 'State', 'Owner', 'Due'];
    const rows: Cell[][] = (data ?? []).map((s) => [
      s.sheet_number,
      s.title,
      s.discipline_code,
      (s.revisions as unknown as { rev_code: string } | null)?.rev_code ?? '',
      STATE_LABELS[s.status as SheetState],
      (s.profiles as unknown as { full_name: string } | null)?.full_name ?? '',
      s.due_date ?? '',
    ]);
    if (format === 'pdf') {
      return download(await tablePdf({ title: `Register · ${project.name}`, subtitle: `${project.code} · ${stamp}`, header, rows: rows.map((r) => r.map((c) => String(c ?? ''))) }), 'application/pdf', `register-${project.code}-${today}.pdf`);
    }
    return download(workbookBuffer([{ name: 'Register', rows: [header, ...rows] }]), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', `register-${project.code}-${today}.xlsx`);
  }

  if (report === 'issues') {
    const [clashes, rfis, submittals] = await Promise.all([
      db.from('clashes').select('number, title, priority, status, discipline_a, discipline_b, source_ref, created_at').eq('project_id', project.id),
      db.from('rfis').select('number, subject, priority, status, due_date, answered_at, created_at').eq('project_id', project.id),
      db.from('submittals').select('number, item, status, due_date, created_at').eq('project_id', project.id),
    ]);
    const sheets = [
      { name: 'Clashes', rows: [['Number', 'Title', 'Priority', 'Status', 'Discipline A', 'Discipline B', 'Source ref', 'Opened'], ...(clashes.data ?? []).map((c) => [c.number, c.title, c.priority, c.status, c.discipline_a, c.discipline_b, c.source_ref, c.created_at])] as Cell[][] },
      { name: 'RFIs', rows: [['Number', 'Subject', 'Priority', 'Status', 'Due', 'Answered'], ...(rfis.data ?? []).map((r) => [r.number, r.subject, r.priority, r.status, r.due_date, r.answered_at])] as Cell[][] },
      { name: 'Submittals', rows: [['Number', 'Item', 'Status', 'Due'], ...(submittals.data ?? []).map((s) => [s.number, s.item, s.status, s.due_date])] as Cell[][] },
    ];
    return download(workbookBuffer(sheets), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', `issues-${project.code}-${today}.xlsx`);
  }

  if (report === 'transmittals') {
    const { data } = await db.from('transmittals').select('number, recipient_text, sent_at, created_at, transmittal_items(revision_id)').eq('project_id', project.id).order('created_at');
    const rows: Cell[][] = [['Number', 'Sent to', 'Created', 'Sent', 'Revisions'], ...(data ?? []).map((t) => [t.number, t.recipient_text, t.created_at, t.sent_at ?? 'not sent', (t.transmittal_items ?? []).length])];
    return download(workbookBuffer([{ name: 'Transmittals', rows }]), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', `transmittals-${project.code}-${today}.xlsx`);
  }

  // changes (CHG-03): with totals of cost and time impact.
  const { data } = await db.from('change_requests').select('reason, status, cost_impact, time_impact_days, created_at, sheets:sheet_id(sheet_number)').eq('project_id', project.id).order('created_at');
  const list = data ?? [];
  const totalCost = list.reduce((sum, c) => sum + Number(c.cost_impact ?? 0), 0);
  const totalDays = list.reduce((sum, c) => sum + Number(c.time_impact_days ?? 0), 0);
  const rows: Cell[][] = [['Sheet', 'Reason', 'Status', 'Cost impact', 'Time impact (days)', 'Requested'], ...list.map((c) => [(c.sheets as unknown as { sheet_number: string } | null)?.sheet_number ?? '', c.reason, c.status, c.cost_impact, c.time_impact_days, c.created_at]), ['Total', '', '', totalCost, totalDays, '']];
  return download(workbookBuffer([{ name: 'Changes', rows }]), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', `changes-${project.code}-${today}.xlsx`);
}
