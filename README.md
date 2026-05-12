# Pintrey Affiliate

> AI-powered Pinterest affiliate-marketing automation for Amazon India.
> Single-operator, free-tier stack, queue-based human-in-the-loop posting.

[![Next.js 16](https://img.shields.io/badge/Next.js-16-black)]()
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ecf8e)]()
[![Groq](https://img.shields.io/badge/Groq-Llama%203.3-orange)]()

---

## Table of Contents

1. [What this app does (60-second pitch)](#what-this-app-does)
2. [End-to-end user flow](#end-to-end-user-flow)
3. [How it works under the hood](#how-it-works-under-the-hood)
4. [Project structure](#project-structure)
5. [Setup](#setup)
6. [Daily workflow](#daily-workflow)
7. [Tech stack](#tech-stack)
8. [Phase roadmap](#phase-roadmap)

---

## What This App Does

| Plain English | Technical |
| --- | --- |
| You add Amazon products. The app's AI invents Pinterest niches, writes pin titles + descriptions + hashtags, picks an image, and queues each pin for your approval. You click Approve, copy-paste to Pinterest in 30 seconds, mark posted. Repeat daily. | Next.js 16 App Router + Supabase + Groq (Llama 3.3) + Pinterest API (manual mode default). Multi-microservice library architecture under `lib/`, thin API routes under `app/api/`, password-gated dashboard. |
| You manage the **library** (products), AI manages everything else, you make the **judgment call** at the end. | Three lifecycle tables: `product_library`, `library_pins`, `pinterest_posts`. Each has its own status enum; transitions are explicit. |
| Free to run if you stay under 1500 AI requests/day (Groq) and 500 MB database (Supabase free tier). | `process.env.GROQ_API_KEY` + `SUPABASE_SERVICE_ROLE_KEY`. No payment integration. |

---

## End-To-End User Flow

The whole pipeline, top-to-bottom, with both translations:

### Step 1 — Discover trending niches

| Plain English | Technical |
| --- | --- |
| You click "Discover top 10 niches" on the home dashboard. After ~10 seconds the AI returns 10 niche ideas like "Korean skincare", "Indoor plant stands", etc. — each with a confidence score and search keywords. | `POST /api/niches` → `lib/groq.ts:generateJson()` with `responseSchema` → upserts into `trending_niches` (UNIQUE on name to prevent duplicates). Score 0–100, keywords stored comma-separated. |
| You browse the niches. Click "🛒 Search Amazon" on any one to open Amazon India in a new tab pre-filled with the niche keywords. | `searchAmazonForNiche()` builds `https://www.amazon.in/s?k=<keywords>&tag=prakshita-21`. Affiliate tag attached so any subsequent purchase still pays you. |
| Don't want to browse Amazon yourself? Expand the niche card and click "✨ Generate 10 product ideas". AI proposes 10 specific products (e.g., "Mamaearth Onion Hair Oil 250 ml") with brand + price hint + search query. | `POST /api/niches/[id]/suggestions` → `lib/suggestions.ts:generateSuggestionsForNiche()`. Wipes pending suggestions for the niche, generates 10 fresh ones, returns them. Cached in `niche_product_suggestions`. |

### Step 2 — Add a product

| Plain English | Technical |
| --- | --- |
| Click "+ Add Product" anywhere. Pick "Amazon India" (other networks greyed). Paste an Amazon product URL. Click "Extract". | `POST /api/library` with `mode: 'preview'`. Resolves short URLs (amzn.in/d/...), pulls ASIN via `lib/amazon-url.ts:extractAsin()`, fetches the product page using a social-bot User-Agent. |
| Within 5 seconds the form shows: product title, price (auto-detected), image, and AI-suggested niche tags. AI also picks the best matching niche from your catalog — OR proposes a brand-new niche if nothing fits. | Page HTML scraped with 8 fallback strategies (`og:title`, `og:image`, `twitter:title`, `id="productTitle"`, `data-old-hires`, `id="landingImage"`, JSON-LD, plain `<title>`). Price extracted from `span.a-offscreen`. AI then receives title + existing niche list → returns top-3 matches or proposed new niche. |
| If Amazon's CAPTCHA blocked us (happens from Vercel's US datacenter), the form shows a yellow banner with manual fill-in fields. You paste the title and image URL from your browser, then click "Re-suggest niche" so AI re-classifies based on your manual title. | Detected by `title.startsWith('Amazon product ')`. UI exposes `editTitle` + `editImageUrl` overrides. The re-suggest call passes `body.title` so AI gets a real title instead of the ASIN-fallback string. |
| Review niche tags, change the primary niche if you disagree, then Save. | `POST /api/library` with `mode: 'save'`. UPSERT by ASIN; row goes into `product_library` with `niche_id`, `niche_tags`, `affiliate_url` (your tag appended). |

### Step 3 — Pin auto-generates

| Plain English | Technical |
| --- | --- |
| The form waits ~5–15 seconds during save. In that window the AI is also writing the Pinterest pin — title, description, hashtags, and choosing an image. | `lib/pins.ts:generatePinForProductId()` is called inline (not in background — Vercel kills bg promises). `maxDuration = 30s` on the route. |
| If anything fails (rare), the error shows in a toast with a "Open Pin Manager" action so you can retry. | `pin_gen_error` field returned in the response; UI calls `toast.warning` with action button. |
| The new pin lands in `/pin-manager` with status "Pending review". | `library_pins` row inserted with `status: 'pending_review'`. |

### Step 4 — Approve, reject, regenerate

| Plain English | Technical |
| --- | --- |
| Open Pin Manager. Section 1 "Pending review" shows all newly-generated pins. Click ✓ Approve, ✕ Reject, or ↻ Regenerate. | `PATCH /api/pins/[id]` with `{ status: 'approved' \| 'rejected' }`. Regenerate hits `POST /api/pins/[id]/regenerate` which deletes the old pin and creates a new one. |
| Approved pins move to Section 2 "Ready to post". | UI filter; underlying status is `approved`. |
| Rejected pins disappear but are kept for analytics (soft delete). | Status `rejected`; not displayed but row remains. |

### Step 5 — Post to Pinterest

| Plain English | Technical |
| --- | --- |
| In Pin Manager "Ready to post" section, click "📤 Open Pinterest". A new tab opens with Pinterest's pin builder pre-filled with your image URL, affiliate link, and full description (title + body + hashtags). | URL constructed: `https://www.pinterest.com/pin/create/button/?url=<affiliate>&media=<image>&description=<text>`. |
| Pinterest may not pre-fill everything depending on their UI. Use the "Copy" buttons on the title / description / link rows. Pick a board on Pinterest, click Save. | Each `CopyField` uses `navigator.clipboard.writeText()`. |
| Come back, click "✓ Mark posted". The pin moves to Section 3 "Posted" (history). | `PATCH /api/pins/[id]` with `{ status: 'posted', pin_url?, pinterest_pin_id? }`. `posted_at` timestamp set server-side. |

### Step 6 — Track performance

| Plain English | Technical |
| --- | --- |
| Open Analytics. See the funnel: products added → pins generated → approved → posted. Each stage shows a count and conversion %. | `GET /api/stats/funnel` aggregates from `product_library` + `library_pins`. UI renders horizontal bar chart via Recharts. |
| Below the funnel, a leaderboard of niches by posted-pin count tells you which niches your pipeline actually produces volume for. | `GET /api/stats/niches` joins niches → products → pins, ranks by posted count. |
| Click tracking + revenue per pin → coming in Phase 3.0. | Roadmap. Will use redirect URLs `/r/[id]` + Amazon affiliate report import. |

---

## How It Works Under The Hood

### Architecture

```
┌────────────┐   POST /api/library    ┌─────────────────┐
│  Browser   │ ─────────────────────► │  /api/library   │
│ (you)      │                        │  + lib/amazon-  │
└────────────┘                        │    url.ts       │
       ▲                              │  + lib/groq.ts  │
       │                              │  + lib/pins.ts  │
       │     toast.success            └────────┬────────┘
       │                                       │
       │                                       ▼
       │                              ┌─────────────────┐
       │                              │   Supabase      │
       │                              │  - product_lib  │
       │                              │  - library_pins │
       │                              │  - trending_n.. │
       │                              │  - niche_prod_..│
       │                              └─────────────────┘
       │
       │      GET /api/queue              ▲
       │ ────────────────────────────────►│
       │       (pin list grouped by       │
       └────── status: pending/approved/  │
              posted/failed)              │
```

### Microservice modules

| File | Plain | Technical |
| --- | --- | --- |
| `lib/supabase.ts` | Connects to the database. | Singleton Supabase client using service role key. Types for every table. |
| `lib/groq.ts` | Talks to the AI. | Wraps Groq's OpenAI-compatible API. `generateJson<T>(prompt, schema)` enforces structured output. |
| `lib/amazon-url.ts` | Parses Amazon URLs. | `extractAsin`, `resolveShortUrl`, `fetchProductMetadata` (8-strategy extractor), `buildAffiliateUrl`. |
| `lib/pins.ts` | Generates and manages pins. | `generatePinForProduct`, `setPinStatus`, `regeneratePin`, `getLatestPinsByProductIds`. |
| `lib/suggestions.ts` | AI product brainstorms. | `generateSuggestionsForNiche`, `markSuggestionAdded`, `dismissSuggestion`. |
| `lib/niche-cleanup.ts` | Finds and merges duplicate niches. | `findDuplicateClusters` (AI scan), `mergeNiches`, `bulkDeactivateNiches`. |
| `lib/pinterest.ts` | Pinterest API wrapper. | `getAccount`, `listBoards`. Used by `/pinterest/setup`. |
| `lib/auth.ts` | Password gate. | `isPasswordCorrect`, `createSessionToken`, `verifySessionToken`. HMAC-SHA256 via Web Crypto. |
| `lib/logger.ts` | Event log helpers. | `logEvent`, `startPipelineRun`, `endPipelineRun`. Writes to `events` table. |

### Database tables

| Table | Plain | Technical |
| --- | --- | --- |
| `trending_niches` | The niche catalog AI discovers. | `id`, `name` (UNIQUE), `description`, `score`, `keywords`, `is_active`, `last_used_at`. |
| `product_library` | Your hand-curated Amazon products. | `asin` (UNIQUE), `title`, `image_url`, `affiliate_url`, `niche_id` (FK), `niche_tags`, `source`, `is_active`. |
| `library_pins` | AI-generated pins per product. | `product_id` (FK CASCADE), `title`, `description`, `hashtags`, `image_url`, `status` (pending_review / approved / rejected / posted / failed), `posted_at`. |
| `niche_product_suggestions` | AI brainstorms for a niche. | `niche_id` (FK CASCADE), `product_name`, `brand`, `approximate_price`, `search_query`, `status` (pending / added / dismissed). |
| `pinterest_posts` | (Legacy) per-run Pinterest post tracking. | Used by older POC code path; kept for back-compat. |

---

## Project Structure

```
pintrey-affiliate-app/
├── app/
│   ├── page.tsx                Dashboard (KPIs + charts)
│   ├── login/page.tsx          Password gate
│   ├── products/page.tsx       Niche-grouped product browser
│   ├── products/add/page.tsx   Paste-URL extraction flow
│   ├── pin-manager/page.tsx    Pin queue (pending / approved / posted)
│   ├── queue/page.tsx          Auto-redirects to /pin-manager
│   ├── analytics/page.tsx      Funnel + niche leaderboard
│   ├── settings/page.tsx       Hub of admin pages
│   ├── admin/page.tsx          API keys & integration status
│   ├── niches/cleanup/page.tsx Duplicate-niche merger
│   ├── pinterest/setup/page.tsx Pinterest token + board picker
│   ├── privacy/page.tsx        Privacy policy (public)
│   ├── terms/page.tsx          Terms of service (public)
│   └── api/
│       ├── auth/               login + logout
│       ├── admin/secrets/      env-var status (read-only)
│       ├── library/            product CRUD + extraction
│       ├── niches/             niche CRUD + AI discovery + cleanup
│       │   ├── [id]/suggestions/  per-niche product suggestions
│       │   └── cleanup/        duplicate analysis + merge
│       ├── pins/               pin CRUD + regenerate
│       ├── queue/              unified pin list for /pin-manager
│       ├── dashboard/          niche tree for /products
│       ├── stats/              KPIs, funnel, per-niche leaderboard
│       └── pinterest/          account info + board list
├── components/
│   ├── layout/                 AppShell, Sidebar, TopBar
│   └── ui/                     Button, Card, Badge, Skeleton, EmptyState
├── lib/                        Microservice modules (see above)
├── db/                         SQL migrations (run in Supabase SQL editor)
│   ├── schema.sql              v1: per-run tables
│   ├── schema-additions.sql    v2: product_library
│   ├── schema-additions-v2.sql v3: trending_niches + niche_id FK
│   ├── schema-additions-v3.sql v4: library_pins
│   └── schema-additions-v4.sql v5: niche_product_suggestions
├── middleware.ts               Password-gate auth on every request
└── README.md                   This file
```

---

## Setup

### 1. Clone & install

```bash
git clone https://github.com/SrivastavaPS/pintrey-affiliate.git
cd pintrey-affiliate-app
npm install
```

### 2. Database

Create a Supabase project, then run the SQL files **in order** in the SQL Editor:

1. `db/schema.sql`
2. `db/schema-additions.sql`
3. `db/schema-additions-v2.sql`
4. `db/schema-additions-v3.sql`
5. `db/schema-additions-v4.sql`

### 3. Environment variables

Create `.env.local` (see `app/admin/page.tsx` for full status of every var):

```
# Auth gate
ADMIN_PASSWORD=pick-a-strong-password

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# AI
GROQ_API_KEY=gsk_<your-key>
GROQ_MODEL=llama-3.3-70b-versatile

# Amazon
AMAZON_ASSOCIATE_TAG=your-store-tag
AMAZON_HOST=webservices.amazon.in
AMAZON_REGION=eu-west-1
AMAZON_MARKETPLACE=www.amazon.in

# Pinterest (optional — manual mode bypasses these)
PINTEREST_MODE=manual
PINTEREST_ACCESS_TOKEN=
PINTEREST_DEFAULT_BOARD_ID=
```

### 4. Run

```bash
npm run dev
```

Open <http://localhost:3000> → sign in with the password from `ADMIN_PASSWORD`.

### 5. Deploy to Vercel

```bash
vercel link
vercel env add ADMIN_PASSWORD
# ...repeat for every var above
vercel deploy --prod
```

---

## Daily Workflow

| Time | What you do |
| --- | --- |
| **Morning, 5 min** | Open `/products` → Search Amazon for trending niches → paste 5–10 product URLs into `/products/add`. |
| **Lunch, 3 min** | Open `/pin-manager` → review the freshly-generated pins → approve the good ones, reject the bad, regenerate the meh. |
| **Evening, 5 min** | Open each approved pin → click "Open Pinterest" → paste → save on Pinterest → click "Mark posted". |
| **Weekly, 10 min** | Run `/niches/cleanup` to merge duplicates. Check `/analytics` for top-performing niches. |

---

## Tech Stack

| Layer | Tool | Why |
| --- | --- | --- |
| Frontend | Next.js 16 + React 19 | App Router, server components, Turbopack |
| Styling | Tailwind v4 + custom design tokens | Strict indigo/rose palette, no design drift |
| Icons | lucide-react | Free, tree-shakable, professional |
| Charts | recharts | Area + bar + donut, ~50KB gzipped |
| Toasts | sonner | Tiny, accessible, prebuilt animations |
| Database | Supabase (Postgres) | Free tier, real SQL, easy hosted |
| AI | Groq Llama 3.3 70B | Truly free tier, no quota games, fast |
| Image gen | Pollinations.ai | Free, no key, no rate limit |
| Hosting | Vercel | Free tier, native Next.js |
| Auth | Web Crypto HMAC | No external auth dep; single-password gate |

---

## Phase Roadmap

| Phase | Status | What |
| --- | --- | --- |
| 1.0 | ✅ done | End-to-end pipeline POC |
| 1.5 | ✅ done | Product library (manual paste-URL) |
| 2.0 | ✅ done | Trending niches as first-class entity |
| 2.1 | ✅ done | Niche-grouped dashboard, plan-B manual posting |
| 2.2 | ✅ done | Auto pin generation per library product |
| 2.3 | ✅ done | Approve / Reject / Regenerate flow |
| 2.4 | ✅ done | AI product suggestions per niche |
| 2.5 | ✅ done | Niche dedup / cleanup |
| 2.6 | ✅ done | Real analytics page (funnel + leaderboard) |
| 2.7 | ✅ done | Password auth wall + admin secrets panel |
| **3.0** | 🔜 next | **Click & sale tracking (redirect URLs + Amazon report import)** |
| 4.0 | upcoming | AI feedback loop (winners get prioritized) |
| 5.0 | upcoming | Multi-affiliate (Flipkart, Myntra, Meesho) |
| 6.0 | upcoming | Daily cron + bulk operations |

---

## Contributing / Personal Use

This app is built for a single operator. There is no multi-user support, no public sign-up, no team features. If you want to use it: fork, deploy, set your own `ADMIN_PASSWORD`, run.

---

## License

Personal-use software. Not for redistribution without permission.
