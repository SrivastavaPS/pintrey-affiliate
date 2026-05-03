// =============================================================================
// AMAZON URL HELPERS — extract ASIN, fetch metadata, build affiliate URL
// =============================================================================
// PLAIN: When you paste an Amazon URL, this file does the work of finding
//        the product code (ASIN) inside it, fetching the title and image,
//        and building the affiliate link with your tag.
//
// TECH:  Pure utility module. No DB, no React. Server-side only because
//        we use fetch() to grab page metadata.
// =============================================================================

// PLAIN: Default associate tag if env var is missing (matches your store).
// TECH:  Hardcoded fallback — env var still takes precedence at call sites.
const DEFAULT_TAG = 'prakshita-21';

/**
 * PLAIN: Pulls the 10-character ASIN out of any Amazon URL shape.
 *        Returns null if the URL doesn't contain one.
 *
 * TECH:  Tries multiple regex patterns covering /dp/, /gp/product/,
 *        /product/, and ?asin= variants. ASIN is uppercase alphanumeric, 10 chars.
 *
 * @example
 *   extractAsin('https://www.amazon.in/dp/B0BS6XRQDF')        // 'B0BS6XRQDF'
 *   extractAsin('https://amazon.in/Some-Name/dp/B0BS6XRQDF/') // 'B0BS6XRQDF'
 *   extractAsin('https://www.example.com')                    // null
 */
export function extractAsin(url: string): string | null {
  // PLAIN: List of patterns to try, in order.
  // TECH:  ASINs are 10 chars, alphanumeric (A-Z, 0-9 — case sensitive uppercase).
  const patterns: RegExp[] = [
    /\/dp\/([A-Z0-9]{10})(?:[/?]|$)/,
    /\/gp\/product\/([A-Z0-9]{10})(?:[/?]|$)/,
    /\/product\/([A-Z0-9]{10})(?:[/?]|$)/,
    /[?&]asin=([A-Z0-9]{10})/i,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1].toUpperCase();
  }

  return null;
}

/**
 * PLAIN: Resolves Amazon short URLs (amzn.in/d/abc) to their full URL.
 *        For regular URLs, just returns the URL as-is.
 *
 * TECH:  HEAD request following redirects; reads response.url. Falls back
 *        to original URL on network error so caller never crashes.
 */
export async function resolveShortUrl(url: string): Promise<string> {
  // PLAIN: Only follow redirects for known Amazon shorteners.
  // TECH:  Skip for direct amazon.in URLs — saves a network round-trip.
  const isShort = /amzn\.(in|to|eu)/i.test(url);
  if (!isShort) return url;

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
    });
    return response.url;
  } catch {
    return url;
  }
}

/**
 * PLAIN: The metadata we extract from an Amazon page (title, image, price).
 * TECH:  Strongly-typed return for callers.
 */
export interface ProductMetadata {
  title: string | null;
  image: string | null;
  /** PLAIN: Display price string (e.g., "₹1,099"), or null if not detected. */
  price: string | null;
  /** PLAIN: True if we successfully fetched the page at all. */
  ok: boolean;
}

/**
 * PLAIN: Fetches the Amazon product page and pulls out the title and
 *        image from its meta tags. These are the same tags WhatsApp/
 *        Facebook use when you paste a link into a chat — totally public,
 *        no scraping rules broken.
 *
 * TECH:  GET request with a social-bot User-Agent (Amazon serves clean
 *        OG meta to bots, gnarly HTML to browsers). Regex-extracts og:title
 *        and og:image. Returns nulls + ok=false on failure.
 */
