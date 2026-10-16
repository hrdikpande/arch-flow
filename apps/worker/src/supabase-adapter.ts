/**
 * Supabase adapter for the worker ports. Uses the service role, so every query
 * below scopes by project or recipient explicitly (ARCHITECTURE.md, 5.2).
 * Column names follow supabase/migrations/20261016000000_init.sql.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CalendarOptions, DigestInput, IssuedItem, istDateOf } from '@arch-flow/domain';
import type { DigestSource, DigestSourceRow } from './jobs/digest';
import type { ConflictCandidate, EscalationCandidate, SchedulePort } from './jobs/schedule';
import type { InboundPort } from './jobs/inbound';
import type { EventRow, FanoutPort, NewOutboxRow, OutboxPort, OutboxRow, Recipient } from './ports';

type Row = Record<string, any>;

export function createServiceClient(url: string, serviceKey: string): SupabaseClient {
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

function check<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result.data as T;
}

/** Scopes a query to the given projects. null = all projects (owner). */
function applyProjects(query: any, projects: string[] | null = null): any {
  if (projects === null) return query;
  if (projects.length === 0) return query.eq('project_id', '00000000-0000-0000-0000-000000000000');
  return query.in('project_id', projects);
}

export class SupabaseAdapter implements OutboxPort, FanoutPort, InboundPort, DigestSource, SchedulePort {
  constructor(private readonly db: SupabaseClient) {}

  // ---------- settings ----------

  async setting<T>(key: string, fallback: T): Promise<T> {
    const row = check(
      await this.db.from('settings').select('value').is('project_id', null).eq('key', key).maybeSingle(),
      `setting ${key}`,
    ) as Row | null;
    return row ? (row.value as T) : fallback;
  }

  async saveSetting(key: string, value: unknown): Promise<void> {
    check(
      await this.db.from('settings').upsert({ project_id: null, key, value }, { onConflict: 'project_id,key' }),
      `save setting ${key}`,
    );
  }

  async heartbeat(connected: boolean, version: string): Promise<void> {
    await this.saveSetting('worker.heartbeat', { at: new Date().toISOString(), connected, version });
  }

  // ---------- recipients ----------

  private mapRecipient(row: Row, isOwner: boolean): Recipient {
    return {
      id: row.id,
      name: row.profiles?.full_name ?? 'Recipient',
      phoneE164: row.phone_e164,
      optedIn: Boolean(row.opted_in && row.opt_in_confirmed_at && !row.opted_out_at && row.active),
      isOwner,
      profileId: row.profile_id ?? null,
    };
  }

  private async ownerProfileIds(): Promise<Set<string>> {
    const rows = check(
      await this.db.from('user_roles').select('user_id').eq('role', 'admin').is('project_id', null),
      'owners',
    ) as Row[];
    return new Set(rows.map((r) => r.user_id));
  }

  private async ownerIdList(): Promise<string[]> {
    return [...(await this.ownerProfileIds())];
  }

  async optedInRecipients(): Promise<Recipient[]> {
    const rows = check(
      await this.db
        .from('whatsapp_recipients')
        .select('id, phone_e164, opted_in, opt_in_confirmed_at, opted_out_at, active, profile_id, profiles(full_name)')
        .eq('active', true),
      'recipients',
    ) as Row[];
    const owners = await this.ownerProfileIds();
    return rows.map((row) => this.mapRecipient(row, owners.has(row.profile_id)));
  }

  async recipientByPhone(phoneE164: string): Promise<Recipient | null> {
    const row = check(
      await this.db
        .from('whatsapp_recipients')
        .select('id, phone_e164, opted_in, opt_in_confirmed_at, opted_out_at, active, profile_id, profiles(full_name)')
        .eq('phone_e164', phoneE164)
        .maybeSingle(),
      'recipient by phone',
    ) as Row | null;
    if (!row) return null;
    const owners = await this.ownerProfileIds();
    return this.mapRecipient(row, owners.has(row.profile_id));
  }

