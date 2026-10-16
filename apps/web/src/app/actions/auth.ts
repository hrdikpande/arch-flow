'use server';

import { redirect } from 'next/navigation';
import { userSupabase } from '@/lib/supabase/server';
import { currentAccess } from '@/lib/access';
import { env } from '@/lib/env';
import { errorState, type FormState } from './types';

function safeNext(value: FormDataEntryValue | null): string {
  const next = String(value ?? '');
  return next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

export async function signIn(_prev: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');
  if (!email || !password) return { error: 'Enter your email and password.' };
  try {
    const supabase = await userSupabase();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: 'That email and password do not match. Try again or reset your password.' };
  } catch (error) {
    return errorState(error);
  }
  const access = await currentAccess();
  if (!access) {
    const supabase = await userSupabase();
    await supabase.auth.signOut();
    return { error: 'This account is not active. Ask the admin to check your access.' };
  }
  const next = safeNext(form.get('next'));
  redirect(next !== '/' ? next : access.isClient ? '/portal' : '/dashboard');
}

export async function signOut(): Promise<void> {
  const supabase = await userSupabase();
  await supabase.auth.signOut();
  redirect('/login');
}

/** Sets the password after an invite or reset link (AUTH-01, AUTH-03). */
export async function setPassword(_prev: FormState, form: FormData): Promise<FormState> {
  const password = String(form.get('password') ?? '');
  const confirm = String(form.get('confirm') ?? '');
  if (password.length < 12) return { error: 'Use at least 12 characters.' };
  if (password !== confirm) return { error: 'The two passwords do not match.' };
  try {
    const supabase = await userSupabase();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: error.message };
  } catch (error) {
    return errorState(error);
  }
  const access = await currentAccess();
  redirect(access?.isClient ? '/portal' : '/dashboard');
}

/** Sends a reset link. Always answers the same way, so it does not reveal which emails exist. */
export async function requestReset(_prev: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  if (email.includes('@')) {
    try {
      const supabase = await userSupabase();
      await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${env.appUrl}/auth/callback?next=/auth/setup` });
    } catch {
      // Intentionally silent: the response below is the same either way.
    }
  }
  return { ok: 'If that email has an account, a reset link is on its way.' };
}
