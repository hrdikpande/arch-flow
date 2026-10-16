/**
 * whatsapp-web.js transport (pilot only, decision 3). Uses a headless Chromium
 * session linked by QR code to a dedicated test number. Not for client data.
 * The adapter is behind the Transport port so the Cloud API can replace it later.
 */

import { Client, LocalAuth, Message } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import type { Transport } from './ports';

export interface WwebjsOptions {
  sessionPath: string;
  chromiumPath?: string;
  onInbound: (message: { fromPhone: string; body: string; messageId: string }) => Promise<void>;
  log: (message: string, fields?: Record<string, unknown>) => void;
}

export interface WwebjsTransport extends Transport {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export function createWwebjsTransport(options: WwebjsOptions): WwebjsTransport {
  let ready = false;
  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: options.sessionPath }),
    puppeteer: {
      headless: true,
      executablePath: options.chromiumPath,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    },
  });

  client.on('qr', (qr: string) => {
    options.log('QR code shown below. Scan it with the test number, Linked devices.');
    qrcode.generate(qr, { small: true });
  });
  client.on('ready', () => {
    ready = true;
    options.log('WhatsApp connected');
  });
  client.on('authenticated', () => options.log('WhatsApp session authenticated'));
  client.on('auth_failure', (message: string) => {
    ready = false;
    options.log('WhatsApp authentication failed', { message });
  });
  client.on('disconnected', (reason: string) => {
    ready = false;
    options.log('WhatsApp disconnected', { reason });
  });
  client.on('message', async (message: Message) => {
    if (message.fromMe || message.from.endsWith('@g.us')) return;
    const fromPhone = '+' + message.from.replace('@c.us', '');
    await options.onInbound({ fromPhone, body: message.body, messageId: message.id.id });
  });

  return {
    isConnected: () => ready,
    async send(phoneE164: string, text: string): Promise<{ messageId: string }> {
      if (!ready) throw new Error('WhatsApp is not connected');
      const chatId = `${phoneE164.replace(/\D/g, '')}@c.us`;
      const sent = await client.sendMessage(chatId, text);
      return { messageId: sent.id.id };
    },
    async start(): Promise<void> {
      await client.initialize();
    },
    async stop(): Promise<void> {
      await client.destroy();
    },
  };
}
