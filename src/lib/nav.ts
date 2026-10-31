import {
  Activity,
  BarChart3,
  Boxes,
  CalendarClock,
  ClipboardList,
  FileText,
  Gauge,
  LayoutDashboard,
  Plane,
  Settings,
  ShieldAlert,
  Star,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  slug: string;
  label: string;
  icon: LucideIcon;
  description: string;
  /** Build step from the HERMES-E plan in MEMORY.md */
  step: number;
};

export type NavGroup = { title: string; items: NavItem[] };

export const navGroups: NavGroup[] = [
  {
    title: "Command",
    items: [
      { slug: "dashboard", label: "Executive Dashboard", icon: LayoutDashboard, step: 3, description: "Fleet readiness and engine health at a glance." },
      { slug: "commander", label: "Commander View", icon: Star, step: 7, description: "Mission readiness, critical alerts and briefing packs." },
    ],
  },
  {
    title: "Engineering",
    items: [
      { slug: "fleet", label: "Fleet Overview", icon: Plane, step: 2, description: "Aircraft, installed engines and serviceability." },
      { slug: "engines", label: "Engines & Passport", icon: Gauge, step: 2, description: "Complete digital identity and life history of every engine." },
      { slug: "health", label: "Health Monitoring", icon: Activity, step: 4, description: "Engine Health Index, oil consumption, chip detector and borescope findings." },
      { slug: "defects", label: "Defect Management", icon: ShieldAlert, step: 5, description: "Record, classify and track defects to closure." },
      { slug: "reliability", label: "Reliability Analytics", icon: BarChart3, step: 5, description: "MTBF, MTBUR, failure-mode Pareto and removal trends." },
    ],
  },
  {
    title: "Maintenance",
    items: [
      { slug: "planner", label: "Maintenance Planner", icon: CalendarClock, step: 6, description: "Scheduled tasks, overhaul forecasting and calendar." },
      { slug: "work", label: "Work Management", icon: ClipboardList, step: 6, description: "Work orders, task cards and work packages." },
      { slug: "inventory", label: "Inventory", icon: Boxes, step: 6, description: "Spare engines, modules and parts." },
      { slug: "reports", label: "Reports", icon: FileText, step: 6, description: "Engineering report generator and exports." },
    ],
  },
  {
    title: "System",
    items: [
      { slug: "admin", label: "Administration", icon: Settings, step: 7, description: "Users, roles, audit trail and settings." },
    ],
  },
];

export const navItems = navGroups.flatMap((g) => g.items);

export const roleLabels: Record<string, string> = {
  admin: "Administrator",
  oc_engineering: "OC Engineering",
  commander: "Commander",
  supervisor: "Supervisor",
  planner: "Planner",
  engineer: "Engineer",
  viewer: "Viewer",
};

export const roleColor = (role: string) =>
  role === "admin" ? "var(--gold)" : role === "commander" || role === "oc_engineering" ? "var(--accent)" : role === "viewer" ? "var(--muted)" : "var(--success)";
