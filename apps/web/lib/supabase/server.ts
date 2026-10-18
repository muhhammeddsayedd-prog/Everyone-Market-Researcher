import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@emr/shared';
import { requirePublicEnv } from '@/lib/env';

/**
 * Per-request Supabase client carrying the signed-in user's session cookies.
 * Every read goes through the Data API as that user, so RLS decides what is visible.
 * Never construct this with a secret key or a machine role.
 */
export async function createClient() {
  const env = requirePublicEnv();
  const cookieStore = await cookies();
  return createServerClient<Database, 'app'>(env.supabaseUrl, env.supabasePublishableKey, {
    db: { schema: 'app' },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // Server Components cannot write cookies; the proxy refreshes sessions instead.
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          /* read-only cookie store during render */
        }
      },
    },
  });
}

export type AppClient = Awaited<ReturnType<typeof createClient>>;
