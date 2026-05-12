// =============================================================================
// APP SHELL — root layout wrapper
// =============================================================================
// PLAIN: Wraps every page in the sidebar + main content area. Pages render
//        their own TopBar with title + actions.
//
// TECH:  Client component because the Sidebar reads pathname. Fetches the
//        pending-pin count once on mount and passes it to Sidebar for the
//        red-dot badge.
// =============================================================================

'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';

interface AppShellProps {
  children: ReactNode;
}

// PLAIN: Routes that render full-screen without the sidebar (e.g., login).
// TECH:  Pathname check at render; no client-side router state.
const FULLSCREEN_ROUTES = ['/login'];

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const isFullscreen = FULLSCREEN_ROUTES.includes(pathname);
  // PLAIN: Count of pending-review pins; drives the sidebar red dot.
  // TECH:  Single fetch on mount + every 60s. Background-only — no UI block.
  const [pendingPinCount, setPendingPinCount] = useState(0);

  useEffect(() => {
    // PLAIN: Skip the stats fetch on login screen — we're not authed yet.
    if (isFullscreen) return;

    let cancelled = false;
    async function fetchCount() {
      try {
        const res = await fetch('/api/stats/summary');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setPendingPinCount(data?.kpis?.pendingPins ?? 0);
        }
      } catch {
        // PLAIN: Silent fail — badge just stays at last value.
      }
    }
    fetchCount();
    const t = setInterval(fetchCount, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [isFullscreen]);

  // PLAIN: Full-screen pages (login) render without sidebar/wrapper.
  if (isFullscreen) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar pendingPinCount={pendingPinCount} />
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