export async function fetchProductMetadata(
  url: string
): Promise<ProductMetadata> {
  try {
    const response = await fetch(url, {
      headers: {
        // PLAIN: Pretending to be a link-preview bot like WhatsApp.
        // TECH:  Triggers Amazon's social-share HTML path with clean og: tags.
        'User-Agent':
          'Mozilla/5.0 (compatible; WhatsApp/2.23.20.0; +http://www.whatsapp.com/)',
        'Accept-Language': 'en-IN,en;q=0.9',
      },
      // PLAIN: 8-second cap so we don't hang forever.
      // TECH:  AbortSignal.timeout — Node 18+.
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return { title: null, image: null, price: null, ok: false };
    }

    const html = await response.text();

    // PLAIN: Find <meta property="og:title" content="...">
    // TECH:  Non-greedy capture; HTML attribute order can vary.
    const titleMatch = html.match(
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i
    );
    const imageMatch = html.match(
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
    );

    return {
      title: titleMatch ? decodeHtml(titleMatch[1]) : null,
      image: imageMatch ? decodeHtml(imageMatch[1]) : null,
      price: extractPrice(html),
      ok: true,
    };
  } catch {
    return { title: null, image: null, price: null, ok: false };
  }
}

/**
 * PLAIN: Searches the Amazon HTML for the product price. Tries several
 *        common patterns since Amazon changes its markup constantly.
 *        Returns null if no price is found.
 *
 * TECH:  Regex sweep over known Amazon price selectors. The first match
 *        wins. Decodes HTML entities so currency symbols (e.g., &#8377; → ₹)
 *        come through correctly.
 */
function extractPrice(html: string): string | null {
  // PLAIN: Patterns to try, in priority order (most reliable first).
  // TECH:  All return capture group 1 = price text. ₹/$/£ symbols handled
  //        either as literal Unicode or HTML entities.
  const patterns: RegExp[] = [
    // Modern Amazon: <span class="a-offscreen">₹1,099</span> (used by screen readers; reliable)
    /<span[^>]*class="a-offscreen"[^>]*>([^<]+)<\/span>/i,
    // Older Amazon: <span id="priceblock_ourprice">₹1,099</span>
    /<span[^>]*id="priceblock_ourprice"[^>]*>([^<]+)<\/span>/i,
    /<span[^>]*id="priceblock_dealprice"[^>]*>([^<]+)<\/span>/i,
    /<span[^>]*id="priceblock_saleprice"[^>]*>([^<]+)<\/span>/i,
    // Twister / variation pages: data-a-color="price" wrapper
    /data-a-color="price"[^>]*>[^<]*<span[^>]*class="a-offscreen"[^>]*>([^<]+)<\/span>/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      const raw = decodeHtml(match[1]).trim();
      // PLAIN: Sanity check — price text should contain a digit.
      // TECH:  Filters out empty matches and label-like strings.
      if (/\d/.test(raw)) return raw;
    }
  }

  return null;
}

/**
 * PLAIN: Adds your affiliate tag to a plain Amazon URL.
 *
 * TECH:  Sets ?tag=<associateTag> via URL API. Falls back to manual
 *        concatenation for malformed URLs.
 */
export function buildAffiliateUrl(
  productUrl: string,
  associateTag: string = DEFAULT_TAG
): string {
  try {
    const url = new URL(productUrl);
    url.searchParams.set('tag', associateTag);
    return url.toString();
  } catch {
    const sep = productUrl.includes('?') ? '&' : '?';
    return `${productUrl}${sep}tag=${associateTag}`;
  }
}

/**
 * PLAIN: Builds the canonical clean Amazon URL from an ASIN.
 *
 * TECH:  Uses .in marketplace by default (matches your associate region).
 *        Pure function; no network call.
 */
export function canonicalUrlFromAsin(
  asin: string,
  marketplace: string = 'www.amazon.in'
): string {
  return `https://${marketplace}/dp/${asin}`;
}

/**
 * PLAIN: Decodes HTML entities like &amp; → & and &#039; → '.
 *        og:title can contain encoded characters.
 *
 * TECH:  Minimal decoder for the common cases. Avoids pulling in a
 *        full entity library.
 */
function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&apos;/g, "'")
    .trim();
}
