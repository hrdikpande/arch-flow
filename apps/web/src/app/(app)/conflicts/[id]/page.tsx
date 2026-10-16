import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireInternal, hasProjectRole } from '@/lib/access';
import { adminDb } from '@/lib/supabase/admin';
import { ConflictThread, type ThreadMessage } from '@/components/conflicts/ConflictThread';
import { PageHeader, Badge } from '@/components/ds';
import { formatIst } from '@/lib/format';

export default async function InternalConflictPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireInternal();
  const { id } = await params;
  const db = adminDb();
  const { data: conflict } = await db.from('conflicts').select('id, subject, status, due_at, project_id, client_org_id, created_at, projects(code)').eq('id', id).maybeSingle();
  if (!conflict) notFound();
  if (!access.isAdmin && !access.projectRoles.has(conflict.project_id)) notFound();
  const code = (conflict.projects as unknown as { code: string }).code;
  const { data: rows } = await db.from('conflict_messages').select('id, body, created_at, author_id, profiles(full_name, client_org_id)').eq('conflict_id', id).order('created_at');
  const messages: ThreadMessage[] = (rows ?? []).map((r) => {
    const profile = r.profiles as unknown as { full_name: string; client_org_id: string | null } | null;
    return { id: r.id, body: r.body, created_at: r.created_at, authorName: profile?.full_name ?? 'Unknown', authorIsClient: Boolean(profile?.client_org_id) };
  });
  const canClose = access.isAdmin || hasProjectRole(access, conflict.project_id, ['project_head']);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={`${code} · due ${formatIst(conflict.due_at)}`}
        title={conflict.subject}
        description="Reply in the thread. The client sees every message."
        actions={<Link href="/conflicts" className="text-sm font-semibold text-brand-700 underline">All conflicts</Link>}
      />
      <Badge tone={conflict.status === 'closed' ? 'neutral' : 'info'}>{conflict.status}</Badge>
      <ConflictThread conflictId={id} messages={messages} closed={conflict.status === 'closed'} canClose={canClose} />
    </div>
  );
}
