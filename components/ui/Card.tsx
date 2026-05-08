// =============================================================================
// UI PRIMITIVE — Card
// =============================================================================
// PLAIN: Standard card container with subtle border + shadow + padding.
//        Sub-components: CardHeader, CardTitle, CardDescription, CardContent.
// TECH:  Composable; mirrors shadcn/ui pattern.
// =============================================================================

import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ children, className = '', ...props }: CardProps) {
  return (
    <div
      {...props}
      className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }: CardProps) {
  return (
    <div className={`flex flex-col gap-1 p-6 pb-4 ${className}`}>{children}</div>
  );
}

export function CardTitle({ children, className = '' }: CardProps) {
  return (
    <h3 className={`text-lg font-semibold text-slate-900 ${className}`}>
      {children}
    </h3>
  );
}

export function CardDescription({ children, className = '' }: CardProps) {
  return <p className={`text-sm text-slate-500 ${className}`}>{children}</p>;
}

export function CardContent({ children, className = '' }: CardProps) {
  return <div className={`p-6 pt-0 ${className}`}>{children}</div>;
}

export function CardFooter({ children, className = '' }: CardProps) {
  return (
    <div
      className={`flex items-center gap-2 border-t border-slate-100 p-4 ${className}`}
    >
      {children}
    </div>
  );
}
