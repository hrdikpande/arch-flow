/**
 * Server-side environment. Read lazily, so the build does not need secrets.
 * Never import this from a client component.
 */

function read(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') throw new Error(`Missing environment variable ${name}`);
  return value.trim();
}

export const env = {
  get supabaseUrl(): string {
    return read('NEXT_PUBLIC_SUPABASE_URL');
  },
  get supabaseAnonKey(): string {
    return read('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  },
  get serviceRoleKey(): string {
    return read('SUPABASE_SERVICE_ROLE_KEY');
  },
  get appUrl(): string {
    return read('APP_URL').replace(/\/$/, '');
  },
};
