// =============================================================================
// AUTH HELPERS — sign + verify session tokens
// =============================================================================
// PLAIN: Tiny password-only auth. When the operator enters the correct
//        password on /login, we hand them a signed cookie. Middleware
//        checks that cookie on every request to keep the app private.
//
// TECH:  Uses Web Crypto (HMAC-SHA256). Works in both Node and Edge
//        runtimes — important because Next.js middleware runs on Edge.
// =============================================================================

// PLAIN: How long the cookie lasts (7 days).
// TECH:  Re-issued on each login; expiry baked into the signed payload.
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

// PLAIN: Where we store the signed token in the user's browser.
// TECH:  Standard httpOnly cookie name.
export const SESSION_COOKIE_NAME = 'pintrey-session';

/**
 * PLAIN: Confirms the password the user typed matches the one in env vars.
 *
 * TECH:  Constant-time comparison via Web Crypto digest to prevent
 *        timing attacks. If ADMIN_PASSWORD is unset we deny everything.
 */
export async function isPasswordCorrect(input: string): Promise<boolean> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || expected.length === 0) return false;

  // PLAIN: Compare hashes instead of raw strings — same outcome, no
  //        timing side-channel that could leak password length.
  // TECH:  SHA-256 both sides; compare byte-by-byte.
  const enc = new TextEncoder();
  const a = new Uint8Array(
    await crypto.subtle.digest('SHA-256', enc.encode(input))
  );
  const b = new Uint8Array(
    await crypto.subtle.digest('SHA-256', enc.encode(expected))
  );
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/**
 * PLAIN: Creates a tamper-proof session token. Format: <expiry>.<signature>.
 *
 * TECH:  HMAC-SHA256 over the expiry timestamp, signed with ADMIN_PASSWORD
 *        as the secret. Reading the token reveals when it expires but not
 *        the password — and you can't forge a new token without the secret.
 */
export async function createSessionToken(): Promise<string> {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) throw new Error('ADMIN_PASSWORD not set');

  const expiry = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const payload = String(expiry);
  const sig = await hmacHex(secret, payload);
  return `${payload}.${sig}`;
}

/**
 * PLAIN: Verifies a session token came from us and hasn't expired.
 *
 * TECH:  Recomputes the HMAC over the payload and constant-time compares
 *        to the signature half. Returns true only if both match AND the
 *        expiry is in the future.
 */
export async function verifySessionToken(token: string): Promise<boolean> {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) return false;
  if (!token || !token.includes('.')) return false;

  const [payload, sig] = token.split('.', 2);
  const expiry = parseInt(payload, 10);
  if (!Number.isFinite(expiry) || expiry < Date.now()) return false;

  const expected = await hmacHex(secret, payload);
  if (sig.length !== expected.length) return false;

  // PLAIN: Constant-time string compare.
  // TECH:  XOR each char code; OR into accumulator; if all zero, match.
  let diff = 0;
  for (let i = 0; i < sig.length; i++) {
    diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

// PLAIN: Helper — produces an HMAC-SHA256 of a message, returned as hex.
// TECH:  Web Crypto subtle API; works in Node 18+ and Edge runtime.
async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
