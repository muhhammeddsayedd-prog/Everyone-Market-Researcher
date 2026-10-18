import { NextResponse, type NextRequest } from 'next/server';
import { safeNextPath } from '@/lib/auth/next-path';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** OAuth return: exchanges the code for a session, then continues to a validated relative path. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const next = safeNextPath(request.nextUrl.searchParams.get('next'));
  const failed = new URL('/login?error=oauth', request.url);

  if (!code || request.nextUrl.searchParams.has('error')) return NextResponse.redirect(failed);

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(failed);

  return NextResponse.redirect(new URL(next, request.url));
}
