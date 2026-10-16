import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireClient } from '@/lib/access';
import { adminDb } from '@/lib/supabase/admin';
import { ConflictThread, type ThreadMessage } from '@/components/conflicts/ConflictThread';
import { PageHeader, Badge } from '@/components/ds';
import { formatIst } from '@/lib/format';

export default async function PortalConflictPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireClient();
  const { id } = await params;
  const db = adminDb();
  const { data: conflict } = await db.from('conflicts').select('id, subject, status, due_at, client_org_id').eq('id', id).maybeSingle();
  if (!conflict || conflict.client_org_id !== access.clientOrgId) notFound();
  const { data: rows } = await db.from('conflict_messages').select('id, body, created_at, profiles(full_name, client_org_id)').eq('conflict_id', id).order('created_at');
  const messages: ThreadMessage[] = (rows ?? []).map((r) => {
    const profile = r.profiles as unknown as { full_name: string; client_org_id: string | null } | null;
    return { id: r.id, body: r.body, created_at: r.created_at, authorName: profile?.full_name ?? 'Firm', authorIsClient: Boolean(profile?.client_org_id) };
  });
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow={`Reply by ${formatIst(conflict.due_at)}`} title={conflict.subject} actions={<Link href="/portal" className="text-sm font-semibold text-brand-700 underline">Back to drawings</Link>} />
      <Badge tone={conflict.status === 'closed' ? 'neutral' : 'info'}>{conflict.status}</Badge>
      <ConflictThread conflictId={id} messages={messages} closed={conflict.status === 'closed'} canClose={false} />
    </div>
  );
}
