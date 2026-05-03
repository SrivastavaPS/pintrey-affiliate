// =============================================================================
// PINTEREST API HELPERS
// =============================================================================
// PLAIN: Wrapper functions for the few Pinterest API endpoints we use.
//        Hides the raw fetch + auth header boilerplate so the rest of the
//        code can just say "list my boards" or "get my account."
//
// TECH:  Server-side only. Uses Pinterest API v5. Bearer auth via the
//        PINTEREST_ACCESS_TOKEN env var.
// =============================================================================

// PLAIN: Pinterest's API base URL (v5 is current).
// TECH:  All endpoints are POST/GET https://api.pinterest.com/v5/...
const PINTEREST_API = 'https://api.pinterest.com/v5';

// PLAIN: Pulls the Pinterest token out of env, throws if missing/placeholder.
// TECH:  Lazy: only validated when an API call is actually made, not at
//        module load — so dev server can start without Pinterest configured.
function getToken(): string {
  const token = process.env.PINTEREST_ACCESS_TOKEN;
  if (!token || token.startsWith('your_')) {
    throw new Error(
      '[pinterest] PINTEREST_ACCESS_TOKEN missing in .env.local. ' +
      'Generate one at https://developers.pinterest.com/apps/'
    );
  }
  return token;
}

// PLAIN: Generic fetch wrapper that adds the auth header and parses JSON.
// TECH:  Throws on non-2xx with body details for debuggability.
async function pinterestFetch<T = unknown>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const token = getToken();

  const response = await fetch(`${PINTEREST_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `[pinterest] ${response.status} ${path}: ${text.slice(0, 500)}`
    );
  }

  return JSON.parse(text) as T;
}

// =============================================================================
// PUBLIC API
// =============================================================================

// PLAIN: Shape of a Pinterest user account info response.
// TECH:  Subset of /v5/user_account fields we care about.
export interface PinterestAccount {
  username: string;
  account_type: string;
  profile_image: string;
}

// PLAIN: Shape of one Pinterest board.
// TECH:  Subset of /v5/boards items.
export interface PinterestBoard {
  id: string;
  name: string;
  description: string;
  privacy: 'PUBLIC' | 'PROTECTED' | 'SECRET';
  pin_count: number;
}

/**
 * PLAIN: Returns info about whose Pinterest account the token belongs to.
 *        Useful as a "is my token valid?" sanity check.
 *
 * TECH:  GET /v5/user_account.
 */
export async function getAccount(): Promise<PinterestAccount> {
  return pinterestFetch<PinterestAccount>('/user_account');
}

/**
 * PLAIN: Lists all the boards on your Pinterest account so you can pick
 *        which one to post pins to.
 *
 * TECH:  GET /v5/boards. Pinterest paginates with bookmark; we fetch up
 *        to 100 in one go, which covers virtually everyone.
 */
export async function listBoards(): Promise<PinterestBoard[]> {
  const data = await pinterestFetch<{ items: PinterestBoard[] }>(
    '/boards?page_size=100'
  );
  return data.items ?? [];
}
