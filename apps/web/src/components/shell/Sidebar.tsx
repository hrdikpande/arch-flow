import Link from 'next/link';
import { signOut } from '@/app/actions/auth';
import type { Access } from '@/lib/access';

const NAV: { href: string; label: string; adminOnly?: boolean }[] = [
  { href: '/dashboard', label: 'Home' },
  { href: '/projects', label: 'Projects' },
  { href: '/approvals', label: 'Approvals' },
  { href: '/conflicts', label: 'Conflicts' },
  { href: '/workload', label: 'Workload', adminOnly: true },
  { href: '/admin', label: 'Admin', adminOnly: true },
  { href: '/admin/users', label: 'Users', adminOnly: true },
  { href: '/admin/whatsapp', label: 'WhatsApp', adminOnly: true },
  { href: '/admin/rules', label: 'Critical rules', adminOnly: true },
  { href: '/admin/audit', label: 'Audit log', adminOnly: true },
];

function Nav({ access, approvalCount }: { access: Access; approvalCount: number }) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {NAV.filter((item) => !item.adminOnly || access.isAdmin).map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="flex min-h-10 items-center justify-between rounded-sm px-3 py-2.5 text-sm text-text-secondary hover:bg-stone-100 hover:text-text-primary aria-[current=page]:bg-brand-50 aria-[current=page]:font-medium aria-[current=page]:text-brand-800"
        >
          <span>{item.label}</span>
          {item.href === '/approvals' && approvalCount > 0 && (
            <span className="rounded-pill bg-warning-bg px-2 text-xs font-semibold text-warning">{approvalCount}</span>
          )}
        </Link>
      ))}
    </nav>
  );
}

/** App shell: sidebar on desktop, a disclosure menu on small screens (DESIGN.md, 6.1). */
export function AppShell({
  access,
  approvalCount,
  unread,
  children,
}: {
  access: Access;
  approvalCount: number;
  unread: number;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="hidden border-r border-border bg-stone-25 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:gap-6 lg:p-4">
        <Brand />
        <div className="flex-1 overflow-y-auto"><Nav access={access} approvalCount={approvalCount} /></div>
        <Footer access={access} unread={unread} />
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-10 flex min-h-16 items-center justify-between border-b border-border bg-surface/95 px-4 backdrop-blur lg:hidden">
          <details className="relative">
            <summary className="flex min-h-10 min-w-10 cursor-pointer list-none items-center justify-center rounded-sm border border-border-strong px-3 text-sm font-semibold">Menu</summary>
            <div className="absolute left-0 mt-2 w-64 rounded-md border border-border bg-surface p-3 shadow-md">
              <Nav access={access} approvalCount={approvalCount} />
              <div className="mt-3 border-t border-border pt-3"><Footer access={access} unread={unread} /></div>
            </div>
          </details>
          <Brand compact />
          <Link href="/approvals" className="text-sm font-semibold text-brand-700">{unread > 0 ? `${unread} new` : 'Inbox'}</Link>
        </header>
        <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

function Brand({ compact }: { compact?: boolean }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-3">
      <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-md bg-brand-600 text-sm font-bold text-text-inverse">AF</span>
      {!compact && (
        <span className="min-w-0">
          <span className="block text-sm font-semibold">arch-flow</span>
          <span className="block text-xs text-text-muted">Drawing control</span>
        </span>
      )}
    </Link>
  );
}

function Footer({ access, unread }: { access: Access; unread: number }) {
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="min-w-0">
        <p className="truncate font-medium">{access.name}</p>
        <p className="truncate text-xs text-text-muted">{access.email}</p>
        {unread > 0 && <p className="mt-1 text-xs font-semibold text-warning">{unread} unread notifications</p>}
      </div>
      <form action={signOut}>
        <button type="submit" className="min-h-10 w-full rounded-sm px-3 text-left text-sm text-error hover:bg-error-bg">Sign out</button>
      </form>
    </div>
  );
}
