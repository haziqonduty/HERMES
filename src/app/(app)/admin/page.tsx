import Link from "next/link";
import { CheckCircle2, CircleDashed, Plus, ShieldCheck, Upload } from "lucide-react";
import { AuditTable } from "@/components/audit-table";
import { SetupNotice } from "@/components/setup-notice";
import { Badge, ButtonLink, KpiCard, PageHeader, Table, Tabs, buttonClass } from "@/components/ui";
import { auditAction, auditTables, type AuditRow } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { friendlyError, isMissingSchema } from "@/lib/db-errors";
import { roleColor, roleLabels } from "@/lib/nav";
import { createClient } from "@/lib/supabase/server";
import { ModelLimitsForm, type UserProfile } from "./forms";
import { fetchAll } from "@/lib/fetch-all";
import { DEFAULT_OIL_LIMIT_QPH } from "@/lib/monitoring";

export const metadata = { title: "Administration" };

const PAGE_SIZE = 50;
type ListedUser = UserProfile & { created_at: string; last_sign_in_at: string | null };

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const sp = (await searchParams) as { tab?: string; table?: string; action?: string; user?: string; from?: string; to?: string; page?: string };
  const user = await getCurrentUser();
  const isAdmin = user.role === "admin";
  const canAudit = isAdmin || user.role === "oc_engineering";
  if (!canAudit)
    return (
      <div className="panel mx-auto max-w-2xl rounded-2xl p-8">
        <p className="label !text-gold">Restricted</p>
        <h1 className="mt-3 text-xl font-medium">Administration is for administrators</h1>
        <p className="mt-2 text-sm text-muted">Ask an administrator if you need a role change or an account for a colleague.</p>
      </div>
    );

  const tab = sp.tab === "audit" || !isAdmin ? "audit" : sp.tab === "system" || sp.tab === "limits" ? sp.tab : "users";
  const tabs = [
    ...(isAdmin ? [{ key: "users", label: "Users & roles", href: "/admin" }] : []),
    { key: "audit", label: "Audit trail", href: "/admin?tab=audit" },
    ...(isAdmin ? [{ key: "limits", label: "Engine limits", href: "/admin?tab=limits" }] : []),
    ...(isAdmin ? [{ key: "system", label: "System status", href: "/admin?tab=system" }] : []),
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        eyebrow="HERMES · System"
        title="Administration"
        description="User accounts and roles, the audit trail of every change, engine limits, data import and system status."
        actions={
          isAdmin &&
          (tab === "users" ? (
            <ButtonLink href="/admin/users/new" variant="primary">
              <Plus size={16} /> Add user
            </ButtonLink>
          ) : tab === "system" ? (
            <ButtonLink href="/admin/import" variant="primary">
              <Upload size={16} /> Import fleet data
            </ButtonLink>
          ) : null)
        }
      />
      <Tabs active={tab} tabs={tabs} />
      {tab === "users" && <Users />}
      {tab === "audit" && <Audit sp={sp} />}
      {tab === "limits" && <EngineLimits />}
      {tab === "system" && <System />}
    </div>
  );
}

async function Users() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_users");
  if (isMissingSchema(error) || error?.code === "PGRST202") return <SetupNotice module="Administration" file="0007_administration.sql" />;
  if (error) return <p className="text-sm text-danger">{friendlyError(error)}</p>;
  const users = (data ?? []) as ListedUser[];
  const active = users.filter((u) => u.active);

  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Users" value={users.length} hint={`${active.length} active · ${users.length - active.length} inactive`} />
        <KpiCard label="Administrators" value={active.filter((u) => u.role === "admin").length} hint="Active admin accounts" color="var(--gold)" />
        <KpiCard label="Can edit" value={active.filter((u) => !["viewer", "commander"].includes(u.role)).length} hint="Engineering roles" color="var(--success)" />
        <KpiCard label="Never signed in" value={active.filter((u) => !u.last_sign_in_at).length} hint="Accounts not yet used" />
      </section>

      <div className="panel overflow-hidden rounded-2xl">
        <Table
          head={["Name", "E-mail", "Role", "Squadron", "Status", "Last sign-in"]}
          empty="No users."
          rows={users.map((u) => [
            <Link key="n" href={`/admin/users/${u.id}`} className="block min-w-48 hover:text-gold-soft">
              {[u.rank, u.full_name].filter(Boolean).join(" ") || <span className="text-muted">(no name)</span>}
              {u.service_no && <span className="block font-mono text-xs text-muted">{u.service_no}</span>}
            </Link>,
            <span key="e" className="whitespace-nowrap font-mono text-xs">{u.email}</span>,
            <Badge key="r" color={roleColor(u.role)}>{roleLabels[u.role] ?? u.role}</Badge>,
            <span key="s" className="whitespace-nowrap text-muted">{u.squadron ?? "—"}</span>,
            <Badge key="a" color={u.active ? "var(--success)" : "var(--danger)"}>{u.active ? "Active" : "Inactive"}</Badge>,
            <span key="l" className="whitespace-nowrap font-mono text-xs text-muted">{u.last_sign_in_at ? u.last_sign_in_at.slice(0, 16).replace("T", " ") : "Never"}</span>,
          ])}
        />
      </div>
      <RoleGuide />
    </>
  );
}

