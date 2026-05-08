// =============================================================================
// PAGE: /analytics — under construction placeholder
// =============================================================================
// PLAIN: Roadmap of what's coming. The data isn't there yet (Phase 3.0
//        adds click tracking; Phase 2.6 builds the funnel).
// TECH:  Static page; lists upcoming features.
// =============================================================================

import { Hammer, TrendingUp, MousePointerClick, IndianRupee, Brain, BarChart3 } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

const FEATURES = [
  {
    icon: <TrendingUp className="h-5 w-5" />,
    title: 'Pipeline funnel',
    description:
      'Products added → pins generated → approved → posted. See conversion rates between stages.',
    phase: '2.6',
  },
  {
    icon: <BarChart3 className="h-5 w-5" />,
    title: 'Per-niche performance',
    description:
      'Which niches actually convert? Compare approval rates and post counts by niche.',
    phase: '2.6',
  },
  {
    icon: <MousePointerClick className="h-5 w-5" />,
    title: 'Click-through tracking',
    description:
      'Track clicks on each pin via redirect URLs. See which pins drive traffic.',
    phase: '3.0',
  },
  {
    icon: <IndianRupee className="h-5 w-5" />,
    title: 'Sales attribution',
    description:
      'Upload Amazon affiliate report → match sales to pins → see actual revenue per pin.',
    phase: '3.0',
  },
  {
    icon: <Brain className="h-5 w-5" />,
    title: 'AI cost tracking',
    description:
      'Groq token usage per pin. Stays free at current volume but worth knowing.',
    phase: '2.6',
  },
];

export default function AnalyticsPage() {
  return (
    <>
      <TopBar
        title="Analytics"
        subtitle="Coming in Phase 2.6 + 3.0"
      />

      <div className="flex-1 p-4 md:p-8">
        <Card>
          <CardContent className="p-12">
            <div className="mx-auto max-w-2xl text-center">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                <Hammer className="h-7 w-7" />
              </div>
              <h2 className="text-2xl font-semibold text-slate-900">
                Under construction
              </h2>
              <p className="mt-2 text-slate-600">
                The analytics page is wired up but waiting on data sources.
                We&apos;ll need a few weeks of pin-posting + click tracking
                before charts become meaningful.
              </p>

              <div className="mt-10 grid gap-4 text-left sm:grid-cols-2">
                {FEATURES.map((f) => (
                  <div
                    key={f.title}
                    className="rounded-lg border border-slate-200 p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                        {f.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-slate-900">
                            {f.title}
                          </h3>
                          <Badge variant="primary">Phase {f.phase}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-slate-600">
                          {f.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
