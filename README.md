# Campfire

A cozy co-working space for friends: synchronized focus timers, Shared Spark challenges, live presence and chat, and a session recap — built with Next.js (App Router) and Supabase (Postgres + Realtime).

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev
```

## Environment variables

| Variable | Required | Used for |
| --- | --- | --- |
| `CAMPFIRE_NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL (client + server) |
| `CAMPFIRE_NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `_PUBLISHABLE_KEY`) | yes | Browser Supabase client |
| `CAMPFIRE_SUPABASE_SERVICE_ROLE_KEY` | yes | Server-only writes in API routes |
| `AI_API_KEY` | optional | AI-generated sparks/explanations (falls back to the curated deck without it) |
| `AI_API_BASE` | optional | OpenAI-compatible base URL (default `https://api.openai.com/v1`) |
| `AI_MODEL` | optional | Model name (default `gpt-4o-mini`) |

The runtime provisions the `CAMPFIRE_`-prefixed names; `next.config.ts` maps them to the plain `NEXT_PUBLIC_*` names Next can inline. Unprefixed names also work as fallback.

## Deploying to Vercel

1. **Apply the database schema first** — run the migration in `supabase/` against your Supabase project (tables, RLS policies, RPCs, realtime publication). Schema reference: `docs/database-schema.md`.
2. **Push the repo to GitHub** and import it on [vercel.com/new](https://vercel.com/new). Vercel auto-detects Next.js — no build settings changes needed.
3. **Add the environment variables** in Project → Settings → Environment Variables, using the `CAMPFIRE_`-prefixed names from the table above (or the plain names — both work). Add them to Production, Preview and Development.
4. **Set the Supabase Auth allow-list** — add your Vercel domain(s) under Authentication → URL Configuration if you use Supabase Auth features.
5. **Deploy**, then sanity-check: create a room, open it in a second browser, confirm presence, chat, timer sync and a Shared Spark round trip.
6. Optional: set `AI_API_KEY` to enable AI-kindled sparks; without it the app quietly uses the predefined challenge deck (the room sees a "from the campfire deck" notice).

The actual Vercel import/connect needs the project owner's Vercel account — steps 2–5 are done in the Vercel dashboard.
