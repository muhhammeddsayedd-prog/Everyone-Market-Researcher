import 'server-only';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { z } from 'zod';
import { DataReadError } from '@/lib/data/errors';
import { createClient } from '@/lib/supabase/server';
import type { MemberRole } from './roles';

export type { MemberRole } from './roles';

export type Viewer =
  | { kind: 'signed-out' }
  | { kind: 'no-access'; email: string | null }
  | { kind: 'member'; userId: string; email: string | null; name: string | null; role: MemberRole };

export type Member = Extract<Viewer, { kind: 'member' }>;

const meSchema = z.object({
  user_id: z.string(),
  email: z.string().nullable(),
  full_name: z.string().nullable(),
  role: z.enum(['viewer', 'analyst', 'admin']),
  status: z.enum(['invited', 'active', 'disabled']),
});

/**
 * Resolves the current request's viewer on the server. Membership comes only from
 * `app.me()` (app.members.role/status), never from user metadata. Cached per request.
 */
export const getViewer = cache(async (): Promise<Viewer> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (error || typeof sub !== 'string') return { kind: 'signed-out' };
  const email = typeof data?.claims?.email === 'string' ? data.claims.email : null;

  const me = await supabase.rpc('me');
  if (me.error) throw new DataReadError('membership', me.error);
  if (me.data === null) return { kind: 'no-access', email };

  const parsed = meSchema.safeParse(me.data);
  if (!parsed.success || parsed.data.status !== 'active' || parsed.data.user_id !== sub)
    return { kind: 'no-access', email };

  return {
    kind: 'member',
    userId: sub,
    email: parsed.data.email ?? email,
    name: parsed.data.full_name,
    role: parsed.data.role,
  };
});

/** Server-side gate for every app page and action. Hiding navigation is not enforcement. */
export async function requireMember(): Promise<Member> {
  const viewer = await getViewer();
  if (viewer.kind === 'signed-out') redirect('/login');
  if (viewer.kind === 'no-access') redirect('/no-access');
  return viewer;
}
