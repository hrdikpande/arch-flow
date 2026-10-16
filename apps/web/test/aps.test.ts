import { describe, expect, it } from 'vitest';
import { apsObjectKey, beginSignedUpload, encodeUrn, getApsToken, splitParts, startTranslation, translationStatus, uploadParts, apsConfig } from '../src/lib/aps';

const cfg = { clientId: 'id', clientSecret: 'secret', bucketKey: 'arch-flow-drawings' };

describe('APS helpers', () => {
  it('encodes the object URN as unpadded base64url', () => {
    const urn = encodeUrn('arch-flow-drawings', 'NRH/M-101 a?.dwg');
    expect(urn).not.toMatch(/[=+/]/);
    expect(Buffer.from(urn.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')).toBe('urn:adsk.objects:os.object:arch-flow-drawings/NRH/M-101 a?.dwg');
  });

  it('sanitises object keys for URL paths', () => {
    expect(apsObjectKey('NRH-BLR-01', 'f1', 'M 101 final.dwg')).toBe('NRH-BLR-01/f1/M_101_final.dwg');
  });

  it('reads configuration only when all three values are present', () => {
    expect(apsConfig({ APS_CLIENT_ID: 'a', APS_CLIENT_SECRET: 'b' } as unknown as NodeJS.ProcessEnv)).toBeNull();
    expect(apsConfig({ APS_CLIENT_ID: 'a', APS_CLIENT_SECRET: 'b', APS_BUCKET_KEY: 'Arch-Flow' } as unknown as NodeJS.ProcessEnv)).toEqual({ clientId: 'a', clientSecret: 'b', bucketKey: 'arch-flow' });
  });

  it('splits a file into parts that cover every byte once', () => {
    const parts = splitParts(10, 3);
    expect(parts).toEqual([{ start: 0, end: 4 }, { start: 4, end: 8 }, { start: 8, end: 10 }]);
  });
});

describe('APS requests', () => {
  it('requests a read-write token with basic credentials and the scopes asked for', async () => {
    let seen: { url: string; init: RequestInit } | null = null;
    const fetchImpl = (async (url: string, init: RequestInit) => {
      seen = { url, init };
      return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3599 }), { status: 200 });
    }) as typeof fetch;
    const token = await getApsToken(cfg, ['data:read', 'data:write'], fetchImpl);
    expect(token.access_token).toBe('tok');
    expect(seen!.url).toBe('https://developer.api.autodesk.com/authentication/v2/token');
    expect((seen!.init.headers as Record<string, string>).authorization).toBe(`Basic ${Buffer.from('id:secret').toString('base64')}`);
    expect(String(seen!.init.body)).toContain('scope=data%3Aread+data%3Awrite');
  });

  it('uploads each part to its own signed URL', async () => {
    const puts: string[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      puts.push(`${url}:${(init.body as Blob).size}`);
      return new Response('', { status: 200 });
    }) as typeof fetch;
    await uploadParts(new Blob([new Uint8Array(10)]), ['https://s3/1', 'https://s3/2'], fetchImpl);
    expect(puts).toEqual(['https://s3/1:5', 'https://s3/2:5']);
  });

  it('asks for the signed upload plan and returns the upload key', async () => {
    const fetchImpl = (async (url: string) => {
      expect(url).toContain('/signeds3upload?parts=2');
      return new Response(JSON.stringify({ uploadKey: 'k', urls: ['a', 'b'] }), { status: 200 });
    }) as typeof fetch;
    expect(await beginSignedUpload('t', 'arch-flow-drawings', 'P/f/x.dwg', 2, fetchImpl)).toEqual({ uploadKey: 'k', urls: ['a', 'b'] });
  });

  it('starts translation with the SVF2 output', async () => {
    let body = '';
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      body = String(init.body);
      return new Response(JSON.stringify({ result: 'success' }), { status: 200 });
    }) as typeof fetch;
    await startTranslation('t', 'dXJu', fetchImpl);
    expect(JSON.parse(body)).toEqual({ input: { urn: 'dXJu' }, output: { formats: [{ type: 'svf2', views: ['2d', '3d'] }] } });
  });

  it('does not send x-ads-force on a normal start (it deletes existing derivatives)', async () => {
    let headers: Record<string, string> = {};
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      headers = init.headers as Record<string, string>;
      return new Response('{}', { status: 200 });
    }) as typeof fetch;
    await startTranslation('t', 'dXJu', fetchImpl);
    expect(headers['x-ads-force']).toBeUndefined();
    await startTranslation('t', 'dXJu', fetchImpl, { force: true });
    expect(headers['x-ads-force']).toBe('true');
  });

  it('maps the manifest to translating, success or failed', async () => {
    const respond = (payload: unknown) => (async () => new Response(JSON.stringify(payload), { status: 200 })) as typeof fetch;
    expect((await translationStatus('t', 'u', respond({ status: 'inprogress', progress: '40% complete' }))).state).toBe('translating');
    expect((await translationStatus('t', 'u', respond({ status: 'success' }))).state).toBe('success');
    const failed = await translationStatus('t', 'u', respond({ status: 'failed', messages: [{ message: 'Unsupported file' }] }));
    expect(failed).toEqual({ state: 'failed', progress: 'failed', error: 'Unsupported file' });
  });
});
