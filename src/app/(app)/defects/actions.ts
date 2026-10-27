"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/components/form";
import { friendlyError } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function createDefect(_prev: FormState, fd: FormData): Promise<FormState> {
  const engineId = str(fd, "engine_id") || null;
  let aircraftId = str(fd, "aircraft_id") || null;
  const description = str(fd, "description");

  if (!description) return { error: "Describe the defect." };
  if (!engineId && !aircraftId) return { error: "Select an aircraft, an engine, or both." };

  const supabase = await createClient();

  // An engine defect is raised against the aircraft it is fitted to, unless one was chosen.
  if (engineId && !aircraftId) {
    const { data } = await supabase
      .from("engine_installations")
      .select("aircraft_id")
      .eq("engine_id", engineId)
      .is("removed_at", null)
      .maybeSingle();
    aircraftId = data?.aircraft_id ?? null;
  }

  const { data, error } = await supabase
    .from("defects")
    .insert({
      aircraft_id: aircraftId,
      engine_id: engineId,
      reported_at: str(fd, "reported_at"),
      ata_chapter: str(fd, "ata_chapter") || null,
      system: str(fd, "system") || null,
      description,
      severity: str(fd, "severity") || "minor",
      failure_mode: str(fd, "failure_mode") || null,
      detection_method: str(fd, "detection_method") || null,
    })
    .select("id")
    .single();

  if (error) return { error: friendlyError(error) };
  redirect(`/defects/${data.id}`);
}

export async function updateDefect(_prev: FormState, fd: FormData): Promise<FormState> {
  const status = str(fd, "status");
  const actionTaken = str(fd, "action_taken");
  const deferredUntil = str(fd, "deferred_until");

  if (status === "closed" && !actionTaken) return { error: "Record the action taken before closing the defect." };
  if (status === "deferred" && !deferredUntil) return { error: "A deferred defect needs a 'deferred until' date." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("defects")
    .update({
      status,
      severity: str(fd, "severity"),
      failure_mode: str(fd, "failure_mode") || null,
      root_cause: str(fd, "root_cause") || null,
      action_taken: actionTaken || null,
      deferred_until: status === "deferred" ? deferredUntil : null,
    })
    .eq("id", str(fd, "id"))
    .select("status");

  if (error) return { error: friendlyError(error) };
  if (!data?.length) return { error: "Your role does not have permission to do this." };
  refresh();
  return { ok: status === "closed" ? "Defect closed." : "Defect updated." };
}
