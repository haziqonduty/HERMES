"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/components/form";
import { friendlyError } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (fd: FormData, k: string) => (str(fd, k) === "" ? null : Number(str(fd, k)));

export async function createWorkOrder(_prev: FormState, fd: FormData): Promise<FormState> {
  const title = str(fd, "title");
  const engineId = str(fd, "engine_id") || null;
  let aircraftId = str(fd, "aircraft_id") || null;
  if (!title) return { error: "Give the work order a title." };

  const supabase = await createClient();

  // Engine work is booked against the aircraft it is fitted to, unless one was chosen.
  if (engineId && !aircraftId) {
    const { data } = await supabase.from("engine_installations").select("aircraft_id").eq("engine_id", engineId).is("removed_at", null).maybeSingle();
    aircraftId = data?.aircraft_id ?? null;
  }

  const { data, error } = await supabase
    .from("work_orders")
    .insert({
      title,
      description: str(fd, "description") || null,
      kind: str(fd, "kind") || "unscheduled",
      priority: str(fd, "priority") || "routine",
      status: str(fd, "status") || "open",
      aircraft_id: aircraftId,
      engine_id: engineId,
      defect_id: str(fd, "defect_id") || null,
      task_id: str(fd, "task_id") || null,
      due_date: str(fd, "due_date") || null,
      assigned_to: str(fd, "assigned_to") || null,
      est_hours: num(fd, "est_hours"),
    })
    .select("id")
    .single();
  if (error) return { error: friendlyError(error) };

  // Task-card steps, one per line.
  const steps = str(fd, "steps")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  if (steps.length) {
    const { error: stepError } = await supabase
      .from("work_order_steps")
      .insert(steps.map((instruction, i) => ({ work_order_id: data.id, seq: i + 1, instruction })));
    if (stepError) return { error: friendlyError(stepError) };
  }
  redirect(`/work/${data.id}`);
}

export async function updateWorkOrder(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = str(fd, "id");
  const status = str(fd, "status");
  const notes = str(fd, "completion_notes");
  const closeDefect = fd.get("close_defect") === "on";

  if (status === "completed" && !notes) return { error: "Record the work carried out before completing the work order." };
  if (status === "cancelled" && !notes) return { error: "Give a reason for cancelling in the notes." };

  const supabase = await createClient();
  if (status === "completed") {
    const { count } = await supabase.from("work_order_steps").select("id", { count: "exact", head: true }).eq("work_order_id", id).eq("done", false);
    if (count) return { error: `${count} task-card step(s) not signed off yet.` };
  }

  const { data, error } = await supabase
    .from("work_orders")
    .update({
      status,
      priority: str(fd, "priority"),
      due_date: str(fd, "due_date") || null,
      assigned_to: str(fd, "assigned_to") || null,
      actual_hours: num(fd, "actual_hours"),
      completion_notes: notes || null,
    })
    .eq("id", id)
    .select("wo_no, defect_id");
  if (error) return { error: friendlyError(error) };
  if (!data?.length) return { error: "Your role does not have permission to do this." };

  const wo = data[0];
  if (status === "completed" && closeDefect && wo.defect_id) {
    const { error: defectError } = await supabase
      .from("defects")
      .update({ status: "closed", action_taken: `${notes}\n(${wo.wo_no})` })
      .eq("id", wo.defect_id);
    if (defectError) return { error: `Work order completed, but the defect could not be closed: ${friendlyError(defectError)}` };
  }

  refresh();
  return { ok: status === "completed" ? "Work order completed." : "Work order updated." };
}

export async function addStep(_prev: FormState, fd: FormData): Promise<FormState> {
  const workOrderId = str(fd, "work_order_id");
  const instruction = str(fd, "instruction");
  if (!instruction) return { error: "Enter the step instruction." };

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("work_order_steps")
    .select("seq")
    .eq("work_order_id", workOrderId)
    .order("seq", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from("work_order_steps").insert({ work_order_id: workOrderId, seq: (last?.seq ?? 0) + 1, instruction });
  if (error) return { error: friendlyError(error) };
  refresh();
  return { ok: "Step added." };
}

/** Signs a task-card step off (or reopens it). The database stamps who and when. */
export async function toggleStep(fd: FormData) {
  const supabase = await createClient();
  await supabase.from("work_order_steps").update({ done: fd.get("done") === "true" }).eq("id", str(fd, "id"));
  refresh();
}

export async function issuePart(_prev: FormState, fd: FormData): Promise<FormState> {
  const qty = Number(str(fd, "quantity"));
  const partId = str(fd, "part_id");
  if (!partId) return { error: "Select a part." };
  if (!(qty > 0)) return { error: "Enter a quantity greater than zero." };

  const supabase = await createClient();
  const { error } = await supabase.from("stock_movements").insert({
    part_id: partId,
    kind: str(fd, "kind") === "return" ? "return" : "issue",
    quantity: str(fd, "kind") === "return" ? qty : -qty,
    work_order_id: str(fd, "work_order_id"),
    reference: str(fd, "wo_no") || null,
  });
  if (error) return { error: friendlyError(error) };
  refresh();
  return { ok: str(fd, "kind") === "return" ? "Part returned to store." : "Part issued." };
}
