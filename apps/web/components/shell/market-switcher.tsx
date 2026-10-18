'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { cx } from '@/components/ui/cx';

const OPTIONS = [
  { value: null, label: 'All', name: 'All markets' },
  { value: 'EG', label: 'EG', name: 'Egypt' },
  { value: 'KSA', label: 'KSA', name: 'Saudi Arabia' },
  { value: 'UAE', label: 'UAE', name: 'UAE' },
] as const;

/**
 * Global market filter, kept in the URL (`?market=`). Changing it restarts paging so the
 * list never mixes positions from different filters.
 */
export function MarketSwitcher({ className }: { className?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get('market');

  const hrefFor = (value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('cursor');
    params.delete('page');
    if (value) params.set('market', value);
    else params.delete('market');
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  return (
    <>
      {/* Phones: compact select (DESIGN.md §5.3). */}
      <label className="sm:hidden">
        <span className="sr-only">Market</span>
        <select
          value={current ?? ''}
          onChange={(event) => router.push(hrefFor(event.target.value || null), { scroll: false })}
          className="h-9 rounded-sm border border-border-strong bg-surface-2 px-2 type-small text-fg"
        >
          {OPTIONS.map((option) => (
            <option key={option.label} value={option.value ?? ''}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <nav
        aria-label="Market"
        className={cx('hidden rounded-full border border-border-strong p-0.5 sm:flex', className)}
      >
        {OPTIONS.map((option) => {
          const selected = (current ?? null) === option.value;
          return (
            <Link
              key={option.label}
              href={hrefFor(option.value)}
              aria-current={selected ? 'true' : undefined}
              title={option.name}
              scroll={false}
              className={cx(
                'flex h-8 min-w-10 items-center justify-center rounded-full px-2.5 type-small motion-colors',
                selected ? 'bg-accent-soft text-accent' : 'text-fg-secondary hover:text-fg',
              )}
            >
              {option.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
