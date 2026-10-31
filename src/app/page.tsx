import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  Database,
  Eye,
  Gauge,
  Lightbulb,
  Network,
  RefreshCw,
  ShieldCheck,
  Target,
} from "lucide-react";
import { Logo, LogoMark } from "@/components/logo";

const pillars = [
  { icon: Database, title: "Integrated", body: "Unified data" },
  { icon: BrainCircuit, title: "Intelligent", body: "AI ready" },
  { icon: BarChart3, title: "Predictive", body: "Proactive insight" },
  { icon: Target, title: "Actionable", body: "Decision support" },
  { icon: ShieldCheck, title: "Secure", body: "Enterprise grade" },
];

const loop = [
  { icon: Eye, title: "Observe", body: "Collect maintenance & inspection data" },
  { icon: Activity, title: "Assess", body: "Validate and analyse engine health" },
  { icon: Lightbulb, title: "Decide", body: "Prioritise with evidence" },
  { icon: Gauge, title: "Act", body: "Plan and execute maintenance" },
  { icon: RefreshCw, title: "Learn", body: "Retain lessons for the fleet" },
];

const modules = [
  { code: "E", name: "Engine", live: true },
  { code: "R", name: "Reliability" },
  { code: "AI", name: "AI & Decision Support" },
  { code: "K", name: "Knowledge" },
  { code: "H", name: "Hydraulic" },
  { code: "LG", name: "Landing Gear" },
  { code: "F", name: "Fuel" },
  { code: "S", name: "Structure" },
  { code: "AV", name: "Avionics" },
];

const mvp = [
  "Executive & Commander dashboards",
  "Engine Digital Passport",
  "Engine Health Index (EHI)",
  "Oil, chip detector & borescope trends",
  "Defect management",
  "Reliability analytics — MTBF / MTBUR",
  "Maintenance planner",
  "Engineering report generator",
];