  async setOptedOut(recipientId: string, optedOut: boolean): Promise<void> {
    check(
      await this.db
        .from('whatsapp_recipients')
        .update({ opted_out_at: optedOut ? new Date().toISOString() : null })
        .eq('id', recipientId),
      'set opt-out',
    );
  }

  async optInConfirmed(recipientId: string): Promise<boolean> {
    const row = check(
      await this.db.from('whatsapp_recipients').select('opt_in_confirmed_at').eq('id', recipientId).maybeSingle(),
      'opt-in',
    ) as Row | null;
    return Boolean(row?.opt_in_confirmed_at);
  }

  // ---------- outbox ----------

  async dueMessages(now: Date, limit: number): Promise<OutboxRow[]> {
    const rows = check(
      await this.db
        .from('whatsapp_outbox')
        .select(
          'id, recipient_id, kind, event_id, body_preview, dedupe_key, status, attempts, next_attempt_at, whatsapp_recipients(phone_e164, opted_in, opt_in_confirmed_at, opted_out_at, active), events(type)',
        )
        .eq('status', 'queued')
        .lte('next_attempt_at', now.toISOString())
        .order('next_attempt_at', { ascending: true })
        .limit(limit),
      'due messages',
    ) as Row[];
    return rows.map((row) => {
      const r = row.whatsapp_recipients ?? {};
      return {
        id: row.id,
        recipientId: row.recipient_id,
        phoneE164: r.phone_e164,
        kind: row.kind,
        eventType: row.events?.type ?? null,
        eventId: row.event_id,
        body: row.body_preview ?? '',
        dedupeKey: row.dedupe_key,
        status: row.status,
        attempts: row.attempts,
        nextAttemptAt: new Date(row.next_attempt_at),
        recipientOptedIn: Boolean(r.opted_in && r.opt_in_confirmed_at && !r.opted_out_at && r.active),
      };
    });
  }

  async update(id: string, patch: Parameters<OutboxPort['update']>[1]): Promise<void> {
    const values: Row = {};
    if (patch.status !== undefined) values.status = patch.status;
    if (patch.attempts !== undefined) values.attempts = patch.attempts;
    if (patch.nextAttemptAt !== undefined) values.next_attempt_at = patch.nextAttemptAt.toISOString();
    if (patch.waMessageId !== undefined) values.wa_message_id = patch.waMessageId;
    if (patch.sentAt !== undefined) values.sent_at = patch.sentAt.toISOString();
    if (patch.lastError !== undefined) values.last_error = patch.lastError;
    if (patch.bodyPreview !== undefined) values.body_preview = patch.bodyPreview;
    check(await this.db.from('whatsapp_outbox').update(values).eq('id', id), 'update outbox');
  }

  async sentForRecipientSince(recipientId: string, since: Date): Promise<number> {
    const result = await this.db
      .from('whatsapp_outbox')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', recipientId)
      .eq('status', 'sent')
      .gte('sent_at', since.toISOString());
    check({ data: null, error: result.error }, 'count sent');
    return result.count ?? 0;
  }

  async sentTimesForRecipientSince(recipientId: string, since: Date): Promise<Date[]> {
    const rows = check(
      await this.db
        .from('whatsapp_outbox')
        .select('sent_at')
        .eq('recipient_id', recipientId)
        .eq('status', 'sent')
        .gte('sent_at', since.toISOString()),
      'sent times',
    ) as Row[];
    return rows.map((r) => new Date(r.sent_at));
  }

