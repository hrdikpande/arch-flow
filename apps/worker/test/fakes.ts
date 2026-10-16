import type { EventRow, OutboxPort, OutboxRow, Recipient, Transport, FanoutPort, NewOutboxRow } from '../src/ports';

export class FakeClock {
  constructor(public current: Date) {}
  now(): Date {
    return this.current;
  }
}

export class FakeTransport implements Transport {
  sent: { phone: string; text: string }[] = [];
  connected = true;
  failNext = 0;
  isConnected(): boolean {
    return this.connected;
  }
  async send(phone: string, text: string): Promise<{ messageId: string }> {
    if (this.failNext > 0) {
      this.failNext -= 1;
      throw new Error('network blip');
    }
    this.sent.push({ phone, text });
    return { messageId: `wa-${this.sent.length}` };
  }
}

export class FakeOutbox implements OutboxPort {
  rows: (OutboxRow & { sentAt?: Date; lastError?: string; waMessageId?: string })[] = [];
  cap = 30;
  enabled = new Set<string>(['file.uploaded', 'revision.issued']);

  add(partial: Partial<OutboxRow> & { body: string; recipientId: string }): OutboxRow & { lastError?: string } {
    const row: OutboxRow & { lastError?: string; sentAt?: Date; waMessageId?: string } = {
      id: `o${this.rows.length + 1}`,
      phoneE164: '+919000000001',
      kind: 'alert',
      eventType: 'file.uploaded',
      eventId: 1,
      dedupeKey: `k${this.rows.length + 1}`,
      status: 'queued',
      attempts: 0,
      nextAttemptAt: new Date(0),
      recipientOptedIn: true,
      ...partial,
    };
    this.rows.push(row);
    return row;
  }

  async dueMessages(now: Date, limit: number): Promise<OutboxRow[]> {
    return this.rows.filter((r) => r.status === 'queued' && r.nextAttemptAt <= now).slice(0, limit);
  }
  async update(id: string, patch: Partial<OutboxRow> & { waMessageId?: string; sentAt?: Date; lastError?: string }): Promise<void> {
    const row = this.rows.find((r) => r.id === id);
    if (!row) throw new Error('missing row');
    const { waMessageId, sentAt, lastError, ...rest } = patch;
    Object.assign(row, rest);
    if (waMessageId !== undefined) row.waMessageId = waMessageId;
    if (sentAt !== undefined) row.sentAt = sentAt;
    if (lastError !== undefined) row.lastError = lastError;
  }
  async sentForRecipientSince(recipientId: string, since: Date): Promise<number> {
    return (await this.sentTimesForRecipientSince(recipientId, since)).length;
  }
  async sentTimesForRecipientSince(recipientId: string, since: Date): Promise<Date[]> {
    return this.rows
      .filter((r) => r.recipientId === recipientId && r.status === 'sent' && r.sentAt && r.sentAt >= since)
      .map((r) => r.sentAt as Date);
  }
  async lastSentForEvent(recipientId: string, eventId: number): Promise<Date | undefined> {
    const times = this.rows
      .filter((r) => r.recipientId === recipientId && r.status === 'sent' && r.eventId === eventId && r.sentAt)
      .map((r) => r.sentAt as Date)
      .sort((a, b) => b.getTime() - a.getTime());
    return times[0];
  }
  async enabledEventTypes(): Promise<ReadonlySet<string>> {
    return this.enabled;
  }
  async dailyCap(): Promise<number> {
    return this.cap;
  }
}

export class FakeFanout implements FanoutPort {
  cursorValue = 0;
  events: EventRow[] = [];
  recipients: Recipient[] = [];
  queued: NewOutboxRow[] = [];
  keys = new Set<string>();
  async cursor(): Promise<number> {
    return this.cursorValue;
  }
  async saveCursor(id: number): Promise<void> {
    this.cursorValue = id;
  }
  async eventsAfter(id: number, limit: number): Promise<EventRow[]> {
    return this.events.filter((e) => e.id > id).slice(0, limit);
  }
  async optedInRecipients(): Promise<Recipient[]> {
    return this.recipients;
  }
  async enqueue(row: NewOutboxRow): Promise<boolean> {
    if (this.keys.has(row.dedupeKey)) return false;
    this.keys.add(row.dedupeKey);
    this.queued.push(row);
    return true;
  }
}

export const owner: Recipient = {
  id: 'r-owner',
  name: 'Owner',
  phoneE164: '+919000000001',
  optedIn: true,
  isOwner: true,
  profileId: 'p-owner',
};

export const member: Recipient = {
  id: 'r-member',
  name: 'Member',
  phoneE164: '+919000000002',
  optedIn: true,
  isOwner: false,
  profileId: 'p-member',
};
