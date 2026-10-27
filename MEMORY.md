# Hermes — Project Memory

Auto-maintained by Caryn. Read before every session. Newest entries at the top of each section.

## Overview
- Hermes = digital engineering system for aircraft.
- Owner: Kay. Stack: Next.js / TypeScript / React / Tailwind / Supabase / Vercel.

## Domain (from user's concept posters, 2026-10-27)
- HERMES = "Hercules Engineering Reliability Monitoring & Engineering Sustainment". Customer: RMAF / TUDM (Royal Malaysian Air Force). Tagline: "Transforming engineering data into engineering intelligence for mission readiness excellence."
- Primary fleet in posters 1–2: C-130H Hercules, T56-A-15 engines. Poster 3 dashboard mock shows helicopter engines (EC725 / AW139, "M703-xx" engine nos, Subang Air Base). Fleet scope still to confirm with user.
- Phase 1 = **HERMES-E (Engine) MVP**, piloted at No. 20 Squadron. MVP features: Executive Dashboard, Engine Digital Passport, Engine Configuration Mgmt, Flying Hours & Utilisation (FH/FC/CSN/TSN/TSO), Defect Mgmt, Oil Consumption Trend, Chip Detector Monitoring, Borescope Mgmt, Reliability Analytics (MTBF/MTBUR, Pareto failure modes), Engine Health Index (EHI 0–100), Engineering Report Generator, Admin & User Mgmt. Poster 3 adds Maintenance Planner, Work Management, Inventory, Commander Dashboard.
- Later modules: HERMES-H Hydraulic, -LG Landing Gear, -S Structure, -F Fuel, -AV Avionics, -R Reliability, -K Knowledge, -AI AI & Decision Support, around a HERMES Core Platform.
- Roles: Engineer, Planner, Supervisor, Commander, OC Engineering, Admin. RBAC + audit trail required.
- CONOPS loop: Collect → Validate → Analyse → Visualise → Alert → Plan → Learn (also Observe/Assess/Decide/Act/Learn).
- Standards: MIL-HDBK-1783B (ESIP), SAE JA1011/JA1012 (RCM), MSG-3, ISO 55000, CBM+, PHM.
- Roadmap: Y1 HERMES-E MVP → Y2 advanced analytics/AI (RUL) → Y3 hydraulic & propeller → Y4 landing gear & fuel → Y5 fleet ESIM.
- Visual style in posters: deep navy panels, gold/amber headings + gold winged "H" logo, cyan/blue data accents, green/amber/red status. Current site uses cyan/violet — should move to navy + gold.

## Built (log)
- 2026-10-27 — **Step 1 Foundation done.** Navy + gold design tokens (`globals.css`: `.panel`, `.label`, `.text-gold-gradient`), winged-H logo (`components/logo.tsx`), landing page, `/login` (Supabase email+password, server actions), auth `proxy.ts` (all routes except `/` and `/login` require sign-in), app shell `(app)/layout.tsx` with sidebar + mobile nav + topbar, Executive Dashboard (`/dashboard`) reading live Supabase data, placeholder page `(app)/[module]` for unbuilt modules (nav config in `lib/nav.ts`). SQL: `supabase/migrations/0001_foundation.sql` (roles enum, profiles, aircraft, engines, engine_installations, flight_logs, defects, audit_log + RLS) and `supabase/seed.sql` (sample 6× C-130H, 27× T56 engines, 5 defects).
- 2026-10-27 — Scaffolded Next.js 16 app (TS, Tailwind v4, ESLint, App Router, `src/`). Added Supabase browser/server clients, `.env.example`, premium dark design tokens, and a landing/dashboard shell page. Initialised local git repo.

## GitHub
- Repo: https://github.com/haziqonduty/HERMES (GitHub user `haziqonduty`). `origin` set, branch `main` tracks `origin/main`. First push 2026-10-27. Push over HTTPS works via Git Credential Manager; `gh` CLI not installed (not needed).

## Supabase
- Project ref `zpscotvpghrtvkchwhcj` — URL https://zpscotvpghrtvkchwhcj.supabase.co. Uses the new publishable key (`sb_publishable_...`), stored in `.env.local` as `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (renamed from ANON_KEY on 2026-10-27). Connection verified 2026-10-27 (auth health 200).
- The same two env vars must be added in Vercel when deploying.

## Decisions
- 2026-10-27 — App lives at repo root `C:\HERMES_PROJECT` (scaffolded in a temp dir because create-next-app rejects uppercase folder names).
- 2026-10-27 — Design: dark-first, deep navy/black base, cyan accent, glass panels, thin grid lines, mono numerics (Geist / Geist Mono). Placeholder until the user's reference image is supplied.

## Design
- 2026-10-27 — User later shared 3 concept posters (see "Domain"). Match their navy + gold + cyan style for the app UI.

## Open items
- Database schema: ask user what Hermes must track (aircraft, maintenance, documents, users…).
- Supabase: user must run `0001_foundation.sql` (+ optional `seed.sql`) in SQL Editor, create first user in Auth, and promote to admin. Not confirmed yet.
- Fleet scope: user said don't fix to one fleet (2026-10-27) — keep aircraft/engine types generic.
- Next: Step 2 — Fleet Overview + Engine Digital Passport/Configuration.
- Vercel: repo imported and both Supabase env vars added (Config type, all environments) on 2026-10-27. Live URL not yet recorded — ask user.

## Mistakes & lessons
- 2026-10-27 — Next.js 16 here has **Cache Components on by default**: any `cookies()`/`searchParams`/DB read or `usePathname`/`useSearchParams` on a dynamic route must sit inside `<Suspense>`, else the build fails. Pattern used: layout shell is static; user info + `{children}` stream in Suspense; dynamic `[module]` route uses `generateStaticParams`. Always run `npm run build` before committing.
- 2026-10-27 — `middleware.ts` is now `proxy.ts` (export `proxy`).
- 2026-10-27 — First logo draft read as "W" (V-shaped crossbar + beacon). Check logo/visual work with a headless Edge screenshot (`msedge --headless=new --screenshot=...`) before shipping.
- When a page needs a user's account to view (dashboard), I can't log in myself — ask the user to verify.
