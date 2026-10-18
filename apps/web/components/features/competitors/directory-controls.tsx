import { ChevronLeft, ChevronRight, LayoutGrid, List, X } from 'lucide-react';
import Link from 'next/link';
import { cx } from '@/components/ui/cx';
import { directoryHref, PAGE_SIZE, type DirectoryParams } from '@/lib/directory/params';
import { formatCount } from '@/lib/view/format';

/** GRID / LIST pill switch; the choice lives in the URL so it survives back/forward. */
export function ViewToggle({ params }: { params: DirectoryParams }) {
  const options = [
    { value: 'grid', label: 'Grid', Icon: LayoutGrid },
    { value: 'list', label: 'List', Icon: List },
  ] as const;
  return (
    <nav aria-label="View" className="flex rounded-full border border-border-strong p-0.5">
      {options.map(({ value, label, Icon }) => {
        const selected = params.view === value;
        return (
          <Link
            key={value}
            href={directoryHref(params, { view: value })}
            aria-current={selected ? 'true' : undefined}
            scroll={false}
            className={cx(
              'flex h-8 items-center gap-1.5 rounded-full px-3 type-micro motion-colors',
              selected ? 'bg-surface-3 text-fg' : 'text-fg-muted hover:text-fg',
            )}
          >
            <Icon aria-hidden="true" strokeWidth={1.5} className="size-3.5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export type ActiveFilter = { key: keyof DirectoryParams; label: string };

/** Removable chips for each active filter plus "Clear all". */
export function ActiveFilters({ params, filters }: { params: DirectoryParams; filters: ActiveFilter[] }) {
  if (filters.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="type-micro text-fg-label">Filtered by</span>
      <ul className="flex flex-wrap gap-2">
        {filters.map((filter) => (
          <li key={filter.key}>
            <Link
              href={directoryHref(params, { [filter.key]: filter.key === 'q' ? '' : null })}
              className="inline-flex h-7 items-center gap-1.5 rounded-full border border-accent bg-accent-soft pl-3 pr-2 type-small text-accent motion-colors hover:bg-surface-2"
            >
              {filter.label}
              <X aria-hidden="true" strokeWidth={1.5} className="size-3.5" />
              <span className="sr-only">Remove filter</span>
            </Link>
          </li>
        ))}
      </ul>
      <Link
        href={directoryHref(params, {
          q: '',
          market: null,
          tier: null,
          category: null,
          capability: null,
          status: null,
        })}
        className="type-small text-fg-secondary underline-offset-4 hover:text-fg hover:underline"
      >
        Clear all
      </Link>
    </div>
  );
}

/**
 * Keyset pager. Page numbers are display-only; positions come from opaque cursors. Going back
 * to page 1 drops the cursor so the pinned baseline and first rows are always the same.
 */
export function DirectoryPagination({
  params,
  page,
  total,
  shown,
  nextCursor,
  prevCursor,
}: {
  params: DirectoryParams;
  page: number;
  total: number;
  shown: number;
  nextCursor: string | null;
  prevCursor: string | null;
}) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const prevHref =
    page <= 2 || !prevCursor
      ? directoryHref(params, { cursor: null, page: 1 })
      : directoryHref(params, { cursor: prevCursor, page: page - 1 });
  const nextHref = nextCursor ? directoryHref(params, { cursor: nextCursor, page: page + 1 }) : null;
  const linkClass =
    'inline-flex h-11 items-center gap-1 rounded-sm border border-border-strong bg-surface-2 px-3 type-body text-fg motion-colors hover:bg-surface-3 md:h-9';
  const disabledClass =
    'inline-flex h-11 items-center gap-1 rounded-sm border border-border px-3 type-body text-fg-muted opacity-60 md:h-9';

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3">
      <p className="type-small text-fg-muted tabular" aria-live="polite">
        Page {formatCount(Math.min(page, pages))} of {formatCount(pages)} · {formatCount(shown)} shown ·{' '}
        {formatCount(total)} companies
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={prevHref} rel="prev" className={linkClass}>
            <ChevronLeft aria-hidden="true" strokeWidth={1.5} className="size-4" />
            Previous
          </Link>
        ) : (
          <span aria-disabled="true" className={disabledClass}>
            <ChevronLeft aria-hidden="true" strokeWidth={1.5} className="size-4" />
            Previous
          </span>
        )}
        {nextHref ? (
          <Link href={nextHref} rel="next" className={linkClass}>
            Next
            <ChevronRight aria-hidden="true" strokeWidth={1.5} className="size-4" />
          </Link>
        ) : (
          <span aria-disabled="true" className={disabledClass}>
            Next
            <ChevronRight aria-hidden="true" strokeWidth={1.5} className="size-4" />
          </span>
        )}
      </div>
    </nav>
  );
}
