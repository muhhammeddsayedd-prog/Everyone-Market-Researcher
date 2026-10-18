'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams, useSelectedLayoutSegment } from 'next/navigation';
import type { KeyboardEvent } from 'react';
import { cx } from '@/components/ui/cx';
import { PROFILE_TABS } from '@/lib/directory/profile-tabs';
import { backToListHref, fromSuffix } from '@/lib/directory/return-to';

function useFrom() {
  const searchParams = useSearchParams();
  return Object.fromEntries(searchParams.entries());
}

/** Returns to the exact list (filters, sort, view, page) the profile was opened from. */
export function BackToList() {
  const href = backToListHref(useFrom());
  return (
    <Link
      href={href}
      className="inline-flex h-9 items-center gap-1.5 rounded-sm type-body text-fg-secondary motion-colors hover:text-fg"
    >
      <ArrowLeft aria-hidden="true" strokeWidth={1.5} className="size-4" />
      Back to competitors
    </Link>
  );
}

/**
 * Route-aware tabs: each tab is a URL segment link (aria-current marks the open one).
 * Left/Right arrows move focus between tabs; the row scrolls with edge fades on phones.
 */
export function ProfileTabs({ slug }: { slug: string }) {
  const segment = useSelectedLayoutSegment() ?? '';
  const suffix = fromSuffix(useFrom());

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const links = Array.from(event.currentTarget.querySelectorAll<HTMLAnchorElement>('a'));
    const index = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (index < 0) return;
    event.preventDefault();
    const next = links[(index + (event.key === 'ArrowRight' ? 1 : -1) + links.length) % links.length];
    next?.focus();
    next?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };

  return (
    <nav
      aria-label="Company sections"
      className="scroll-fade relative -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0"
    >
      <ul className="flex min-w-max gap-1 border-b border-border" onKeyDown={onKeyDown}>
        {PROFILE_TABS.map((tab) => {
          const active = tab.segment === segment;
          const href = `/competitors/${encodeURIComponent(slug)}${tab.segment ? `/${tab.segment}` : ''}${suffix}`;
          return (
            <li key={tab.label}>
              <Link
                href={href}
                scroll={false}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'relative flex h-11 items-center gap-1.5 px-3 type-body motion-colors',
                  active
                    ? 'text-fg after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:bg-accent'
                    : 'text-fg-secondary hover:text-fg',
                )}
              >
                {tab.label}
                {tab.state === 'planned' ? (
                  <span className="type-micro text-fg-label">
                    <span className="sr-only">(</span>soon<span className="sr-only">)</span>
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
