import { describe, expect, it } from 'vitest';
import { handleInbound, InboundPort } from '../src/jobs/inbound';
import { FakeClock, owner } from './fakes';
import type { NewOutboxRow, Recipient } from '../src/ports';

class FakeInbound implements InboundPort {
  logged: { fromPhone: string; recipientId: string | null; body: string; command: string | null; allowed: boolean }[] = [];
  queued: NewOutboxRow[] = [];
  optedOut = false;
  confirmed = true;
  lastDigest: Date | undefined;
  digestRequested = 0;
  constructor(private readonly known: Recipient[]) {}
  async recipientByPhone(phone: string): Promise<Recipient | null> {
    return this.known.find((r) => r.phoneE164 === phone) ?? null;
  }
  async setOptedOut(_id: string, optedOut: boolean): Promise<void> {
    this.optedOut = optedOut;
  }
  async optInConfirmed(): Promise<boolean> {
    return this.confirmed;
  }
  async logInbound(row: { fromPhone: string; recipientId: string | null; body: string; command: string | null; allowed: boolean }): Promise<void> {
    this.logged.push(row);
  }
  async lastDigestRequest(): Promise<Date | undefined> {
    return this.lastDigest;
  }
  async enqueue(row: NewOutboxRow): Promise<boolean> {
    this.queued.push(row);
    return true;
  }
  async answer(command: string): Promise<string> {
    return `answer:${command}`;
  }
  async requestDigest(): Promise<void> {
    this.digestRequested += 1;
  }
}

const T0 = new Date('2026-10-17T06:00:00Z');

describe('inbound commands (WA-08 to WA-10)', () => {
  it('ignores numbers that are not on the allowlist and logs them', async () => {
    const inbound = new FakeInbound([owner]);
    await handleInbound({ inbound, clock: new FakeClock(T0) }, { fromPhone: '+919999999999', body: 'today', messageId: 'm1' });
    expect(inbound.queued).toHaveLength(0);
    expect(inbound.logged).toEqual([{ fromPhone: '+919999999999', recipientId: null, body: 'today', command: null, allowed: false }]);
  });

  it('answers a known command from a fixed query', async () => {
    const inbound = new FakeInbound([owner]);
    await handleInbound({ inbound, clock: new FakeClock(T0) }, { fromPhone: owner.phoneE164, body: 'overdue', messageId: 'm2' });
    expect(inbound.queued[0]?.body).toBe('answer:overdue');
  });

  it('STOP opts out and START resumes only after admin confirmation', async () => {
    const inbound = new FakeInbound([owner]);
    await handleInbound({ inbound, clock: new FakeClock(T0) }, { fromPhone: owner.phoneE164, body: 'STOP', messageId: 'm3' });
    expect(inbound.optedOut).toBe(true);
    inbound.confirmed = false;
    await handleInbound({ inbound, clock: new FakeClock(T0) }, { fromPhone: owner.phoneE164, body: 'START', messageId: 'm4' });
    expect(inbound.queued.at(-1)?.body).toMatch(/admin confirms/);
    expect(inbound.optedOut).toBe(true);
  });

  it('answers a redelivered message only once', async () => {
    const inbound = new FakeInbound([owner]);
    const deps = { inbound, clock: new FakeClock(T0) };
    await handleInbound(deps, { fromPhone: owner.phoneE164, body: 'help', messageId: 'same' });
    await handleInbound(deps, { fromPhone: owner.phoneE164, body: 'help', messageId: 'same' });
    expect(inbound.queued.map((q) => q.dedupeKey)).toEqual(['reply:same:help', 'reply:same:help']);
  });

  it('limits on-demand digests to one per 10 minutes', async () => {
    const inbound = new FakeInbound([owner]);
    inbound.lastDigest = new Date(T0.getTime() - 2 * 60_000);
    await handleInbound({ inbound, clock: new FakeClock(T0) }, { fromPhone: owner.phoneE164, body: 'digest', messageId: 'm5' });
    expect(inbound.digestRequested).toBe(0);
    expect(inbound.queued.at(-1)?.body).toMatch(/last 10 minutes/);
    inbound.lastDigest = undefined;
    await handleInbound({ inbound, clock: new FakeClock(T0) }, { fromPhone: owner.phoneE164, body: 'digest', messageId: 'm6' });
    expect(inbound.digestRequested).toBe(1);
  });
});
