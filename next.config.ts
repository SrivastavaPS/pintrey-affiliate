// =============================================================================
// NEXT.JS CONFIG
// =============================================================================
// PLAIN: Tells Next.js a few special rules — most importantly, don't try
//        to "understand" the amazon-paapi library because it uses an old
//        format Turbopack can't parse. We'll just load it at runtime.
//
// TECH:  serverExternalPackages excludes a package from the server bundle.
//        Node.js requires it directly at runtime, bypassing Turbopack's
//        AMD/CommonJS analyzer. Solves the TP1200 error.
// =============================================================================

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // PLAIN: Don't bundle these — load them from node_modules at runtime.
  // TECH:  Equivalent to webpack externals. Required for amazon-paapi
  //        because of its mixed AMD/CommonJS module format.
  serverExternalPackages: ['amazon-paapi'],
};

export default nextConfig;