  async lastSentForEvent(recipientId: string, eventId: number): Promise<Date | undefined> {
    const row = check(
      await this.db
        .from('whatsapp_outbox')
        .select('sent_at')
        .eq('recipient_id', recipientId)
        .eq('status', 'sent')
        .eq('event_id', eventId)
        .order('sent_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      'last sent for event',
    ) as Row | null;
    return row?.sent_at ? new Date(row.sent_at) : undefined;
  }

  async enabledEventTypes(): Promise<ReadonlySet<string>> {
    const rows = check(
      await this.db.from('whatsapp_event_settings').select('event_type').eq('enabled', true),
      'enabled events',
    ) as Row[];
    return new Set(rows.map((r) => r.event_type));
  }

  async dailyCap(): Promise<number> {
    const value = await this.setting<number | string>('whatsapp.daily_cap', 30);
    const cap = Number(value);
    return Number.isFinite(cap) && cap > 0 ? cap : 30;
  }

  // ---------- fan-out ----------

  async cursor(): Promise<number> {
    return Number(await this.setting<number>('worker.event_cursor', 0));
  }

  async saveCursor(id: number): Promise<void> {
    await this.saveSetting('worker.event_cursor', id);
  }

  async eventsAfter(id: number, limit: number): Promise<EventRow[]> {
    const rows = check(
      await this.db
        .from('events')
        .select('id, type, project_id, payload, created_at')
        .gt('id', id)
        .order('id', { ascending: true })
        .limit(limit),
      'events',
    ) as Row[];
    return rows.map((r) => ({
      id: Number(r.id),
      type: r.type,
      projectId: r.project_id,
      payload: (r.payload ?? {}) as Record<string, unknown>,
      createdAt: new Date(r.created_at),
    }));
  }

  async enqueue(row: NewOutboxRow): Promise<boolean> {
    const { error, data } = await this.db
      .from('whatsapp_outbox')
      .insert({
        recipient_id: row.recipientId,
        kind: row.kind,
        event_id: row.eventId,
        template_code: row.kind,
        variables: {},
        body_preview: row.body,
        dedupe_key: row.dedupeKey,
        status: 'queued',
        next_attempt_at: row.nextAttemptAt.toISOString(),
      })
      .select('id')
      .maybeSingle();
    if (error) {
      if (error.message.includes('duplicate key')) return false;
      throw new Error(`enqueue: ${error.message}`);
    }
    return Boolean(data);
  }

  // ---------- inbound and commands ----------

  async logInbound(row: { fromPhone: string; recipientId: string | null; body: string; command: string | null; allowed: boolean }): Promise<void> {
    check(
      await this.db.from('whatsapp_inbound').insert({
        from_phone: row.fromPhone,
        recipient_id: row.recipientId,
        body: row.body.slice(0, 1000),
        command: row.command,
        is_allowed: row.allowed,
      }),
      'log inbound',
    );
  }

  async lastDigestRequest(recipientId: string): Promise<Date | undefined> {
    const row = check(
      await this.db
        .from('digests')
        .select('created_at')
        .eq('recipient_id', recipientId)
        .eq('trigger_type', 'on_demand')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      'last digest request',
    ) as Row | null;
    return row?.created_at ? new Date(row.created_at) : undefined;
  }

  async requestDigest(recipient: Recipient): Promise<void> {
    const date = istDateOf(new Date());
    const rows = await this.digestRows(recipient, date, new Date());
    await this.saveDigestRow({
      recipientId: recipient.id,
      date,
      trigger: 'on_demand',
      deterministicText: rows.text,
      aiText: null,
      aiValidated: false,
      aiRejectionReason: 'on-demand digest is deterministic',
      sentText: rows.text,
    });
    await this.enqueue({
      recipientId: recipient.id,
      kind: 'digest',
      eventId: null,
      body: rows.text,
      dedupeKey: `digest:on_demand:${recipient.id}:${Date.now()}`,
      nextAttemptAt: new Date(),
    });
  }

  async answer(command: 'today' | 'overdue' | 'critical', recipient: Recipient): Promise<string> {
    const date = istDateOf(new Date());
    const data = await this.digestData(recipient, date, new Date());
    if (command === 'today') {
      return `Today: ${data.uploads} uploads, ${data.issued.length} issued revisions, ${data.decisions} decisions. ${data.dueToday} items due today.`;
    }
    if (command === 'overdue') {
      const lines = data.overdueRows.slice(0, 10).map((r) => `- ${r}`);
      return [`Overdue: ${data.overdueSheets} sheets, ${data.overdueRfis} RFIs, ${data.overdueReviews} reviews.`, ...lines].join('\n');
    }
    return `Open critical: ${data.openCriticalClashes} clashes, ${data.openCriticalRfis} RFIs.`;
  }

  // ---------- digests ----------

  private async memberProjectIds(recipient: Recipient): Promise<string[] | null> {
    if (recipient.isOwner) return null; // owner sees every project
    const profile = check(
      await this.db.from('whatsapp_recipients').select('profile_id').eq('id', recipient.id).maybeSingle(),
      'recipient profile',
    ) as Row | null;
    if (!profile?.profile_id) return [];
    const rows = check(
      await this.db.from('user_roles').select('project_id').eq('user_id', profile.profile_id).not('project_id', 'is', null),
      'member projects',
    ) as Row[];
    return [...new Set(rows.map((r) => r.project_id as string))];
  }

  /** Gathers the figures for one recipient. Owner-only fields are set only for the owner. */
  async digestData(recipient: Recipient, date: string, now: Date) {
    const projects = await this.memberProjectIds(recipient);
    const since = new Date(now.getTime() - 24 * 60 * 60_000).toISOString();
    const inProjects = (q: any) => applyProjects(q, projects);

    const events = check(
      await inProjects(this.db.from('events').select('type, payload, created_at, project_id').gte('created_at', since)),
      'events in window',
    ) as Row[];
    const issued: IssuedItem[] = events
      .filter((e) => e.type === 'revision.issued')
      .map((e) => ({ project: e.payload?.projectCode ?? '?', sheet: e.payload?.sheet ?? '?', rev: e.payload?.rev ?? '?' }));
    const uploads = events.filter((e) => e.type === 'file.uploaded').length;
    const decisions = events.filter((e) =>
      ['approval.approved', 'approval.rejected', 'conflict.responded', 'transmittal.sent'].includes(e.type),
    ).length;

    const openStatuses = ['not_started', 'assigned', 'wip', 'internal_check', 'coordination', 'approved', 'client_review', 'commented', 'revised'];
    const overdueSheetRows = check(
      await inProjects(this.db.from('sheets').select('sheet_number, due_date, status, projects(code)').in('status', openStatuses).lt('due_date', date)),
      'overdue sheets',
    ) as Row[];
    const overdueReviewRows = overdueSheetRows.filter((s) => ['internal_check', 'client_review'].includes(s.status));
    const dueTodayCount = await this.countWhere(
      inProjects(this.db.from('sheets').select('id', { count: 'exact', head: true }).in('status', openStatuses).eq('due_date', date)),
    );
    const overdueRfiRows = check(
      await inProjects(this.db.from('rfis').select('number, due_date, projects(code)').eq('status', 'open').lt('due_date', date)),
      'overdue rfis',
    ) as Row[];
    const overdueSubmittals = await this.countWhere(
      inProjects(this.db.from('submittals').select('id', { count: 'exact', head: true }).in('status', ['submitted', 'under_review']).lt('due_date', date)),
    );
    const openCriticalClashes = await this.countWhere(
      inProjects(this.db.from('clashes').select('id', { count: 'exact', head: true }).eq('status', 'open').eq('priority', 'critical')),
    );
    const openCriticalRfis = await this.countWhere(
      inProjects(this.db.from('rfis').select('id', { count: 'exact', head: true }).eq('status', 'open').eq('priority', 'critical')),
    );
    const waiting = check(
      await applyProjects(this.db.from('approvals').select('id, entity_id, transition, assignee_id, status, project_id').eq('status', 'pending')),
      'approvals',
    ) as Row[];
    const sheetIds = waiting.map((a) => a.entity_id as string);
    const sheetNumbers = new Map<string, string>();
    if (sheetIds.length > 0) {
      const sheets = check(await this.db.from('sheets').select('id, sheet_number').in('id', sheetIds), 'approval sheets') as Row[];
      for (const s of sheets) sheetNumbers.set(s.id, s.sheet_number);
    }
    const mine = recipient.profileId ? waiting.filter((a) => a.assignee_id === recipient.profileId) : [];
    const overdueClientConflicts = recipient.isOwner
      ? await this.countWhere(
          this.db.from('conflicts').select('id', { count: 'exact', head: true }).in('status', ['open', 'awaiting_client']).lt('due_at', now.toISOString()),
        )
      : undefined;

    const overdueRows = [
      ...overdueSheetRows.map((s) => `${s.projects?.code ?? '?'} ${s.sheet_number} due ${s.due_date}`),
      ...overdueRfiRows.map((r) => `${r.projects?.code ?? '?'} RFI ${r.number} due ${r.due_date}`),
    ];

    return {
      uploads,
      issued,
      decisions,
      waitingOnYou: mine.length,
      yourItems: mine.slice(0, 20).map((a) => `${sheetNumbers.get(a.entity_id) ?? 'sheet'}: ${a.transition}`),
      overdueSheets: overdueSheetRows.length,
      overdueRfis: overdueRfiRows.length,
      overdueReviews: overdueReviewRows.length,
      overdueSubmittals,
      dueToday: dueTodayCount,
      openCriticalClashes,
      openCriticalRfis,
      overdueClientConflicts,
      overdueRows,
      changed: events.filter((e) => e.type !== 'approval.escalated').length,
    };
  }

  private async countWhere(query: PromiseLike<{ count: number | null; error: { message: string } | null }>): Promise<number> {
    const result = await query;
    check({ data: null, error: result.error }, 'count');
    return result.count ?? 0;
  }

  private async digestRows(recipient: Recipient, date: string, now: Date): Promise<{ text: string }> {
    const data = await this.digestData(recipient, date, now);
    return { text: `Morning digest, ${date}: ${data.uploads} uploads, ${data.overdueSheets} overdue sheets, ${data.openCriticalClashes} open critical clashes.` };
  }

  async gather(recipient: Recipient, date: string, now: Date) {
    const data = await this.digestData(recipient, date, now);
    const row: DigestSourceRow & { structured: unknown } = {
      uploads: data.uploads,
      decisions: data.decisions,
      issued: data.issued,
      waitingOnYou: data.waitingOnYou,
      overdueSheets: data.overdueSheets,
      overdueRfis: data.overdueRfis,
      overdueReviews: data.overdueReviews,
      overdueSubmittals: data.overdueSubmittals,
      dueToday: data.dueToday,
      openCriticalClashes: data.openCriticalClashes,
      openCriticalRfis: data.openCriticalRfis,
      overdueClientConflicts: data.overdueClientConflicts,
      yourItems: data.yourItems,
      capReached: false,
      structured: {
        date,
        overdue: data.overdueRows.slice(0, 20),
        changedLast24h: data.changed,
        issued: data.issued.slice(0, 20),
        openCritical: { clashes: data.openCriticalClashes, rfis: data.openCriticalRfis },
      },
    };
    return row;
  }

  async digestRecipients(istDate: string): Promise<Recipient[]> {
    const recipients = await this.optedInRecipients();
    const done = check(
      await this.db.from('digests').select('recipient_id').eq('digest_date', istDate).eq('trigger_type', 'scheduled'),
      'scheduled digests done',
    ) as Row[];
    const doneIds = new Set(done.map((d) => d.recipient_id));
    return recipients.filter((r) => !doneIds.has(r.id));
  }

  async saveDigest(row: Parameters<SchedulePort['saveDigest']>[0]): Promise<void> {
    await this.saveDigestRow(row);
  }

  private async saveDigestRow(row: {
    recipientId: string;
    date: string;
    trigger: 'scheduled' | 'on_demand';
    deterministicText: string;
    aiText: string | null;
    aiValidated: boolean;
    aiRejectionReason: string | null;
    sentText: string;
  }): Promise<void> {
    check(
      await this.db.from('digests').insert({
        recipient_id: row.recipientId,
        digest_date: row.date,
        trigger_type: row.trigger,
        deterministic_text: row.deterministicText,
        ai_text: row.aiText,
        ai_validated: row.aiValidated,
        ai_rejection_reason: row.aiRejectionReason,
        sent_text: row.sentText,
      }),
      'save digest',
    );
  }

  async digestTime(): Promise<string> {
    return String(await this.setting<string>('digest.time_local', '09:00')).replace(/"/g, '');
  }

  // ---------- escalations and overdue conflicts ----------

  async calendar(): Promise<CalendarOptions> {
    const rows = check(await this.db.from('holidays').select('day'), 'holidays') as Row[];
    const weekend = await this.setting<number[]>('calendar.weekend_days', [0, 6]);
    return { holidays: new Set(rows.map((r) => r.day as string)), weekendDays: weekend };
  }

  async escalationDays(): Promise<number> {
    return Number(await this.setting<number>('approval.escalation_days', 2));
  }

  async pendingApprovals(): Promise<EscalationCandidate[]> {
    const rows = check(
      await this.db
        .from('approvals')
        .select('id, project_id, entity_id, transition, assignee_id, created_at, requested_by, escalated_at, projects(code)')
        .eq('status', 'pending')
        .is('escalated_at', null),
      'pending approvals',
    ) as Row[];
    const ids = rows.map((r) => r.entity_id as string);
    const sheetRefs = new Map<string, { sheet: string; rev: string }>();
    if (ids.length > 0) {
      const sheets = check(
        await this.db.from('sheets').select('id, sheet_number, revisions:current_revision_id(rev_code)').in('id', ids),
        'sheets for approvals',
      ) as Row[];
      for (const s of sheets) sheetRefs.set(s.id, { sheet: s.sheet_number, rev: s.revisions?.rev_code ?? '' });
    }
    const names = await this.profileNames(rows.map((r) => r.assignee_id as string));
    const owners = await this.ownerIdList();
    return rows.map((r) => ({
      approvalId: r.id,
      projectId: r.project_id,
      projectCode: r.projects?.code ?? '?',
      sheet: sheetRefs.get(r.entity_id)?.sheet ?? 'sheet',
      rev: sheetRefs.get(r.entity_id)?.rev ?? '',
      assignee: names.get(r.assignee_id) ?? 'assignee',
      requestedOnDate: istDateOf(new Date(r.created_at)),
      ownerId: owners[0] ?? null,
    }));
  }

  private async profileNames(ids: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter(Boolean))];
    const map = new Map<string, string>();
    if (unique.length === 0) return map;
    const rows = check(await this.db.from('profiles').select('id, full_name').in('id', unique), 'profile names') as Row[];
    for (const r of rows) map.set(r.id, r.full_name);
    return map;
  }

