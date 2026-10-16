#!/usr/bin/env node
'use strict';

/**
 * WhatsAppWeb.js: the WhatsApp Web session process for the pilot.
 *
 * What it does:
 *  - Logs in with a QR code on a dedicated test number (Linked devices). The session is stored
 *    encrypted in Supabase, so a restart does not need a new scan.
 *  - Receives messages and passes them to the messaging runtime. Only allowlisted, opted-in
 *    numbers get an answer (owner commands: today, overdue, critical, digest, help, STOP, START).
 *  - Sends the queued digests and alerts from the shared outbox, every 15 seconds by default.
 *
 * What it does not do:
 *  - It does not send to clients, and it does not send files. Client-facing messages use the
 *    Cloud API (see README). This process only sends to numbers on the internal allowlist.
 *  - It does not create messages. Vercel creates them (checks, digests, events), and this process
 *    sends them. Vercel runs with MESSAGING_TRANSPORT=web so nothing is sent twice.
 *
 * Run with: npm start -w @arch-flow/whatsapp-web   (needs Node 22.19+ and Chromium)
 */

const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');

const { Client, RemoteAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { createClient } = require('@supabase/supabase-js');
const { createRuntime } = require('@arch-flow/messaging');
const { createSessionStore, createSupabaseRepository } = require('./session-store');

const SESSION_NAME = 'arch-flow-pilot';
const SESSION_ROW_ID = process.env.WA_SESSION_NAME || SESSION_NAME;

function log(message, fields) {
  // Never log message bodies, phone numbers or session data.
  const line = fields ? `${message} ${JSON.stringify(fields)}` : message;
  console.log(`[whatsapp-web] ${new Date().toISOString()} ${line}`);
}

/**
 * The main component. Returns { start, stop, isConnected } and keeps the WhatsApp session,
 * the runtime and the send loop together. Dependencies can be replaced in tests.
 */
function createWhatsAppWeb(options) {
  const {
    db,
    appUrl,
    sessionKey,
    chromiumPath,
    dataPath,
    flushSeconds = 15,
    repository = createSupabaseRepository(db),
    ClientClass = Client,
    RemoteAuthClass = RemoteAuth,
    qr = qrcode,
  } = options;

  let ready = false;
  let flushTimer = null;
  let flushing = false;

  const store = createSessionStore({ repository, sessionKey });
  const client = new ClientClass({
    authStrategy: new RemoteAuthClass({
      clientId: SESSION_ROW_ID,
      dataPath,
      store,
      backupSyncIntervalMs: 300_000,
    }),
    puppeteer: {
      headless: true,
      executablePath: chromiumPath || undefined,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    },
  });

  const transport = {
    isConnected: () => ready,
    async send(phoneE164, text) {
      if (!ready) throw new Error('WhatsApp Web is not connected');
      const chatId = `${phoneE164.replace(/\D/g, '')}@c.us`;
      const sent = await client.sendMessage(chatId, text);
      return { messageId: sent.id.id };
    },
  };

  const runtime = createRuntime(db, { appUrl, transport, sendFromThisProcess: true });

  client.on('qr', (code) => {
    log('Scan this QR code with the test number: WhatsApp > Linked devices > Link a device.');
    qr.generate(code, { small: true });
  });
  client.on('authenticated', () => log('Session authenticated'));
  client.on('remote_session_saved', () => log('Encrypted session saved'));
  client.on('ready', () => {
    ready = true;
    log('WhatsApp connected');
  });
  client.on('auth_failure', (message) => {
    ready = false;
    log('Authentication failed. Delete the stored session row and scan again.', { message });
  });
  client.on('disconnected', (reason) => {
    ready = false;
    log('Disconnected. Exiting so the process supervisor restarts it.', { reason });
    stop().finally(() => process.exit(1));
  });
  client.on('message', async (message) => {
    if (message.fromMe || message.from.endsWith('@g.us')) return;
    const fromPhone = '+' + message.from.replace('@c.us', '');
    try {
      await runtime.handleInboundMessage({ fromPhone, body: message.body, messageId: message.id.id });
    } catch (error) {
      log('Inbound handling failed', { error: error instanceof Error ? error.message : String(error) });
    }
  });

  async function flushOnce() {
    if (flushing || !ready) return;
    flushing = true;
    try {
      const result = await runtime.flush();
      if (result.sent || result.failed) log('Outbox pass', result);
    } catch (error) {
      log('Outbox pass failed', { error: error instanceof Error ? error.message : String(error) });
    } finally {
      flushing = false;
    }
  }

  async function start() {
    await client.initialize();
    flushTimer = setInterval(flushOnce, flushSeconds * 1000);
  }

  async function stop() {
    if (flushTimer) clearInterval(flushTimer);
    flushTimer = null;
    try {
      await client.destroy();
    } catch {
      // Already closed.
    }
  }

  return { start, stop, isConnected: () => ready, runtime };
}

function loadConfig(env = process.env) {
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'WA_SESSION_KEY', 'APP_URL'];
  const missing = required.filter((name) => !env[name]);
  if (missing.length > 0) throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  return {
    supabaseUrl: env.SUPABASE_URL,
    serviceKey: env.SUPABASE_SERVICE_ROLE_KEY,
    sessionKey: env.WA_SESSION_KEY,
    appUrl: env.APP_URL.replace(/\/$/, ''),
    chromiumPath: env.WA_CHROMIUM_PATH || undefined,
    flushSeconds: Number(env.WA_FLUSH_SECONDS || 15),
  };
}

async function main() {
  const config = loadConfig();
  const db = createClient(config.supabaseUrl, config.serviceKey, { auth: { persistSession: false } });
  // RemoteAuth needs a scratch folder for the zip. It is private and removed on exit.
  const dataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'arch-flow-wa-'), { mode: 0o700 });
  const app = createWhatsAppWeb({ db, ...config, dataPath });
  const cleanup = async () => {
    await app.stop();
    fs.rmSync(dataPath, { recursive: true, force: true });
    process.exit(0);
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  await app.start();
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[whatsapp-web] Failed to start:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
}

module.exports = { createWhatsAppWeb, loadConfig };
