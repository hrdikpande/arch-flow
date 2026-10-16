/**
 * Connects the web app to the messaging runtime. Configuration is read from environment
 * variables per request, so a missing key produces a clear status instead of a crash at build time.
 *
 * MESSAGING_TRANSPORT selects who sends:
 *  - "web":   the WhatsApp Web process (apps/whatsapp-web) sends. This app only queues and fans out.
 *  - "cloud": this app sends through the WhatsApp Cloud API.
 *  - unset:   nothing is sent. Events still create messages in the outbox.
 */

import { createRuntime, type Runtime } from '@arch-flow/messaging';
import { adminDb } from './supabase/admin';

export type MessagingMode = 'web' | 'cloud' | 'off';

export interface MessagingStatus {
  mode: MessagingMode;
  /** True when this app sends (cloud) or when the web process will send (web). */
  sending: boolean;
  whatsappCloud: boolean;
  gemini: boolean;
  missing: string[];
}

const CLOUD_VARIABLES = ['WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_APP_SECRET', 'WHATSAPP_VERIFY_TOKEN'];

export function messagingStatus(env: NodeJS.ProcessEnv = process.env): MessagingStatus {
  const missing = CLOUD_VARIABLES.filter((name) => !env[name]);
  const cloudConfigured = missing.length === 0;
  const mode: MessagingMode = env.MESSAGING_TRANSPORT === 'web' ? 'web' : env.MESSAGING_TRANSPORT === 'cloud' ? 'cloud' : 'off';
  return {
    mode,
    sending: mode === 'web' || (mode === 'cloud' && cloudConfigured),
    whatsappCloud: cloudConfigured,
    gemini: Boolean(env.GEMINI_API_KEY && env.GEMINI_MODEL),
    missing: mode === 'cloud' ? missing : [],
  };
}

export function messagingRuntime(env: NodeJS.ProcessEnv = process.env): Runtime {
  const status = messagingStatus(env);
  const geminiApiKey = env.GEMINI_API_KEY;
  const geminiModel = env.GEMINI_MODEL;
  const appUrl = (env.APP_URL ?? '').replace(/\/$/, '');
  if (status.mode === 'web') {
    // Queue-only: the WhatsApp Web process sends from the outbox.
    return createRuntime(adminDb(), { appUrl, sendFromThisProcess: false, geminiApiKey, geminiModel });
  }
  if (status.mode !== 'cloud' || !status.whatsappCloud) {
    throw new Error(`WhatsApp sending is not configured. Set MESSAGING_TRANSPORT to "web" or "cloud". Missing: ${status.missing.join(', ') || 'MESSAGING_TRANSPORT'}`);
  }
  return createRuntime(adminDb(), {
    appUrl,
    cloud: {
      phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID as string,
      accessToken: env.WHATSAPP_ACCESS_TOKEN as string,
      graphVersion: env.WHATSAPP_GRAPH_VERSION ?? 'v21.0',
      templateName: env.WHATSAPP_TEMPLATE_NAME ?? 'arch_flow_update',
      templateLanguage: env.WHATSAPP_TEMPLATE_LANGUAGE ?? 'en',
    },
    geminiApiKey,
    geminiModel,
  });
}
