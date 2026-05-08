// =============================================================================
// UI PRIMITIVE — Skeleton
// =============================================================================
// PLAIN: Gray placeholder block shown while real content is loading.
// TECH:  Pulse animation via Tailwind.
// =============================================================================

import type { HTMLAttributes } from 'react';

export function Skeleton({
  className = '',
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={`animate-pulse rounded bg-slate-200 ${className}`}
    />
  );
}
