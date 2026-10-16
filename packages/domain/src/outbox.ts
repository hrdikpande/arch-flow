/**
 * WhatsApp outbox decisions (WA-04 to WA-07, ARCHITECTURE.md 3.7 and 6).
 * Pure functions: the caller reads the data, asks these functions what to do,
 * then performs the send. This keeps the rules testable without WhatsApp.
 */

export const RETRY_DELAYS_MINUTES = [1, 5, 30] as const;
export const MAX_ATTEMPTS = RETRY_DELAYS_MINUTES.length + 1;
export const DUPLICATE_WINDOW_MINUTES = 5; // A-W1, proposed
export const MAX_SENDS_PER_MINUTE = 3; // ARCHITECTURE.md 6.2 pacing
export const DIGEST_REQUEST_COOLDOWN_MINUTES = 10; // DIG-02

export type SendDecision =
  | { action: 'send' }
  | { action: 'hold'; reason: string }
  | { action: 'cancel'; reason: string }
  | { action: 'wait'; reason: string };

export interface SendContext {
  recipientOptedIn: boolean;
  eventEnabled: boolean;
  connected: boolean;
  /** Messages already sent to this recipient today (IST). */
  sentTodayForRecipient: number;
  dailyCap: number;
  /** Timestamps (ms) of sends to this recipient in the last minute. */
  recentSendTimes: readonly number[];
  nowMs: number;
  /** Timestamp of the last send of the same event type to this recipient, if any. */
  lastSameEventSentMs?: number;
}

/** Decide whether a queued message may be sent now (WA-04, WA-05, WA-07, WA-08). */
export function decideSend(ctx: SendContext): SendDecision {
  if (!ctx.recipientOptedIn) return { action: 'cancel', reason: 'recipient is not opted in' };
  if (!ctx.eventEnabled) return { action: 'cancel', reason: 'event type is switched off by the admin' };
  if (!ctx.connected) return { action: 'wait', reason: 'WhatsApp connection is down' };
  if (ctx.sentTodayForRecipient >= ctx.dailyCap) {
    return { action: 'hold', reason: 'daily cap reached; included in the next digest' };
  }
  if (
    ctx.lastSameEventSentMs !== undefined &&
    ctx.nowMs - ctx.lastSameEventSentMs < DUPLICATE_WINDOW_MINUTES * 60_000
  ) {
    return { action: 'cancel', reason: 'duplicate of an event sent within 5 minutes' };
  }
  const lastMinute = ctx.recentSendTimes.filter((t) => ctx.nowMs - t < 60_000).length;
  if (lastMinute >= MAX_SENDS_PER_MINUTE) return { action: 'wait', reason: 'pacing: too many sends this minute' };
  return { action: 'send' };
}

/** Next attempt time after a failed send, or null when the message is marked failed. */
export function nextAttemptAfterFailure(attemptsSoFar: number, nowMs: number): number | null {
  if (attemptsSoFar >= MAX_ATTEMPTS) return null;
  const delayMinutes = RETRY_DELAYS_MINUTES[Math.min(attemptsSoFar - 1, RETRY_DELAYS_MINUTES.length - 1)] ?? 30;
  return nowMs + delayMinutes * 60_000;
}

/** Stable key so the same event never creates two outbox rows (ARCHITECTURE.md 3.7). */
export function buildDedupeKey(parts: readonly (string | number)[]): string {
  return parts.map((p) => String(p)).join(':');
}

/** Digest on-demand cooldown (DIG-02): once per 10 minutes per number. */
export function canRequestDigest(lastRequestedMs: number | undefined, nowMs: number): boolean {
  if (lastRequestedMs === undefined) return true;
  return nowMs - lastRequestedMs >= DIGEST_REQUEST_COOLDOWN_MINUTES * 60_000;
}

/** Cap-hit digests must say what was held (WA-04). */
export function capNoteText(heldCount: number): string | null {
  if (heldCount <= 0) return null;
  return 'More items not sent. See dashboard.';
}
