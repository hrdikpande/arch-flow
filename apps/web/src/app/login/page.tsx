import Link from 'next/link';
import { signIn } from '../actions/auth';
import { ActionForm } from '@/components/ActionForm';
import { Alert, FormField, inputClass } from '@/components/ds';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const params = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-4 py-12">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.06em] text-text-muted">arch-flow</p>
        <h1 className="mt-1 text-2xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-text-secondary">Use the email and password you set when you accepted your invitation.</p>
      </div>
      {params.error === 'link' && <Alert tone="error">That link is invalid or has expired. Ask the admin for a new invitation, or reset your password.</Alert>}
      <ActionForm action={signIn} submitLabel="Sign in" pendingLabel="Signing in…">
        <input type="hidden" name="next" value={params.next ?? ''} />
        <FormField label="Email" htmlFor="email" required>
          <input id="email" name="email" type="email" autoComplete="username" required className={inputClass} />
        </FormField>
        <FormField label="Password" htmlFor="password" required>
          <input id="password" name="password" type="password" autoComplete="current-password" required className={inputClass} />
        </FormField>
      </ActionForm>
      <Link href="/auth/forgot" className="text-sm font-semibold text-brand-700 underline underline-offset-2">Forgot your password?</Link>
    </main>
  );
}
