// =============================================================================
// PAGE: /settings — hub for niche cleanup, Pinterest setup, POC, etc.
// =============================================================================
// PLAIN: Lists every "advanced" page so they don't clutter the main sidebar.
// TECH:  Static page with cards linking to existing routes.
// =============================================================================

import Link from 'next/link';
import {
  Wrench,
  PinIcon,
  Sparkles,
  FileText,
  ShieldCheck,
  ChevronRight,
  KeyRound,
} from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { Card, CardContent } from '@/components/ui/Card';

const SECTIONS = [
  {
    href: '/admin',
    icon: <KeyRound className="h-5 w-5" />,
    title: 'Admin · API keys & secrets',
    description:
      'View status of every API key, token, and integration. Edit instructions for Vercel & local.',
    accent: true,
  },
  {
    href: '/niches/cleanup',
    icon: <Wrench className="h-5 w-5" />,
    title: 'Niche cleanup',
    description: 'Find and merge duplicate niches with AI.',
  },
  {
    href: '/pinterest/setup',
    icon: <PinIcon className="h-5 w-5" />,
    title: 'Pinterest connection',
    description:
      'Verify your Pinterest API token, pick a default board, and check connection status.',
  },
  {
    href: '/poc',
    icon: <Sparkles className="h-5 w-5" />,
    title: 'Run POC pipeline',
    description:
      'Legacy one-click pipeline: AI niche → product → pin → post. Useful for end-to-end demos.',
  },
  {
    href: '/privacy',
    icon: <ShieldCheck className="h-5 w-5" />,
    title: 'Privacy policy',
    description: 'How this app handles your data.',
  },
  {
    href: '/terms',
    icon: <FileText className="h-5 w-5" />,
    title: 'Terms of service',
    description: 'Personal-use terms.',
  },
];

export default function SettingsPage() {
  return (
    <>
      <TopBar title="Settings" subtitle="Tools, integrations, legal" />

      <div className="flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-3xl">
          <ul className="space-y-3">
            {SECTIONS.map((s) => (
              <li key={s.href}>
                <Link href={s.href}>
                  <Card
                    className={`cursor-pointer transition-all hover:border-slate-300 hover:shadow-md ${
                      s.accent ? 'border-indigo-200 bg-indigo-50/30' : ''
                    }`}
                  >
                    <CardContent className="flex items-center gap-4 p-5">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                          s.accent
                            ? 'bg-indigo-600 text-white'
                            : 'bg-indigo-50 text-indigo-600'
                        }`}
                      >
                        {s.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-slate-900">
                          {s.title}
                        </h3>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {s.description}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                    </CardContent>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
