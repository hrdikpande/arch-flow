/**
 * Scheduled jobs (ESC-01, ESC-02, DIG-01). Each job reads its candidates from the
 * database through ports, decides with the domain rules, and records the result
 * as an event so fan-out and the in-app bell see it the same way as any other event.
 */

import {
  addWorkingDays,
  CalendarOptions,
  isEscalationDue,
  istDateOf,
} from '@arch-flow/domain';
import { composeDigest, DigestSource } from './digest';
import type { Summariser } from '../gemini';
import type { Clock, NewOutboxRow, Recipient } from '../ports';

export interface EscalationCandidate {
  approvalId: string;
  projectId: string;
  projectCode: string;
  sheet: string;
  rev: string;
  assignee: string;
  requestedOnDate: string;
  ownerId: string | null;
}

export interface ConflictCandidate {
  conflictId: string;
  projectId: string;
  projectCode: string;
  clientUser: string;
  raisedOnDate: string;
}

export interface SchedulePort {
  calendar(): Promise<CalendarOptions>;
  escalationDays(): Promise<number>;
  pendingApprovals(): Promise<EscalationCandidate[]>;
  markEscalated(approvalId: string, at: Date): Promise<void>;
  overdueConflicts(now: Date): Promise<ConflictCandidate[]>;
  overdueNoticeSentToday(conflictId: string, istDate: string): Promise<boolean>;
  recordEvent(event: { type: string; projectId: string | null; entityType: string; entityId: string; payload: Record<string, unknown> }): Promise<void>;
  notifyUser(userId: string, title: string, body: string, link: string): Promise<void>;
  digestTime(): Promise<string>;
  digestRecipients(istDate: string): Promise<Recipient[]>;
  saveDigest(row: {
    recipientId: string;
    date: string;
    trigger: 'scheduled' | 'on_demand';
    deterministicText: string;
    aiText: string | null;
    aiValidated: boolean;
    aiRejectionReason: string | null;
    sentText: string;
  }): Promise<void>;
  enqueue(row: NewOutboxRow): Promise<boolean>;
}

export interface ScheduleDeps {
  store: SchedulePort;
  clock: Clock;
  appUrl: string;
  digestSource: DigestSource;
  summariser: Summariser | null;
}

/** ESC-01: approvals pending for the configured number of working days go to the owner once. */
export async function runEscalations(deps: ScheduleDeps): Promise<number> {
  const now = deps.clock.now();
  const today = istDateOf(now);
  const calendar = await deps.store.calendar();
  const days = await deps.store.escalationDays();
  let escalated = 0;
  for (const approval of await deps.store.pendingApprovals()) {
    if (!isEscalationDue(approval.requestedOnDate, today, days, calendar)) continue;
    await deps.store.markEscalated(approval.approvalId, now);
    await deps.store.recordEvent({
      type: 'approval.escalated',
      projectId: approval.projectId,
      entityType: 'approval',
      entityId: approval.approvalId,
      payload: {
        projectCode: approval.projectCode,
        sheet: approval.sheet,
        rev: approval.rev,
        assignee: approval.assignee,
        days,
        path: '/approvals',
      },
    });
    if (approval.ownerId) {
      await deps.store.notifyUser(
        approval.ownerId,
        'Approval overdue',
        `${approval.sheet} ${approval.rev} is waiting for ${approval.assignee}.`,
        '/approvals',
      );
    }
    escalated += 1;
  }
  return escalated;
}

/** ESC-02 (CFL-03): one overdue notice per conflict per IST day. */
export async function runConflictOverdue(deps: ScheduleDeps): Promise<number> {
  const now = deps.clock.now();
  const today = istDateOf(now);
  let notices = 0;
  for (const conflict of await deps.store.overdueConflicts(now)) {
    if (await deps.store.overdueNoticeSentToday(conflict.conflictId, today)) continue;
    await deps.store.recordEvent({
      type: 'conflict.overdue',
      projectId: conflict.projectId,
      entityType: 'conflict',
      entityId: conflict.conflictId,
      payload: { projectCode: conflict.projectCode, raisedOn: conflict.raisedOnDate, clientUser: conflict.clientUser, path: '/conflicts' },
    });
    notices += 1;
  }
  return notices;
}

/**
 * DIG-01: at the configured IST time, create each recipient's digest once per day.
 * If the runtime was down past the time, the digest is sent late with a note.
 */
export async function runScheduledDigests(deps: ScheduleDeps): Promise<number> {
  const now = deps.clock.now();
  const today = istDateOf(now);
  const [hh, mm] = (await deps.store.digestTime()).split(':').map(Number);
  const scheduledMinutes = (hh ?? 9) * 60 + (mm ?? 0);
  const ist = new Date(now.getTime() + 330 * 60_000);
  const nowMinutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  if (nowMinutes < scheduledMinutes) return 0;
  const sentLate = nowMinutes - scheduledMinutes > 15;
  let sent = 0;
  for (const recipient of await deps.store.digestRecipients(today)) {
    if (!recipient.optedIn) continue;
    sent += (await sendDigest(deps, recipient, today, 'scheduled', sentLate)) ? 1 : 0;
  }
  return sent;
}

export async function sendDigest(
  deps: ScheduleDeps,
  recipient: Recipient,
  date: string,
  trigger: 'scheduled' | 'on_demand',
  sentLate: boolean,
): Promise<boolean> {
  const composed = await composeDigest(
    { source: deps.digestSource, summariser: deps.summariser, appUrl: deps.appUrl },
    recipient,
    date,
    deps.clock.now(),
    sentLate,
  );
  await deps.store.saveDigest({
    recipientId: recipient.id,
    date,
    trigger,
    deterministicText: composed.deterministicText,
    aiText: composed.aiText,
    aiValidated: composed.aiValidated,
    aiRejectionReason: composed.aiRejectionReason,
    sentText: composed.text,
  });
  return deps.store.enqueue({
    recipientId: recipient.id,
    kind: 'digest',
    eventId: null,
    body: composed.text,
    dedupeKey: `digest:${trigger}:${date}:${recipient.id}:${trigger === 'on_demand' ? deps.clock.now().getTime() : 'scheduled'}`,
    nextAttemptAt: deps.clock.now(),
  });
}

/** Working-day helper used by the conflict notice text. */
export function dueDateFor(startDate: string, days: number, calendar: CalendarOptions): string {
  return addWorkingDays(startDate, days, calendar);
}
