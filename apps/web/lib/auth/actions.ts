'use server';

import { redirect } from 'next/navigation';
import { requirePublicEnv } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import { safeNextPath } from './next-path';

/**
 * Starts invite-only Google sign-in. The PKCE verifier is stored in a cookie by the server
 * client; the callback exchanges the code. Membership is checked after sign-in, never here.
 */
export async function signInWithGoogle(formData: FormData) {
  const { siteUrl } = requirePublicEnv();
  const next = safeNextPath(String(formData.get('next') ?? ''));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`,
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
