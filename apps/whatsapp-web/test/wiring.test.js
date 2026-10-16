'use strict';
/**
 * Wiring of WhatsAppWeb.js against the real database (PostgREST). The WhatsApp client is a fake,
 * because web.whatsapp.com cannot be reached from the test environment. Everything else runs for real:
 * message handling, the allowlist, the outbox, the heartbeat row and the session store.
 * Skipped unless ARCHFLOW_API_URL is set (supabase/tests/api/run.sh sets it).
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const { createClient } = require('@supabase/supabase-js');
const { createWhatsAppWeb } = require('../src/WhatsAppWeb');

const API_URL = process.env.ARCHFLOW_API_URL;
const SKIP = API_URL ? false : 'set ARCHFLOW_API_URL (see supabase/tests/api/run.sh)';

function serviceJwt(secret) {
  const b64 = (v) => Buffer.from(JSON.stringify(v)).toString('base64url');
  const header = b64({ alg: 'HS256', typ: 'JWT' });
  const payload = b64({ role: 'service_role', iss: 'supabase-local', exp: Math.floor(Date.now() / 1000) + 3600 });
  const sig = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

class FakeClient extends EventEmitter {
  constructor() {
    super();
    this.sent = [];
    this.initialized = false;
    this.destroyed = false;
  }
  async initialize() {
    this.initialized = true;
  }
  async sendMessage(chatId, text) {
    this.sent.push({ chatId, text });
    return { id: { id: `wamid.fake.${this.sent.length}` } };
  }
  async destroy() {
    this.destroyed = true;
  }
}

class FakeRemoteAuth {
  constructor(options) {
    this.options = options;
  }
}

function memoryRepository() {
  const rows = new Map();
  return {
    get: async (id) => rows.get(id) ?? null,
    put: async (id, row) => rows.set(id, row),
    remove: async (id) => rows.delete(id),
  };
}

test('WhatsAppWeb wiring against the database', { skip: SKIP }, async (t) => {
  const secret = process.env.ARCHFLOW_JWT_SECRET;
  const db = createClient(API_URL, serviceJwt(secret), { auth: { persistSession: false } });
  const qrCalls = [];
  const exits = [];
  let client;
  const app = createWhatsAppWeb({
    db,
    appUrl: 'https://arch-flow.example',
    sessionKey: crypto.randomBytes(32).toString('base64'),
    dataPath: require('node:os').tmpdir(),
    repository: memoryRepository(),
    ClientClass: class extends FakeClient {
      constructor() {
        super();
        client = this;
      }
    },
    RemoteAuthClass: FakeRemoteAuth,
    qr: { generate: (code) => qrCalls.push(code) },
    flushSeconds: 3600,
    heartbeatSeconds: 3600,
    exitProcess: (code) => exits.push(code),
  });

  // A second allowlisted number, so this test is not affected by pacing from other tests.
  const phone = '+919000000002';
  const { error: recipientError } = await db.from('whatsapp_recipients').insert({ phone_e164: phone, opted_in: true, opt_in_confirmed_at: new Date().toISOString(), active: true });
  assert.equal(recipientError, null, 'seed second recipient');

  await t.test('a start() call initialises the client and the QR code is printed when requested', async () => {
    await app.start();
    assert.equal(client.initialized, true);
    client.emit('qr', 'QR-PAYLOAD-1');
    assert.deepEqual(qrCalls, ['QR-PAYLOAD-1']);
  });

  await t.test('ready marks the process connected and writes the heartbeat row', async () => {
    client.emit('ready');
    assert.equal(app.isConnected(), true);
    await app.reportHeartbeat();
    const { data } = await db.from('settings').select('value').is('project_id', null).eq('key', 'runtime.heartbeat').single();
    assert.equal(data.value.connected, true);
    assert.ok(Date.now() - new Date(data.value.at).getTime() < 60_000);
  });

  await t.test('group and self messages are ignored', async () => {
    await app.handleMessage({ fromMe: false, from: '120363000000000000@g.us', body: 'group-msg-xyz', id: { id: 'g1' } });
    await app.handleMessage({ fromMe: true, from: '919000000002@c.us', body: 'self-msg-xyz', id: { id: 's1' } });
    const { data } = await db.from('whatsapp_inbound').select('id').in('body', ['group-msg-xyz', 'self-msg-xyz']);
    assert.equal((data ?? []).length, 0);
  });

  await t.test('an allowlisted number command is logged as allowed and answered through the outbox', async () => {
    await app.handleMessage({ fromMe: false, from: '919000000002@c.us', body: 'help', id: { id: 'wire-help-1' } });
    const { data: inbound } = await db.from('whatsapp_inbound').select('is_allowed, command').eq('from_phone', phone);
    assert.deepEqual(inbound[0], { is_allowed: true, command: 'help' });
    await app.flushNow();
    assert.ok(client.sent.some((m) => m.chatId === '919000000002@c.us' && m.text.startsWith('Commands:')), 'help reply sent to the allowlisted chat');
  });

  await t.test('a stranger is logged as not allowed and gets no reply', async () => {
    await app.handleMessage({ fromMe: false, from: '919000000009@c.us', body: 'today', id: { id: 'wire-stranger-1' } });
    const { data } = await db.from('whatsapp_inbound').select('is_allowed').eq('from_phone', '+919000000009');
    assert.equal(data[0].is_allowed, false);
    await app.flushNow();
    assert.equal(client.sent.some((m) => m.chatId.startsWith('919000000009')), false);
  });

  await t.test('an alert event is queued and sent through the WhatsApp client', async () => {
    const { error } = await db.from('events').insert({ type: 'revision.issued', payload: { sheet: 'A-101', rev: 'R2', title: 'Plan', projectCode: 'PRJ', userName: 'Drafter', time: '09:00', path: '/projects/PRJ' } });
    assert.equal(error, null);
    await app.flushNow();
    assert.ok(client.sent.some((m) => m.chatId === '919000000002@c.us' && m.text.includes('A-101')), 'alert sent to the allowlisted chat');
  });

  await t.test('a disconnected session is not used for sending', async () => {
    client.emit('disconnected', 'test');
    assert.equal(app.isConnected(), false);
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(exits, [1], 'exits non-zero so the supervisor restarts the process');
  });

  await app.stop();
  assert.equal(client.destroyed, true);
});
