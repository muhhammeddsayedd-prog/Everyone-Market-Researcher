'use client';

import { useState } from 'react';
import { initialsFor } from '@/lib/view/logo';
import { cx } from './cx';

const SIZE = {
  32: 'size-8 type-small',
  40: 'size-10 type-small',
  64: 'size-16 type-h3',
  96: 'size-24 type-h2',
} as const;

type LogoTileProps = { src: string | null; name: string; size: keyof typeof SIZE; className?: string };

/**
 * Stored logo on the dark tile (many logos are white-on-transparent), or initials when no
 * stored logo exists or it fails to load. Never a broken-image icon; logos are never recoloured.
 */
export function LogoTile({ src, name, size, className }: LogoTileProps) {
  const [failed, setFailed] = useState(false);
  const showImage = src !== null && !failed;
  return (
    <span
      className={cx(
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border bg-surface-2',
        SIZE[size],
        className,
      )}
    >
      {showImage ? (
        // Stored SVG/WebP from the project's own Storage bucket, constrained by CSP img-src.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="card-media size-full object-contain p-[12%]"
        />
      ) : (
        <span
          role="img"
          aria-label={name}
          className="font-semibold text-fg-secondary select-none"
          data-testid="logo-initials"
        >
          {initialsFor(name)}
        </span>
      )}
    </span>
  );
}
