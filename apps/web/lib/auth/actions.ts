'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { requirePublicEnv } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import { safeNextPath } from './next-path';
import { authOrigin } from './origin';

/**
 * Starts invite-only Google sign-in. The PKCE verifier is stored in a cookie by the server
 * client; the callback exchanges the code. Membership is checked after sign-in, never here.
 */
export async function signInWithGoogle(formData: FormData) {
  const { siteUrl } = requirePublicEnv();
  const next = safeNextPath(String(formData.get('next') ?? ''));
  const requestHeaders = await headers();
  const origin = authOrigin(
    siteUrl,
    requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host'),
    requestHeaders.get('x-forwarded-proto'),
  );
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      skipBrowserRedirect: true,
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error || !data?.url) redirect('/login?error=oauth');
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: 'local' });
  redirect('/login');
}
