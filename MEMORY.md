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
- 2026-10-27 — **Step 3 Engine Health Index + dashboard upgrade done.** Migration `0003_engine_health_index.sql`: table `ehi_assessments` (6 component scores 0–100; generated `ehi` = weighted vib/oil/hot 20%, comp/acc 15%, fuel 10%, capped at worst component + 25); trigger keeps `engines.ehi` = latest assessment; migrates existing manual EHI as a "Baseline" assessment. Optional `supabase/seed_0003_health_history.sql` = 11 months sample history. Engine form no longer edits EHI. Passport has a **Health** tab (trend chart, component bars, history table, record-assessment form with live EHI preview). Dashboard: 12-month fleet EHI trend, EHI distribution bands, alert summary (critical/warning/info), fleet utilisation (FH last 30 days), overhaul forecast. Components: `components/trend-chart.tsx` (client SVG line chart with crosshair tooltip), `lib/health.ts` (ehiComponents, ehiBands, monthlyAverage).
- 2026-10-27 — **Step 2 Fleet & Engine Passport done.** Migration `0002_fleet_configuration.sql` (adds `aircraft.engine_positions`; RPCs `install_engine` / `remove_engine`; `flight_logs` trigger rolls hours/cycles up to aircraft + engines installed on the flight date). Pages: `/fleet` (cards, search, status chips), `/fleet/new`, `/fleet/[registration]` (engine positions with install/remove, flight log form, open defects, removal history), `/fleet/[registration]/edit`, `/engines` (table, search/status/sort), `/engines/new`, `/engines/[serial]` passport (tabs: overview, configuration, defects, timeline via `?tab=`), `/engines/[serial]/edit`. Shared: `components/ui.tsx` (PageHeader, Badge, StatusBadge, Table, Chip, ButtonLink, Stat), `components/form.tsx` (Field, SelectField, TextArea, SubmitButton, FormMessage), `lib/status.ts` (status label/colour maps, fmtHours), `lib/db-errors.ts` (friendlyError), `canEdit(role)` in `lib/auth.ts`. Server actions call `refresh()` from `next/cache` to update the page.
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
- Supabase: `0001_foundation.sql` + `seed.sql` run and admin user created — confirmed by user 2026-10-27. Migrations are applied by the USER pasting into SQL Editor (I have no DB access); always tell them which new file to run.
- Vercel live URL still not recorded.
- Fleet scope: user said don't fix to one fleet (2026-10-27) — keep aircraft/engine types generic.
- `0002_fleet_configuration.sql` run by user — confirmed 2026-10-27.
- Step 2 pages not yet verified logged-in by user (I can't sign in).
- User must run `0003_engine_health_index.sql` + optional `seed_0003_health_history.sql` (pushed 2026-10-27). Not yet confirmed.
- Next: Step 4 Health Monitoring — raw inputs (oil consumption/SOAP samples, chip detector findings, borescope inspections) at `/health`, feeding alerts and assessments.
- Vercel: repo imported and both Supabase env vars added (Config type, all environments) on 2026-10-27. Live URL not yet recorded — ask user.

## Mistakes & lessons
- 2026-10-27 — Next.js 16 here has **Cache Components on by default**: any `cookies()`/`searchParams`/DB read or `usePathname`/`useSearchParams` on a dynamic route must sit inside `<Suspense>`, else the build fails. Pattern used: layout shell is static; user info + `{children}` stream in Suspense; dynamic `[module]` route uses `generateStaticParams`. Always run `npm run build` before committing.
- 2026-10-27 — `middleware.ts` is now `proxy.ts` (export `proxy`).
- 2026-10-27 — `usePathname()` on a dynamic route also needs Suspense under Cache Components; sidebar uses a `WithPathname` render-prop wrapper with an unhighlighted fallback.
- 2026-10-27 — First logo draft read as "W" (V-shaped crossbar + beacon). Check logo/visual work with a headless Edge screenshot (`msedge --headless=new --screenshot=...`) before shipping.
- When a page needs a user's account to view (dashboard), I can't log in myself — ask the user to verify. To eyeball a component visually, render it on a temporary public page (add path to PUBLIC_PATHS in `lib/supabase/proxy.ts`), screenshot with headless Edge, then delete the page and revert the proxy before committing.
- Charts: followed the dataviz skill — single series per chart (no legend, title names it), 2px line, crosshair tooltip, status colours always paired with text labels.
