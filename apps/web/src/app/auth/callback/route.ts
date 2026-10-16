import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { userSupabase } from '@/lib/supabase/server';

const TYPES: readonly EmailOtpType[] = ['invite', 'recovery', 'magiclink', 'email'];

/** Exchanges the emailed token for a session (invite, reset, magic link). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next') ?? '/auth/setup';
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/auth/setup';
  if (!tokenHash || !type || !TYPES.includes(type)) {
    return NextResponse.redirect(new URL('/login?error=link', origin));
  }
  const supabase = await userSupabase();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) return NextResponse.redirect(new URL('/login?error=link', origin));
  return NextResponse.redirect(new URL(safeNext, origin));
}
