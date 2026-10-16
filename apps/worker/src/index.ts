/**
 * Worker entry point. Runs the outbox sender, event fan-out, scheduled jobs and
 * the WhatsApp connection in one process, with a small health endpoint.
 */

import http from 'node:http';
import { loadConfig } from './config';
import { createGeminiSummariser } from './gemini';
import { fanoutOnce } from './jobs/fanout';
import { handleInbound } from './jobs/inbound';
import { processOutboxOnce } from './jobs/outbox';
import { runConflictOverdue, runEscalations, runScheduledDigests } from './jobs/schedule';
import { createServiceClient, SupabaseAdapter } from './supabase-adapter';
import { createWwebjsTransport, WwebjsTransport } from './transport-wwebjs';
import type { Clock } from './ports';

const VERSION = '0.1.0';
const HOUR_MS = 60 * 60_000;

function log(message: string, fields?: Record<string, unknown>): void {
  process.stdout.write(JSON.stringify({ t: new Date().toISOString(), msg: message, ...fields }) + '\n');
}

async function main(): Promise<void> {
  const config = loadConfig();
  const db = createServiceClient(config.supabaseUrl, config.serviceRoleKey);
  const adapter = new SupabaseAdapter(db);
  const clock: Clock = { now: () => new Date() };
  const summariser = config.geminiApiKey && config.geminiModel
    ? createGeminiSummariser(config.geminiApiKey, config.geminiModel)
    : null;

  let transport: WwebjsTransport | null = null;
  const disconnectedTransport = { isConnected: () => false, send: async () => { throw new Error('WhatsApp disabled'); } };

  const scheduleDeps = { store: adapter, clock, appUrl: config.appUrl, digestSource: adapter, summariser };

  const sendPort = {
    isConnected: () => transport?.isConnected() ?? false,
    send: (phone: string, text: string) => (transport ?? disconnectedTransport).send(phone, text),
  };

  let lastRun = { fanout: '', outbox: '', schedule: '', error: '' };

  const tick = async (name: string, work: () => Promise<unknown>): Promise<void> => {
    try {
      await work();
    } catch (error) {
      lastRun.error = `${name}: ${error instanceof Error ? error.message : String(error)}`;
      log('job failed', { job: name, error: lastRun.error });
    }
  };

  if (config.enableWhatsapp) {
    transport = createWwebjsTransport({
      sessionPath: config.sessionPath,
      chromiumPath: config.chromiumPath,
      log,
      onInbound: (message) =>
        handleInbound({ inbound: adapter, clock }, message).catch((error) =>
          log('inbound failed', { error: String(error) }),
        ),
    });
    void transport.start().catch((error) => log('transport failed to start', { error: String(error) }));
  }

  setInterval(() => {
    void tick('fanout', async () => {
      lastRun.fanout = clock.now().toISOString();
      await fanoutOnce({ fanout: adapter, clock, appUrl: config.appUrl, enabledEventTypes: () => adapter.enabledEventTypes() });
    });
    void tick('outbox', async () => {
      lastRun.outbox = clock.now().toISOString();
      await processOutboxOnce({ outbox: adapter, transport: sendPort, clock, log });
    });
  }, 10_000);

  setInterval(() => {
    void tick('heartbeat', () => adapter.heartbeat(sendPort.isConnected(), VERSION));
    void tick('digest', async () => {
      lastRun.schedule = clock.now().toISOString();
      await runScheduledDigests(scheduleDeps);
    });
  }, 60_000);

  setInterval(() => {
    void tick('escalations', () => runEscalations(scheduleDeps));
    void tick('conflicts', () => runConflictOverdue(scheduleDeps));
  }, HOUR_MS);

  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      const body = JSON.stringify({ ok: true, version: VERSION, whatsappConnected: sendPort.isConnected(), lastRun });
      res.writeHead(200, { 'content-type': 'application/json' }).end(body);
      return;
    }
    res.writeHead(404).end();
  });
  server.listen(config.httpPort, () => log('worker started', { port: config.httpPort, version: VERSION }));
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