export default function Home() {
  return (
    <div className="relative isolate min-h-screen overflow-hidden">
      <div className="bg-grid pointer-events-none absolute inset-0 -z-10" />
      <div className="pointer-events-none absolute left-1/2 top-[-18rem] -z-10 h-[40rem] w-[64rem] -translate-x-1/2 rounded-full bg-[#1b3a78]/40 blur-[140px]" />
      <div className="pointer-events-none absolute left-1/2 top-[6rem] -z-10 h-[18rem] w-[30rem] -translate-x-1/2 rounded-full bg-gold/10 blur-[110px]" />

      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <Logo />
        <nav className="hidden gap-8 text-sm text-muted md:flex">
          <a className="transition hover:text-foreground" href="#approach">Approach</a>
          <a className="transition hover:text-foreground" href="#modules">Modules</a>
          <a className="transition hover:text-foreground" href="#mvp">HERMES-E</a>
        </nav>
        <Link
          href="/login"
          className="rounded-full border border-gold/40 px-5 py-2 text-sm text-gold-soft transition hover:bg-gold/10"
        >
          Sign in
        </Link>
      </header>

      <main className="mx-auto max-w-7xl px-6">
        {/* Hero */}
        <section className="flex flex-col items-center pb-20 pt-14 text-center md:pt-20">
          <LogoMark className="h-24 w-auto drop-shadow-[0_0_40px_rgba(233,180,76,0.35)] md:h-32" />
          <p className="mt-8 font-mono text-xs tracking-[0.4em] text-accent">PROJECT HERMES</p>
          <h1 className="text-gold-gradient mt-3 text-6xl font-bold tracking-[0.12em] md:text-8xl">HERMES</h1>
          <p className="mt-4 text-lg font-medium tracking-[0.2em] text-foreground/90 md:text-xl">
            DIGITAL ENGINEERING PLATFORM
          </p>
          <p className="mt-6 max-w-2xl text-base text-muted md:text-lg">
            Engineering Reliability Monitoring &amp; Engineering Sustainment — transforming engineering data into
            engineering intelligence for mission readiness.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              href="/dashboard"
              className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-gold-soft to-gold px-7 py-3 text-sm font-semibold text-background shadow-[0_0_50px_-10px_var(--gold)] transition hover:brightness-110"
            >
              Enter Operations Center
              <ArrowRight size={16} className="transition group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#approach"
              className="rounded-full border border-border px-7 py-3 text-sm font-medium transition hover:border-foreground/40"
            >
              Explore the platform
            </a>
          </div>

          <div className="mt-16 grid w-full max-w-4xl grid-cols-2 gap-3 sm:grid-cols-5">
            {pillars.map(({ icon: Icon, title, body }) => (
              <div key={title} className="panel rounded-xl px-4 py-4">
                <Icon size={20} className="mx-auto text-accent" />
                <p className="mt-3 font-mono text-[11px] tracking-[0.2em] text-gold-soft">{title.toUpperCase()}</p>
                <p className="mt-1 text-xs text-muted">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Vision / mission */}
        <section className="grid gap-4 md:grid-cols-2">
          <div className="panel rounded-2xl p-8">
            <p className="label !text-gold">Vision</p>
            <p className="mt-4 text-lg leading-relaxed">
              Transform maintenance data into engineering intelligence that enables proactive sustainment, enhanced
              reliability and evidence-based engineering decisions.
            </p>
          </div>
          <div className="panel rounded-2xl p-8">
            <p className="label !text-gold">Mission</p>
            <ul className="mt-4 space-y-2 text-sm text-foreground/90">
              {[
                "Digitise engine sustainment information",
                "Improve engine reliability and availability",
                "Reduce unscheduled engine removals",
                "Support predictive maintenance and decision making",
                "Build a reusable engineering knowledge base",
              ].map((m) => (
                <li key={m} className="flex gap-2">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success" />
                  {m}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Decision loop */}
        <section id="approach" className="py-24">
          <p className="label text-center !text-gold">Concept of operations</p>
          <h2 className="mt-3 text-center text-3xl font-semibold tracking-tight">From data to decision to readiness</h2>
          <div className="mt-12 grid gap-3 md:grid-cols-5">
            {loop.map(({ icon: Icon, title, body }, i) => (
              <div key={title} className="panel relative rounded-2xl p-6">
                <span className="font-mono text-xs text-muted">0{i + 1}</span>
                <div className="mt-3 grid h-11 w-11 place-items-center rounded-xl border border-accent/30 bg-accent/10 text-accent">
                  <Icon size={20} />
                </div>
                <h3 className="mt-4 font-medium tracking-wide">{title}</h3>
                <p className="mt-1 text-sm text-muted">{body}</p>
                {i < loop.length - 1 && (
                  <ArrowRight size={16} className="absolute -right-3 top-1/2 z-10 hidden text-gold md:block" />
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Modules */}
        <section id="modules" className="grid items-center gap-10 pb-24 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="label !text-gold">Platform modules</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">One core. Every aircraft system.</h2>
            <p className="mt-4 text-muted">
              HERMES starts with the engine and grows into a full aircraft engineering platform — each module plugging
              into the same core data, security and analytics.
            </p>
            <div className="mt-6 flex items-center gap-3 text-sm">
              <Network size={16} className="text-accent" />
              <span className="text-muted">One platform · One data · One truth</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {modules.map((m) => (
              <div
                key={m.code}
                className={`panel rounded-xl p-4 text-center ${m.live ? "!border-gold/50 shadow-[0_0_40px_-15px_var(--gold)]" : ""}`}
              >
                <p className={`font-mono text-lg font-semibold ${m.live ? "text-gold-soft" : "text-accent"}`}>
                  HERMES-{m.code}
                </p>
                <p className="mt-1 text-xs text-muted">{m.name}</p>
                {m.live && <p className="mt-2 font-mono text-[10px] tracking-widest text-success">PHASE 1</p>}
              </div>
            ))}
          </div>
        </section>

        {/* MVP */}
        <section id="mvp" className="pb-24">
          <div className="panel rounded-2xl p-8 md:p-12">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="label !text-gold">Minimum viable product</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight">HERMES-E · Engine</h2>
              </div>
              <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-accent hover:underline">
                Open the Operations Center <ArrowRight size={14} />
              </Link>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {mvp.map((f) => (
                <div key={f} className="flex items-start gap-2 rounded-lg border border-border bg-background/40 p-4 text-sm">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-gold" />
                  {f}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-10 text-center">
        <LogoMark className="mx-auto h-8 w-auto opacity-80" />
        <p className="mt-4 font-mono text-[11px] tracking-[0.3em] text-muted">
          INTEGRATED · INTELLIGENT · PREDICTIVE · ACTIONABLE
        </p>
      </footer>
    </div>
  );
}
