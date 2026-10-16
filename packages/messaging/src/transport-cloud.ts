/**
 * WhatsApp Cloud API transport (production, Meta). Runs on Vercel: stateless HTTPS calls.
 * Rules (Meta policy): inside the 24-hour customer-service window a free-text message is allowed;
 * outside it, business-initiated messages must use a pre-approved template. The alert and digest
 * text is sent as one body parameter of a single approved template (see README: WHATSAPP_TEMPLATE_NAME).
 */

import type { Transport } from './ports';

export interface CloudConfig {
  phoneNumberId: string;
  accessToken: string;
  graphVersion: string;
  templateName: string;
  templateLanguage: string;
  /** Returns true when the last inbound message from this number is within 24 hours. */
  isWindowOpen: (phoneE164: string) => Promise<boolean>;
  fetchImpl?: typeof fetch;
}

/** Meta limits a template body parameter to 1024 characters. Longer text is cut at a line boundary. */
export const TEMPLATE_PARAM_MAX = 1000;

export function fitTemplateParam(text: string): string {
  if (text.length <= TEMPLATE_PARAM_MAX) return text;
  const cut = text.slice(0, TEMPLATE_PARAM_MAX - 40);
  const lastBreak = cut.lastIndexOf('\n');
  return `${(lastBreak > 0 ? cut.slice(0, lastBreak) : cut)}\nSee dashboard for the rest.`;
}

export function toMetaNumber(phoneE164: string): string {
  return phoneE164.replace(/\D/g, '');
}

export function buildCloudBody(to: string, text: string, windowOpen: boolean, template: { name: string; language: string }): Record<string, unknown> {
  if (windowOpen) {
    return { messaging_product: 'whatsapp', to, type: 'text', text: { body: text, preview_url: false } };
  }
  return {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: template.name,
      language: { code: template.language },
      components: [{ type: 'body', parameters: [{ type: 'text', text: fitTemplateParam(text) }] }],
    },
  };
}

export function createCloudTransport(config: CloudConfig): Transport {
  const fetchFn = config.fetchImpl ?? fetch;
  return {
    isConnected: () => Boolean(config.phoneNumberId && config.accessToken),
    async send(phoneE164: string, text: string): Promise<{ messageId: string }> {
      const to = toMetaNumber(phoneE164);
      const windowOpen = await config.isWindowOpen(phoneE164);
      const body = buildCloudBody(to, text, windowOpen, { name: config.templateName, language: config.templateLanguage });
      const response = await fetchFn(`https://graph.facebook.com/${config.graphVersion}/${config.phoneNumberId}/messages`, {
        method: 'POST',
        headers: { authorization: `Bearer ${config.accessToken}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string } };
      if (!response.ok || !payload.messages?.[0]?.id) {
        throw new Error(`WhatsApp Cloud API ${response.status}: ${payload.error?.message ?? 'no message id returned'}`);
      }
      return { messageId: payload.messages[0].id };
    },
  };
}
