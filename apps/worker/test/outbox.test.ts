import { describe, expect, it } from 'vitest';
import { processOutboxOnce } from '../src/jobs/outbox';
import { FakeClock, FakeOutbox, FakeTransport } from './fakes';

const T0 = new Date('2026-10-17T06:00:00Z'); // 11:30 IST

describe('outbox sender (WA-04 to WA-07)', () => {
  it('sends a due alert and records the WhatsApp message id', async () => {
    const outbox = new FakeOutbox();
    const transport = new FakeTransport();
    outbox.add({ recipientId: 'r1', body: 'Upload: M-101.dwg', nextAttemptAt: new Date(0) });
    const summary = await processOutboxOnce({ outbox, transport, clock: new FakeClock(T0) });
    expect(summary.sent).toBe(1);
    expect(transport.sent).toEqual([{ phone: '+919000000001', text: 'Upload: M-101.dwg' }]);
    expect(outbox.rows[0]).toMatchObject({ status: 'sent', waMessageId: 'wa-1', attempts: 1 });
  });

  it('retries a failed send after 1 minute and gives up after 4 attempts', async () => {
    const outbox = new FakeOutbox();
    const transport = new FakeTransport();
    const row = outbox.add({ recipientId: 'r1', body: 'x', nextAttemptAt: new Date(0) });
    const clock = new FakeClock(T0);
    transport.failNext = 10;
    await processOutboxOnce({ outbox, transport, clock });
    expect(row.status).toBe('queued');
    expect(row.nextAttemptAt.getTime()).toBe(T0.getTime() + 60_000);

    clock.current = new Date(T0.getTime() + 60_000);
    await processOutboxOnce({ outbox, transport, clock });
    clock.current = new Date(T0.getTime() + 6 * 60_000);
    await processOutboxOnce({ outbox, transport, clock });
    clock.current = new Date(T0.getTime() + 40 * 60_000);
    await processOutboxOnce({ outbox, transport, clock });
    expect(row.attempts).toBe(4);
    expect(row.status).toBe('failed');
    expect(row.lastError).toBe('network blip');
  });

  it('holds messages once the daily cap is reached and records why', async () => {
    const outbox = new FakeOutbox();
    outbox.cap = 1;
    const transport = new FakeTransport();
    outbox.add({ recipientId: 'r1', body: 'first', nextAttemptAt: new Date(0), eventId: 1 });
    outbox.add({ recipientId: 'r1', body: 'second', nextAttemptAt: new Date(0), eventId: 2, eventType: 'revision.issued' });
    const clock = new FakeClock(T0);
    await processOutboxOnce({ outbox, transport, clock });
    expect(outbox.rows.map((r) => r.status)).toEqual(['sent', 'held']);
    expect(outbox.rows[1]?.lastError).toMatch(/daily cap/);
  });

  it('cancels messages for opted-out recipients and switched-off event types', async () => {
    const outbox = new FakeOutbox();
    const transport = new FakeTransport();
    outbox.add({ recipientId: 'r1', body: 'a', nextAttemptAt: new Date(0), recipientOptedIn: false });
    outbox.add({ recipientId: 'r2', body: 'b', nextAttemptAt: new Date(0), eventType: 'clash.opened' });
    await processOutboxOnce({ outbox, transport, clock: new FakeClock(T0) });
    expect(outbox.rows.map((r) => r.status)).toEqual(['cancelled', 'cancelled']);
    expect(transport.sent).toHaveLength(0);
  });

  it('waits while disconnected and does not lose the message', async () => {
    const outbox = new FakeOutbox();
    const transport = new FakeTransport();
    transport.connected = false;
    const row = outbox.add({ recipientId: 'r1', body: 'a', nextAttemptAt: new Date(0) });
    const summary = await processOutboxOnce({ outbox, transport, clock: new FakeClock(T0) });
    expect(summary.waiting).toBe(1);
    expect(row.status).toBe('queued');
  });

  it('does not send the same event to the same recipient twice within 5 minutes', async () => {
    const outbox = new FakeOutbox();
    const transport = new FakeTransport();
    outbox.add({ recipientId: 'r1', body: 'first', nextAttemptAt: new Date(0), eventId: 7, dedupeKey: 'a' });
    outbox.add({ recipientId: 'r1', body: 'again', nextAttemptAt: new Date(0), eventId: 7, dedupeKey: 'b' });
    await processOutboxOnce({ outbox, transport, clock: new FakeClock(T0) });
    expect(outbox.rows.map((r) => r.status)).toEqual(['sent', 'cancelled']);
  });

  it('sends different events in the same minute (no merging is applied)', async () => {
    const outbox = new FakeOutbox();
    const transport = new FakeTransport();
    outbox.add({ recipientId: 'r1', body: 'upload 1', nextAttemptAt: new Date(0), eventId: 7, dedupeKey: 'a' });
    outbox.add({ recipientId: 'r1', body: 'upload 2', nextAttemptAt: new Date(0), eventId: 8, dedupeKey: 'b' });
    await processOutboxOnce({ outbox, transport, clock: new FakeClock(T0) });
    expect(transport.sent.map((s) => s.text)).toEqual(['upload 1', 'upload 2']);
  });

  it('paces to three sends per minute per recipient', async () => {
    const outbox = new FakeOutbox();
    const transport = new FakeTransport();
    for (let i = 0; i < 5; i += 1) outbox.add({ recipientId: 'r1', body: `m${i}`, nextAttemptAt: new Date(0), eventId: i, dedupeKey: `d${i}` });
    const summary = await processOutboxOnce({ outbox, transport, clock: new FakeClock(T0) });
    expect(summary.sent).toBe(3);
    expect(summary.waiting).toBe(2);
  });
});
