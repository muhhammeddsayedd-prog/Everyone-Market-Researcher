import type { Metadata } from 'next';
import { Wordmark } from '@/components/brand/wordmark';
import { GoogleGlyph } from '@/components/brand/google-glyph';
import { Button } from '@/components/ui/button';
import { signInWithGoogle } from '@/lib/auth/actions';
import { safeNextPath } from '@/lib/auth/next-path';

export const metadata: Metadata = { title: 'Sign in' };

type LoginProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function LoginPage({ searchParams }: LoginProps) {
  const params = await searchParams;
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next;
  const next = safeNextPath(rawNext);
  const failed = params.error === 'oauth';

  return (
    <main
      id="main"
      className="mx-auto flex min-h-svh w-full max-w-[480px] flex-col justify-center gap-10 px-4 py-12"
    >
      <div className="flex flex-col gap-3">
        <Wordmark width={160} />
        <p className="type-h3 text-fg-secondary">Market Radar</p>
      </div>

      <h1 className="type-display">
        <span className="reveal-line block">If it&apos;s not everyone—</span>
        <span className="reveal-line reveal-line-2 block">it&apos;s no one.</span>
      </h1>

      <div className="flex flex-col gap-3">
        {failed ? (
          <p role="alert" className="rounded-sm bg-danger-soft px-3 py-2 type-body text-danger">
            Google sign-in didn&apos;t finish. Try again.
          </p>
        ) : null}
        <form action={signInWithGoogle}>
          <input type="hidden" name="next" value={next} />
          <Button type="submit" variant="secondary" size="lg" className="w-full" icon={<GoogleGlyph />}>
            Sign in with Google
          </Button>
        </form>
        <p className="type-small text-fg-muted">Invite-only. Ask Mohamed for access.</p>
      </div>
    </main>
  );
}
