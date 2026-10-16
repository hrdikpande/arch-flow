/**
 * Inbound WhatsApp messages (WA-08 to WA-10, DIG-02). Numbers not on the
 * allowlist are ignored and logged. Replies are built from fixed queries.
 * No AI is used for command replies.
 */

import {
  canRequestDigest,
  HELP_TEXT,
  parseCommand,
  START_REPLY_CONFIRMED,
  START_REPLY_NOT_CONFIRMED,
  STOP_REPLY,
} from '@arch-flow/domain';
import type { Clock, NewOutboxRow, Recipient } from '../ports';

export interface InboundPort {
  recipientByPhone(phoneE164: string): Promise<Recipient | null>;
  setOptedOut(recipientId: string, optedOut: boolean): Promise<void>;
  optInConfirmed(recipientId: string): Promise<boolean>;
  logInbound(row: { fromPhone: string; recipientId: string | null; body: string; command: string | null; allowed: boolean }): Promise<void>;
  lastDigestRequest(recipientId: string): Promise<Date | undefined>;
  enqueue(row: NewOutboxRow): Promise<boolean>;
  /** Fixed-query replies. Each returns plain text. */
  answer(command: 'today' | 'overdue' | 'critical', recipient: Recipient): Promise<string>;
  requestDigest(recipient: Recipient): Promise<void>;
}

export interface InboundDeps {
  inbound: InboundPort;
  clock: Clock;
  /** Dedupe key component: the WhatsApp message id, so a redelivered message is answered once. */
}

export async function handleInbound(
  deps: InboundDeps,
  message: { fromPhone: string; body: string; messageId: string },
): Promise<void> {
  const recipient = await deps.inbound.recipientByPhone(message.fromPhone);
  const command = parseCommand(message.body);
  if (!recipient) {
    await deps.inbound.logInbound({ fromPhone: message.fromPhone, recipientId: null, body: message.body, command: null, allowed: false });
    return;
  }
  await deps.inbound.logInbound({ fromPhone: message.fromPhone, recipientId: recipient.id, body: message.body, command, allowed: true });

  const now = deps.clock.now();
  const reply = async (text: string, suffix: string): Promise<void> => {
    await deps.inbound.enqueue({
      recipientId: recipient.id,
      kind: 'command_reply',
      eventId: null,
      body: text,
      dedupeKey: `reply:${message.messageId}:${suffix}`,
      nextAttemptAt: now,
    });
  };

  switch (command) {
    case 'stop':
      await deps.inbound.setOptedOut(recipient.id, true);
      await reply(STOP_REPLY, 'stop');
      return;
    case 'start': {
      if (!(await deps.inbound.optInConfirmed(recipient.id))) {
        await reply(START_REPLY_NOT_CONFIRMED, 'start');
        return;
      }
      await deps.inbound.setOptedOut(recipient.id, false);
      await reply(START_REPLY_CONFIRMED, 'start');
      return;
    }
    case 'today':
    case 'overdue':
    case 'critical':
      await reply(await deps.inbound.answer(command, recipient), command);
      return;
    case 'digest': {
      const last = await deps.inbound.lastDigestRequest(recipient.id);
      if (!canRequestDigest(last?.getTime(), now.getTime())) {
        await reply('A digest was sent in the last 10 minutes. Try again shortly.', 'digest-cooldown');
        return;
      }
      await deps.inbound.requestDigest(recipient);
      return;
    }
    case 'help':
      await reply(HELP_TEXT, 'help');
      return;
  }
}
