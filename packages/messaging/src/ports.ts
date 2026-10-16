/**
 * Ports: the messaging runtime's dependencies as narrow interfaces. The Supabase adapter
 * implements them in production. Tests use in-memory fakes. Business decisions
 * are in @arch-flow/domain, not here.
 */

export interface Recipient {
  id: string;
  name: string;
  phoneE164: string;
  /** opted_in AND admin-confirmed AND not opted out (WA-03, WA-08). */
  optedIn: boolean;
  /** The firm owner (admin). Owner-only digest sections depend on this (CFL-04). */
  isOwner: boolean;
  /** Profile id of the recipient, when linked to a user. Used to find their approvals. */
  profileId: string | null;
}

export type OutboxStatus = 'queued' | 'sending' | 'sent' | 'failed' | 'held' | 'cancelled';

export interface OutboxRow {
  id: string;
  recipientId: string;
  phoneE164: string;
  kind: 'alert' | 'digest' | 'command_reply' | 'escalation' | 'health';
  eventType: string | null;
  eventId: number | null;
  body: string;
  dedupeKey: string;
  status: OutboxStatus;
  attempts: number;
  nextAttemptAt: Date;
  recipientOptedIn: boolean;
}

export interface NewOutboxRow {
  recipientId: string;
  kind: OutboxRow['kind'];
  eventId: number | null;
  body: string;
  dedupeKey: string;
  nextAttemptAt: Date;
}

export interface EventRow {
  id: number;
  type: string;
  projectId: string | null;
  payload: Record<string, unknown>;
  createdAt: Date;
  actorName?: string;
}

export interface OutboxPort {
  dueMessages(now: Date, limit: number): Promise<OutboxRow[]>;
  update(id: string, patch: Partial<Pick<OutboxRow, 'status' | 'attempts' | 'nextAttemptAt'>> & {
    waMessageId?: string;
    sentAt?: Date;
    lastError?: string;
    bodyPreview?: string;
  }): Promise<void>;
  sentForRecipientSince(recipientId: string, since: Date): Promise<number>;
  sentTimesForRecipientSince(recipientId: string, since: Date): Promise<Date[]>;
  /** Last time this exact event was sent to this recipient. Used for the 5-minute repeat check. */
  lastSentForEvent(recipientId: string, eventId: number): Promise<Date | undefined>;
  enabledEventTypes(): Promise<ReadonlySet<string>>;
  dailyCap(): Promise<number>;
}

export interface FanoutPort {
  cursor(): Promise<number>;
  saveCursor(id: number): Promise<void>;
  eventsAfter(id: number, limit: number): Promise<EventRow[]>;
  optedInRecipients(): Promise<Recipient[]>;
  enqueue(row: NewOutboxRow): Promise<boolean>;
}

export interface Transport {
  isConnected(): boolean;
  send(phoneE164: string, text: string): Promise<{ messageId: string }>;
}

export interface Clock {
  now(): Date;
}
