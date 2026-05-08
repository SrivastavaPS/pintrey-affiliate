// =============================================================================
// TOP BAR — page-level header
// =============================================================================
// PLAIN: Sticky top bar with page title, optional subtitle, and a slot for
//        action buttons (e.g., "+ Add Product"). Also has a mobile menu
//        toggle (since sidebar is hidden on mobile).
//
// TECH:  Server-safe; receives title + subtitle as props from each page.
// =============================================================================

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Home, ListChecks } from 'lucide-react';

interface TopBarProps {
  title: string;
  subtitle?: string;
  /** PLAIN: Right-aligned action buttons (page-specific CTAs). */
  actions?: ReactNode;
  /** PLAIN: When true, shows back-to-home + queue icons (mobile only,
   *  since sidebar is hidden there). */
  showMobileNav?: boolean;
}

export function TopBar({
  title,
  subtitle,
  actions,
  showMobileNav = true,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white/80 px-4 backdrop-blur md:px-8">
      <div className="flex min-w-0 items-center gap-3">
        {/* MOBILE NAV ICONS — sidebar is hidden on small screens */}
        {showMobileNav && (
          <div className="flex items-center gap-1 md:hidden">
            <Link
              href="/"
              aria-label="Home"
              className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <Home className="h-5 w-5" />
            </Link>
            <Link
              href="/pin-manager"
              aria-label="Pin Manager"
              className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <ListChecks className="h-5 w-5" />
            </Link>
          </div>
        )}

        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-slate-900 md:text-lg">
            {title}
          </h1>
          {subtitle && (
            <p className="truncate text-xs text-slate-500 md:text-sm">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">{actions}</div>
    </header>
  );
}
