/**
 * Integration tests against PostgREST and a migrated PostgreSQL database (supabase/tests/api/run.sh).
 * They run the real messaging runtime: events → fan-out → outbox → transport, inbound commands,
 * STOP/START, queue-only mode, and the WhatsApp Web session store. The transport is a fake, because
 * WhatsApp Web itself cannot be reached from the test environment.
 * Skipped unless ARCHFLOW_API_URL is set.
 */
import { describe, expect, it, beforeAll, beforeEach } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createHmac } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdtemp, writeFile, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRuntime } from '../../src/runtime';
import type { Transport } from '../../src/ports';

const API_URL = process.env.ARCHFLOW_API_URL;
const JWT_SECRET = process.env.ARCHFLOW_JWT_SECRET ?? '';
const OWNER_PHONE = '+919000000001';
const STRANGER_PHONE = '+919000000009';
const RECIPIENT_ID = '22222222-2222-4222-8222-222222222222';

function signedJwt(secret: string, claims: object): string {
  const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = b64({ alg: 'HS256', typ: 'JWT' });
  const payload = b64({ ...claims, exp: Math.floor(Date.now() / 1000) + 3600 });
  const signature = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

const serviceRoleJwt = (secret: string) => signedJwt(secret, { role: 'service_role', iss: 'supabase-local' });

function fakeTransport(): Transport & { sent: { to: string; text: string }[] } {
  const sent: { to: string; text: string }[] = [];
  let counter = 0;
  return {
    sent,
    isConnected: () => true,
    async send(to, text) {
      counter += 1;
      sent.push({ to, text });
      return { messageId: `wamid.test.${counter}` };
    },
  };
}

describe.skipIf(!API_URL)('messaging pipeline against PostgREST', () => {
  let db: SupabaseClient;
  // The outbox paces sends (3 per recipient per minute). A controllable clock lets each test move
  // past that window instead of sleeping for a real minute.
  let nowMs = Date.now();
  const clock = { now: () => new Date(nowMs) };
  const config = { appUrl: 'https://arch-flow.example' };

  beforeAll(() => {
    db = createClient(API_URL as string, serviceRoleJwt(JWT_SECRET), { auth: { persistSession: false } });
  });

  beforeEach(() => {
    nowMs += 61_000;
  });

  function runtimeFor(transport: Transport, sendFromThisProcess: boolean) {
    return createRuntime(db, { ...config, transport, sendFromThisProcess }, clock);
  }

  async function outboxFor(recipientId: string) {
    const { data, error } = await db.from('whatsapp_outbox').select('id, kind, status, body_preview, wa_message_id').eq('recipient_id', recipientId).order('created_at');
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  it('fans out an upload event to the owner, sends it, and records the message id', async () => {
    const transport = fakeTransport();
    const runtime = runtimeFor(transport, true);
    const { error } = await db.from('events').insert({
      type: 'file.uploaded',
      payload: { fileName: 'PRJ_ARC_A101_R00.pdf', userName: 'Drafter One', time: '10:15', path: '/projects/PRJ/sheets/A101' },
    });
    expect(error).toBeNull();

    const result = await runtime.flush();
    expect(result.sent).toBeGreaterThanOrEqual(1);
    expect(transport.sent.some((m) => m.to === OWNER_PHONE && m.text.includes('PRJ_ARC_A101_R00.pdf'))).toBe(true);
    const rows = await outboxFor(RECIPIENT_ID);
    const alert = rows.find((r) => r.kind === 'alert');
    expect(alert?.status).toBe('sent');
    expect(alert?.wa_message_id).toMatch(/^wamid\.test\./);
  });

  it('answers an allowlisted owner command and logs the inbound message', async () => {
    const transport = fakeTransport();
    const runtime = runtimeFor(transport, true);
    await runtime.handleInboundMessage({ fromPhone: OWNER_PHONE, body: 'today', messageId: 'in-owner-1' });
    const { data: inbound } = await db.from('whatsapp_inbound').select('is_allowed, command').eq('from_phone', OWNER_PHONE);
    expect(inbound?.[0]).toMatchObject({ is_allowed: true, command: 'today' });
    await runtime.flush();
    expect(transport.sent.some((m) => m.to === OWNER_PHONE)).toBe(true);
  });

  it('ignores a number that is not on the allowlist: logged, never answered', async () => {
    const transport = fakeTransport();
    const runtime = runtimeFor(transport, true);
    await runtime.handleInboundMessage({ fromPhone: STRANGER_PHONE, body: 'digest', messageId: 'in-stranger-1' });
    const { data: inbound } = await db.from('whatsapp_inbound').select('is_allowed').eq('from_phone', STRANGER_PHONE);
    expect(inbound?.[0]?.is_allowed).toBe(false);
    await runtime.flush();
    expect(transport.sent.some((m) => m.to === STRANGER_PHONE)).toBe(false);
  });

  it('STOP stops alerts for the owner, and START restores them because the opt-in is confirmed', async () => {
    const transport = fakeTransport();
    const runtime = runtimeFor(transport, true);
    await runtime.handleInboundMessage({ fromPhone: OWNER_PHONE, body: 'STOP', messageId: 'in-stop-1' });
    await runtime.flush();
    expect(transport.sent.at(-1)?.text).toMatch(/no longer receive updates/i);

    const { error } = await db.from('events').insert({ type: 'file.uploaded', payload: { fileName: 'after-stop.pdf', userName: 'X', time: '11:00', path: '/' } });
    expect(error).toBeNull();
    const before = transport.sent.length;
    await runtime.flush();
    expect(transport.sent.slice(before).some((m) => m.text.includes('after-stop.pdf'))).toBe(false);

    await runtime.handleInboundMessage({ fromPhone: OWNER_PHONE, body: 'START', messageId: 'in-start-1' });
    await runtime.flush();
    expect(transport.sent.at(-1)?.text).toBe('Updates resumed.');
  });

  it('queue-only mode creates messages but leaves sending to the WhatsApp Web process', async () => {
    const transport = fakeTransport();
    const queueOnly = runtimeFor(transport, false);
    const { error } = await db.from('events').insert({ type: 'file.uploaded', payload: { fileName: 'queued-only.pdf', userName: 'Y', time: '12:00', path: '/' } });
    expect(error).toBeNull();
    await queueOnly.flush();
    expect(transport.sent.some((m) => m.text.includes('queued-only.pdf'))).toBe(false);
    const { data: queued } = await db.from('whatsapp_outbox').select('status, body_preview').like('body_preview', '%queued-only.pdf%');
    expect(queued?.[0]?.status).toBe('queued');

    const sender = runtimeFor(transport, true);
    await sender.flush();
    expect(transport.sent.some((m) => m.text.includes('queued-only.pdf'))).toBe(true);
  });

  it('stores the encrypted WhatsApp session in whatsapp_sessions and restores it byte for byte', async () => {
    const require = createRequire(join(process.cwd(), 'noop.js'));
    const webDir = join(process.env.ARCHFLOW_WHATSAPP_WEB_DIR ?? '', 'src');
    const { createSessionStore, createSupabaseRepository } = require(join(webDir, 'session-store.js'));
    const crypto = require('node:crypto');
    const key = crypto.randomBytes(32).toString('base64');
    const dir = await mkdtemp(join(tmpdir(), 'wa-int-'));
    const zipIn = join(dir, 'in.zip');
    const zipOut = join(dir, 'out.zip');
    const payload = crypto.randomBytes(2048);
    await writeFile(zipIn, payload);

    const store = createSessionStore({ repository: createSupabaseRepository(db), sessionKey: key });
    const session = `itest-${Date.now()}`;
    expect(await store.sessionExists({ session })).toBe(false);
    await store.save({ session, zipPath: zipIn });
    expect(await store.sessionExists({ session })).toBe(true);

    const { data: row } = await db.from('whatsapp_sessions').select('ciphertext').eq('id', session).single();
    expect(Buffer.from(row?.ciphertext ?? '', 'base64').equals(payload)).toBe(false);

    await store.extract({ session, path: zipOut });
    expect((await readFile(zipOut)).equals(payload)).toBe(true);
    expect((await stat(zipOut)).mode & 0o077).toBe(0);
    await store.delete({ session });
    expect(await store.sessionExists({ session })).toBe(false);
  });

  it('the session table is not readable with the anon role (RLS denies by default)', async () => {
    const anonToken = signedJwt(JWT_SECRET, { role: 'anon', iss: 'supabase-local' });
    const anon = createClient(API_URL as string, anonToken, { auth: { persistSession: false } });
    const { data } = await anon.from('whatsapp_sessions').select('id');
    expect(data ?? []).toHaveLength(0);
  });
});
