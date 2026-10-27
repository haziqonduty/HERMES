"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/components/form";
import { friendlyError } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

const partFields = (fd: FormData) => ({
  part_number: str(fd, "part_number"),
  description: str(fd, "description"),
  category: str(fd, "category") || "component",
  unit: str(fd, "unit") || "ea",
  min_quantity: Number(str(fd, "min_quantity") || 0),
  location: str(fd, "location") || "Main store",
  applicability: str(fd, "applicability") || null,
  notes: str(fd, "notes") || null,
});

/** Creates or updates a store item. Opening stock is booked as a receipt so the ledger balances. */
export async function savePart(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = str(fd, "id");
  const fields = partFields(fd);
  if (!fields.part_number || !fields.description) return { error: "Part number and description are required." };

  const supabase = await createClient();
  if (id) {
    const { data, error } = await supabase.from("parts").update(fields).eq("id", id).select("id");
    if (error) return { error: friendlyError(error) };
    if (!data?.length) return { error: "Your role does not have permission to do this." };
    refresh();
    return { ok: "Item updated." };
  }

  const { data, error } = await supabase.from("parts").insert(fields).select("id").single();
  if (error) return { error: friendlyError(error) };
  const opening = Number(str(fd, "opening") || 0);
  if (opening > 0) {
    const { error: moveError } = await supabase
      .from("stock_movements")
      .insert({ part_id: data.id, kind: "receipt", quantity: opening, reference: "Opening balance" });
    if (moveError) return { error: friendlyError(moveError) };
  }
  redirect(`/inventory/${data.id}`);
}

export async function recordMovement(_prev: FormState, fd: FormData): Promise<FormState> {
  const kind = str(fd, "kind");
  const qty = Number(str(fd, "quantity"));
  const direction = str(fd, "direction");
  if (!(qty > 0)) return { error: "Enter a quantity greater than zero." };

  // Issues remove stock; adjustments go the chosen way; receipts and returns add stock.
  const signed = kind === "issue" || (kind === "adjustment" && direction === "out") ? -qty : qty;
  if (kind === "adjustment" && !str(fd, "notes")) return { error: "Give a reason for the stock adjustment." };

  const supabase = await createClient();
  const { error } = await supabase.from("stock_movements").insert({
    part_id: str(fd, "part_id"),
    kind,
    quantity: signed,
    moved_at: str(fd, "moved_at") || undefined,
    reference: str(fd, "reference") || null,
    notes: str(fd, "notes") || null,
  });
  if (error) return { error: friendlyError(error) };
  refresh();
  return { ok: "Movement recorded." };
}
