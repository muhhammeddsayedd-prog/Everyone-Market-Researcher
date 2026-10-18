import { cx } from '@/components/ui/cx';
import { ACCOUNT_STATUS_META, FAMILY_LABEL, type FamilyHealth, type Tone } from '@/lib/view/sources';

const DOT: Record<Tone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  muted: 'bg-fg-muted',
};

/**
 * Five platform dots (Vimeo, Instagram, Website, LinkedIn, YouTube). A filled dot is the
 * recorded account status; a hollow ring means no source is recorded. Text alternatives
 * carry the meaning, never colour alone.
 */
export function HealthDots({ health, className }: { health: FamilyHealth[]; className?: string }) {
  return (
    <ul className={cx('flex items-center gap-1.5', className)} aria-label="Source status by platform">
      {health.map(({ family, status }) => {
        const label = `${FAMILY_LABEL[family]}: ${status ? ACCOUNT_STATUS_META[status].label : 'no source'}`;
        return (
          <li key={family} title={label} className="flex items-center">
            <span
              aria-hidden="true"
              className={cx(
                'block size-2.5 rounded-full',
                status ? DOT[ACCOUNT_STATUS_META[status].tone] : 'border border-border-strong',
              )}
            />
            <span className="sr-only">{label}</span>
          </li>
        );
      })}
    </ul>
  );
}
