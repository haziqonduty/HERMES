# Hermes — Project Memory

Auto-maintained by Caryn. Read before every session. Newest entries at the top of each section.

## Overview
- Hermes = digital engineering system for aircraft.
- Owner: Kay. Stack: Next.js / TypeScript / React / Tailwind / Supabase / Vercel.

## Built (log)
- 2026-10-27 — Scaffolded Next.js 16 app (TS, Tailwind v4, ESLint, App Router, `src/`). Added Supabase browser/server clients, `.env.example`, premium dark design tokens, and a landing/dashboard shell page. Initialised local git repo.

## Supabase
- Project ref `zpscotvpghrtvkchwhcj` — URL https://zpscotvpghrtvkchwhcj.supabase.co. Uses the new publishable key (`sb_publishable_...`), stored in `.env.local` as `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (renamed from ANON_KEY on 2026-10-27). Connection verified 2026-10-27 (auth health 200).
- The same two env vars must be added in Vercel when deploying.

## Decisions
- 2026-10-27 — App lives at repo root `C:\HERMES_PROJECT` (scaffolded in a temp dir because create-next-app rejects uppercase folder names).
- 2026-10-27 — Design: dark-first, deep navy/black base, cyan accent, glass panels, thin grid lines, mono numerics (Geist / Geist Mono). Placeholder until the user's reference image is supplied.

## Design
- 2026-10-27 — No reference image. User said to drop it; the current dark premium design is the direction. Don't ask for an image again.

## Open items
- GitHub: user says they connected GitHub (2026-10-27), but `gh` CLI is still not on this machine and the local repo has no remote. Need the repo URL to add `origin` and push.
- Supabase: no tables/schema yet.
- Vercel project not yet linked.

## Mistakes & lessons
- _(none yet)_
