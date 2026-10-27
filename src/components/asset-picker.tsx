"use client";

import { useState } from "react";
import type { AircraftOption, EngineOption } from "@/lib/assets";
import { SelectField } from "./form";

/** Aircraft + engine selects: picking an engine fills in its aircraft; an aircraft narrows the engine list. */
export function AssetPicker({
  aircraft,
  engines,
  defaults,
  aircraftBlank = "— Not aircraft-specific —",
  engineBlank = "— No engine —",
}: {
  aircraft: AircraftOption[];
  engines: EngineOption[];
  defaults: { aircraftId?: string; engineId?: string };
  aircraftBlank?: string;
  engineBlank?: string;
}) {
  const [aircraftId, setAircraftId] = useState(defaults.aircraftId ?? "");
  const [engineId, setEngineId] = useState(defaults.engineId ?? "");
  const engineChoices = aircraftId ? engines.filter((e) => e.aircraft_id === aircraftId || e.id === engineId) : engines;

  return (
    <>
      <SelectField
        label="Aircraft"
        name="aircraft_id"
        value={aircraftId}
        onChange={(e) => setAircraftId(e.target.value)}
        options={[{ value: "", label: aircraftBlank }, ...aircraft.map((a) => ({ value: a.id, label: a.registration }))]}
      />
      <SelectField
        label="Engine"
        name="engine_id"
        value={engineId}
        onChange={(e) => {
          setEngineId(e.target.value);
          const fitted = engines.find((x) => x.id === e.target.value)?.aircraft_id;
          if (fitted && !aircraftId) setAircraftId(fitted);
        }}
        options={[{ value: "", label: engineBlank }, ...engineChoices.map((e) => ({ value: e.id, label: e.serial_number }))]}
        hint={aircraftId ? "Engines fitted to this aircraft" : "Picking an engine fills in its aircraft"}
      />
    </>
  );
}
