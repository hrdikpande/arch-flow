/**
 * Outbox sender (ARCHITECTURE.md 3.7, WA-04 to WA-07).
 * Reads due messages, decides per message with the domain rules, sends through
 * the transport, and records the result. Holds and cancels are recorded, never silent.
 */

import { decideSend, nextAttemptAfterFailure, MAX_ATTEMPTS } from '@arch-flow/domain';
import type { Clock, OutboxPort, Transport } from '../ports';

export interface OutboxDeps {
  outbox: OutboxPort;
  transport: Transport;
  clock: Clock;
  batchSize?: number;
  log?: (message: string, fields?: Record<string, unknown>) => void;
}

export interface OutboxRunSummary {
  sent: number;
  held: number;
  cancelled: number;
  waiting: number;
  failed: number;
}

export async function processOutboxOnce(deps: OutboxDeps): Promise<OutboxRunSummary> {
  const now = deps.clock.now();
  const nowMs = now.getTime();
  const summary: OutboxRunSummary = { sent: 0, held: 0, cancelled: 0, waiting: 0, failed: 0 };
  const dueMessages = await deps.outbox.dueMessages(now, deps.batchSize ?? 50);
  const enabled = await deps.outbox.enabledEventTypes();
  const cap = await deps.outbox.dailyCap();
  const startOfIstDay = istMidnight(now);

  for (const message of dueMessages) {
    const eventAllowed =
      message.eventType === null || message.kind !== 'alert' ? true : enabled.has(message.eventType);

    const sentToday = await deps.outbox.sentForRecipientSince(message.recipientId, startOfIstDay);
    const recentSendTimes = (
      await deps.outbox.sentTimesForRecipientSince(message.recipientId, new Date(nowMs - 60_000))
    ).map((d) => d.getTime());
    const lastSameEvent =
      message.eventId === null
        ? undefined
        : await deps.outbox.lastSentForEvent(message.recipientId, message.eventId);

    // A reply to a message the person sent is allowed even right after STOP, so the STOP
    // confirmation itself arrives. Alerts and digests stay gated on the opt-in.
    const replyToPerson = message.kind === 'command_reply';
    const decision = decideSend({
      recipientOptedIn: message.recipientOptedIn || replyToPerson,
      eventEnabled: eventAllowed,
      connected: deps.transport.isConnected(),
      sentTodayForRecipient: sentToday,
      dailyCap: cap,
      recentSendTimes,
      nowMs,
      lastSameEventSentMs: lastSameEvent?.getTime(),
    });

    switch (decision.action) {
      case 'send': {
        try {
          const { messageId } = await deps.transport.send(message.phoneE164, message.body);
          await deps.outbox.update(message.id, {
            status: 'sent',
            attempts: message.attempts + 1,
            waMessageId: messageId,
            sentAt: now,
          });
          summary.sent += 1;
        } catch (error) {
          const attempts = message.attempts + 1;
          const next = nextAttemptAfterFailure(attempts, nowMs);
          await deps.outbox.update(message.id, {
            status: next === null ? 'failed' : 'queued',
            attempts,
            nextAttemptAt: next === null ? now : new Date(next),
            lastError: errorText(error),
          });
          summary.failed += 1;
          deps.log?.('send failed', { id: message.id, attempts, maxAttempts: MAX_ATTEMPTS });
        }
        break;
      }
      case 'hold':
        await deps.outbox.update(message.id, { status: 'held', lastError: decision.reason });
        summary.held += 1;
        break;
      case 'cancel':
        await deps.outbox.update(message.id, { status: 'cancelled', lastError: decision.reason });
        summary.cancelled += 1;
        break;
      case 'wait':
        await deps.outbox.update(message.id, { nextAttemptAt: new Date(nowMs + 30_000), lastError: decision.reason });
        summary.waiting += 1;
        break;
    }
  }
  return summary;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 500) : 'unknown error';
}

/** Start of the current IST day, as a UTC instant. */
export function istMidnight(instant: Date): Date {
  const ist = new Date(instant.getTime() + 330 * 60_000);
  const midnightIstAsUtc = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate());
  return new Date(midnightIstAsUtc - 330 * 60_000);
}
