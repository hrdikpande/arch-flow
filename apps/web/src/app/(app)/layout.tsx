import { requireInternal } from '@/lib/access';
import { adminDb } from '@/lib/supabase/admin';
import { AppShell } from '@/components/shell/Sidebar';

export default async function InternalLayout({ children }: { children: React.ReactNode }) {
  const access = await requireInternal();
  const db = adminDb();
  const [{ count: approvalCount }, { count: unread }] = await Promise.all([
    db.from('approvals').select('id', { count: 'exact', head: true }).eq('assignee_id', access.userId).eq('status', 'pending'),
    db.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', access.userId).is('read_at', null),
  ]);
  return (
    <AppShell access={access} approvalCount={approvalCount ?? 0} unread={unread ?? 0}>
      {children}
    </AppShell>
  );
}
