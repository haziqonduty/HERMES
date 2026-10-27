import "server-only";
import type { createClient } from "./supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type AircraftOption = { id: string; registration: string };
export type EngineOption = { id: string; serial_number: string; aircraft_id: string | null };

type EngineRow = { id: string; serial_number: string; engine_installations: { aircraft_id: string; removed_at: string | null }[] };

/** Aircraft and (non-retired) engines for pickers; each engine carries the aircraft it is fitted to. */
export async function loadAssetOptions(supabase: Supabase) {
  const [aircraftRes, enginesRes] = await Promise.all([
    supabase.from("aircraft").select("id, registration").order("registration").returns<AircraftOption[]>(),
    supabase
      .from("engines")
      .select("id, serial_number, engine_installations(aircraft_id, removed_at)")
      .neq("status", "retired")
      .order("serial_number")
      .returns<EngineRow[]>(),
  ]);
  return {
    aircraft: aircraftRes.data ?? [],
    engines: (enginesRes.data ?? []).map(
      (e): EngineOption => ({
        id: e.id,
        serial_number: e.serial_number,
        aircraft_id: e.engine_installations.find((i) => !i.removed_at)?.aircraft_id ?? null,
      }),
    ),
  };
}
