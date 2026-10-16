import { after } from 'next/server';
import { verifyHandshake, verifySignature } from '@arch-flow/messaging';
import { messagingRuntime } from '@/lib/messaging';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Meta's subscribe handshake (GET). Returns the challenge only when the verify token matches. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const challenge = verifyHandshake(
    { mode: url.searchParams.get('hub.mode'), token: url.searchParams.get('hub.verify_token'), challenge: url.searchParams.get('hub.challenge') },
    process.env.WHATSAPP_VERIFY_TOKEN ?? '',
  );
  if (challenge === null) return new Response('forbidden', { status: 403 });
  return new Response(challenge, { status: 200, headers: { 'content-type': 'text/plain' } });
}

/**
 * Inbound messages and delivery statuses (POST). The signature is checked against the raw body.
 * Meta expects a fast 200, so the work runs after the response is sent.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  const secret = process.env.WHATSAPP_APP_SECRET ?? '';
  if (!verifySignature(raw, request.headers.get('x-hub-signature-256'), secret)) {
    return new Response('invalid signature', { status: 401 });
  }
  after(async () => {
    try {
      const runtime = messagingRuntime();
      await runtime.handleWebhook(raw);
      await runtime.flush();
    } catch (error) {
      console.error('webhook processing failed', error instanceof Error ? error.message : error);
    }
  });
  return new Response('ok', { status: 200 });
}
