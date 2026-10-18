'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cx } from '@/components/ui/cx';
import { GROUP_LABEL, type NavGroup, type PageEntry } from '@/lib/nav/registry';
import { NavIcon } from './nav-icon';

export function isActivePath(pathname: string, path: string): boolean {
  if (path === '/') return pathname === '/';
  return pathname === path || pathname.startsWith(`${path}/`);
}

const GROUPS: NavGroup[] = ['radar', 'market', 'work', 'admin'];

export type NavMode = 'full' | 'responsive' | 'rail';

/** Labels hidden visually (kept for assistive tech) in the 72 px rail. */
const LABEL: Record<NavMode, string> = {
  full: 'truncate',
  responsive: 'sr-only lg:not-sr-only lg:truncate',
  rail: 'sr-only',
};
const LINK_LAYOUT: Record<NavMode, string> = {
  full: 'px-3',
  responsive: 'justify-center px-0 lg:justify-start lg:px-3',
  rail: 'justify-center px-0',
};
const MILESTONE: Record<NavMode, string> = {
  full: 'ml-auto',
  responsive: 'hidden lg:ml-auto lg:inline',
  rail: 'hidden',
};

/**
 * Grouped navigation. `full` in the mobile menu, `responsive` in the sidebar (rail on tablets,
 * labelled on desktop), `rail` when the desktop sidebar is collapsed.
 */
export function NavLinks({
  pages,
  mode,
  onNavigate,
}: {
  pages: PageEntry[];
  mode: NavMode;
  onNavigate?: () => void;
}) {
  const rail = mode === 'rail';
  const pathname = usePathname();
  const footer = pages.filter((page) => page.group === 'footer');

  const renderLink = (page: PageEntry) => {
    const active = isActivePath(pathname, page.path);
    return (
      <li key={page.path}>
        <Link
          href={page.path}
          onClick={onNavigate}
          aria-current={active ? 'page' : undefined}
          title={mode === 'full' ? undefined : page.label}
          className={cx(
            'relative flex h-11 items-center gap-3 rounded-sm type-body motion-colors md:h-9',
            LINK_LAYOUT[mode],
            active
              ? 'bg-surface-2 text-fg before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-accent'
              : 'text-fg-secondary hover:bg-surface-2 hover:text-fg',
          )}
        >
          <NavIcon name={page.icon} className={cx('size-4 shrink-0', active ? 'text-fg' : 'text-fg-muted')} />
          <span className={LABEL[mode]}>{page.label}</span>
          {page.state === 'planned' ? (
            <span className={cx('type-micro text-fg-label', MILESTONE[mode])}>
              <span className="sr-only">, planned for </span>
              {page.milestone}
            </span>
          ) : null}
        </Link>
      </li>
    );
  };

  return (
    <nav aria-label="Main" className="flex flex-1 flex-col gap-5">
      {GROUPS.map((group) => {
        const items = pages.filter((page) => page.group === group);
        if (items.length === 0) return null;
        return (
          <div key={group}>
            <p
              aria-hidden="true"
              className={cx(
                'mb-1 px-3 type-micro text-fg-label',
                rail && 'sr-only',
                mode === 'responsive' && 'sr-only lg:not-sr-only',
              )}
            >
              {GROUP_LABEL[group]}
            </p>
            <ul aria-label={GROUP_LABEL[group]} className="flex flex-col gap-0.5">
              {items.map(renderLink)}
            </ul>
          </div>
        );
      })}
      {footer.length > 0 ? (
        <ul aria-label="More" className="mt-auto flex flex-col gap-0.5 border-t border-border pt-3">
          {footer.map(renderLink)}
        </ul>
      ) : null}
    </nav>
  );
}
