'use server';

import { revalidatePath } from 'next/cache';
import { adminDb } from '@/lib/supabase/admin';
import { assertProjectRole, canSee, requireInternal } from '@/lib/access';
import { writeAudit } from '@/lib/audit';
import { apsConfig, apsObjectKey, beginSignedUpload, CAD_FORMATS, completeSignedUpload, encodeUrn, ensureBucket, getApsToken, startTranslation, translationStatus, type ApsConfig } from '@/lib/aps';
import { errorState, type FormState } from './types';

const PART_BYTES = 25 * 1024 * 1024;
const SCOPES_WRITE = ['data:read', 'data:write', 'data:create', 'bucket:create', 'bucket:read'];

async function fileForUser(fileId: string) {
  const access = await requireInternal();
  const { data: file } = await adminDb()
    .from('files')
    .select('id, project_id, original_name, format, size_bytes, aps_status, aps_urn, translation_attempts, storage_path, projects(code)')
    .eq('id', fileId)
    .maybeSingle();
  if (!file) throw new Error('File not found.');
  assertProjectRole(access, file.project_id, ['project_head', 'discipline_lead', 'drafter', 'checker']);
  return { access, file, projectCode: (file.projects as unknown as { code: string }).code };
}

function configOrThrow(): ApsConfig {
  const config = apsConfig();
  if (!config) throw new Error('Autodesk viewing is not configured. The admin must set the APS variables.');
  return config;
}

/**
 * Step 1 of the Autodesk upload for a CAD file. Returns part URLs for the browser to upload
 * straight to Autodesk storage. Large files are split into parts.
 */
export async function startApsUpload(fileId: string): Promise<{ uploadKey: string; urls: string[]; bucket: string; objectKey: string } | { error: string }> {
  try {
    const { file, projectCode } = await fileForUser(fileId);
    if (!(CAD_FORMATS as readonly string[]).includes(file.format)) throw new Error('Only DWG, RVT, IFC and NWD files are sent to Autodesk.');
    const config = configOrThrow();
    const { access_token } = await getApsToken(config, SCOPES_WRITE);
    await ensureBucket(access_token, config.bucketKey);
    const objectKey = apsObjectKey(projectCode, file.id, file.original_name);
    const parts = Math.max(1, Math.ceil(Number(file.size_bytes) / PART_BYTES));
    const plan = await beginSignedUpload(access_token, config.bucketKey, objectKey, parts);
    if (!plan.uploadKey || plan.urls.length === 0) throw new Error('Autodesk did not return an upload plan.');
    await adminDb().from('files').update({ aps_status: 'uploading', aps_error: null }).eq('id', file.id);
    return { uploadKey: plan.uploadKey, urls: plan.urls, bucket: config.bucketKey, objectKey };
  } catch (error) {
    await adminDb().from('files').update({ aps_status: 'failed', aps_error: error instanceof Error ? error.message : 'upload failed' }).eq('id', fileId);
    return { error: error instanceof Error ? error.message : 'Could not start the Autodesk upload.' };
  }
}

/** Step 2: complete the upload and start translation. The URN is stored for the viewer. */
export async function completeApsUpload(fileId: string, uploadKey: string): Promise<FormState> {
  try {
    const { access, file, projectCode } = await fileForUser(fileId);
    const config = configOrThrow();
    const { access_token } = await getApsToken(config, SCOPES_WRITE);
    const objectKey = apsObjectKey(projectCode, file.id, file.original_name);
    const { objectId } = await completeSignedUpload(access_token, config.bucketKey, objectKey, uploadKey);
    const urn = encodeUrn(config.bucketKey, objectKey);
    await startTranslation(access_token, urn);
    await adminDb().from('files').update({ aps_object_id: objectId, aps_urn: urn, aps_status: 'translating', aps_error: null, translation_attempts: 1, aps_checked_at: new Date().toISOString() }).eq('id', file.id);
    await writeAudit({ actorId: access.userId, action: 'file.translation_started', entityType: 'file', entityId: file.id, projectId: file.project_id });
    revalidatePath(`/projects/${projectCode}`);
  } catch (error) {
    await adminDb().from('files').update({ aps_status: 'failed', aps_error: error instanceof Error ? error.message : 'translation failed' }).eq('id', fileId);
    return errorState(error);
  }
  return { ok: 'Uploaded to Autodesk. Translation has started.' };
}

/** Reads the translation status and stores it (VIEW-03). Called from the file page and the daily pass. */
export async function refreshTranslation(_prev: FormState, form: FormData): Promise<FormState> {
  const fileId = String(form.get('fileId') ?? '');
  try {
    const { file } = await fileForUser(fileId);
    if (!file.aps_status || !['translating', 'uploading'].includes(file.aps_status)) return { ok: 'Nothing to refresh.' };
    const { data: row } = await adminDb().from('files').select('aps_urn').eq('id', file.id).maybeSingle();
    if (!row?.aps_urn) throw new Error('This file has not been sent to Autodesk yet.');
    const config = configOrThrow();
    const { access_token } = await getApsToken(config, ['data:read']);
    const status = await translationStatus(access_token, row.aps_urn);
    const next = status.state === 'translating' ? 'translating' : status.state === 'success' ? 'success' : 'failed';
    await adminDb().from('files').update({ aps_status: next, aps_error: status.error, aps_checked_at: new Date().toISOString() }).eq('id', file.id);
    revalidatePath('/dashboard');
  } catch (error) {
    return errorState(error);
  }
  return { ok: 'Status updated.' };
}

/** Retry a failed translation of a file already in Autodesk storage. Three attempts in total (VIEW-03). */
export async function retryTranslation(_prev: FormState, form: FormData): Promise<FormState> {
  const fileId = String(form.get('fileId') ?? '');
  try {
    const { access, file, projectCode } = await fileForUser(fileId);
    if (file.aps_status !== 'failed' || !file.aps_urn) throw new Error('Only a failed translation can be retried.');
    if ((file.translation_attempts ?? 0) >= 3) throw new Error('Three attempts used. Ask the firm to check the source file, then upload a corrected file.');
    const config = configOrThrow();
    const { access_token } = await getApsToken(config, SCOPES_WRITE);
    await startTranslation(access_token, file.aps_urn, fetch, { force: true });
    await adminDb().from('files').update({ aps_status: 'translating', aps_error: null, translation_attempts: (file.translation_attempts ?? 0) + 1, aps_checked_at: new Date().toISOString() }).eq('id', file.id);
    await writeAudit({ actorId: access.userId, action: 'file.translation_retried', entityType: 'file', entityId: file.id, projectId: file.project_id });
    revalidatePath(`/projects/${projectCode}`);
  } catch (error) {
    return errorState(error);
  }
  return { ok: 'Translation restarted.' };
}
