'use client';

import { useActionState, type ReactNode } from 'react';
import { Alert, Button } from './ds';
import type { FormState } from '@/app/actions/types';

/** Form wired to a server action. Shows the action's error or success message. */
export function ActionForm({
  action,
  submitLabel,
  pendingLabel = 'Saving…',
  className,
  children,
  variant = 'primary',
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  submitLabel: string;
  pendingLabel?: string;
  className?: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className={className ?? 'flex flex-col gap-4'}>
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" pending={pending} variant={variant}>
          {pending ? pendingLabel : submitLabel}
        </Button>
        {state?.error && <Alert tone="error">{state.error}</Alert>}
        {state?.ok && <Alert tone="success">{state.ok}</Alert>}
      </div>
    </form>
  );
}
