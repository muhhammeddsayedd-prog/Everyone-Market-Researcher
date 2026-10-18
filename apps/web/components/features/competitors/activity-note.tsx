import { formatCompact, formatRelative } from '@/lib/view/format';

/**
 * Recorded activity from the account counters. When nothing has been collected the UI says so
 * explicitly instead of showing zeros or a sparkline (stats_daily is not populated yet).
 */
export function ActivityNote({
  itemsRecorded,
  lastItemAt,
}: {
  itemsRecorded: number;
  lastItemAt: string | null;
}) {
  if (itemsRecorded === 0 && !lastItemAt)
    return <p className="type-small text-fg-muted">No activity collected yet</p>;
  return (
    <p className="type-small text-fg-muted tabular">
      {formatCompact(itemsRecorded)} items recorded
      {lastItemAt ? <> · last post {formatRelative(lastItemAt)}</> : null}
    </p>
  );
}
