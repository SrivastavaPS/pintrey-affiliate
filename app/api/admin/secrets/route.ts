// =============================================================================
// API ROUTE: GET /api/admin/secrets
// =============================================================================
// PLAIN: Returns the status of every env-var secret used by the app:
//          - configured (real value present)
//          - placeholder (still has the "your_xxx_here" stub)
//          - missing
//        ALWAYS masks the actual value — never returns plaintext secrets.
//
// TECH:  Server-side route reads process.env. Returns last 4 chars of each
//        value as a "fingerprint" the user can use to verify it matches.
// =============================================================================

import { NextResponse } from 'next/server';

// PLAIN: Status of one secret as the UI renders it.
interface SecretStatus {
  key: string;
  label: string;
  description: string;
  /** PLAIN: Configured / placeholder / missing. */
  status: 'configured' | 'placeholder' | 'missing';
  /** PLAIN: Last 4 chars of the value (e.g., "...gKx9"). Empty if not configured. */
  preview: string;
  /** PLAIN: Full character length of the value (helps spot truncation). */
  length: number;
  /** PLAIN: True if this env var is sensitive (token, secret, key). */
  sensitive: boolean;
  /** PLAIN: True if the app NEEDS this to function. */
  required: boolean;
}

interface SecretGroup {
  integration: string;
  description: string;
  items: SecretStatus[];
}

// PLAIN: Inspects an env var and returns a UI-friendly status object.
// TECH:  Detects placeholder values (anything starting with "your_" or
//        being one of the literal placeholders we ship in .env.local).
function readSecret(
  key: string,
  meta: { label: string; description: string; sensitive?: boolean; required?: boolean }
): SecretStatus {
  const raw = process.env[key];
  const value = (raw ?? '').trim();

  let status: SecretStatus['status'] = 'missing';
  if (value.length > 0) {
    const looksLikePlaceholder =
      value.startsWith('your_') ||
      value === 'placeholder' ||
      value === 'your_amazon_access_key_here' ||
      value === 'your_amazon_secret_key_here' ||
      value === 'your_pinterest_access_token_here' ||
      value === 'your_board_id_here' ||
      value === 'your_groq_api_key_here' ||
      value === 'your_gemini_api_key_here' ||
      value === 'your_bitly_token_here';
    status = looksLikePlaceholder ? 'placeholder' : 'configured';
  }

  // PLAIN: Build a tiny preview so the user can verify which value is set
  //        without exposing the full secret. e.g., "...XYZ4" for sensitive,
  //        full value for non-sensitive (like "prakshita-21").
  let preview = '';
  if (value.length > 0) {
    if (meta.sensitive) {
      preview = value.length > 4 ? `…${value.slice(-4)}` : '••••';
    } else {
      preview = value;
    }
  }

  return {
    key,
    label: meta.label,
    description: meta.description,
    status,
    preview,
    length: value.length,
    sensitive: meta.sensitive ?? false,
    required: meta.required ?? false,
  };
}

