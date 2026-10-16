/**
 * Connects the web app to the messaging runtime. Configuration is read from environment
 * variables per request, so a missing key produces a clear status instead of a crash at build time.
 */

import { createRuntime, type Runtime } from '@arch-flow/messaging';
import { adminDb } from './supabase/admin';

export interface MessagingStatus {
  whatsappCloud: boolean;
  gemini: boolean;
  missing: string[];
}

export function messagingStatus(env: NodeJS.ProcessEnv = process.env): MessagingStatus {
  const missing: string[] = [];
  for (const name of ['WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_APP_SECRET', 'WHATSAPP_VERIFY_TOKEN']) {
    if (!env[name]) missing.push(name);
  }
  return {
    whatsappCloud: missing.length === 0,
    gemini: Boolean(env.GEMINI_API_KEY && env.GEMINI_MODEL),
    missing,
  };
}

export function messagingRuntime(env: NodeJS.ProcessEnv = process.env): Runtime {
  const status = messagingStatus(env);
  if (!status.whatsappCloud) throw new Error(`WhatsApp is not configured. Missing: ${status.missing.join(', ')}`);
  return createRuntime(adminDb(), {
    appUrl: (env.APP_URL ?? '').replace(/\/$/, ''),
    cloud: {
      phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID as string,
      accessToken: env.WHATSAPP_ACCESS_TOKEN as string,
      graphVersion: env.WHATSAPP_GRAPH_VERSION ?? 'v21.0',
      templateName: env.WHATSAPP_TEMPLATE_NAME ?? 'arch_flow_update',
      templateLanguage: env.WHATSAPP_TEMPLATE_LANGUAGE ?? 'en',
    },
    geminiApiKey: env.GEMINI_API_KEY,
    geminiModel: env.GEMINI_MODEL,
  });
}
