/**
 * Autodesk Platform Services (APS) client: token, object storage upload, translation and viewer token.
 * Endpoints follow the APS v2 REST API. They have NOT been called against a live account yet:
 * verify each one against the current APS documentation with real credentials before go-live.
 * The client secret stays on the server; the browser only receives a short-lived viewer token.
 */

export const APS_BASE = 'https://developer.api.autodesk.com';
export const CAD_FORMATS = ['dwg', 'rvt', 'ifc', 'nwd'] as const;

export interface ApsConfig {
  clientId: string;
  clientSecret: string;
  bucketKey: string;
}

export function apsConfig(env: NodeJS.ProcessEnv = process.env): ApsConfig | null {
  const clientId = env.APS_CLIENT_ID?.trim();
  const clientSecret = env.APS_CLIENT_SECRET?.trim();
  const bucketKey = (env.APS_BUCKET_KEY ?? '').trim().toLowerCase();
  if (!clientId || !clientSecret || !bucketKey) return null;
  return { clientId, clientSecret, bucketKey };
}

/** Object key for a stored drawing: unique, and safe in a URL path. */
export function apsObjectKey(projectCode: string, fileId: string, fileName: string): string {
  const safe = fileName.replace(/[^A-Za-z0-9._-]/g, '_');
  return `${projectCode}/${fileId}/${safe}`.slice(0, 500);
}

/** URN for a bucket object: base64url of "urn:adsk.objects:os.object:{bucket}/{object}", without padding. */
export function encodeUrn(bucketKey: string, objectKey: string): string {
  return Buffer.from(`urn:adsk.objects:os.object:${bucketKey}/${objectKey}`, 'utf8')
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export { splitParts, uploadParts } from './aps-upload';

type Fetch = typeof fetch;

async function json<T>(response: Response, what: string): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T & { developerMessage?: string; detail?: string; error_description?: string };
  if (!response.ok) {
    const message = body.developerMessage ?? body.detail ?? body.error_description ?? `HTTP ${response.status}`;
    throw new Error(`${what} failed: ${message}`);
  }
  return body;
}

/** Two-legged token for the server (client credentials). Scopes are requested per call. */
export async function getApsToken(config: ApsConfig, scopes: string[], fetchImpl: Fetch = fetch): Promise<{ access_token: string; expires_in: number }> {
  const form = new URLSearchParams({ grant_type: 'client_credentials', scope: scopes.join(' ') });
  const response = await fetchImpl(`${APS_BASE}/authentication/v2/token`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
    },
    body: form.toString(),
  });
  return json(response, 'APS token');
}

/** Creates the storage bucket if it does not exist yet (409 means it already exists). */
export async function ensureBucket(token: string, bucketKey: string, fetchImpl: Fetch = fetch): Promise<void> {
  const response = await fetchImpl(`${APS_BASE}/oss/v2/buckets`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ bucketKey, policyKey: 'persistent' }),
  });
  if (response.status === 409) return;
  await json(response, 'create bucket');
}

export interface SignedUpload {
  uploadKey: string | null;
  urls: string[];
}

/** Step 1 of the signed S3 upload: get one or more part URLs. */
export async function beginSignedUpload(token: string, bucketKey: string, objectKey: string, parts = 1, fetchImpl: Fetch = fetch): Promise<SignedUpload> {
  const url = `${APS_BASE}/oss/v2/buckets/${encodeURIComponent(bucketKey)}/objects/${encodeURIComponent(objectKey)}/signeds3upload?parts=${parts}`;
  const response = await fetchImpl(url, { headers: { authorization: `Bearer ${token}` } });
  const body = await json<{ uploadKey?: string; urls?: string[] }>(response, 'begin upload');
  return { uploadKey: body.uploadKey ?? null, urls: body.urls ?? [] };
}

/** Step 2: complete the upload; APS creates the object and returns its id. */
export async function completeSignedUpload(token: string, bucketKey: string, objectKey: string, uploadKey: string, fetchImpl: Fetch = fetch): Promise<{ objectId: string }> {
  const response = await fetchImpl(`${APS_BASE}/oss/v2/buckets/${encodeURIComponent(bucketKey)}/objects/${encodeURIComponent(objectKey)}/signeds3upload`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ uploadKey }),
  });
  const body = await json<{ objectId?: string }>(response, 'complete upload');
  if (!body.objectId) throw new Error('complete upload failed: no object id returned');
  return { objectId: body.objectId };
}

/** Starts translation to the web viewer format (SVF2, 2D and 3D views). */
export async function startTranslation(token: string, urn: string, fetchImpl: Fetch = fetch): Promise<void> {
  const response = await fetchImpl(`${APS_BASE}/modelderivative/v2/designdata/job`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'x-ads-force': 'true' },
    body: JSON.stringify({ input: { urn }, output: { formats: [{ type: 'svf2', views: ['2d', '3d'] }] } }),
  });
  await json(response, 'start translation');
}

export type TranslationState = 'translating' | 'success' | 'failed';

/** Reads the manifest and maps it to one of three states. */
export async function translationStatus(token: string, urn: string, fetchImpl: Fetch = fetch): Promise<{ state: TranslationState; progress: string; error: string | null }> {
  const response = await fetchImpl(`${APS_BASE}/modelderivative/v2/designdata/${urn}/manifest`, { headers: { authorization: `Bearer ${token}` } });
  if (response.status === 404) return { state: 'translating', progress: 'queued', error: null };
  const body = await json<{ status?: string; progress?: string; messages?: { message?: string }[] }>(response, 'manifest');
  if (body.status === 'success') return { state: 'success', progress: 'complete', error: null };
  if (body.status === 'failed') {
    return { state: 'failed', progress: body.progress ?? 'failed', error: body.messages?.[0]?.message ?? 'translation failed' };
  }
  return { state: 'translating', progress: body.progress ?? 'in progress', error: null };
}

/** Viewer token: read-only, short-lived. Returned to the browser after the access check. */
export async function viewerToken(config: ApsConfig, fetchImpl: Fetch = fetch): Promise<{ access_token: string; expires_in: number }> {
  return getApsToken(config, ['viewables:read'], fetchImpl);
}
