import { messagingRuntime } from '@/lib/messaging';
import { secretsMatch } from '@/lib/secrets';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * Scheduled pass: RFI and stale-revision checks, digests, escalations, conflict notices,
 * and the outbox. Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request) {
  const presented = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null;
  if (!secretsMatch(presented, process.env.CRON_SECRET)) {
    return Response.json({ ok: false, error: 'unauthorised' }, { status: 401 });
  }
  try {
    const summary = await messagingRuntime().tick();
    return Response.json({ ok: true, summary });
  } catch (error) {
    console.error('cron tick failed', error instanceof Error ? error.message : error);
    return Response.json({ ok: false, error: 'tick failed; see server logs' }, { status: 500 });
  }
}
