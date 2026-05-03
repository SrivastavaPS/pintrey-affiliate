# Pintrey Affiliate

Automated Pinterest affiliate marketing pipeline for Amazon India.

A single click runs the full chain: AI picks a trending niche, picks a product
from your curated library, generates a Pinterest-ready image and copy, and
posts the pin to your Pinterest board with your affiliate link attached.

## What It Does

```
[ Run POC button ]
        ↓
[ Groq LLM picks niche of the day ]
        ↓
[ Library matches niche → real product picked ]
        ↓
[ Groq writes title + description + hashtags ]
        ↓
[ Pin uses real product image (or AI-generated fallback) ]
        ↓
[ Pinterest API posts to your selected board ]
        ↓
[ Every step logged to Supabase for tracking ]
```

## Stack

- **Frontend / API**: Next.js 16 (App Router) + TypeScript + Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **AI (niches + copy)**: Groq (Llama 3.3 70B) — free tier
- **Image generation**: Pollinations.ai (free) or product image directly
- **Affiliate**: Amazon Associates India (tag `prakshita-21`)
- **Posting**: Pinterest API v5

## Folder Structure

```
app/
├── page.tsx                    Home dashboard
├── poc/page.tsx                Run-the-pipeline UI with live event feed
├── products/add/page.tsx       Product library manager (paste Amazon URLs)
├── pinterest/setup/page.tsx    Pinterest token check + board picker
├── privacy/page.tsx            Privacy policy
├── terms/page.tsx              Terms of service
└── api/
    ├── poc/                    Pipeline orchestrator + sub-steps
    │   ├── run/                Calls all sub-steps in sequence
    │   ├── discover-niche/     Groq picks a niche
    │   ├── find-products/      Library → PA-API → mock fallback
    │   ├── generate-content/   Groq writes copy + image URL
    │   └── post-pin/           Pinterest API call
    ├── library/                CRUD for product_library
    └── pinterest/              Account + boards lookup

lib/
├── supabase.ts                 DB client + types
├── groq.ts                     AI client (JSON mode)
├── logger.ts                   Event logging helpers
├── amazon-url.ts               ASIN extraction + metadata fetch
└── pinterest.ts                Pinterest API wrapper

db/
├── schema.sql                  Phase 1 tables (run once in Supabase)
└── schema-additions.sql        Phase 1.5 product_library table
```

## Setup

### 1. Database
Create a Supabase project, then run the SQL files in order in the SQL Editor:

```
db/schema.sql            (creates pipeline_runs, niches, products, pins, pinterest_posts, events)
db/schema-additions.sql  (creates product_library + alters products.source check)
```

### 2. Environment Variables
Fill in `.env.local`:

| Var | Where to get it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API (keep secret) |
| `GROQ_API_KEY` | https://console.groq.com/keys |
| `AMAZON_ASSOCIATE_TAG` | Your Amazon Associates store tag |
| `PINTEREST_ACCESS_TOKEN` | https://developers.pinterest.com/apps/ |
| `PINTEREST_DEFAULT_BOARD_ID` | Use `/pinterest/setup` to look up |

Amazon PA-API keys are optional — the pipeline falls back to the curated
library and mock data when they are not set.

### 3. Run
```
npm install
npm run dev
```

Open http://localhost:3000 → add products at `/products/add` →
click **Run POC** at `/poc`.

## Phase Roadmap

| Phase | Status | What |
| --- | --- | --- |
| 1.0 — End-to-end POC | done | Pipeline plumbing, mock data, dry-run Pinterest |
| 1.5 — Product library | done | Manual product curation via paste-URL |
| 2.0 — Daily cron + scaling | pending | Auto-run N times per day, scale to 50 pins/day |
| 3.0 — Click + sale tracking | pending | Real attribution, performance analytics |
| 4.0 — A/B test + AI feedback loop | pending | AI learns winners, doubles down |
| 5.0 — Multi-affiliate | pending | Add Flipkart, Myntra, AJIO alongside Amazon |

## License

Personal-use software. Not for redistribution.
