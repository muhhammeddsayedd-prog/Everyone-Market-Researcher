import Link from 'next/link';
import { DotsMark } from '@/components/ui/dots-mark';

/** DESIGN.md §8.26 404. */
export default function NotFound() {
  return (
    <main
      id="main"
      className="mx-auto flex min-h-[60svh] max-w-[480px] flex-col items-center justify-center gap-4 px-4 text-center"
    >
      <DotsMark className="size-10 text-fg-muted" />
      <h1 className="type-h2">This page isn&apos;t on the radar.</h1>
      <p className="type-body text-fg-muted">
        <Link href="/" className="text-fg-secondary underline underline-offset-4 hover:text-fg">
          Go to Pulse
        </Link>{' '}
        or{' '}
        <Link href="/competitors" className="text-fg-secondary underline underline-offset-4 hover:text-fg">
          browse competitors
        </Link>
        .
      </p>
    </main>
  );
}
