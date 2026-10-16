/**
 * WhatsApp Cloud API webhook (Meta). Verifies the handshake and the HMAC signature,
 * then returns inbound messages and delivery statuses. Pure: the Vercel route does the I/O.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

export interface InboundMessage {
  fromPhone: string;
  messageId: string;
  body: string;
}

export interface StatusUpdate {
  messageId: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  error?: string;
}

export interface VerifyQuery {
  mode: string | null;
  token: string | null;
  challenge: string | null;
}

/** GET handshake. Returns the challenge when the verify token matches, otherwise null. */
export function verifyHandshake(query: VerifyQuery, expectedToken: string): string | null {
  if (query.mode !== 'subscribe' || !query.token || !query.challenge || !expectedToken) return null;
  const a = Buffer.from(query.token);
  const b = Buffer.from(expectedToken);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return query.challenge;
}

/** Checks X-Hub-Signature-256 against the raw request body. */
export function verifySignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header || !header.startsWith('sha256=') || !appSecret) return false;
  const expected = 'sha256=' + createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex');
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

interface CloudPayload {
  entry?: { changes?: { value?: {
    messages?: { from: string; id: string; type: string; text?: { body: string } }[];
    statuses?: { id: string; status: string; errors?: { title?: string; message?: string }[] }[];
  } }[] }[];
}

export function parseWebhook(rawBody: string): { messages: InboundMessage[]; statuses: StatusUpdate[] } {
  const payload = JSON.parse(rawBody) as CloudPayload;
  const messages: InboundMessage[] = [];
  const statuses: StatusUpdate[] = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const m of change.value?.messages ?? []) {
        messages.push({ fromPhone: `+${m.from}`, messageId: m.id, body: m.type === 'text' ? (m.text?.body ?? '') : '' });
      }
      for (const s of change.value?.statuses ?? []) {
        if (['sent', 'delivered', 'read', 'failed'].includes(s.status)) {
          const error = s.errors?.[0]?.message ?? s.errors?.[0]?.title;
          statuses.push({ messageId: s.id, status: s.status as StatusUpdate['status'], error });
        }
      }
    }
  }
  return { messages, statuses };
}
