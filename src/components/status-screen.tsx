import { LogoMark } from "./logo";

/** Centred message panel used by the 404 and error pages. Works in server and client components. */
export function StatusScreen({
  code,
  title,
  children,
  actions,
}: {
  code: string;
  title: string;
  children: React.ReactNode;
  actions: React.ReactNode;
}) {
  return (
    <div className="grid min-h-[60vh] place-items-center py-10">
      <div className="panel w-full max-w-lg p-8 text-center">
        <LogoMark className="mx-auto h-12 w-auto opacity-90" />
        <p className="mt-6 font-mono text-[11px] tracking-[0.3em] text-accent">{code}</p>
        <h1 className="text-gold-gradient mt-2 text-2xl font-semibold">{title}</h1>
        <div className="mt-3 text-sm leading-relaxed text-muted">{children}</div>
        <div className="mt-7 flex flex-wrap justify-center gap-3">{actions}</div>
      </div>
    </div>
  );
}
