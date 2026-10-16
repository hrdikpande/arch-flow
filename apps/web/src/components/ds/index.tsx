/**
 * Design-system components (DESIGN.md, section 7). Colours come from tokens only.
 * Each component is small and does one thing. Domain components compose these.
 */
import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-brand-600 text-text-inverse hover:bg-brand-700 active:bg-brand-800 border-transparent',
  secondary: 'bg-surface text-text-primary border-border-strong hover:bg-stone-50',
  ghost: 'bg-transparent text-text-secondary border-transparent hover:bg-surface-secondary',
  danger: 'bg-error text-text-inverse hover:brightness-95 border-transparent',
};

export function Button({
  variant = 'primary',
  fullWidth,
  pending,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; fullWidth?: boolean; pending?: boolean }) {
  return (
    <button
      {...rest}
      aria-busy={pending || undefined}
      disabled={rest.disabled || pending}
      className={cx(
        'inline-flex min-h-10 items-center justify-center gap-2 rounded-sm border px-4 text-sm font-semibold transition-colors duration-[120ms] disabled:opacity-55 disabled:cursor-not-allowed',
        buttonVariants[variant],
        fullWidth && 'w-full',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function LinkButton({ href, variant = 'primary', children }: { href: string; variant?: ButtonVariant; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={cx(
        'inline-flex min-h-10 items-center justify-center gap-2 rounded-sm border px-4 text-sm font-semibold transition-colors',
        buttonVariants[variant],
      )}
    >
      {children}
    </Link>
  );
}

export function Card({ children, className, padding = 'md' }: { children: ReactNode; className?: string; padding?: 'sm' | 'md' | 'lg' }) {
  const pad = { sm: 'p-4', md: 'p-5', lg: 'p-6' }[padding];
  return <div className={cx('rounded-md border border-border bg-surface shadow-xs', pad, className)}>{children}</div>;
}

type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'error' | 'info';
const tones: Record<Tone, string> = {
  neutral: 'bg-surface-secondary text-text-secondary',
  brand: 'bg-brand-100 text-brand-800',
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  error: 'bg-error-bg text-error',
  info: 'bg-info-bg text-info',
};

/** Badge always shows text. Colour is never the only signal (DESIGN.md, 9). */
export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cx('inline-flex min-h-6 items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-xs font-medium', tones[tone])}>
      {children}
    </span>
  );
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-xs font-bold uppercase tracking-[0.06em] text-text-muted">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold sm:text-[2rem] sm:leading-10">{title}</h1>
        {description && <p className="mt-1 text-sm text-text-secondary">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong bg-surface-muted p-8 text-center">
      <p className="font-semibold">{title}</p>
      {description && <p className="max-w-md text-sm text-text-secondary">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Alert({ tone = 'error', children }: { tone?: 'error' | 'success' | 'info' | 'warning'; children: ReactNode }) {
  const styles = {
    error: 'bg-error-bg text-error border-error',
    success: 'bg-success-bg text-success border-success',
    info: 'bg-info-bg text-info border-info',
    warning: 'bg-warning-bg text-warning border-warning',
  }[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cx('rounded-sm border px-4 py-3 text-sm', styles)}>
      {children}
    </div>
  );
}

export function FormField({ label, htmlFor, hint, error, required, children }: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-semibold text-text-primary">
        {label}
        {required && <span aria-hidden="true" className="text-error"> *</span>}
      </label>
      {children}
      {hint && !error && <p id={`${htmlFor}-hint`} className="text-xs text-text-muted">{hint}</p>}
      {error && <p id={`${htmlFor}-error`} role="alert" className="text-xs text-error">{error}</p>}
    </div>
  );
}

export const inputClass =
  'min-h-10 w-full rounded-sm border border-border-strong bg-surface px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-focus focus:outline-none focus:ring-[3px] focus:ring-brand-600/15';

export const textareaClass =
  'w-full rounded-sm border border-border-strong bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-focus focus:outline-none focus:ring-[3px] focus:ring-brand-600/15';

export function Table({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-md border border-border bg-surface">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export const th = 'border-b border-border bg-surface-muted px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.04em] text-text-muted';
export const td = 'border-b border-border px-3 py-3 align-top';
