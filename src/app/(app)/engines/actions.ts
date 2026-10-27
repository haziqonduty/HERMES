"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/components/form";
import { friendlyError } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (fd: FormData, k: string) => {
  const v = str(fd, k);
  return v === "" ? null : Number(v);
};

export async function saveEngine(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = str(fd, "id");
  const serial = str(fd, "serial_number").toUpperCase();
  const record = {
    serial_number: serial,
    model: str(fd, "model"),
    manufacturer: str(fd, "manufacturer") || null,
    tsn: num(fd, "tsn") ?? 0,
    csn: num(fd, "csn") ?? 0,
    tso: num(fd, "tso"),
    cso: num(fd, "cso"),
    overhaul_interval_hours: num(fd, "overhaul_interval_hours"),
    last_overhaul_date: str(fd, "last_overhaul_date") || null,
    ehi: num(fd, "ehi"),
    notes: str(fd, "notes") || null,
    // Installed status is managed by install/remove on the aircraft page.
    ...(id ? {} : { status: str(fd, "status") || "spare" }),
  };

  if (!serial || !record.model) return { error: "Serial number and model are required." };
  if (record.tso != null && record.tso > record.tsn) return { error: "TSO cannot exceed TSN." };
  if (record.cso != null && record.cso > record.csn) return { error: "CSO cannot exceed CSN." };

  const supabase = await createClient();
  const { data, error } = id
    ? await supabase.from("engines").update(record).eq("id", id).select("id")
    : await supabase.from("engines").insert(record).select("id");

  if (error) return { error: friendlyError(error) };
  if (!data?.length) return { error: "Your role does not have permission to do this." };

  redirect(`/engines/${encodeURIComponent(serial)}`);
}
