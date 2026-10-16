/**
 * Runtime wiring for the Vercel functions: one place that builds the adapters, the
 * WhatsApp Cloud transport, the optional Gemini summariser and the scheduled pass.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseAdapter } from './supabase-adapter';
import { createCloudTransport } from './transport-cloud';
import { createGeminiSummariser, type Summariser } from './gemini';
import { createChecksPort } from './jobs/checks-adapter';
import { fanoutOnce, type FanoutDeps } from './jobs/fanout';
import { processOutboxOnce, type OutboxDeps } from './jobs/outbox';
import { handleInbound } from './jobs/inbound';
import { runTick, type TickSummary } from './tick';
import { parseWebhook } from './webhook';
import type { Clock, Transport } from './ports';

export interface RuntimeConfig {
  appUrl: string;
  /** Cloud API settings. Omit when another transport is used. */
  cloud?: {
    phoneNumberId: string;
    accessToken: string;
    graphVersion: string;
    templateName: string;
    templateLanguage: string;
  };
  /** Overrides the Cloud API transport, for example the WhatsApp Web session process. */
  transport?: Transport;
  /**
   * False when another process sends the queue (the WhatsApp Web process). This runtime then
   * only creates and fans out messages, so nothing is sent twice.
   */
  sendFromThisProcess?: boolean;
  geminiApiKey?: string;
  geminiModel?: string;
}

export interface Runtime {
  transport: Transport;
  /** The daily pass (also safe to run more often): checks, fan-out, digests, escalations, outbox. */
  tick(): Promise<TickSummary>;
  /** Sends whatever is queued now (called right after events, so alerts do not wait for the cron). */
  flush(): Promise<{ sent: number; failed: number; held: number; cancelled: number; waiting: number }>;
  /** Handles one Cloud API webhook payload: inbound messages (commands) and delivery statuses. */
  handleWebhook(rawBody: string): Promise<{ messages: number; statuses: number }>;
  /** Handles one inbound message from any transport (owner commands, STOP and START). */
  handleInboundMessage(message: { fromPhone: string; body: string; messageId: string }): Promise<void>;
}

const NO_TRANSPORT: Transport = {
  isConnected: () => false,
  send: async () => {
    throw new Error('No WhatsApp transport is configured in this process');
  },
};

export function createRuntime(db: SupabaseClient, config: RuntimeConfig, clock: Clock = { now: () => new Date() }): Runtime {
  const adapter = new SupabaseAdapter(db);
  const sendFromThisProcess = config.sendFromThisProcess !== false;
  const transport: Transport =
    config.transport ??
    (config.cloud
      ? createCloudTransport({
          phoneNumberId: config.cloud.phoneNumberId,
          accessToken: config.cloud.accessToken,
          graphVersion: config.cloud.graphVersion,
          templateName: config.cloud.templateName,
          templateLanguage: config.cloud.templateLanguage,
          isWindowOpen: (phone) => adapter.isWindowOpen(phone),
        })
      : NO_TRANSPORT);
  const summariser: Summariser | null =
    config.geminiApiKey && config.geminiModel ? createGeminiSummariser(config.geminiApiKey, config.geminiModel) : null;
  const checks = createChecksPort(db);
  const fanout: FanoutDeps = {
    fanout: adapter,
    clock,
    appUrl: config.appUrl,
    enabledEventTypes: () => adapter.enabledEventTypes(),
  };
  const outbox: OutboxDeps = { outbox: adapter, transport, clock };
  const outboxForTick = sendFromThisProcess ? outbox : null;
  const schedule = { store: adapter, clock, appUrl: config.appUrl, digestSource: adapter, summariser };

  return {
    transport,
    tick: () => runTick({ clock, fanout, outbox: outboxForTick, schedule, checks }),
    async flush() {
      await fanoutOnce(fanout);
      if (!sendFromThisProcess) return { sent: 0, failed: 0, held: 0, cancelled: 0, waiting: 0 };
      const result = await processOutboxOnce(outbox);
      return { sent: result.sent, failed: result.failed, held: result.held, cancelled: result.cancelled, waiting: result.waiting };
    },
    async handleWebhook(rawBody: string) {
      const parsed = parseWebhook(rawBody);
      for (const message of parsed.messages) {
        await adapter.recordInbound(message);
        await handleInbound({ inbound: adapter, clock }, message);
      }
      for (const status of parsed.statuses) {
        await adapter.applyDeliveryStatus(status.messageId, status.status, status.error);
      }
      return { messages: parsed.messages.length, statuses: parsed.statuses.length };
    },
    async handleInboundMessage(message) {
      await adapter.recordInbound(message);
      await handleInbound({ inbound: adapter, clock }, message);
    },
  };
}
