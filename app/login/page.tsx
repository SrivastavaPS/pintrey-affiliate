// =============================================================================
// PAGE: /login — password gate
// =============================================================================
// PLAIN: One field, one button. Enter the ADMIN_PASSWORD → cookie set →
//        you're in. After success, redirects to wherever you were trying
//        to go (?redirect=/admin etc.).
// TECH:  Client component. No sidebar (this is shown to logged-out users).
// =============================================================================

'use client';

import { useState } from 'react';
import { Lock, KeyRound, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setBusy(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? 'Invalid password');
        return;
      }

      toast.success('Welcome in');

      // PLAIN: Bounce back to wherever the user was originally going,
      //        or home if it's a fresh visit.
      // TECH:  Read the ?redirect=... query param if present.
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get('redirect') ?? '/';
      // PLAIN: Use replace so login doesn't stay in browser history.
      window.location.replace(redirect);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 p-4">
      <div className="w-full max-w-sm">
        {/* LOGO */}
        <div className="mb-6 flex flex-col items-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-rose-500 text-white shadow-lg">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="mt-3 text-xl font-semibold text-slate-900">
            Pintrey Affiliate
          </h1>
          <p className="text-sm text-slate-500">Private app · log in to continue</p>
        </div>

        {/* FORM */}
        <form
          onSubmit={handleLogin}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Password
            </span>
            <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 focus-within:border-indigo-500">
              <Lock className="h-4 w-4 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
                autoFocus
                placeholder="••••••••"
                className="block w-full bg-transparent py-2.5 text-sm focus:outline-none disabled:opacity-50"
              />
            </div>
          </label>

          <Button
            type="submit"
            className="mt-4 w-full"
            loading={busy}
            disabled={!password}
            icon={<KeyRound className="h-4 w-4" />}
          >
            Sign in
          </Button>

          <p className="mt-4 text-center text-xs text-slate-500">
            Set <code className="rounded bg-slate-100 px-1">ADMIN_PASSWORD</code>{' '}
            in your Vercel env vars to enable login.
          </p>
        </form>
      </div>
    </div>
  );
}
