import { requestReset } from '../../actions/auth';
import { ActionForm } from '@/components/ActionForm';
import { FormField, inputClass } from '@/components/ds';

export default function ForgotPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-4 py-12">
      <div>
        <h1 className="text-2xl font-semibold">Reset your password</h1>
        <p className="mt-1 text-sm text-text-secondary">We will email you a link to set a new password.</p>
      </div>
      <ActionForm action={requestReset} submitLabel="Send reset link" pendingLabel="Sending…">
        <FormField label="Email" htmlFor="email" required>
          <input id="email" name="email" type="email" autoComplete="username" required className={inputClass} />
        </FormField>
      </ActionForm>
    </main>
  );
}
