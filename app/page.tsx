// =============================================================================
// PAGE: / — Home dashboard
// =============================================================================
// PLAIN: The landing page. Hero card to run the automated pipeline plus
//        cards for each working feature (library, Pinterest setup).
//
// TECH:  Server component (no 'use client'). Pure JSX, no state.
// =============================================================================

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-rose-50 to-indigo-50">
      {/* HEADER */}
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Pintrey Affiliate
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Automated Pinterest affiliate marketing for Amazon India
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* HERO — RUN POC */}
        <a
          href="/poc"
          className="mb-8 block rounded-2xl bg-gradient-to-r from-rose-600 to-indigo-600 p-8 text-white shadow-lg transition hover:scale-[1.01]"
        >
          <p className="text-xs font-semibold uppercase tracking-wider opacity-90">
            Phase 1 POC
          </p>
          <h2 className="mt-2 text-3xl font-bold">
            Run the automated pipeline →
          </h2>
          <p className="mt-2 max-w-2xl text-sm opacity-90">
            AI picks a niche, finds a product from your library, generates a
            Pinterest pin, and posts it — all in one click.
          </p>
        </a>

        {/* FEATURE CARDS */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* PRODUCT LIBRARY */}
          <a
            href="/products/add"
            className="rounded-xl bg-white p-6 shadow transition hover:shadow-lg"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              Product Library
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              Paste Amazon URLs to add products the AI will promote.
            </p>
          </a>

          {/* PINTEREST SETUP */}
          <a
            href="/pinterest/setup"
            className="rounded-xl bg-white p-6 shadow transition hover:shadow-lg"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-red-600">
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              Pinterest Setup
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              Verify token, pick the board where pins should be posted.
            </p>
          </a>

          {/* RUN POC (duplicate as a card for clarity) */}
          <a
            href="/poc"
            className="rounded-xl bg-white p-6 shadow transition hover:shadow-lg"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Run POC</h3>
            <p className="mt-1 text-sm text-gray-600">
              Trigger the full pipeline and watch live progress.
            </p>
          </a>
        </div>

        {/* FOOTER LINKS */}
        <footer className="mt-12 border-t border-gray-200 pt-6 text-center text-xs text-gray-500">
          <a href="/privacy" className="hover:text-gray-700">
            Privacy
          </a>
          <span className="mx-2">·</span>
          <a href="/terms" className="hover:text-gray-700">
            Terms
          </a>
          <span className="mx-2">·</span>
          <a
            href="https://github.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-700"
          >
            GitHub
          </a>
        </footer>
      </div>
    </main>
  );
}
