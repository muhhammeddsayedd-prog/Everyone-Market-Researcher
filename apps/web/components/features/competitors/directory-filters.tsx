'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, useTransition, type ChangeEvent, type FormEvent } from 'react';
import { buttonClasses } from '@/components/ui/button';
import { cx } from '@/components/ui/cx';
import { directoryHref, normalizeSearch, type DirectoryParams } from '@/lib/directory/params';

export type FilterOption = { value: string; label: string };

type FilterProps = {
  params: DirectoryParams;
  categories: FilterOption[];
  capabilities: FilterOption[];
  activeCount: number;
};

const TIER_OPTIONS: FilterOption[] = [
  { value: 'baseline', label: 'Baseline' },
  { value: 'pilot', label: 'Pilot' },
  { value: 'next_wave', label: 'Next wave' },
  { value: 'adjacent', label: 'Adjacent' },
];
const STATUS_OPTIONS: FilterOption[] = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'archived', label: 'Archived' },
];
const SORT_OPTIONS: FilterOption[] = [
  { value: 'name', label: 'Name A–Z' },
  { value: '-name', label: 'Name Z–A' },
  { value: 'code', label: 'Company code' },
  { value: 'updated', label: 'Recently updated' },
];

/** Reads the form into directory params; empty values are dropped and paging restarts. */
function hrefFromForm(form: HTMLFormElement, params: DirectoryParams): string {
  const data = new FormData(form);
  const value = (name: string) => {
    const raw = data.get(name);
    return typeof raw === 'string' && raw !== '' ? raw : null;
  };
  return directoryHref(params, {
    q: normalizeSearch(value('q') ?? ''),
    tier: value('tier') as DirectoryParams['tier'],
    category: value('category'),
    capability: value('capability'),
    status: value('status') as DirectoryParams['status'],
    sort: (value('sort') ?? 'name') as DirectoryParams['sort'],
  });
}

function Select({
  name,
  label,
  value,
  options,
  placeholder,
  onChange,
}: {
  name: string;
  label: string;
  value: string | null;
  options: FilterOption[];
  placeholder?: string;
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
}) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="type-micro text-fg-label">
        {label}
      </label>
      <select
        id={id}
        name={name}
        defaultValue={value ?? ''}
        onChange={onChange}
        className="h-11 w-full min-w-0 rounded-sm border border-border-strong bg-surface-2 px-3 type-body text-fg md:h-9"
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Fields({
  params,
  categories,
  capabilities,
  autoSubmit,
  searchRef,
}: Omit<FilterProps, 'activeCount'> & {
  autoSubmit?: (event: { currentTarget: { form: HTMLFormElement | null } }) => void;
  searchRef?: React.Ref<HTMLInputElement>;
}) {
  const searchId = useId();
  return (
    <>
      <div className="flex min-w-0 flex-col gap-1 lg:col-span-2">
        <label htmlFor={searchId} className="type-micro text-fg-label">
          Search by name or code
        </label>
        <div className="relative">
          <Search
            aria-hidden="true"
            strokeWidth={1.5}
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted"
          />
          <input
            ref={searchRef}
            id={searchId}
            name="q"
            type="search"
            defaultValue={params.q}
            maxLength={80}
            autoComplete="off"
            placeholder="e.g. Good People or C012"
            className="h-11 w-full rounded-sm border border-border-strong bg-surface-2 pl-9 pr-3 type-body text-fg placeholder:text-fg-muted md:h-9"
          />
        </div>
      </div>
      <Select
        name="tier"
        label="Tier"
        value={params.tier}
        options={TIER_OPTIONS}
        placeholder="All tiers"
        onChange={autoSubmit}
      />
      <Select
        name="category"
        label="Category"
        value={params.category}
        options={categories}
        placeholder="All categories"
        onChange={autoSubmit}
      />
      <Select
        name="capability"
        label="In-house capability"
        value={params.capability}
        options={capabilities}
        placeholder="Any capability"
        onChange={autoSubmit}
      />
      <Select
        name="status"
        label="Status"
        value={params.status}
        options={STATUS_OPTIONS}
        placeholder="Any status"
        onChange={autoSubmit}
      />
      <Select name="sort" label="Sort" value={params.sort} options={SORT_OPTIONS} onChange={autoSubmit} />
    </>
  );
}

