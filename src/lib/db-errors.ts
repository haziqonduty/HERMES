type PgError = { code?: string; message: string } | null;

/** Turns Postgres/Supabase errors into messages an engineer can act on. */
export function friendlyError(error: PgError, fallback = "Something went wrong. Please try again."): string {
  if (!error) return fallback;
  switch (error.code) {
    case "23505":
      return error.message.includes("position")
        ? "That position already has an engine fitted."
        : error.message.includes("engine_installations_active_engine")
          ? "That engine is already installed on an aircraft."
          : "A record with that identifier already exists.";
    case "23514":
      return "One of the values is out of range. Check hours, cycles and EHI.";
    case "42501":
      return "Your role does not have permission to do this.";
    case "P0001": // raise exception from our SQL functions
      return error.message;
    default:
      return error.message.includes("row-level security") ? "Your role does not have permission to do this." : fallback;
  }
}
