'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { Search, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { cx } from '@/components/ui/cx';

/**
 * ⌘K / Ctrl+K entry point. Hybrid search arrives in M11; until then the dialog says so and
 * points to the company name search that works today. It makes no search or embedding calls.
 */
export function SearchCommand({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        className={cx(
          'flex h-9 items-center gap-2 rounded-sm border border-border-strong bg-surface-2 px-3 type-body text-fg-muted motion-colors hover:text-fg',
          className,
        )}
      >
        <Search aria-hidden="true" strokeWidth={1.5} className="size-4" />
        <span className="hidden lg:inline">Search everything…</span>
        <span className="sr-only lg:hidden">Search</span>
        <kbd className="ml-auto hidden rounded-[4px] border border-border px-1.5 type-micro text-fg-label xl:inline">
          Ctrl K
        </kbd>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-overlay fixed inset-0 z-[600] bg-[var(--color-overlay)]" />
        <Dialog.Content className="pop-panel fixed left-1/2 top-[15vh] z-[600] w-[calc(100vw-32px)] max-w-[560px] -translate-x-1/2 rounded-md border border-border-strong bg-surface-3 p-5 shadow-[var(--elevation-pop)]">
          <div className="flex items-start justify-between gap-4">
            <Dialog.Title className="type-h3">Search is coming in M11</Dialog.Title>
            <Dialog.Close
              aria-label="Close"
              className="-m-2 flex size-10 items-center justify-center rounded-sm text-fg-secondary hover:bg-surface-2"
            >
              <X aria-hidden="true" strokeWidth={1.5} className="size-4" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="mt-2 type-body text-fg-secondary">
            Search across items, campaigns and people needs the M11 hybrid search. You can already find a
            company by name in the competitors list.
          </Dialog.Description>
          <Link
            href="/competitors"
            onClick={() => setOpen(false)}
            className="mt-4 inline-flex h-9 items-center rounded-sm bg-surface-2 px-4 type-body text-fg motion-colors hover:bg-surface-1"
          >
            Find a company
          </Link>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
