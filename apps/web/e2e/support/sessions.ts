import { createServerClient } from '@supabase/ssr';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Genuine Supabase sessions for the isolated e2e stack. Each identity signs in against local
 * Auth; the exact cookies @supabase/ssr would set are written as Playwright storage state.
 * The app under test still verifies every request server-side (getClaims + app.me()).
 */
export type Identity = 'member' | 'admin' | 'disabled' | 'outsider';

type StackState = {
  apiUrl: string;
  publishableKey: string;
  users: Record<Identity, { email: string; password: string }>;
};

const here = dirname(fileURLToPath(import.meta.url));
export const STACK_DIR = join(here, '..', '.stack');
export const APP_ORIGIN = 'http://127.0.0.1:3100';

export function readStackState(): StackState {
  return JSON.parse(readFileSync(join(STACK_DIR, 'state.json'), 'utf8')) as StackState;
}

export function storageStatePath(identity: Identity): string {
  return join(STACK_DIR, `${identity}.storage.json`);
}

export async function createSessionState(identity: Identity): Promise<void> {
  const cookies = await signInCookies(identity);
  mkdirSync(STACK_DIR, { recursive: true });
  writeFileSync(storageStatePath(identity), JSON.stringify({ cookies, origins: [] }));
}

/** A brand-new session (for tests that sign out, which revokes that session server-side). */
export async function signInCookies(identity: Identity) {
  const state = readStackState();
  const jar = new Map<string, { value: string; options: Record<string, unknown> }>();
  const supabase = createServerClient(state.apiUrl, state.publishableKey, {
    cookies: {
      getAll: () => [...jar].map(([name, { value }]) => ({ name, value })),
      setAll: (cookies) => {
        for (const { name, value, options } of cookies) jar.set(name, { value, options });
      },
    },
  });
  const { error } = await supabase.auth.signInWithPassword(state.users[identity]);
  if (error) throw new Error(`Sign-in failed for ${identity}: ${error.message}`);

  return [...jar].map(([name, { value, options }]) => ({
    name,
    value,
    domain: '127.0.0.1',
    path: (options.path as string) ?? '/',
    expires: Math.floor(Date.now() / 1000) + 3600,
    httpOnly: false,
    secure: false,
    sameSite: 'Lax' as const,
  }));
}
