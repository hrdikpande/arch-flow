/**
 * Who may view a drawing file, and the links for it. Used by the portal and the clash pages, so the
 * rules live in one place (portal: issued or superseded revisions only, NDA flag for CAD, FIL-06 for download).
 */

import { adminDb } from './supabase/admin';
import { CAD_FORMATS } from './aps';
import type { Access } from './access';
import { canSee } from './access';

export interface DrawingFile {
  id: string;
  project_id: string;
  original_name: string;
  format: string;
  storage_path: string;
  aps_status: string | null;
  aps_error: string | null;
  revision_status: string | null;
}

export interface DrawingView {
  file: DrawingFile;
  isCad: boolean;
  /** Short-lived link for PDF viewing (inline). */
  pdfUrl: string | null;
  /** Short-lived download link, only when allowed. */
  downloadUrl: string | null;
  /** CAD viewing allowed for this viewer (portal: NDA flag). */
  cadAllowed: boolean;
  cadBlockedReason: string | null;
}

const FILE_SELECT = 'id, project_id, original_name, format, storage_path, aps_status, aps_error, revisions:revision_id(status)';

async function toView(row: Record<string, unknown>, cadAllowed: boolean, cadBlockedReason: string | null, allowDownload: boolean): Promise<DrawingView> {
  const revision = row.revisions as unknown as { status: string } | null;
  const file: DrawingFile = {
    id: row.id as string,
    project_id: row.project_id as string,
    original_name: row.original_name as string,
    format: row.format as string,
    storage_path: row.storage_path as string,
    aps_status: (row.aps_status as string | null) ?? null,
    aps_error: (row.aps_error as string | null) ?? null,
    revision_status: revision?.status ?? null,
  };
  const db = adminDb();
  const isCad = (CAD_FORMATS as readonly string[]).includes(file.format);
  let pdfUrl: string | null = null;
  let downloadUrl: string | null = null;
  if (file.format === 'pdf') {
    const { data } = await db.storage.from('drawings').createSignedUrl(file.storage_path, 300);
    pdfUrl = data?.signedUrl ?? null;
  }
  if (allowDownload) {
    const { data: dl } = await db.storage.from('drawings').createSignedUrl(file.storage_path, 300, { download: file.original_name });
    downloadUrl = dl?.signedUrl ?? null;
  }
  return { file, isCad, pdfUrl, downloadUrl, cadAllowed, cadBlockedReason };
}

/** Internal users: any file of a project they can see. CAD is always viewable for them. */
export async function internalDrawingView(access: Access, fileId: string): Promise<DrawingView | null> {
  const { data: row } = await adminDb().from('files').select(FILE_SELECT).eq('id', fileId).maybeSingle();
  if (!row || !canSee(access, row.project_id as string)) return null;
  return toView(row as unknown as Record<string, unknown>, true, null, true);
}

/**
 * Client users: only issued or superseded revisions of their own organisation's projects.
 * CAD viewing needs the organisation's NDA flag (allow_aps_processing). Download needs allow_native_download.
 */
export async function portalDrawingView(access: Access, fileId: string): Promise<DrawingView | null> {
  if (!access.isClient || !access.clientOrgId) return null;
  const db = adminDb();
  const { data: row } = await db.from('files').select(`${FILE_SELECT}, projects:project_id(client_org_id)`).eq('id', fileId).maybeSingle();
  if (!row) return null;
  const projectOrg = (row.projects as unknown as { client_org_id: string | null } | null)?.client_org_id ?? null;
  if (projectOrg !== access.clientOrgId || !access.projectRoles.has(row.project_id as string)) return null;
  const revision = row.revisions as unknown as { status: string } | null;
  if (!revision || !['issued', 'superseded'].includes(revision.status)) return null;

  const { data: org } = await db.from('client_orgs').select('allow_aps_processing, allow_native_download').eq('id', access.clientOrgId).maybeSingle();
  const cadAllowed = Boolean(org?.allow_aps_processing);
  const cadBlockedReason = cadAllowed ? null : 'Your organisation has not allowed CAD viewing. PDF drawings can still be viewed.';
  return toView(row as unknown as Record<string, unknown>, cadAllowed, cadBlockedReason, Boolean(org?.allow_native_download));
}
