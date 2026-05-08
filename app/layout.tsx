// =============================================================================
// ROOT LAYOUT
// =============================================================================
// PLAIN: Wraps every page in the AppShell (sidebar + main content) and
//        loads the Inter font + Sonner toast container.
// TECH:  AppShell is a client component; layout itself stays server-side.
// =============================================================================

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import { AppShell } from '@/components/layout/AppShell';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Pintrey Affiliate',
  description:
    'AI-powered Pinterest affiliate marketing automation for Amazon India.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full bg-slate-50 font-sans text-slate-900 antialiased">
        <AppShell>{children}</AppShell>
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            style: { fontFamily: 'var(--font-inter)' },
          }}
        />
      </body>
    </html>
  );
}
