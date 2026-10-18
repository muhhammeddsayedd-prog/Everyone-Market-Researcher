'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useState } from 'react';
import { DotsMark } from '@/components/ui/dots-mark';
import type { PageEntry } from '@/lib/nav/registry';
import { NavLinks } from './nav-links';

/** Mobile "Menu": the white rounded-square three-dot button opening full-height navigation. */
export function MobileMenu({ pages }: { pages: PageEntry[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className="flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[11px] leading-tight text-fg-secondary">
        <span className="flex size-7 items-center justify-center rounded-sm bg-[#ffffff] text-[#000000]">
          <DotsMark className="size-5" />
        </span>
        Menu
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-overlay fixed inset-0 z-[500] bg-[var(--color-overlay)]" />
        <Dialog.Content className="sheet-panel fixed inset-x-0 bottom-0 top-0 z-[500] flex flex-col overflow-y-auto bg-surface-1 px-4 pb-6">
          <div className="flex h-14 items-center justify-between">
            <Dialog.Title className="type-h3">Menu</Dialog.Title>
            <Dialog.Close
              aria-label="Close menu"
              className="flex size-11 items-center justify-center rounded-sm text-fg-secondary hover:bg-surface-2"
            >
              <X aria-hidden="true" strokeWidth={1.5} className="size-5" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">All Market Radar pages</Dialog.Description>
          <NavLinks pages={pages} mode="full" onNavigate={() => setOpen(false)} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
