# Hermes — Project Instructions

Hermes is a **digital engineering platform for aircraft** (aircraft data, configurations, engineering records, and related workflows).

@AGENTS.md
@MEMORY.md

## Stack
- Next.js 16 (App Router, `src/` dir, `@/*` alias) · TypeScript · React 19 · Tailwind CSS v4
- Supabase (`@supabase/supabase-js`, `@supabase/ssr`) — clients in `src/lib/supabase/`
- Deploy: Vercel

## Commands
- `npm run dev` — local dev at http://localhost:3000
- `npm run build` — production build (run before saying something is done)
- `npm run lint`

## Conventions
- Next.js 16 differs from older versions: read `node_modules/next/dist/docs/` before using an unfamiliar API.
- Env vars live in `.env.local` (never committed). Required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Template: `.env.example`.
- Design tokens are in `src/app/globals.css` (`@theme`). Use them, don't hard-code colours.
- Visual direction: dark, premium aerospace/HUD aesthetic — see MEMORY.md "Design".

## Memory
Update `MEMORY.md` automatically after any meaningful change, decision, or mistake. No permission needed.
