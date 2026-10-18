'use client';

import { RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { startTransition } from 'react';
import { Button } from '@/components/ui/button';
import { DotsMark } from '@/components/ui/dots-mark';

/** DESIGN.md §8: "Couldn't load this. Retry" with the request id. No internal details are shown. */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-md border border-border px-6 py-12 text-center"
    >
      <DotsMark className="size-8 text-fg-muted" />
      <p className="type-h3">Couldn&apos;t load this.</p>
      <Button
        variant="secondary"
        icon={<RotateCcw aria-hidden="true" strokeWidth={1.5} className="size-4" />}
        onClick={() =>
          startTransition(() => {
            router.refresh();
            reset();
          })
        }
      >
        Retry
      </Button>
      {error.digest ? <p className="type-small text-fg-muted tabular">Request id {error.digest}</p> : null}
    </div>
  );
}
