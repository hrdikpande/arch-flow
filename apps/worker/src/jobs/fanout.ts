/**
 * Event fan-out (ARCHITECTURE.md 3.7 and 7). Reads new events in order and
 * creates one outbox row per opted-in recipient for each alert type the admin
 * has switched on. Dedupe keys make this safe to run again after a crash.
 */

import { buildDedupeKey } from '@arch-flow/domain';
import { ALERT_EVENT_TYPES, renderEvent } from '../templates';
import type { Clock, EventRow, FanoutPort } from '../ports';

export interface FanoutDeps {
  fanout: FanoutPort;
  clock: Clock;
  appUrl: string;
  enabledEventTypes: () => Promise<ReadonlySet<string>>;
  batchSize?: number;
}

export interface FanoutSummary {
  events: number;
  queued: number;
  skipped: number;
}

export async function fanoutOnce(deps: FanoutDeps): Promise<FanoutSummary> {
  const cursor = await deps.fanout.cursor();
  const events = await deps.fanout.eventsAfter(cursor, deps.batchSize ?? 200);
  const summary: FanoutSummary = { events: events.length, queued: 0, skipped: 0 };
  if (events.length === 0) return summary;

  const enabled = await deps.enabledEventTypes();
  const recipients = await deps.fanout.optedInRecipients();
  const alertTypes = new Set<string>(ALERT_EVENT_TYPES);

  for (const event of events) {
    if (!alertTypes.has(event.type) || !enabled.has(event.type)) {
      summary.skipped += 1;
    } else {
      const queued = await queueForEvent(deps, event, recipients);
      summary.queued += queued;
    }
    await deps.fanout.saveCursor(event.id);
  }
  return summary;
}

async function queueForEvent(
  deps: FanoutDeps,
  event: EventRow,
  recipients: Awaited<ReturnType<FanoutPort['optedInRecipients']>>,
): Promise<number> {
  const message = renderEvent(event, deps.appUrl);
  if (!message) return 0;
  let queued = 0;
  for (const recipient of recipients) {
    if (!recipient.optedIn) continue;
    const created = await deps.fanout.enqueue({
      recipientId: recipient.id,
      kind: event.type === 'approval.escalated' ? 'escalation' : 'alert',
      eventId: event.id,
      body: message.text,
      dedupeKey: buildDedupeKey(['event', event.id, recipient.id]),
      nextAttemptAt: deps.clock.now(),
    });
    if (created) queued += 1;
  }
  return queued;
}
