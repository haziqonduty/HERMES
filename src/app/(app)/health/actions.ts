"use server";

import { refresh } from "next/cache";
import type { FormState } from "@/components/form";
import { friendlyError } from "@/lib/db-errors";
import { soapElements } from "@/lib/monitoring";
import { createClient } from "@/lib/supabase/server";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (fd: FormData, k: string) => {
  const v = str(fd, k);
  return v === "" ? null : Number(v);
};

async function insert(table: string, row: Record<string, unknown>, ok: string): Promise<FormState> {
  if (!row.engine_id) return { error: "Select an engine." };
  const supabase = await createClient();
  const { error } = await supabase.from(table).insert(row);
  if (error) return { error: friendlyError(error) };
  refresh();
  return { ok };
}

export async function recordOilUplift(_prev: FormState, fd: FormData): Promise<FormState> {
  const quantity = num(fd, "quantity_qt");
  const hours = num(fd, "flight_hours");
  if (quantity == null || Number.isNaN(quantity) || quantity < 0) return { error: "Enter the oil quantity added." };
  if (hours == null || Number.isNaN(hours) || hours <= 0) return { error: "Flight hours since last servicing must be above 0." };

  return insert(
    "oil_uplifts",
    {
      engine_id: str(fd, "engine_id"),
      serviced_at: str(fd, "serviced_at"),
      quantity_qt: quantity,
      flight_hours: hours,
      notes: str(fd, "notes") || null,
    },
    `Oil uplift recorded — ${(quantity / hours).toFixed(2)} qt/FH.`,
  );
}

export async function recordOilSample(_prev: FormState, fd: FormData): Promise<FormState> {
  const metals = Object.fromEntries(soapElements.map((m) => [m.key, num(fd, m.key)]));
  if (Object.values(metals).some((v) => v != null && (Number.isNaN(v) || v < 0)))
    return { error: "Wear metal values must be 0 or more (ppm)." };

  return insert(
    "oil_samples",
    {
      engine_id: str(fd, "engine_id"),
      sampled_at: str(fd, "sampled_at"),
      lab_ref: str(fd, "lab_ref") || null,
      level: str(fd, "level") || "normal",
      recommendation: str(fd, "recommendation") || null,
      ...metals,
    },
    "Oil sample recorded.",
  );
}

export async function recordChipCheck(_prev: FormState, fd: FormData): Promise<FormState> {
  return insert(
    "chip_checks",
    {
      engine_id: str(fd, "engine_id"),
      checked_at: str(fd, "checked_at"),
      location: str(fd, "location"),
      finding: str(fd, "finding"),
      action_taken: str(fd, "action_taken") || null,
    },
    "Chip detector check recorded.",
  );
}

export async function recordBorescope(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!str(fd, "findings")) return { error: "Describe the findings." };
  return insert(
    "borescope_inspections",
    {
      engine_id: str(fd, "engine_id"),
      inspected_at: str(fd, "inspected_at"),
      area: str(fd, "area"),
      findings: str(fd, "findings"),
      disposition: str(fd, "disposition"),
      next_due: str(fd, "next_due") || null,
      reference: str(fd, "reference") || null,
    },
    "Borescope inspection recorded.",
  );
}
