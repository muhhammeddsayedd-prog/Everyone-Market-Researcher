import Link from 'next/link';
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { Wordmark } from '@/components/brand/wordmark';
import type { Member } from '@/lib/auth/viewer';
import { navFor, pageForPath, type PageEntry } from '@/lib/nav/registry';
import { BottomNav } from './bottom-nav';
import { MarketSwitcher } from './market-switcher';
import { SearchCommand } from './search-command';
import { Sidebar } from './sidebar';
import { UserMenu } from './user-menu';

/** DESIGN.md §5: sidebar + sticky topbar on desktop, rail on tablet, bottom nav on phones. */
export function AppShell({
  member,
  localData,
  children,
}: {
  member: Member;
  localData: boolean;
  children: ReactNode;
}) {
  const pages = navFor(member.role);
  const reviewOrCoverage = member.role === 'viewer' ? '/coverage' : '/review';
  const primary = ['/', '/competitors', '/search', reviewOrCoverage]
    .map((path) => pageForPath(path))
    .filter((page): page is PageEntry => Boolean(page));

  return (
    <div className="flex min-h-svh">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Sidebar pages={pages} />
      <div className="flex min-w-0 flex-1 flex-col">
        {localData ? (
          <p
            role="note"
            className="border-b border-warning/40 bg-warning-soft px-4 py-1.5 text-center type-small text-warning"
          >
            Local test data from a development database — not business records.
          </p>
        ) : null}
        <header className="sticky top-0 z-[300] flex h-14 items-center gap-3 border-b border-border bg-bg px-4 md:h-16 lg:px-8">
          <Link href="/" className="rounded-sm md:hidden" aria-label="everyone. Market Radar home">
            <Wordmark width={88} />
          </Link>
          <SearchCommand className="hidden md:flex md:w-11 md:justify-center md:px-0 lg:w-[320px] lg:justify-start lg:px-3" />
          <div className="ml-auto flex items-center gap-3">
            <Suspense fallback={null}>
              <MarketSwitcher />
            </Suspense>
            <UserMenu name={member.name} email={member.email} role={member.role} />
          </div>
        </header>
        <main id="main" tabIndex={-1} className="flex-1 pb-24 outline-none md:pb-12">
          <div className="mx-auto w-full max-w-[1440px] px-4 pt-6 md:px-6 lg:px-8 lg:pt-8">{children}</div>
        </main>
      </div>
      <BottomNav primary={primary} pages={pages} />
    </div>
  );
}
