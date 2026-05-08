// =============================================================================
// PAGE: /queue — redirects to /pin-manager (renamed in Phase 2.6 redesign)
// =============================================================================
// PLAIN: Anyone hitting the old /queue URL is sent to /pin-manager.
// TECH:  Server-side redirect via Next.js redirect helper.
// =============================================================================

import { redirect } from 'next/navigation';

export default function QueueRedirect() {
  redirect('/pin-manager');
}