  async markEscalated(approvalId: string, at: Date): Promise<void> {
    check(await this.db.from('approvals').update({ escalated_at: at.toISOString() }).eq('id', approvalId), 'mark escalated');
  }

  async overdueConflicts(now: Date): Promise<ConflictCandidate[]> {
    const rows = check(
      await this.db
        .from('conflicts')
        .select('id, project_id, created_at, raised_by, status, due_at, projects(code)')
        .in('status', ['open', 'awaiting_client'])
        .lt('due_at', now.toISOString()),
      'overdue conflicts',
    ) as Row[];
    const names = await this.profileNames(rows.map((r) => r.raised_by as string));
    return rows.map((r) => ({
      conflictId: r.id,
      projectId: r.project_id,
      projectCode: r.projects?.code ?? '?',
      clientUser: names.get(r.raised_by) ?? 'client',
      raisedOnDate: istDateOf(new Date(r.created_at)),
    }));
  }

  async overdueNoticeSentToday(conflictId: string, istDate: string): Promise<boolean> {
    const start = new Date(`${istDate}T00:00:00+05:30`).toISOString();
    const row = check(
      await this.db
        .from('events')
        .select('id')
        .eq('type', 'conflict.overdue')
        .eq('entity_id', conflictId)
        .gte('created_at', start)
        .limit(1)
        .maybeSingle(),
      'overdue notice today',
    ) as Row | null;
    return Boolean(row);
  }

  async recordEvent(event: Parameters<SchedulePort['recordEvent']>[0]): Promise<void> {
    check(
      await this.db.from('events').insert({
        type: event.type,
        project_id: event.projectId,
        entity_type: event.entityType,
        entity_id: event.entityId,
        payload: event.payload,
      }),
      'record event',
    );
  }

  async notifyUser(userId: string, title: string, body: string, link: string): Promise<void> {
    check(await this.db.from('notifications').insert({ user_id: userId, title, body, link }), 'notify user');
  }
}
