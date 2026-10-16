import Link from 'next/link';
import { requireClient } from '@/lib/access';
import { signOut } from '@/app/actions/auth';

/** Client portal shell: simpler than the internal one, no sidebar (DESIGN.md, 6.2). */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const access = await requireClient();
  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/portal" className="flex items-center gap-3">
            <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-md bg-brand-600 text-sm font-bold text-text-inverse">AF</span>
            <span className="text-sm font-semibold">arch-flow · Client portal</span>
          </Link>
          <nav aria-label="Portal" className="flex items-center gap-4 text-sm">
            <Link href="/portal" className="font-medium text-brand-700 underline underline-offset-2">Drawings</Link>
            <Link href="/portal/conflicts/new" className="font-medium text-brand-700 underline underline-offset-2">Raise a conflict</Link>
            <span className="hidden text-text-muted sm:inline">{access.name}</span>
            <form action={signOut}><button type="submit" className="min-h-10 rounded-sm px-3 text-error hover:bg-error-bg">Sign out</button></form>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-6 lg:py-8">{children}</main>
    </div>
  );
}
