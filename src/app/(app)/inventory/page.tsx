import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { SetupNotice } from "@/components/setup-notice";
import { ButtonLink, Chip, KpiCard, PageHeader, StatusBadge, Table, Tabs } from "@/components/ui";
import { canEdit, getCurrentUser } from "@/lib/auth";
import { friendlyError, isMissingSchema } from "@/lib/db-errors";
import { fmtQty, movementKind, partCategory, stockLevel, stockState, type Part } from "@/lib/maintenance";
import { engineStatus, fmtHours } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Inventory · Hermes" };

const tabKeys = ["parts", "engines", "movements"] as const;

type SpareEngine = {
  id: string;
  serial_number: string;
  model: string;
  status: string;
  tso: number | null;
  overhaul_interval_hours: number | null;
  ehi: number | null;
  engine_installations: { removed_at: string | null }[];
};
type Movement = {
  id: string;
  moved_at: string;
  kind: string;
  quantity: number;
  reference: string | null;
  notes: string | null;
  work_order_id: string | null;
  parts: { id: string; part_number: string; description: string; unit: string } | null;
  work_orders: { wo_no: string | null } | null;
};

export default async function InventoryPage({ searchParams }: PageProps<"/inventory">) {
  const sp = (await searchParams) as { tab?: string; q?: string; level?: string; category?: string };
  const tab = tabKeys.find((t) => t === sp.tab) ?? "parts";
  const q = (sp.q ?? "").trim();
  const level = sp.level && sp.level in stockLevel ? sp.level : "";
  const category = sp.category && sp.category in partCategory ? sp.category : "";

  const [user, supabase] = await Promise.all([getCurrentUser(), createClient()]);
  const [partsRes, enginesRes, movesRes] = await Promise.all([
    supabase.from("parts").select("*").order("part_number").limit(2000).returns<Part[]>(),
    supabase
      .from("engines")
      .select("id, serial_number, model, status, tso, overhaul_interval_hours, ehi, engine_installations(removed_at)")
      .in("status", ["spare", "in_overhaul", "unserviceable"])
      .order("serial_number")
      .returns<SpareEngine[]>(),
    tab === "movements"
      ? supabase
          .from("stock_movements")
          .select("id, moved_at, kind, quantity, reference, notes, work_order_id, parts(id, part_number, description, unit), work_orders(wo_no)")
          .order("moved_at", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(200)
          .returns<Movement[]>()
      : null,
  ]);
  if (isMissingSchema(partsRes.error)) return <SetupNotice module="Inventory" file="0006_maintenance.sql" />;

  const parts = partsRes.data ?? [];
  const spares = (enginesRes.data ?? []).filter((e) => !e.engine_installations.some((i) => !i.removed_at));
  const count = (s: string) => parts.filter((p) => stockState(p) === s).length;
  const needle = q.toLowerCase();
  const shown = parts.filter(
    (p) =>
      (!level || stockState(p) === level) &&
      (!category || p.category === category) &&
      (!needle || [p.part_number, p.description, p.location, p.applicability].some((v) => v?.toLowerCase().includes(needle))),
  );

  const link = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ ...(tab !== "parts" && { tab }), ...(q && { q }), ...(level && { level }), ...(category && { category }), ...patch });
    for (const [k, v] of [...p]) if (!v) p.delete(k);
    const s = p.toString();
    return s ? `/inventory?${s}` : "/inventory";
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        eyebrow="HERMES-E · Maintenance"
        title="Inventory"
        description="Store stock, reorder levels, spare engines and the movement ledger."
        actions={
          canEdit(user.role) && (
            <ButtonLink href="/inventory/new" variant="primary">
              <Plus size={16} /> Add item
            </ButtonLink>
          )
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Stock lines" value={parts.length} hint={`${new Set(parts.map((p) => p.location)).size} locations`} />
        <KpiCard label="Below reorder" value={count("low")} hint="Raise a demand" color={count("low") ? "var(--warning)" : undefined} />
        <KpiCard label="Out of stock" value={count("out")} hint="Nil on hand" color={count("out") ? "var(--danger)" : undefined} />
        <KpiCard label="Spare engines" value={spares.filter((e) => e.status === "spare").length} hint="Serviceable, in store" color="var(--success)" />
        <KpiCard label="Engines in overhaul" value={spares.filter((e) => e.status === "in_overhaul").length} hint={`${spares.filter((e) => e.status === "unserviceable").length} unserviceable in store`} color="var(--gold)" />
      </section>

      <Tabs
        active={tab}
        tabs={[
          { key: "parts", label: "Store items", href: link({ tab: "" }) },
          { key: "engines", label: "Spare engines", href: link({ tab: "engines" }) },
          { key: "movements", label: "Movements", href: link({ tab: "movements" }) },
        ]}
      />

      {partsRes.error && <p className="text-sm text-danger">{friendlyError(partsRes.error)}</p>}

      {tab === "parts" && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <form className="flex min-w-64 flex-1 items-center gap-2 rounded-lg border border-border bg-surface/60 px-3 focus-within:border-gold/60">
              <Search size={15} className="text-muted" />
              <input name="q" defaultValue={q} placeholder="Search part no., description, location…" className="w-full bg-transparent py-2.5 text-sm outline-none" />
              {level && <input type="hidden" name="level" value={level} />}
              {category && <input type="hidden" name="category" value={category} />}
            </form>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(stockLevel).map(([k, m]) => (
                <Chip key={k} href={link({ level: level === k ? "" : k })} active={level === k} color={m.color}>
                  {m.label} <span className="font-mono text-muted">{count(k)}</span>
                </Chip>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(partCategory).map(([k, m]) => (
                <Chip key={k} href={link({ category: category === k ? "" : k })} active={category === k}>{m.label}</Chip>
              ))}
            </div>
          </div>
          <div className="panel overflow-hidden rounded-2xl">
            <Table
              head={["Part no.", "Description", "Category", "Location", "On hand", "Reorder level", "Stock"]}
              empty="No items match."
              rows={shown.map((p) => {
                const s = stockState(p);
                return [
                  <Link key="pn" href={`/inventory/${p.id}`} className="whitespace-nowrap font-mono hover:text-gold-soft">{p.part_number}</Link>,
                  <Link key="d" href={`/inventory/${p.id}`} className="block min-w-56 hover:text-gold-soft">
                    {p.description}
                    {p.applicability && <span className="mt-0.5 block text-xs text-muted">{p.applicability}</span>}
                  </Link>,
                  <span key="c" className="whitespace-nowrap text-muted">{partCategory[p.category]?.label ?? p.category}</span>,
                  <span key="l" className="whitespace-nowrap text-muted">{p.location}</span>,
                  <span key="q" className="whitespace-nowrap font-mono" style={{ color: stockLevel[s].color }}>
                    {fmtQty(p.quantity)} <span className="text-muted">{p.unit}</span>
                  </span>,
                  <span key="m" className="whitespace-nowrap font-mono text-muted">{fmtQty(p.min_quantity)}</span>,
                  <StatusBadge key="s" map={stockLevel} value={s} />,
                ];
              })}
            />
          </div>
          <p className="font-mono text-xs text-muted">{shown.length} of {parts.length} item(s)</p>
        </>
      )}

      {tab === "engines" && (
        <div className="panel overflow-hidden rounded-2xl">
          <Table
            head={["Engine", "Model", "Status", "TSO", "Hours to overhaul", "EHI"]}
            empty="No engines in store."
            rows={spares.map((e) => [
              <Link key="sn" href={`/engines/${encodeURIComponent(e.serial_number)}`} className="font-mono hover:text-gold-soft">{e.serial_number}</Link>,
              <span key="m" className="whitespace-nowrap text-muted">{e.model}</span>,
              <StatusBadge key="s" map={engineStatus} value={e.status} />,
              <span key="t" className="font-mono">{fmtHours(e.tso)}</span>,
              <span key="r" className="font-mono text-muted">
                {e.overhaul_interval_hours && e.tso != null ? fmtHours(Number(e.overhaul_interval_hours) - Number(e.tso)) : "—"}
              </span>,
              <span key="h" className="font-mono">{e.ehi ?? "—"}</span>,
            ])}
          />
        </div>
      )}

      {tab === "movements" && (
        <div className="panel overflow-hidden rounded-2xl">
          <Table
            head={["Date", "Part no.", "Description", "Movement", "Qty", "Work order", "Reference"]}
            empty="No stock movements yet."
            rows={(movesRes?.data ?? []).map((m) => [
              <span key="d" className="whitespace-nowrap font-mono text-muted">{m.moved_at}</span>,
              m.parts ? (
                <Link key="p" href={`/inventory/${m.parts.id}`} className="whitespace-nowrap font-mono hover:text-gold-soft">{m.parts.part_number}</Link>
              ) : "—",
              <span key="ds" className="block min-w-48">{m.parts?.description}</span>,
              <StatusBadge key="k" map={movementKind} value={m.kind} />,
              <span key="q" className="whitespace-nowrap font-mono" style={{ color: m.quantity < 0 ? "var(--warning)" : "var(--success)" }}>
                {m.quantity > 0 ? "+" : "−"}{fmtQty(Math.abs(m.quantity))} <span className="text-muted">{m.parts?.unit}</span>
              </span>,
              m.work_order_id ? (
                <Link key="w" href={`/work/${m.work_order_id}`} className="whitespace-nowrap font-mono text-accent hover:text-gold-soft">{m.work_orders?.wo_no}</Link>
              ) : (
                <span key="w" className="text-muted">—</span>
              ),
              <span key="r" className="whitespace-nowrap text-muted">{m.reference ?? m.notes ?? "—"}</span>,
            ])}
          />
        </div>
      )}
    </div>
  );
}
