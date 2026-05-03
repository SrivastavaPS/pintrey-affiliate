// =============================================================================
// PAGE: /terms — Terms of Service
// =============================================================================
// PLAIN: Pinterest's review process also looks for a Terms page. This is a
//        minimal, honest TOS for our personal-use app.
//
// TECH:  Static server component. Mirrors /privacy structure.
// =============================================================================

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service — Pintrey Affiliate',
  description: 'Terms of service for the Pintrey Affiliate Pinterest automation tool.',
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white p-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 border-b border-gray-200 pb-6">
          <a href="/" className="text-sm text-rose-600 hover:underline">
            ← Back to Pintrey Affiliate
          </a>
          <h1 className="mt-4 text-4xl font-bold text-gray-900">
            Terms of Service
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Last updated: May 3, 2026
          </p>
        </header>

        <article className="prose prose-gray max-w-none space-y-6 text-gray-700">
          <section>
            <h2 className="text-2xl font-semibold text-gray-900">
              1. Acceptance
            </h2>
            <p>
              Pintrey Affiliate (&quot;the App&quot;) is a personal automation
              tool operated by Prateek Srivastava. By using the App, the
              operator accepts these Terms of Service. The App is intended
              solely for personal use by its operator and is not offered as a
              service to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900">
              2. Use of Third-Party APIs
            </h2>
            <p>
              The App accesses the Pinterest API, Amazon Product Advertising
              API, Groq API, Pollinations.ai, and Supabase using credentials
              supplied by the operator. The operator is responsible for
              complying with each provider&apos;s terms of service, including
              rate limits, content policies, and data handling rules.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900">
              3. Affiliate Marketing Disclosure
            </h2>
            <p>
              Pins published by the App contain Amazon Associates affiliate
              links. The operator earns a commission on qualifying purchases
              made through these links. Affiliate relationships are disclosed
              to viewers as required by applicable advertising laws and
              platform policies.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900">
              4. Content Responsibility
            </h2>
            <p>
              The operator is solely responsible for the products promoted, the
              content generated, and the accuracy of any claims made in pins.
              The App provides automation tools but does not endorse or verify
              the products linked.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900">
              5. No Warranty
            </h2>
            <p>
              The App is provided &quot;as is&quot; without warranties of any
              kind. The operator uses it at their own risk.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900">
              6. Limitation of Liability
            </h2>
            <p>
              The App&apos;s author shall not be liable for any indirect,
              incidental, or consequential damages arising from use of the App,
              including but not limited to lost commissions, account
              suspensions by third-party platforms, or data loss.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900">
              7. Changes to These Terms
            </h2>
            <p>
              These Terms may be updated from time to time. Continued use of
              the App after changes constitutes acceptance of the revised Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900">
              8. Contact
            </h2>
            <p>
              For questions:{' '}
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
