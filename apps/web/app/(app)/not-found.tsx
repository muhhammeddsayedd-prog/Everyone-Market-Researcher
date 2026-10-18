import Link from 'next/link';
import { DotsMark } from '@/components/ui/dots-mark';

/** 404 inside the app shell (unknown pages, unknown companies, pages above the member's role). */
export default function AppNotFound() {
  return (
    <div className="flex min-h-[50svh] flex-col items-center justify-center gap-4 text-center">
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
    </div>
  );
}
