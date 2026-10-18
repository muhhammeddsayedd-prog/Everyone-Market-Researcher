import type { ReactNode } from 'react';

/** Kicker (micro-label) · H1 · optional meta line and actions (DESIGN.md §5.1). */
export function PageHeader({
  kicker,
  title,
  meta,
  actions,
}: {
  kicker: string;
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <p className="type-micro text-fg-label">{kicker}</p>
        <h1 className="mt-2 type-h1 text-balance">{title}</h1>
        {meta ? <div className="mt-2 type-body text-fg-muted">{meta}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
