import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Wordmark } from '@/components/brand/wordmark';
import { Button } from '@/components/ui/button';
import { signOut } from '@/lib/auth/actions';
import { getViewer } from '@/lib/auth/viewer';

export const metadata: Metadata = { title: 'No access' };
export const dynamic = 'force-dynamic';

/** A signed-in Google account without an active membership (DESIGN.md §8.2). */
export default async function NoAccessPage() {
  const viewer = await getViewer();
  if (viewer.kind === 'signed-out') redirect('/login');
  if (viewer.kind === 'member') redirect('/');
  const email = viewer.email ?? 'your Google account';

  return (
    <main
      id="main"
      className="mx-auto flex min-h-svh w-full max-w-[480px] flex-col justify-center gap-8 px-4"
    >
      <Wordmark width={120} />
      <div className="flex flex-col gap-3">
        <h1 className="type-h2">Your account isn&apos;t on the invite list yet.</h1>
        <p className="type-body-lg text-fg-secondary">Ask Mohamed Abdelrahman to invite {email}.</p>
      </div>
      <form action={signOut}>
        <Button type="submit" variant="secondary">
          Sign out
        </Button>
      </form>
      <p className="type-small text-fg-muted">Signed in as {email}</p>
    </main>
  );
}
