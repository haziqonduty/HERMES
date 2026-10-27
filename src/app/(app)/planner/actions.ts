"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/components/form";
import { friendlyError } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (fd: FormData, k: string) => (str(fd, k) === "" ? null : Number(str(fd, k)));

/** Creates a programme task, or updates it when an id is posted. */
export async function saveTask(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = str(fd, "id");
  const appliesTo = str(fd, "applies_to");
  const engineId = appliesTo === "engine" ? str(fd, "engine_id") : "";
  const aircraftId = appliesTo === "aircraft" ? str(fd, "aircraft_id") : "";
  const intervals = { interval_hours: num(fd, "interval_hours"), interval_cycles: num(fd, "interval_cycles"), interval_days: num(fd, "interval_days") };

  if (!str(fd, "title")) return { error: "Give the task a title." };
  if (!id && !engineId && !aircraftId) return { error: `Select the ${appliesTo || "asset"} this task applies to.` };
  if (Object.values(intervals).every((v) => v == null)) return { error: "Set at least one interval (hours, cycles or days)." };

  const record = {
    task_ref: str(fd, "task_ref") || null,
    title: str(fd, "title"),
    ata_chapter: str(fd, "ata_chapter") || null,
    ...intervals,
    last_done_date: str(fd, "last_done_date") || null,
    last_done_hours: num(fd, "last_done_hours"),
    last_done_cycles: num(fd, "last_done_cycles"),
    active: id ? fd.get("active") === "on" : true,
    notes: str(fd, "notes") || null,
  };

  const supabase = await createClient();
  if (id) {
    const { data, error } = await supabase.from("maintenance_tasks").update(record).eq("id", id).select("id");
    if (error) return { error: friendlyError(error) };
    if (!data?.length) return { error: "Your role does not have permission to do this." };
    refresh();
    return { ok: "Task updated." };
  }

  const { data, error } = await supabase
    .from("maintenance_tasks")
    .insert({ ...record, engine_id: engineId || null, aircraft_id: aircraftId || null })
    .select("id")
    .single();
  if (error) return { error: friendlyError(error) };
  redirect(`/planner/${data.id}`);
}
