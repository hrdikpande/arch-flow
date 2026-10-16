import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildCloudBody, createCloudTransport, fitTemplateParam, TEMPLATE_PARAM_MAX } from '../src/transport-cloud';
import { parseWebhook, verifyHandshake, verifySignature } from '../src/webhook';

const template = { name: 'arch_flow_update', language: 'en' };

describe('Cloud API message bodies (Meta 24-hour window rule)', () => {
  it('sends free text inside the 24-hour window', () => {
    const body = buildCloudBody('919000000001', 'Hello', true, template);
    expect(body).toEqual({ messaging_product: 'whatsapp', to: '919000000001', type: 'text', text: { body: 'Hello', preview_url: false } });
  });

  it('uses the approved template outside the window', () => {
    const body = buildCloudBody('919000000001', 'Issued: M-101 R2', false, template) as { type: string; template: { name: string; components: { parameters: { text: string }[] }[] } };
    expect(body.type).toBe('template');
    expect(body.template.name).toBe('arch_flow_update');
    expect(body.template.components[0]?.parameters[0]?.text).toBe('Issued: M-101 R2');
  });

  it('cuts long template parameters at a line boundary', () => {
    const long = Array.from({ length: 200 }, (_, i) => `Line ${i} of the digest text`).join('\n');
    const fitted = fitTemplateParam(long);
    expect(fitted.length).toBeLessThanOrEqual(TEMPLATE_PARAM_MAX);
    expect(fitted.endsWith('See dashboard for the rest.')).toBe(true);
  });

  it('posts to the Graph API and returns the message id', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ messages: [{ id: 'wamid.1' }] }), { status: 200 });
    }) as typeof fetch;
    const transport = createCloudTransport({
      phoneNumberId: '123', accessToken: 't0k', graphVersion: 'v21.0', templateName: template.name, templateLanguage: 'en',
      isWindowOpen: async () => true, fetchImpl,
    });
    const result = await transport.send('+919000000001', 'Hi');
    expect(result.messageId).toBe('wamid.1');
    expect(calls[0]?.url).toBe('https://graph.facebook.com/v21.0/123/messages');
    expect((calls[0]?.init.headers as Record<string, string>).authorization).toBe('Bearer t0k');
  });

  it('reports a Graph API error without the token', async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({ error: { message: 'Template not approved' } }), { status: 400 })) as typeof fetch;
    const transport = createCloudTransport({
      phoneNumberId: '123', accessToken: 't0k', graphVersion: 'v21.0', templateName: template.name, templateLanguage: 'en',
      isWindowOpen: async () => false, fetchImpl,
    });
    await expect(transport.send('+919000000001', 'x')).rejects.toThrow('Template not approved');
  });
});

describe('webhook verification and parsing', () => {
  const secret = 'app-secret';
  const body = JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ from: '919000000001', id: 'wamid.in', type: 'text', text: { body: 'today' } }] } }] }] });
  const signature = 'sha256=' + createHmac('sha256', secret).update(body, 'utf8').digest('hex');

  it('accepts a correct X-Hub-Signature-256 and rejects a wrong one', () => {
    expect(verifySignature(body, signature, secret)).toBe(true);
    expect(verifySignature(body + ' ', signature, secret)).toBe(false);
    expect(verifySignature(body, null, secret)).toBe(false);
  });

  it('answers the subscribe handshake only with the right token', () => {
    expect(verifyHandshake({ mode: 'subscribe', token: 'vt', challenge: '1234' }, 'vt')).toBe('1234');
    expect(verifyHandshake({ mode: 'subscribe', token: 'nope', challenge: '1234' }, 'vt')).toBeNull();
    expect(verifyHandshake({ mode: 'unsubscribe', token: 'vt', challenge: '1' }, 'vt')).toBeNull();
  });

  it('parses inbound messages and delivery statuses', () => {
    const statusBody = JSON.stringify({ entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.out', status: 'failed', errors: [{ title: 'Undeliverable' }] }] } }] }] });
    expect(parseWebhook(body).messages).toEqual([{ fromPhone: '+919000000001', messageId: 'wamid.in', body: 'today' }]);
    expect(parseWebhook(statusBody).statuses).toEqual([{ messageId: 'wamid.out', status: 'failed', error: 'Undeliverable' }]);
  });
});
