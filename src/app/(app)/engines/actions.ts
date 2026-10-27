"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/components/form";
import { friendlyError } from "@/lib/db-errors";
import { ehiComponents } from "@/lib/health";
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

export async function recordAssessment(_prev: FormState, fd: FormData): Promise<FormState> {
  const scores = Object.fromEntries(ehiComponents.map((c) => [c.key, num(fd, c.key)]));
  if (Object.values(scores).some((v) => v == null || Number.isNaN(v) || v < 0 || v > 100))
    return { error: "Score every component from 0 to 100." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ehi_assessments")
    .insert({
      engine_id: str(fd, "engine_id"),
      assessed_at: str(fd, "assessed_at"),
      source: str(fd, "source") || null,
      notes: str(fd, "notes") || null,
      ...scores,
    })
    .select("ehi")
    .single();

  if (error) return { error: friendlyError(error) };
  refresh();
  return { ok: `Assessment recorded — EHI ${data.ehi}.` };
}
