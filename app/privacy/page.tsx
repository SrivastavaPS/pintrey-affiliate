// =============================================================================
// PAGE: /privacy — Privacy Policy
// =============================================================================
// PLAIN: A real, complete privacy policy page so Pinterest accepts our app.
//        Pinterest requires a privacy policy hosted on the same domain as
//        the app. This page is publicly accessible and clearly labeled.
//
// TECH:  Static server component (no 'use client'). Renders Markdown-style
//        content as HTML. SEO-friendly metadata included.
// =============================================================================

import type { Metadata } from 'next';

// PLAIN: Browser tab title + meta description.
// TECH:  Next.js metadata API.
export const metadata: Metadata = {
  title: 'Privacy Policy — Pintrey Affiliate',
  description: 'Privacy policy for the Pintrey Affiliate Pinterest automation tool.',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white p-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 border-b border-gray-200 pb-6">
          <a
            href="/"
            className="text-sm text-rose-600 hover:underline"
          >
            ← Back to Pintrey Affiliate
          </a>
          <h1 className="mt-4 text-4xl font-bold text-gray-900">
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Last updated: May 3, 2026
          </p>
        </header>

        <article className="prose prose-gray max-w-none space-y-6 text-gray-700">
          <section>
            <h2 className="text-2xl font-semibold text-gray-900">
              1. Overview
            </h2>
            <p>
              Pintrey Affiliate (&quot;the App&quot;, &quot;we&quot;, &quot;us&quot;)
              is a personal automation tool operated by Prateek Srivastava that
              helps a single user (the operator) generate and publish Pinterest
              pins linked to their own Amazon Associates affiliate account.
              This Privacy Policy describes what data the App handles, where it
              is stored, and what it is used for.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900">
              2. Who Uses This App
            </h2>
            <p>
              This App is intended for personal use by its operator only. It is
              not a multi-user product, does not have public sign-up, and does
              not collect data from any third party or end user. The only
              person whose data flows through the App is the operator
              themselves.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900">
              3. Data We Collect and Process
            </h2>
            <p>The App processes the following categories of data:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                <strong>Operator-provided product data:</strong> Amazon product
                URLs, ASINs, titles, prices, and tags that the operator
                voluntarily adds to their personal product library.
              </li>
              <li>
                <strong>Pinterest account information:</strong> The operator&apos;s
                Pinterest username, account type, profile image URL, and list
                of boards. Retrieved via the Pinterest API using the operator&apos;s
                own access token.
              </li>
              <li>
                <strong>Generated content:</strong> AI-generated pin titles,
                descriptions, hashtags, and image URLs produced by the App.
              </li>
              <li>
                <strong>Operational logs:</strong> Pipeline run history, step
                statuses, timestamps, and error messages for debugging.
              </li>
            </ul>
            <p>
              The App does <strong>not</strong> collect, store, or transmit any
              data about other Pinterest users, viewers of the operator&apos;s
              pins, end consumers, or any party other than the operator.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900">
              4. Where Data Is Stored
            </h2>
            <p>
              Data is stored in a Supabase (PostgreSQL) database controlled by
              the operator. API credentials, access tokens, and configuration
              are stored in a local environment file
              (<code className="rounded bg-gray-100 px-1">.env.local</code>) on
              the operator&apos;s machine and are never transmitted off that
              machine except as required to call the third-party APIs listed
              below.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900">
              5. Third-Party Services
            </h2>
            <p>
              The App makes API calls to the following services on the
              operator&apos;s behalf, using credentials the operator supplies:
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                <strong>Pinterest API</strong> — to authenticate the operator,
                list their boards, and create pins on their account.
              </li>
              <li>
                <strong>Amazon Product Advertising API</strong> (when configured) —
                to fetch product information from Amazon India for the
                operator&apos;s own Associates account.
              </li>
              <li>
                <strong>Groq API</strong> — for niche discovery and pin copy
                generation using language models.
              </li>
              <li>
                <strong>Pollinations.ai</strong> — for AI-generated image content
                (no API key required).
              </li>
              <li>
                <strong>Supabase</strong> — as the database and storage backend.
              </li>
            </ul>
            <p>
              Each of these services has its own privacy policy. The App passes
              only the data necessary to perform the requested operation.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900">
              6. Data Sharing
            </h2>
            <p>
              The App does not sell, trade, or share data with any party other
              than the third-party services listed above (and only to the
              extent required to perform the operator&apos;s requested actions).
              No advertising networks, analytics providers, or other tracking
              services are integrated.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900">
              7. Data Retention
            </h2>
            <p>
              Operator-supplied data persists in the database until the
              operator deletes it via the App&apos;s built-in delete actions or
              by removing rows directly. Pipeline run logs are retained
              indefinitely for debugging unless the operator chooses to
              truncate them.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900">
              8. Security
            </h2>
            <p>
              API credentials are stored in environment variables, not in the
              database, and are never sent to the browser. All external API
              calls use HTTPS. The operator is responsible for keeping their
              credentials confidential.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900">
              9. Children&apos;s Privacy
            </h2>
            <p>
              The App is not directed to children under 13 and does not
              knowingly process data about children.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900">
              10. Changes to This Policy
            </h2>
            <p>
              This Privacy Policy may be updated from time to time. The
              &quot;Last updated&quot; date at the top of the page reflects the
              most recent revision.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900">
              11. Contact
            </h2>
            <p>
              For questions about this Privacy Policy, contact:{' '}
              <a
                href="mailto:prateeksrivastav598@gmail.com"
                className="text-rose-600 hover:underline"
              >
                prateeksrivastav598@gmail.com
              </a>
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}
