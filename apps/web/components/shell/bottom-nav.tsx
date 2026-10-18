'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cx } from '@/components/ui/cx';
import type { PageEntry } from '@/lib/nav/registry';
import { MobileMenu } from './mobile-menu';
import { NavIcon } from './nav-icon';
import { isActivePath } from './nav-links';

/** Mobile bottom navigation (64 px). Four destinations plus Menu. */
export function BottomNav({ primary, pages }: { primary: PageEntry[]; pages: PageEntry[] }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-[300] flex h-16 border-t border-border bg-bg pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {primary.map((page) => {
        const active = isActivePath(pathname, page.path);
        return (
          <Link
            key={page.path}
            href={page.path}
            aria-current={active ? 'page' : undefined}
            className={cx(
              'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-0.5 text-[11px] leading-tight motion-colors',
              active ? 'text-accent' : 'text-fg-secondary',
            )}
          >
            <NavIcon name={page.icon} className="size-5" />
            <span className="max-w-full truncate">{page.label}</span>
          </Link>
        );
      })}
      <MobileMenu pages={pages} />
    </nav>
  );
}
