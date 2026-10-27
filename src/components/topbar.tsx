import { LogOut } from "lucide-react";
import { signOut } from "@/app/login/actions";
import { roleLabels } from "@/lib/nav";
import { LogoMark } from "./logo";

export function Topbar({ children }: { children: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/70 px-6 backdrop-blur-xl">
      <div className="flex items-center gap-3 lg:hidden">
        <LogoMark className="h-7 w-auto" />
        <span className="text-gold-gradient font-semibold tracking-[0.3em]">HERMES</span>
      </div>
      <div className="hidden items-center gap-2 font-mono text-[11px] tracking-widest text-muted lg:flex">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
        SYSTEMS NOMINAL
      </div>
      {children}
    </header>
  );
}

export function TopbarUserMenu({ name, role }: { name: string; role: string }) {
  const initials = name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <div className="flex items-center gap-4">
      <div className="hidden text-right leading-tight sm:block">
        <p className="text-sm">{name}</p>
        <p className="font-mono text-[10px] tracking-widest text-gold">{(roleLabels[role] ?? role).toUpperCase()}</p>
      </div>
      <div className="grid h-9 w-9 place-items-center rounded-full border border-gold/40 bg-surface-2 text-xs font-semibold text-gold-soft">
        {initials || "?"}
      </div>
      <form action={signOut}>
        <button
          type="submit"
          title="Sign out"
          className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted transition hover:border-danger/50 hover:text-danger"
        >
          <LogOut size={15} />
        </button>
      </form>
    </div>
  );
}

export function TopbarUserSkeleton() {
  return (
    <div className="flex animate-pulse items-center gap-4">
      <div className="hidden h-8 w-32 rounded bg-surface-2 sm:block" />
      <div className="h-9 w-9 rounded-full bg-surface-2" />
    </div>
  );
}
