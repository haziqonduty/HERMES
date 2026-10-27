const modules = [
  {
    code: "CFG",
    title: "Configuration Control",
    body: "Tail-specific bill of materials, effectivity and modification status in one source of truth.",
  },
  {
    code: "MRO",
    title: "Maintenance Engineering",
    body: "Task cards, AD/SB compliance and reliability trends linked directly to each airframe.",
  },
  {
    code: "TWN",
    title: "Digital Twin",
    body: "Live structural and system health model fed by flight hours, cycles and inspection data.",
  },
  {
    code: "DOC",
    title: "Technical Records",
    body: "Versioned drawings, manuals and certification evidence with full audit trail.",
  },
];

const telemetry = [
  { label: "Fleet availability", value: "97.4", unit: "%", tone: "text-success" },
  { label: "Open work orders", value: "128", unit: "", tone: "text-foreground" },
  { label: "AD compliance", value: "100", unit: "%", tone: "text-accent" },
  { label: "Deferred defects", value: "6", unit: "", tone: "text-warning" },
];

const fleet = [
  { tail: "9M-HRM", type: "A320neo", hours: "12,480", status: "In service" },
  { tail: "9M-HRA", type: "A321neo", hours: "8,215", status: "C-check" },
  { tail: "9M-HRB", type: "B737-8", hours: "15,902", status: "In service" },
  { tail: "9M-HRC", type: "ATR 72-600", hours: "21,337", status: "AOG" },
];

const statusTone: Record<string, string> = {
  "In service": "bg-success/10 text-success ring-success/30",
  "C-check": "bg-accent/10 text-accent ring-accent/30",
  AOG: "bg-warning/10 text-warning ring-warning/30",
};

export default function Home() {
  return (
    <div className="relative isolate min-h-screen overflow-hidden">
      <div className="bg-grid pointer-events-none absolute inset-0 -z-10" />
      <div className="pointer-events-none absolute left-1/2 top-[-20rem] -z-10 h-[40rem] w-[60rem] -translate-x-1/2 rounded-full bg-accent-2/20 blur-[140px]" />

      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-accent to-accent-2 font-mono text-sm font-bold text-background">
            H
          </div>
          <span className="text-lg font-semibold tracking-[0.3em]">HERMES</span>
        </div>
        <nav className="hidden gap-8 text-sm text-muted md:flex">
          <a className="transition hover:text-foreground" href="#modules">Platform</a>
          <a className="transition hover:text-foreground" href="#fleet">Fleet</a>
          <a className="transition hover:text-foreground" href="#">Docs</a>
        </nav>
        <a
          href="#"
          className="rounded-full border border-border px-4 py-2 text-sm transition hover:border-accent/60 hover:text-accent"
        >
          Sign in
        </a>
      </header>

      <main className="mx-auto max-w-7xl px-6">
        <section className="pb-20 pt-16 md:pt-24">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 font-mono text-xs uppercase tracking-widest text-muted">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
            Systems nominal
          </p>
          <h1 className="max-w-4xl text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl">
            Digital engineering for the <span className="text-gradient">modern aircraft</span>.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted">
            Hermes unifies configuration, maintenance and technical records into a single engineering
            backbone — from design data to the hangar floor.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <a
              href="#fleet"
              className="rounded-full bg-accent px-6 py-3 text-sm font-medium text-background shadow-[0_0_40px_-8px_var(--accent)] transition hover:brightness-110"
            >
              Open console
            </a>
            <a
              href="#modules"
              className="rounded-full border border-border px-6 py-3 text-sm font-medium transition hover:border-foreground/40"
            >
              Explore platform
            </a>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {telemetry.map((t) => (
            <div key={t.label} className="glass rounded-2xl p-5">
              <p className="font-mono text-[11px] uppercase tracking-widest text-muted">{t.label}</p>
              <p className={`mt-3 font-mono text-4xl font-medium tabular-nums ${t.tone}`}>
                {t.value}
                <span className="ml-1 text-lg text-muted">{t.unit}</span>
              </p>
            </div>
          ))}
        </section>

        <section id="modules" className="py-24">
          <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-accent">Platform modules</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {modules.map((m) => (
              <article
                key={m.code}
                className="glass group rounded-2xl p-7 transition hover:border-accent/40"
              >
                <span className="font-mono text-xs text-muted transition group-hover:text-accent">
                  {m.code}
                </span>
                <h3 className="mt-3 text-xl font-medium">{m.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{m.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="fleet" className="pb-24">
          <div className="glass overflow-hidden rounded-2xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-accent">Fleet status</h2>
              <span className="font-mono text-xs text-muted">Sample data</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="font-mono text-[11px] uppercase tracking-widest text-muted">
                  <tr>
                    <th className="px-6 py-3 font-normal">Tail</th>
                    <th className="px-6 py-3 font-normal">Type</th>
                    <th className="px-6 py-3 font-normal">Flight hours</th>
                    <th className="px-6 py-3 font-normal">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {fleet.map((a) => (
                    <tr key={a.tail} className="border-t border-border transition hover:bg-surface-2/60">
                      <td className="px-6 py-4 font-mono">{a.tail}</td>
                      <td className="px-6 py-4">{a.type}</td>
                      <td className="px-6 py-4 font-mono tabular-nums text-muted">{a.hours}</td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs ring-1 ${statusTone[a.status]}`}>
                          {a.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center font-mono text-xs text-muted">
        HERMES · Aircraft Digital Engineering
      </footer>
    </div>
  );
}
