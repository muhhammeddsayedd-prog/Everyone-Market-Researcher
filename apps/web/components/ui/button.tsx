import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { cx } from './cx';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent-strong',
  secondary: 'bg-surface-2 text-fg border border-border-strong hover:bg-surface-3',
  ghost: 'bg-transparent text-fg-secondary hover:bg-surface-2 hover:text-fg',
};

// 36 px default, 44 px on touch-sized screens (DESIGN.md §6, §9 target size).
const SIZE: Record<Size, string> = {
  sm: 'h-8 px-3 type-small',
  md: 'h-11 md:h-9 px-4 type-body',
  lg: 'h-11 px-5 type-body-lg',
};

export function buttonClasses(variant: Variant = 'secondary', size: Size = 'md', className?: string) {
  return cx(
    'inline-flex items-center justify-center gap-2 rounded-sm whitespace-nowrap motion-colors',
    'active:translate-y-px disabled:pointer-events-none disabled:opacity-40',
    VARIANT[variant],
    SIZE[size],
    className,
  );
}

type ButtonProps = ComponentProps<'button'> & { variant?: Variant; size?: Size; icon?: ReactNode };

export function Button({ variant, size, icon, className, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button type={type} className={buttonClasses(variant, size, className)} {...rest}>
      {icon}
      {children}
    </button>
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: Variant; size?: Size; icon?: ReactNode };

export function ButtonLink({ variant, size, icon, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonClasses(variant, size, className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}
