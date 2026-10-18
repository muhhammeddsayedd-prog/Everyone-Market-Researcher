import type { Tone } from '@/lib/view/sources';
import { cx } from './cx';

const TONE: Record<Tone, string> = {
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
  muted: 'bg-surface-3 text-fg-muted',
};

const DOT: Record<Tone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  muted: 'bg-fg-muted',
};

/** Dot + text: status is never conveyed by colour alone. */
export function StatusPill({ tone, label, className }: { tone: Tone; label: string; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 type-small whitespace-nowrap',
        TONE[tone],
        className,
      )}
    >
      <span aria-hidden="true" className={cx('size-1.5 rounded-full', DOT[tone])} />
      {label}
    </span>
  );
}