/**
 * Directory filters. A plain GET form (works without JavaScript) enhanced to navigate
 * client-side; every value ends up in the URL. Desktop shows a bar, phones a "Filters (n)" sheet.
 */
export function DirectoryFilters({ params, categories, capabilities, activeCount }: FilterProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const formKey = JSON.stringify([
    params.q,
    params.tier,
    params.category,
    params.capability,
    params.status,
    params.sort,
  ]);

  const navigate = (form: HTMLFormElement) => {
    const href = hrefFromForm(form, params);
    startTransition(() => router.push(href, { scroll: false }));
  };
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    navigate(event.currentTarget);
  };
  const onSheetSubmit = (event: FormEvent<HTMLFormElement>) => {
    onSubmit(event);
    setSheetOpen(false);
  };
  const autoSubmit = (event: { currentTarget: { form: HTMLFormElement | null } }) => {
    if (event.currentTarget.form) navigate(event.currentTarget.form);
  };

  // "/" focuses the filter search (DESIGN.md §7), unless the user is typing elsewhere.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.closest('input, textarea, select, [contenteditable="true"]');
      if (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const clearHref = directoryHref(params, {
    q: '',
    tier: null,
    category: null,
    capability: null,
    status: null,
  });

  return (
    <div aria-busy={pending}>
      <form
        key={formKey}
        role="search"
        aria-label="Filter competitors"
        method="get"
        action="/competitors"
        onSubmit={onSubmit}
        className="hidden gap-3 md:grid md:grid-cols-3 lg:grid-cols-7 lg:items-end"
      >
        {params.market ? <input type="hidden" name="market" value={params.market} /> : null}
        {params.view !== 'grid' ? <input type="hidden" name="view" value={params.view} /> : null}
        <Fields
          params={params}
          categories={categories}
          capabilities={capabilities}
          autoSubmit={autoSubmit}
          searchRef={searchRef}
        />
        <button type="submit" className="sr-only">
          Apply filters
        </button>
      </form>

      <div className="flex items-center gap-2 md:hidden">
        <Dialog.Root open={sheetOpen} onOpenChange={setSheetOpen}>
          <Dialog.Trigger className={buttonClasses('secondary', 'md')}>
            <SlidersHorizontal aria-hidden="true" strokeWidth={1.5} className="size-4" />
            Filters{activeCount ? ` (${activeCount})` : ''}
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="sheet-overlay fixed inset-0 z-[500] bg-[var(--color-overlay)]" />
            <Dialog.Content className="sheet-panel fixed inset-x-0 bottom-0 z-[500] max-h-[85svh] overflow-y-auto rounded-t-md border-t border-border-strong bg-surface-1 px-4 pb-6">
              <div className="flex h-14 items-center justify-between">
                <Dialog.Title className="type-h3">Filters</Dialog.Title>
                <Dialog.Close
                  aria-label="Close filters"
                  className="flex size-11 items-center justify-center rounded-sm text-fg-secondary hover:bg-surface-2"
                >
                  <X aria-hidden="true" strokeWidth={1.5} className="size-5" />
                </Dialog.Close>
              </div>
              <Dialog.Description className="sr-only">Narrow the competitors list</Dialog.Description>
              <form
                method="get"
                action="/competitors"
                onSubmit={onSheetSubmit}
                className="flex flex-col gap-4"
              >
                {params.market ? <input type="hidden" name="market" value={params.market} /> : null}
                {params.view !== 'grid' ? <input type="hidden" name="view" value={params.view} /> : null}
                <Fields params={params} categories={categories} capabilities={capabilities} />
                <button type="submit" className={buttonClasses('primary', 'lg', 'w-full')}>
                  Show results
                </button>
              </form>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
        {activeCount ? (
          <Link href={clearHref} className={cx(buttonClasses('ghost', 'md'))}>
            Clear all
          </Link>
        ) : null}
      </div>
    </div>
  );
}
