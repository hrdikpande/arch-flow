import { setPassword } from '../../actions/auth';
import { ActionForm } from '@/components/ActionForm';
import { FormField, inputClass } from '@/components/ds';

export default function SetupPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-4 py-12">
      <div>
        <h1 className="text-2xl font-semibold">Set your password</h1>
        <p className="mt-1 text-sm text-text-secondary">Use at least 12 characters. You will use this password to sign in.</p>
      </div>
      <ActionForm action={setPassword} submitLabel="Save password" pendingLabel="Saving…">
        <FormField label="New password" htmlFor="password" required hint="At least 12 characters.">
          <input id="password" name="password" type="password" autoComplete="new-password" minLength={12} required className={inputClass} />
        </FormField>
        <FormField label="Confirm password" htmlFor="confirm" required>
          <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={12} required className={inputClass} />
        </FormField>
      </ActionForm>
    </main>
  );
}
