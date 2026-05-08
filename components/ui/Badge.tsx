// =============================================================================
// UI PRIMITIVE — Badge
// =============================================================================
// PLAIN: Small status pill. Variants for success/warning/danger/info/neutral.
// TECH:  Pure presentational; no state.
// =============================================================================

import type { HTMLAttributes } from 'react';

type BadgeVariant =
  | 'neutral'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const VARIANTS: Record<BadgeVariant, string> = {
  neutral: 'bg-slate-100 text-slate-700',
  primary: 'bg-indigo-50 text-indigo-700',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-red-700',
  info: 'bg-blue-50 text-blue-700',
};

export function Badge({
  variant = 'neutral',
  children,
  className = '',
  ...props
}: BadgeProps) {
  return (
    <span
      {...props}
      className={[
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        VARIANTS[variant],
        className,
      ].join(' ')}
    >
      {children}
    </span>
  );
}