function RoleGuide() {
  const rows: [string, string][] = [
    ["admin", "Everything, including user accounts and deleting records."],
    ["oc_engineering", "All engineering data, plus the audit trail."],
    ["supervisor", "Record and update all engineering and maintenance data."],
    ["planner", "Record and update all engineering and maintenance data."],
    ["engineer", "Record and update all engineering and maintenance data."],
    ["commander", "View everything, including Commander View and reports. Cannot change data."],
    ["viewer", "View only."],
  ];
  return (
    <section className="panel rounded-2xl p-6">
      <p className="label flex items-center gap-2"><ShieldCheck size={14} className="text-gold" /> What each role can do</p>
      <dl className="mt-4 grid gap-x-8 gap-y-3 text-sm md:grid-cols-2">
        {rows.map(([role, text]) => (
          <div key={role} className="flex gap-3">
            <dt className="w-32 shrink-0"><Badge color={roleColor(role)}>{roleLabels[role]}</Badge></dt>
            <dd className="text-muted">{text}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-xs text-muted">Permissions are enforced by the database (row-level security), not just hidden in the app. Every change is recorded in the audit trail.</p>
    </section>
  );
}

async function Audit({ sp }: { sp: { table?: string; action?: string; user?: string; from?: string; to?: string; page?: string } }) {
  const supabase = await createClient();
  const page = Math.max(1, Number(sp.page) || 1);
  const table = sp.table && sp.table in auditTables ? sp.table : "";
  const action = sp.action && sp.action in auditAction ? sp.action : "";
  const actor = sp.user && /^[0-9a-f-]{36}$/i.test(sp.user) ? sp.user : "";
  const date = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");
  const from = date(sp.from);
  const to = date(sp.to);

  // "estimated" is exact for small results and a planner estimate for large ones, so
  // big trails don't pay for a full count on every page. Paging uses one extra row instead.
  let query = supabase.from("audit_log").select("*", { count: "estimated" }).order("at", { ascending: false }).order("id", { ascending: false });
  if (table) query = query.eq("table_name", table);
  if (action) query = query.eq("action", action);
  if (actor) query = query.eq("actor", actor);
  // Dates are Malaysia days (UTC+8).
  if (from) query = query.gte("at", `${from}T00:00:00+08:00`);
  if (to) query = query.lte("at", `${to}T23:59:59.999+08:00`);

  const [res, profiles] = await Promise.all([
    query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE).returns<AuditRow[]>(),
    supabase.from("profiles").select("id, full_name, rank").order("full_name"),
  ]);
  if (res.error) return <p className="text-sm text-danger">{friendlyError(res.error)}</p>;

  const actors = new Map((profiles.data ?? []).map((p) => [p.id as string, [p.rank, p.full_name].filter(Boolean).join(" ") || "(no name)"]));
  const rows = (res.data ?? []).slice(0, PAGE_SIZE);
  const hasOlder = (res.data?.length ?? 0) > PAGE_SIZE;
  const total = Math.max(res.count ?? 0, (page - 1) * PAGE_SIZE + rows.length);
  const approx = total > 1000;
  const pages = Math.max(page, Math.ceil(total / PAGE_SIZE));
  const pageHref = (n: number) => {
    const p = new URLSearchParams({ tab: "audit", ...(table && { table }), ...(action && { action }), ...(actor && { user: actor }), ...(from && { from }), ...(to && { to }), page: String(n) });
    return `/admin?${p}`;
  };
  const select = "w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-gold/60 [&>option]:bg-surface";

  return (
    <>
      <form className="panel grid gap-3 rounded-2xl p-4 sm:grid-cols-2 lg:grid-cols-6">
        <input type="hidden" name="tab" value="audit" />
        <label className="block">
          <span className="label">Area</span>
          <select name="table" defaultValue={table} className={`mt-1.5 ${select}`}>
            <option value="">All areas</option>
            {Object.entries(auditTables).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Action</span>
          <select name="action" defaultValue={action} className={`mt-1.5 ${select}`}>
            <option value="">All actions</option>
            {Object.entries(auditAction).map(([k, m]) => (
              <option key={k} value={k}>{m.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">User</span>
          <select name="user" defaultValue={actor} className={`mt-1.5 ${select}`}>
            <option value="">All users</option>
            {[...actors].map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">From</span>
          <input type="date" name="from" defaultValue={from} className={`mt-1.5 ${select}`} />
        </label>
        <label className="block">
          <span className="label">To</span>
          <input type="date" name="to" defaultValue={to} className={`mt-1.5 ${select}`} />
        </label>
        <div className="flex items-end gap-2">
          <button type="submit" className={buttonClass("primary")}>Filter</button>
          <Link href="/admin?tab=audit" className={buttonClass()}>Clear</Link>
        </div>
      </form>

      <div className="panel overflow-hidden rounded-2xl">
        <AuditTable rows={rows} actors={actors} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 font-mono text-xs text-muted">
        <span>{approx && "about "}{total.toLocaleString("en-GB")} entr{total === 1 ? "y" : "ies"} · page {page} of {approx && "about "}{pages}</span>
        <div className="flex gap-2">
          {page > 1 && <Link href={pageHref(page - 1)} className={buttonClass()}>← Newer</Link>}
          {hasOlder && <Link href={pageHref(page + 1)} className={buttonClass()}>Older →</Link>}
        </div>
      </div>
    </>
  );
}

/** Which migrations are applied (each probe touches something that migration adds), and record counts. */
async function System() {
  const supabase = await createClient();
  const probe = async (table: string, column = "*") => {
    const { count, error } = await supabase.from(table).select(column, { count: "estimated", head: true });
    return { ok: !error, count: count ?? 0 };
  };
  // 0008/0009 add no table or column to probe; 0010 adds a function that reads the catalog.
  const checks = supabase.rpc("hermes_schema_checks").then(({ data }) => data as Record<string, boolean> | null);
  // Before 0010 the function is missing, so 0008/0009 are unknown rather than "not applied".
  const schema = async (key: string): Promise<{ ok: boolean | null; count: number }> => {
    const c = await checks;
    return { ok: c ? (c[key] ?? false) : key === "0010" ? false : null, count: 0 };
  };
  const modules = [
    { file: "0001_foundation.sql", name: "Foundation — users, aircraft, engines, defects, audit", check: probe("engines") },
    { file: "0002_fleet_configuration.sql", name: "Fleet configuration — installations, flight logs", check: probe("aircraft", "engine_positions") },
    { file: "0003_engine_health_index.sql", name: "Engine Health Index", check: probe("ehi_assessments") },
    { file: "0004_health_monitoring.sql", name: "Health monitoring — oil, SOAP, chip, borescope", check: probe("oil_uplifts") },
    { file: "0005_defects_reliability.sql", name: "Defects & reliability", check: probe("defects", "defect_no") },
    { file: "0006_maintenance.sql", name: "Maintenance — planner, work orders, inventory", check: probe("work_orders") },
    { file: "0007_administration.sql", name: "Administration — user status, admin functions", check: probe("profiles", "active") },
    { file: "0008_my_account.sql", name: "My Account — self-service profile", check: schema("0008") },
    { file: "0009_fixes.sql", name: "Fixes — Malaysia time, engine status guard, flight log correction", check: schema("0009") },
    { file: "0010_polish.sql", name: "Polish — work order reopen, audit indexes", check: schema("0010") },
  ];
  const results = await Promise.all(modules.map((m) => m.check));
  const counts = await Promise.all(
    (["aircraft", "engines", "flight_logs", "defects", "ehi_assessments", "oil_uplifts", "maintenance_tasks", "work_orders", "parts", "stock_movements", "audit_log"] as const).map(
      async (t) => [t, await probe(t)] as const,
    ),
  );
  const host = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/^https?:\/\//, "") ?? "not configured";

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="panel overflow-hidden rounded-2xl lg:col-span-2">
        <p className="label px-6 pt-6">Database migrations</p>
        <p className="px-6 pt-1 text-xs text-muted">Run any missing file in Supabase → SQL Editor, in order.</p>
        <ul className="mt-4 divide-y divide-border border-t border-border">
          {modules.map((m, i) => (
            <li key={m.file} className="flex items-center gap-4 px-6 py-3 text-sm">
              {results[i].ok ? <CheckCircle2 size={18} className="shrink-0 text-success" /> : <CircleDashed size={18} className={`shrink-0 ${results[i].ok === null ? "text-muted" : "text-warning"}`} />}
              <span className="min-w-0 flex-1">
                {m.name}
                <span className="block font-mono text-xs text-muted">supabase/migrations/{m.file}</span>
              </span>
              <span className={`whitespace-nowrap text-xs ${results[i].ok ? "text-success" : results[i].ok === null ? "text-muted" : "text-warning"}`}>
                {results[i].ok ? "Applied" : results[i].ok === null ? "Check after 0010" : "Not applied"}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <div className="space-y-6">
        <section className="panel rounded-2xl p-6">
          <p className="label">Records</p>
          <dl className="mt-4 space-y-2 text-sm">
            {counts.map(([t, r]) => (
              <div key={t} className="flex justify-between gap-4">
                <dt className="text-muted">{auditTables[t] ?? (t === "audit_log" ? "Audit entries" : t)}</dt>
                <dd className="font-mono">{r.ok ? r.count.toLocaleString("en-GB") : "—"}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="panel rounded-2xl p-6 text-sm">
          <p className="label">Environment</p>
          <dl className="mt-4 space-y-2">
            <div className="flex justify-between gap-4"><dt className="text-muted">Supabase project</dt><dd className="truncate font-mono text-xs">{host}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted">HERMES version</dt><dd className="font-mono text-xs">v0.8</dd></div>
          </dl>
        </section>
      </div>
    </div>
  );
}

/** Oil consumption limit and overhaul interval per engine model — set from the engine manual before go-live. */
async function EngineLimits() {
  const supabase = await createClient();
  const { data, error } = await fetchAll<{ model: string; status: string; oil_limit_qph: number | null; overhaul_interval_hours: number | null }>((from, to) =>
    supabase.from("engines").select("model, status, oil_limit_qph, overhaul_interval_hours, id").order("model").order("id").range(from, to),
  );
  if (error) return <p className="text-sm text-danger">{friendlyError(error)}</p>;

  const models = new Map<string, { count: number; oil: Map<string, number>; tbo: Map<string, number> }>();
  for (const e of data ?? []) {
    const m = models.get(e.model) ?? { count: 0, oil: new Map(), tbo: new Map() };
    const oil = e.oil_limit_qph === null ? `app default ${DEFAULT_OIL_LIMIT_QPH} qt/FH` : `${Number(e.oil_limit_qph)} qt/FH`;
    const tbo = e.overhaul_interval_hours === null ? "not set" : `${Number(e.overhaul_interval_hours).toLocaleString("en-GB")} FH`;
    m.count++;
    m.oil.set(oil, (m.oil.get(oil) ?? 0) + 1);
    m.tbo.set(tbo, (m.tbo.get(tbo) ?? 0) + 1);
    models.set(e.model, m);
  }
  const summary = (values: Map<string, number>, count: number) =>
    [...values].map(([v, n]) => (values.size === 1 ? v : `${v} (${n} of ${count})`)).join(", ");

  return (
    <div className="space-y-4">
      <div className="panel rounded-2xl border-l-2 !border-l-warning p-5 text-sm">
        <p className="font-medium text-warning">Use the limits from the engine manual</p>
        <p className="mt-1 text-muted">
          Engines without an oil limit use the app default of {DEFAULT_OIL_LIMIT_QPH} qt/FH, which is a placeholder, not an approved
          figure. Health Monitoring flags caution above 80% of the limit and alert above it. Single engines can still be set on their
          own Edit page.
        </p>
      </div>
      {models.size === 0 && <p className="panel rounded-2xl p-6 text-sm text-muted">No engines yet. Import or add engines first.</p>}
      {[...models].map(([model, m]) => (
        <section key={model} className="panel rounded-2xl p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-mono text-lg text-gold-soft">{model}</h2>
            <span className="text-xs text-muted">{m.count} engine{m.count === 1 ? "" : "s"}</span>
          </div>
          <dl className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
            <div><dt className="label inline">Oil limit</dt> <dd className="inline font-mono">{summary(m.oil, m.count)}</dd></div>
            <div><dt className="label inline">Overhaul interval</dt> <dd className="inline font-mono">{summary(m.tbo, m.count)}</dd></div>
          </dl>
          <div className="mt-4 border-t border-border pt-4">
            <ModelLimitsForm model={model} />
          </div>
        </section>
      ))}
    </div>
  );
}
