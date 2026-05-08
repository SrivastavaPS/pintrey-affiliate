// =============================================================================
// SIDEBAR — primary navigation
// =============================================================================
// PLAIN: Vertical navigation rail with icons + labels for desktop.
//        Highlights the active route. Shows a red dot on Pin Manager when
//        there are pins awaiting review.
// TECH:  Client component (uses usePathname for active state).
// =============================================================================

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  PlusCircle,
  ListChecks,
  BarChart3,
  Settings,
  Sparkles,
} from 'lucide-react';
import type { ReactNode } from 'react';

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  /** PLAIN: Other paths that should keep this item highlighted. */
  matchPrefixes?: string[];
}

interface SidebarProps {
  /** PLAIN: Optional notification count to render as a red dot/badge. */
  pendingPinCount?: number;
}

const NAV: NavItem[] = [
  {
    href: '/',
    label: 'Dashboard',
    icon: <LayoutDashboard className="h-5 w-5" />,
  },
  {
    href: '/products',
    label: 'Products',
    icon: <Package className="h-5 w-5" />,
    matchPrefixes: ['/products'],
  },
  {
    href: '/products/add',
    label: 'Add Product',
    icon: <PlusCircle className="h-5 w-5" />,
  },
  {
    href: '/pin-manager',
    label: 'Pin Manager',
    icon: <ListChecks className="h-5 w-5" />,
    matchPrefixes: ['/pin-manager', '/queue'],
  },
  {
    href: '/analytics',
    label: 'Analytics',
    icon: <BarChart3 className="h-5 w-5" />,
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: <Settings className="h-5 w-5" />,
    matchPrefixes: ['/settings', '/niches/cleanup', '/pinterest/setup', '/poc'],
  },
];

export function Sidebar({ pendingPinCount = 0 }: SidebarProps) {
  const pathname = usePathname();

  function isActive(item: NavItem): boolean {
    if (pathname === item.href) return true;
    if (item.matchPrefixes) {
      return item.matchPrefixes.some(
        (p) => pathname === p || pathname.startsWith(p + '/')
      );
    }
    return false;
  }

  return (
    <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">
      {/* LOGO */}
      <Link
        href="/"
        className="flex h-16 items-center gap-2 border-b border-slate-200 px-6"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-rose-500 text-white">
          <Sparkles className="h-4 w-4" />
        </div>
        <span className="text-base font-semibold text-slate-900">Pintrey</span>
      </Link>

      {/* NAV LINKS */}
      <nav className="flex-1 space-y-1 p-3">
        {NAV.map((item) => {
          const active = isActive(item);
          const showBadge = item.href === '/pin-manager' && pendingPinCount > 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                'flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
              ].join(' ')}
            >
              <span className="flex items-center gap-3">
                {item.icon}
                {item.label}
              </span>
              {showBadge && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-semibold text-white">
                  {pendingPinCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* FOOTER */}
      <div className="border-t border-slate-200 p-3 text-xs text-slate-400">
        <p>Pintrey Affiliate</p>
        <p>v0.5 · Phase 2.5</p>
      </div>
    </aside>
  );
}
