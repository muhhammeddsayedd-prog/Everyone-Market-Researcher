import type { ReactNode } from 'react';
import { cx } from './cx';
import { DotsMark } from './dots-mark';

/** One-line title, one-line hint, optional action (DESIGN.md §6 EmptyState). */
export function EmptyState({
  title,
  hint,
  action,
  className,
}: {
  title: string;
  hint?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        'flex flex-col items-center gap-3 rounded-md border border-border px-6 py-12 text-center',
        className,
      )}
    >
      <DotsMark className="size-8 text-fg-muted" />
      <p className="type-h3 text-fg">{title}</p>
      {hint ? <p className="max-w-prose type-body text-fg-muted">{hint}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/** Explicit "not available yet" panel for evidence that has not been collected or processed. */
export function UnavailablePanel({
  title,
  reason,
  dependency,
  className,
}: {
  title: string;
  reason: string;
  dependency?: string;
  className?: string;
}) {
  return (
    <section
      className={cx('rounded-md border border-dashed border-border-strong px-5 py-6', className)}
      aria-label={title}
    >
      <p className="type-micro text-fg-label">Not available yet</p>
      <h3 className="mt-2 type-h3 text-fg">{title}</h3>
      <p className="mt-1 max-w-prose type-body text-fg-muted">{reason}</p>
      {dependency ? <p className="mt-3 type-small text-fg-muted">Depends on: {dependency}</p> : null}
    </section>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cx('skeleton block', className)} />;
}

export function KeyValue({
  items,
  className,
}: {
  items: { label: string; value: ReactNode }[];
  className?: string;
}) {
  return (
    <dl className={cx('grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2', className)}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="type-micro text-fg-label">{item.label}</dt>
          <dd className="mt-1 type-body text-fg break-words">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
