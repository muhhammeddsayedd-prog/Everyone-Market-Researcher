import { cx } from '@/components/ui/cx';

/** The everyone. logotype (519×87, currentColor), white on dark via the .wordmark filter. */
export function Wordmark({ width, className }: { width: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static brand SVG; next/image adds nothing here
    <img
      src="/brand/everyone-logotype.svg"
      alt="everyone."
      width={width}
      height={Math.round((width * 87) / 519)}
      className={cx('wordmark', className)}
    />
  );
}
