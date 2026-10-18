import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { requireMember } from '@/lib/auth/viewer';
import { isLocalSupabase, requirePublicEnv } from '@/lib/env';

// Every page under (app) is personalized and session-bearing: render per request, never cache.
export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const member = await requireMember();
  return (
    <AppShell member={member} localData={isLocalSupabase(requirePublicEnv())}>
      {children}
    </AppShell>
  );
}
