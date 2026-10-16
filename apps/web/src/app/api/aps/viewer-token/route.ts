import { currentAccess, canSee } from '@/lib/access';
import { adminDb } from '@/lib/supabase/admin';
import { apsConfig, viewerToken } from '@/lib/aps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Viewer token for the browser: read-only and short-lived. Internal users see files of their projects.
 * Clients see issued files only, and only when their organisation allows Autodesk processing (NDA, NDA-03).
 */
export async function GET(request: Request) {
  const fileId = new URL(request.url).searchParams.get('fileId') ?? '';
  const access = await currentAccess();
  if (!access) return Response.json({ error: 'sign in required' }, { status: 401 });
  const db = adminDb();
  const { data: file } = await db
    .from('files')
    .select('id, project_id, format, aps_urn, aps_status, revision_id, revisions:revision_id(status), projects(client_org_id)')
    .eq('id', fileId)
    .maybeSingle();
  if (!file || !file.aps_urn || file.aps_status !== 'success') return Response.json({ error: 'not available' }, { status: 404 });

  if (access.isClient) {
    const revision = file.revisions as unknown as { status: string } | null;
    const projectOrg = (file.projects as unknown as { client_org_id: string | null } | null)?.client_org_id;
    if (!access.isClient || !access.projectRoles.has(file.project_id) || projectOrg !== access.clientOrgId) {
      return Response.json({ error: 'not available' }, { status: 404 });
    }
    if (!revision || !['issued', 'superseded'].includes(revision.status)) return Response.json({ error: 'not available' }, { status: 404 });
    const { data: org } = await db.from('client_orgs').select('allow_aps_processing').eq('id', access.clientOrgId ?? '').maybeSingle();
    if (!org?.allow_aps_processing) return Response.json({ error: 'viewing is not permitted for this client' }, { status: 403 });
  } else if (!canSee(access, file.project_id)) {
    return Response.json({ error: 'not available' }, { status: 404 });
  }

  const config = apsConfig();
  if (!config) return Response.json({ error: 'Autodesk viewing is not configured' }, { status: 503 });
  const token = await viewerToken(config);
  return Response.json({ access_token: token.access_token, expires_in: token.expires_in, urn: file.aps_urn });
}

