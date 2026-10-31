# HERMES-E — Go-live checklist

For the HERMES administrator and OC Engineering, before the squadron starts using HERMES for real records.
Work top to bottom; tick each box. Allow about half a day, plus the time to prepare the spreadsheets.

## 1. System ready
- [ ] **Administration → System status** shows every migration `0001`–`0010` as **Applied**.
      Run any missing file from `supabase/migrations/` in Supabase → SQL Editor, in number order.
- [ ] Live site opens: https://hermes-weld-one.vercel.app — sign-in works, dashboard loads.
- [ ] Supabase → Database → Backups: daily backups are on (paid plans), or you have a plan for regular exports.

## 2. Accounts and roles
- [ ] One named **Admin** account per person who administers HERMES (at least two, so one can cover the other). No shared logins.
- [ ] Every user created in **Administration → Users & roles** with the right role:
      Engineer · Planner · Supervisor · Commander · OC Engineering · Viewer.
- [ ] Each user signed in once and changed their temporary password under **My account**.
- [ ] Test or demo accounts deactivated.

## 3. Clear the sample data  ⚠ no undo
- [ ] Take a backup / export first.
- [ ] Open `supabase/snippets/clear_sample_data.sql`, change `confirm` from `'no'` to `'yes'`, run it in SQL Editor.
- [ ] The final check shows 0 aircraft, 0 engines, 0 defects, 0 work orders, 0 parts — and your users are still there.
      Defect and work-order numbers restart at `DEF-YY-0001` / `WO-YY-0001`.

## 4. Load the fleet baseline
Prepare the figures **as at one cut-over date**, agreed with the records section, from the engine log books and aircraft
technical records.

- [ ] **Administration → System status → Import fleet data**.
- [ ] **Aircraft first**: download the aircraft template, fill one row per aircraft (registration, type, airframe hours and
      cycles, number of engine positions), load it, fix anything flagged red, import.
- [ ] **Then engines**: download the engines template; one row per engine with TSN/CSN, TSO/CSO, overhaul interval,
      last overhaul date — and for fitted engines the aircraft registration, position and install date. Spare and
      in-overhaul engines leave those blank and set the status.
- [ ] Spot-check 3 aircraft and 5 engines in HERMES against the log books (hours, cycles, positions).

Re-importing the same file is safe: existing records are updated, and blank cells leave stored values unchanged.

## 5. Engineering limits
- [ ] **Administration → Engine limits**: set the **oil consumption limit** (qt/FH) and **overhaul interval** for each
      engine model **from the engine manual**. The app default of 0.5 qt/FH is a placeholder, not an approved limit.
- [ ] Record a baseline **Engine Health Index** assessment for each engine (engine passport → Health).
- [ ] Enter the **maintenance programme**: tasks per engine/aircraft with their intervals and last-done figures
      (Maintenance Planner → Add task).
- [ ] Load **store items** with opening stock (Inventory → Add item).

## 6. Dry run (one day, with the real team)
- [ ] Engineer logs the day's flights → aircraft and engine hours go up.
- [ ] Raise a defect → raise a work order from it → sign off steps → complete with notes → defect closes.
- [ ] Record an oil uplift, a chip check and a borescope inspection on one engine; check Health Monitoring.
- [ ] Commander opens **Commander View** and prints the **Commander Brief** (Reports → Print → Save as PDF).
- [ ] OC Engineering reviews the **Audit trail** — every change above is listed with name and time.
- [ ] Any wrong flight log deleted by a Supervisor / OC Engineering to confirm corrections work.

## 7. Go-live
- [ ] Announce the date: from then on, flight hours, defects and work are recorded in HERMES first.
- [ ] Keep paper records in parallel for the first month; compare at month end.
- [ ] Name a point of contact for problems and questions.

## After go-live — weekly
- [ ] Administration → Audit trail: skim for unexpected changes.
- [ ] Dashboard alerts and Maintenance Planner overdue list reviewed at the weekly engineering meeting.
- [ ] Deactivate accounts of personnel who are posted out (Users & roles → user → Active off).
