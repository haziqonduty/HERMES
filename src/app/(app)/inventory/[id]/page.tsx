import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SetupNotice } from "@/components/setup-notice";
import { StatusBadge, Table } from "@/components/ui";
import { canEdit, getCurrentUser } from "@/lib/auth";
import { isMissingSchema } from "@/lib/db-errors";
import { fmtQty, movementKind, partCategory, stockLevel, stockState, type Part } from "@/lib/maintenance";
import { createClient } from "@/lib/supabase/server";
import { MovementForm, PartForm } from "../forms";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Movement = {
  id: string;
  moved_at: string;
  kind: string;
  quantity: number;
  reference: string | null;
  notes: string | null;
  work_order_id: string | null;
  work_orders: { wo_no: string | null; title: string } | null;
};

export default async function PartPage({ params }: PageProps<"/inventory/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const [user, supabase] = await Promise.all([getCurrentUser(), createClient()]);
  const [partRes, movesRes] = await Promise.all([
    supabase.from("parts").select("*").eq("id", id).returns<Part[]>().maybeSingle(),
    supabase
      .from("stock_movements")
      .select("id, moved_at, kind, quantity, reference, notes, work_order_id, work_orders(wo_no, title)")
      .eq("part_id", id)
      .order("moved_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500)
      .returns<Movement[]>(),
  ]);
  if (isMissingSchema(partRes.error)) return <SetupNotice module="Inventory" file="0006_maintenance.sql" />;
  const p = partRes.data;
  if (!p) notFound();

  const moves = movesRes.data ?? [];
  const s = stockState(p);
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const since90 = new Date(now.getTime() - 90 * 86_400_000).toISOString().slice(0, 10);
  const used90 = moves.filter((m) => m.moved_at >= since90 && Number(m.quantity) < 0 && m.kind === "issue").reduce((t, m) => t - Number(m.quantity), 0);
  // Days of cover at the last quarter's issue rate.
  const cover = used90 > 0 ? Math.floor(Number(p.quantity) / (used90 / 90)) : null;
  const editable = canEdit(user.role);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link href="/inventory" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft size={14} /> Inventory
      </Link>

      <section className="panel rounded-2xl p-6 md:p-8">
        <p className="label !text-gold">Store item · {partCategory[p.category]?.label ?? p.category}</p>
        <h1 className="mt-1 flex flex-wrap items-center gap-3 font-mono text-3xl font-semibold tracking-wider">
          {p.part_number}
          <StatusBadge map={stockLevel} value={s} />
        </h1>
        <p className="mt-3 text-lg">{p.description}</p>
        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-border pt-5 text-sm md:grid-cols-5">
          <Item label="On hand" value={`${fmtQty(p.quantity)} ${p.unit}`} color={stockLevel[s].color} />
          <Item label="Reorder level" value={`${fmtQty(p.min_quantity)} ${p.unit}`} />
          <Item label="Issued — 90 days" value={`${fmtQty(used90)} ${p.unit}`} />
          <Item label="Days of cover" value={cover != null ? `${cover} d` : "—"} color={cover != null && cover < 30 ? "var(--warning)" : undefined} />
          <Item label="Location" value={p.location} />
        </dl>
        {(p.applicability || p.notes) && (
          <p className="mt-4 text-sm text-muted">{[p.applicability && `Applicability: ${p.applicability}`, p.notes].filter(Boolean).join(" · ")}</p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="panel h-fit overflow-hidden rounded-2xl lg:col-span-2">
          <p className="label px-6 pt-6">Movement ledger</p>
          <div className="mt-3">
            <Table
              head={["Date", "Movement", "Qty", "Work order", "Reference / notes"]}
              empty="No movements yet."
              rows={moves.map((m) => [
                <span key="d" className="whitespace-nowrap font-mono text-muted">{m.moved_at}</span>,
                <StatusBadge key="k" map={movementKind} value={m.kind} />,
                <span key="q" className="whitespace-nowrap font-mono" style={{ color: Number(m.quantity) < 0 ? "var(--warning)" : "var(--success)" }}>
                  {Number(m.quantity) > 0 ? "+" : "−"}{fmtQty(Math.abs(Number(m.quantity)))}
                </span>,
                m.work_order_id ? (
                  <Link key="w" href={`/work/${m.work_order_id}`} className="block min-w-40 hover:text-gold-soft">
                    <span className="font-mono text-accent">{m.work_orders?.wo_no}</span>
                    <span className="block text-xs text-muted">{m.work_orders?.title}</span>
                  </Link>
                ) : (
                  <span key="w" className="text-muted">—</span>
                ),
                <span key="r" className="block min-w-40 text-muted">{[m.reference, m.notes].filter(Boolean).join(" · ") || "—"}</span>,
              ])}
            />
          </div>
        </section>

        {editable && (
          <div className="space-y-6">
            <section className="panel h-fit rounded-2xl p-6">
              <p className="label mb-5">Record movement</p>
              <MovementForm partId={p.id} unit={p.unit} today={today} />
            </section>
            <details className="panel group h-fit rounded-2xl p-6">
              <summary className="label cursor-pointer list-none group-open:mb-5">Edit item ▾</summary>
              <PartForm part={p} compact />
            </details>
          </div>
        )}
      </div>
    </div>
  );
}

function Item({ label, value, color }: { label: string; value: string | null; color?: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 font-mono" style={color ? { color } : undefined}>{value ?? "—"}</dd>
    </div>
  );
}
