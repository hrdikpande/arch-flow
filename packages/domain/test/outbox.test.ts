import { describe, expect, it } from 'vitest';
import { canRequestDigest, decideSend, nextAttemptAfterFailure, SendContext } from '../src/outbox';

const now = Date.UTC(2026, 9, 17, 4, 0, 0); // arbitrary instant
const base: SendContext = {
  recipientOptedIn: true,
  eventEnabled: true,
  connected: true,
  sentTodayForRecipient: 0,
  dailyCap: 30,
  recentSendTimes: [],
  nowMs: now,
};

describe('send decisions (WA-04 to WA-08)', () => {
  it('sends when everything allows it', () => {
    expect(decideSend(base)).toEqual({ action: 'send' });
  });

  it('cancels for opted-out recipients and switched-off events', () => {
    expect(decideSend({ ...base, recipientOptedIn: false }).action).toBe('cancel');
    expect(decideSend({ ...base, eventEnabled: false }).action).toBe('cancel');
  });

  it('waits while the connection is down', () => {
    expect(decideSend({ ...base, connected: false }).action).toBe('wait');
  });

  it('holds messages once the daily cap is reached (30 by default)', () => {
    expect(decideSend({ ...base, sentTodayForRecipient: 30 })).toEqual({
      action: 'hold',
      reason: 'daily cap reached; included in the next digest',
    });
    expect(decideSend({ ...base, sentTodayForRecipient: 29 }).action).toBe('send');
  });

  it('cancels a duplicate of the same event within 5 minutes', () => {
    expect(decideSend({ ...base, lastSameEventSentMs: now - 4 * 60_000 }).action).toBe('cancel');
    expect(decideSend({ ...base, lastSameEventSentMs: now - 6 * 60_000 }).action).toBe('send');
  });

  it('paces sends to 3 per minute', () => {
    expect(decideSend({ ...base, recentSendTimes: [now - 1000, now - 2000, now - 3000] }).action).toBe('wait');
    expect(decideSend({ ...base, recentSendTimes: [now - 61_000, now - 62_000, now - 63_000] }).action).toBe('send');
  });
});

describe('retries (WA-06)', () => {
  it('backs off 1, 5 and 30 minutes, then gives up', () => {
    expect(nextAttemptAfterFailure(1, now)).toBe(now + 60_000);
    expect(nextAttemptAfterFailure(2, now)).toBe(now + 5 * 60_000);
    expect(nextAttemptAfterFailure(3, now)).toBe(now + 30 * 60_000);
    expect(nextAttemptAfterFailure(4, now)).toBeNull();
  });
});

describe('digest request cooldown (DIG-02)', () => {
  it('allows one on-demand digest per 10 minutes', () => {
    expect(canRequestDigest(undefined, now)).toBe(true);
    expect(canRequestDigest(now - 9 * 60_000, now)).toBe(false);
    expect(canRequestDigest(now - 10 * 60_000, now)).toBe(true);
  });
});
