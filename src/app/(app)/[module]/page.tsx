import { notFound } from "next/navigation";
import { Hammer } from "lucide-react";
import { navItems } from "@/lib/nav";

const BUILT = new Set(["dashboard", "fleet", "engines", "health", "defects", "reliability"]);

export function generateStaticParams() {
  return navItems.filter((i) => !BUILT.has(i.slug)).map((i) => ({ module: i.slug }));
}

/** Placeholder for modules not built yet. Real pages at /<slug>/page.tsx take precedence. */
export default async function ModulePage({ params }: PageProps<"/[module]">) {
  const { module } = await params;
  const item = navItems.find((i) => i.slug === module);
  if (!item) notFound();

  const Icon = item.icon;
  return (
    <div className="mx-auto max-w-3xl pt-10">
      <div className="panel rounded-2xl p-10 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-gold/30 bg-gold/10 text-gold">
          <Icon size={28} />
        </div>
        <h1 className="mt-6 text-2xl font-semibold">{item.label}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">{item.description}</p>
        <p className="mt-8 inline-flex items-center gap-2 rounded-full border border-border px-4 py-1.5 font-mono text-[11px] tracking-widest text-accent">
          <Hammer size={12} /> IN DEVELOPMENT · BUILD STEP {item.step}
        </p>
      </div>
    </div>
  );
}
