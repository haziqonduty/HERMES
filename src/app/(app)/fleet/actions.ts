"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/components/form";
import { friendlyError } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (fd: FormData, k: string) => {
  const v = str(fd, k);
  return v === "" ? null : Number(v);
};

export async function saveAircraft(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = str(fd, "id");
  const registration = str(fd, "registration").toUpperCase();
  const record = {
    registration,
    aircraft_type: str(fd, "aircraft_type"),
    serial_number: str(fd, "serial_number") || null,
    squadron: str(fd, "squadron") || null,
    base: str(fd, "base") || null,
    status: str(fd, "status"),
    engine_positions: num(fd, "engine_positions") ?? 4,
    ...(id ? {} : { total_hours: num(fd, "total_hours") ?? 0, total_cycles: num(fd, "total_cycles") ?? 0 }),
  };

  if (!registration || !record.aircraft_type) return { error: "Registration and aircraft type are required." };

  const supabase = await createClient();
  const { data, error } = id
    ? await supabase.from("aircraft").update(record).eq("id", id).select("id")
    : await supabase.from("aircraft").insert(record).select("id");

  if (error) return { error: friendlyError(error) };
  if (!data?.length) return { error: "Your role does not have permission to do this." };

  redirect(`/fleet/${encodeURIComponent(registration)}`);
}

export async function logFlight(_prev: FormState, fd: FormData): Promise<FormState> {
  const hours = num(fd, "flight_hours");
  const cycles = num(fd, "cycles");
  const flight_date = str(fd, "flight_date");

  if (!flight_date || !hours || hours <= 0) return { error: "Enter the flight date and flight hours." };
  if (hours > 24) return { error: "Flight hours above 24 for one sortie — check the entry." };

  const supabase = await createClient();
  const { error } = await supabase.from("flight_logs").insert({
    aircraft_id: str(fd, "aircraft_id"),
    flight_date,
    flight_hours: hours,
    cycles: cycles ?? 1,
    sortie_ref: str(fd, "sortie_ref") || null,
  });

  if (error) return { error: friendlyError(error) };
  refresh();
  return { ok: `Logged ${hours} FH. Aircraft and installed engines updated.` };
}

export async function installEngine(_prev: FormState, fd: FormData): Promise<FormState> {
  const engine = str(fd, "engine_id");
  if (!engine) return { error: "Choose an engine to install." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("install_engine", {
    p_engine: engine,
    p_aircraft: str(fd, "aircraft_id"),
    p_position: num(fd, "position"),
    p_date: str(fd, "date"),
  });

  if (error) return { error: friendlyError(error) };
  refresh();
  return { ok: "Engine installed." };
}

export async function removeEngine(_prev: FormState, fd: FormData): Promise<FormState> {
  const reason = str(fd, "reason");
  if (!reason) return { error: "A removal reason is required." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_engine", {
    p_installation: str(fd, "installation_id"),
    p_date: str(fd, "date"),
    p_reason: reason,
    p_engine_status: str(fd, "engine_status"),
    p_removal_type: str(fd, "removal_type") || "unscheduled",
    p_failure_mode: str(fd, "failure_mode") || null,
    p_confirmed_failure: fd.get("confirmed_failure") === "on",
  });

  if (error) return { error: friendlyError(error) };
  refresh();
  return { ok: "Engine removed." };
}
