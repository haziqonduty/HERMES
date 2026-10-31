-- ⚠  CLEAR ALL ENGINEERING DATA — run once, just before go-live.
--
-- Deletes every aircraft, engine, installation, flight log, defect, health record,
-- maintenance task, work order, store item and stock movement, and the audit trail
-- of the sample data. Defect and work-order numbers restart at 0001.
-- KEEPS: user accounts, roles and passwords (auth.users, profiles).
--
-- There is no undo. Take a backup first if in doubt (Supabase → Database → Backups).
--
-- To run: change 'no' to 'yes' on the confirm line below, then Run in SQL Editor.

do $$
declare
  confirm text := 'no';   -- ← change to 'yes'
begin
  if confirm <> 'yes' then
    raise exception 'Nothing deleted. Change confirm to ''yes'' to clear the sample data.';
  end if;

  truncate table
    public.stock_movements,
    public.parts,
    public.work_order_steps,
    public.work_orders,
    public.maintenance_tasks,
    public.borescope_inspections,
    public.chip_checks,
    public.oil_samples,
    public.oil_uplifts,
    public.ehi_assessments,
    public.defects,
    public.flight_logs,
    public.engine_installations,
    public.engines,
    public.aircraft,
    public.audit_log
  restart identity;

  alter sequence public.defect_no_seq restart with 1;
  alter sequence public.work_order_no_seq restart with 1;

  raise notice 'Sample data cleared. User accounts kept.';
end $$;

-- Check: every count should be 0, and profiles should still list your users.
select
  (select count(*) from public.aircraft)  as aircraft,
  (select count(*) from public.engines)   as engines,
  (select count(*) from public.defects)   as defects,
  (select count(*) from public.work_orders) as work_orders,
  (select count(*) from public.parts)     as parts,
  (select count(*) from public.profiles)  as users_kept;
