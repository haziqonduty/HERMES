export type StatusMeta = { label: string; color: string };

export const aircraftStatus: Record<string, StatusMeta> = {
  serviceable: { label: "Mission ready", color: "var(--success)" },
  standby: { label: "Standby", color: "var(--accent)" },
  in_maintenance: { label: "In maintenance", color: "var(--warning)" },
  unserviceable: { label: "Unserviceable", color: "var(--danger)" },
};

export const engineStatus: Record<string, StatusMeta> = {
  installed: { label: "Installed", color: "var(--success)" },
  spare: { label: "Spare", color: "var(--accent)" },
  in_overhaul: { label: "In overhaul", color: "var(--warning)" },
  unserviceable: { label: "Unserviceable", color: "var(--danger)" },
  retired: { label: "Retired", color: "var(--muted)" },
};

export const defectSeverity: Record<string, StatusMeta> = {
  critical: { label: "Critical", color: "var(--danger)" },
  major: { label: "Major", color: "var(--warning)" },
  minor: { label: "Minor", color: "var(--accent)" },
};

export const defectStatus: Record<string, StatusMeta> = {
  open: { label: "Open", color: "var(--danger)" },
  in_work: { label: "In work", color: "var(--warning)" },
  deferred: { label: "Deferred", color: "var(--accent)" },
  closed: { label: "Closed", color: "var(--muted)" },
};

export const fmtHours = (n: number | null | undefined) =>
  n == null ? "—" : Number(n).toLocaleString("en-GB", { maximumFractionDigits: 1 });

export const fmtInt = (n: number | null | undefined) => (n == null ? "—" : Number(n).toLocaleString("en-GB"));
