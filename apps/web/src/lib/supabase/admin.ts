import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../env';

let client: SupabaseClient | null = null;

/**
 * Service-role client. Bypasses RLS, so every caller must authorise the action
 * first (see lib/access.ts). Never send this client or its key to the browser.
 */
export function adminDb(): SupabaseClient {
  if (!client) {
    client = createClient(env.supabaseUrl, env.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
