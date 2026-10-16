import { adminDb } from '@/lib/supabase/admin';
import { messagingStatus } from '@/lib/messaging';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Reports which integrations are configured and whether the database answers. Never returns secret values. */
export async function GET() {
  let database = 'ok';
  try {
    const { error } = await adminDb().from('settings').select('key', { count: 'exact', head: true }).limit(1);
    if (error) database = 'error';
  } catch {
    database = 'unreachable';
  }
  const messaging = messagingStatus();
  return Response.json({
    ok: database === 'ok',
    database,
    whatsapp: messaging.mode === 'off' ? 'off (set MESSAGING_TRANSPORT)' : messaging.mode === 'web' ? 'web session process sends' : messaging.sending ? 'cloud configured' : `cloud missing: ${messaging.missing.join(', ')}`,
    gemini: messaging.gemini ? 'configured' : 'off',
    autodesk: process.env.APS_CLIENT_ID && process.env.APS_CLIENT_SECRET ? 'configured' : 'off',
    time: new Date().toISOString(),
  });
}