export async function GET() {
  const groups: SecretGroup[] = [
    {
      integration: 'Database — Supabase',
      description:
        'Stores all your products, niches, pins, and runs. App will not work without these.',
      items: [
        readSecret('NEXT_PUBLIC_SUPABASE_URL', {
          label: 'Project URL',
          description: 'Your Supabase project endpoint. Public.',
          sensitive: false,
          required: true,
        }),
        readSecret('NEXT_PUBLIC_SUPABASE_ANON_KEY', {
          label: 'Anon (public) key',
          description: 'Public API key. Safe to expose to browser.',
          sensitive: true,
          required: true,
        }),
        readSecret('SUPABASE_SERVICE_ROLE_KEY', {
          label: 'Service role key',
          description: 'ADMIN power — server-side only. Never expose.',
          sensitive: true,
          required: true,
        }),
      ],
    },
    {
      integration: 'AI — Groq',
      description:
        'Llama 3.3 70B for niche discovery, pin copy, product suggestions. Free tier.',
      items: [
        readSecret('GROQ_API_KEY', {
          label: 'API key',
          description: 'Get one free at console.groq.com/keys.',
          sensitive: true,
          required: true,
        }),
        readSecret('GROQ_MODEL', {
          label: 'Model name',
          description: 'Default: llama-3.3-70b-versatile.',
          sensitive: false,
          required: false,
        }),
      ],
    },
    {
      integration: 'Amazon Associates',
      description:
        'Affiliate links use your Associate tag. PA-API keys are optional (only needed for auto-discovery).',
      items: [
        readSecret('AMAZON_ASSOCIATE_TAG', {
          label: 'Associate tag (store ID)',
          description:
            'Appended as ?tag=... to every affiliate link. Required for commission tracking.',
          sensitive: false,
          required: true,
        }),
        readSecret('AMAZON_ACCESS_KEY', {
          label: 'PA-API access key',
          description:
            'Optional. Only needed if you have PA-API access (10 sales / 30 days requirement).',
          sensitive: true,
          required: false,
        }),
        readSecret('AMAZON_SECRET_KEY', {
          label: 'PA-API secret key',
          description: 'Optional. Pairs with the access key above.',
          sensitive: true,
          required: false,
        }),
        readSecret('AMAZON_HOST', {
          label: 'PA-API host',
          description: 'Default: webservices.amazon.in (India).',
          sensitive: false,
          required: false,
        }),
        readSecret('AMAZON_REGION', {
          label: 'AWS region',
          description: 'Default: eu-west-1 (used for India PA-API).',
          sensitive: false,
          required: false,
        }),
        readSecret('AMAZON_MARKETPLACE', {
          label: 'Marketplace',
          description: 'Default: www.amazon.in.',
          sensitive: false,
          required: false,
        }),
      ],
    },
    {
      integration: 'Pinterest',
      description:
        'Auto-posting + board lookup. Manual mode bypasses Pinterest API entirely.',
      items: [
        readSecret('PINTEREST_ACCESS_TOKEN', {
          label: 'Access token',
          description:
            'Generated at developers.pinterest.com. Required only if PINTEREST_MODE=auto.',
          sensitive: true,
          required: false,
        }),
        readSecret('PINTEREST_DEFAULT_BOARD_ID', {
          label: 'Default board ID',
          description: 'Where pins are posted in auto mode.',
          sensitive: false,
          required: false,
        }),
        readSecret('PINTEREST_MODE', {
          label: 'Mode',
          description:
            '"manual" = queue for manual posting (recommended). "auto" = auto-post via API.',
          sensitive: false,
          required: false,
        }),
      ],
    },
    {
      integration: 'Flipkart  · Coming soon',
      description:
        'Affiliate integration not yet built. Add credentials when Phase 5 ships.',
      items: [
        readSecret('FLIPKART_AFFILIATE_ID', {
          label: 'Affiliate ID',
          description: 'Not yet wired into the pipeline.',
          sensitive: false,
          required: false,
        }),
        readSecret('FLIPKART_API_TOKEN', {
          label: 'API token',
          description: 'Not yet wired.',
          sensitive: true,
          required: false,
        }),
      ],
    },
    {
      integration: 'Myntra  · Coming soon',
      description:
        'Myntra has no public affiliate API — integration would use partner network.',
      items: [
        readSecret('MYNTRA_AFFILIATE_ID', {
          label: 'Affiliate ID',
          description: 'Not yet wired.',
          sensitive: false,
          required: false,
        }),
      ],
    },
    {
      integration: 'Meesho  · Coming soon',
      description:
        'Meesho reseller integration. Not yet wired.',
      items: [
        readSecret('MEESHO_AFFILIATE_ID', {
          label: 'Affiliate ID',
          description: 'Not yet wired.',
          sensitive: false,
          required: false,
        }),
      ],
    },
  ];

  // PLAIN: Aggregate counts for the page header.
  const allItems = groups.flatMap((g) => g.items);
  const summary = {
    total: allItems.length,
    configured: allItems.filter((i) => i.status === 'configured').length,
    placeholder: allItems.filter((i) => i.status === 'placeholder').length,
    missing: allItems.filter((i) => i.status === 'missing').length,
    requiredMissing: allItems.filter(
      (i) => i.required && i.status !== 'configured'
    ).length,
  };

  return NextResponse.json({ groups, summary });
}
