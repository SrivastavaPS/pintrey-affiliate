// =============================================================================
// PAGE: /pinterest/setup — wire up Pinterest in 3 clicks
// =============================================================================
// PLAIN: This page checks if your Pinterest token works, shows your account
//        info if it does, and lists all your boards so you can copy the
//        correct board ID into .env.local.
//
// TECH:  Client component. Calls /api/pinterest/account and /api/pinterest/boards
//        on mount. Single "Test Pinterest connection" button to retry after
//        env changes.
// =============================================================================

'use client';

import { useEffect, useState } from 'react';

// PLAIN: Shape of the account info we render.
// TECH:  Mirrors PinterestAccount from lib/pinterest.ts.
interface Account {
  username: string;
  account_type: string;
  profile_image: string;
}

// PLAIN: Shape of one board row in the picker.
// TECH:  Mirrors PinterestBoard.
interface Board {
  id: string;
  name: string;
  description: string;
  privacy: 'PUBLIC' | 'PROTECTED' | 'SECRET';
  pin_count: number;
}

export default function PinterestSetupPage() {
  // PLAIN: Connection state.
  // TECH:  null = not yet checked; populated on first fetch.
  const [account, setAccount] = useState<Account | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // PLAIN: Auto-check connection on first page load.
  // TECH:  useEffect with empty deps runs once on mount.
  useEffect(() => {
    void checkConnection();
  }, []);

  // PLAIN: Calls both endpoints in parallel and updates state.
  // TECH:  Promise.all for parallel fetch; sets error if either fails.
  async function checkConnection() {
    setLoading(true);
    setError(null);
    setAccount(null);
    setBoards([]);

    try {
      const [accRes, boardRes] = await Promise.all([
        fetch('/api/pinterest/account'),
        fetch('/api/pinterest/boards'),
      ]);

      const accData = await accRes.json();
      const boardData = await boardRes.json();

      if (!accData.ok) {
        setError(accData.error ?? 'Account check failed');
      } else {
        setAccount(accData.account);
      }

      if (boardData.ok) {
        setBoards(boardData.boards ?? []);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // PLAIN: Copies a board ID to clipboard so user can paste into .env.local.
  // TECH:  Browser Clipboard API; visual feedback for 2s.
  async function copyId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // PLAIN: Older browsers may not have clipboard — silently ignore.
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-rose-50 to-indigo-50 p-8">
      <div className="mx-auto max-w-4xl">
        {/* HEADER */}
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">
            Pinterest Setup
          </h1>
          <p className="mt-2 text-gray-600">
            Verify your access token, then pick a board to post pins to.
          </p>
        </header>

        {/* INSTRUCTIONS BANNER */}
        <section className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-6">
          <h2 className="text-lg font-semibold text-blue-900">
            One-time setup
          </h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-blue-900">
            <li>
              Go to{' '}
              <a
                href="https://developers.pinterest.com/apps/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold underline"
              >
                developers.pinterest.com/apps/
              </a>{' '}
              → sign in → click <b>Connect app</b>.
            </li>
            <li>
              Fill the form (name = "Pintrey Affiliate"), accept terms, and
              create the app.
            </li>
            <li>
              Open the app → find <b>Generate access token</b> → select scopes:{' '}
              <code className="rounded bg-white px-1 text-xs">boards:read</code>
              ,{' '}
              <code className="rounded bg-white px-1 text-xs">pins:read</code>,{' '}
              <code className="rounded bg-white px-1 text-xs">pins:write</code>
              ,{' '}
              <code className="rounded bg-white px-1 text-xs">
                user_accounts:read
              </code>
              .
            </li>
            <li>Copy the token (starts with <code>pina_</code>).</li>
            <li>
              Open <code>.env.local</code> → replace
              <code className="mx-1 rounded bg-white px-1 text-xs">
                PINTEREST_ACCESS_TOKEN=...
              </code>
              with your token. Save the file.
            </li>
            <li>
              <b>Restart the dev server</b> (Ctrl+C, then npm run dev) so the
              new token loads.
            </li>
            <li>
              Click <b>Re-check connection</b> below — your account should
              appear.
            </li>
          </ol>
        </section>

        {/* CONNECTION STATUS */}
        <section className="mb-8 rounded-xl bg-white p-6 shadow">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Connection
            </h2>
            <button
              onClick={checkConnection}
              disabled={loading}
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:bg-gray-400"
            >
              {loading ? 'Checking…' : 'Re-check connection'}
            </button>
          </div>

          {loading && !account && !error && (
            <p className="text-sm text-gray-500">
              Talking to Pinterest…
            </p>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
              <p className="font-semibold">✗ Connection failed</p>
              <p className="mt-1 font-mono text-xs">{error}</p>
              <p className="mt-2 text-red-600">
                Most common cause: token missing/wrong in .env.local, or
                server wasn&apos;t restarted after editing .env.local.
              </p>
            </div>
          )}

          {account && (
            <div className="flex items-center gap-4 rounded-lg bg-green-50 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {account.profile_image && (
                <img
                  src={account.profile_image}
                  alt={account.username}
                  className="h-12 w-12 rounded-full"
                />
              )}
              <div>
                <p className="font-semibold text-green-800">
                  ✓ Connected as @{account.username}
                </p>
                <p className="text-xs text-green-700">
                  Account type: {account.account_type}
                </p>
              </div>
            </div>
          )}
        </section>

        {/* BOARDS LIST */}
        {account && (
          <section className="rounded-xl bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">
              Your boards ({boards.length})
            </h2>

            {boards.length === 0 ? (
              <p className="text-sm text-gray-500">
                You don&apos;t have any boards yet. Create one on Pinterest
                first, then re-check.
              </p>
            ) : (
              <>
                <p className="mb-4 text-sm text-gray-600">
                  Pick the board you want pins posted to. Click{' '}
                  <b>Copy board ID</b>, then paste into{' '}
                  <code className="rounded bg-gray-100 px-1 text-xs">
                    PINTEREST_DEFAULT_BOARD_ID
                  </code>{' '}
                  in <code>.env.local</code>. Save and restart the server.
                </p>

                <ul className="space-y-3">
                  {boards.map((b) => (
                    <li
                      key={b.id}
                      className="flex items-center justify-between rounded-lg border border-gray-200 p-4"
                    >
                      <div>
                        <p className="font-semibold">{b.name}</p>
                        <p className="text-xs text-gray-500">
                          {b.privacy} · {b.pin_count} pins
                          {b.description && ` · ${b.description.slice(0, 80)}`}
                        </p>
                        <p className="mt-1 font-mono text-xs text-gray-400">
                          ID: {b.id}
                        </p>
                      </div>
                      <button
                        onClick={() => copyId(b.id)}
                        className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                          copiedId === b.id
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {copiedId === b.id ? '✓ Copied!' : 'Copy board ID'}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
