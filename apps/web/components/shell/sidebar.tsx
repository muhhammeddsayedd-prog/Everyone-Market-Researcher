'use client';

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';
import { Wordmark } from '@/components/brand/wordmark';
import { cx } from '@/components/ui/cx';
import { DotsMark } from '@/components/ui/dots-mark';
import { usePreference, writePreference } from '@/lib/client/stored-preference';
import type { PageEntry } from '@/lib/nav/registry';
import { NavLinks } from './nav-links';

const STORAGE_KEY = 'emr-sidebar-collapsed';

/**
 * 248 px sidebar on desktop, collapsible to a 72 px rail (⌘\ or the toggle, stored locally).
 * Tablets always get the rail; phones use the bottom navigation instead.
 */
export function Sidebar({ pages }: { pages: PageEntry[] }) {
  const collapsed = usePreference(STORAGE_KEY) === '1';
  const toggle = () => writePreference(STORAGE_KEY, collapsed ? '0' : '1');

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === '\\') {
        event.preventDefault();
        writePreference(STORAGE_KEY, collapsed ? '0' : '1');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [collapsed]);

  return (
    <aside
      data-collapsed={collapsed ? 'true' : 'false'}
      className={cx(
        'sticky top-0 z-[200] hidden h-svh shrink-0 flex-col border-r border-border bg-surface-1 md:flex',
        'w-[72px]',
        !collapsed && 'lg:w-[248px]',
      )}
    >
      <div className={cx('flex h-16 items-center px-4', collapsed ? 'justify-center' : 'lg:justify-between')}>
        <Link href="/" className="rounded-sm" aria-label="everyone. Market Radar home">
          <DotsMark className={cx('size-8 text-fg', !collapsed && 'lg:hidden')} />
          <span className={cx('hidden flex-col gap-1', !collapsed && 'lg:flex')}>
            <Wordmark width={104} />
            <span className="type-small text-fg-secondary">Market Radar</span>
          </span>
        </Link>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-3">
        <NavLinks pages={pages} mode={collapsed ? 'rail' : 'responsive'} />
      </div>
      <div className="hidden border-t border-border p-3 lg:block">
        <button
          type="button"
          onClick={toggle}
          aria-pressed={collapsed}
          className={cx(
            'flex h-9 w-full items-center gap-3 rounded-sm px-3 type-small text-fg-muted motion-colors hover:bg-surface-2 hover:text-fg',
            collapsed && 'justify-center px-0',
          )}
        >
          {collapsed ? (
            <PanelLeftOpen aria-hidden="true" strokeWidth={1.5} className="size-4" />
          ) : (
            <PanelLeftClose aria-hidden="true" strokeWidth={1.5} className="size-4" />
          )}
          <span className={collapsed ? 'sr-only' : undefined}>
            {collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          </span>
        </button>
      </div>
    </aside>
  );
}
