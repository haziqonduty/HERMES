"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navGroups, navItems } from "@/lib/nav";
import { Logo } from "./logo";

const isActive = (pathname: string | null, slug: string) =>
  pathname != null && (pathname === `/${slug}` || pathname.startsWith(`/${slug}/`));

/**
 * The pathname is request data on dynamic routes (e.g. /engines/[serial]), so the
 * highlighted link streams in; the fallback renders the same links unhighlighted.
 */
function WithPathname({ render }: { render: (pathname: string | null) => React.ReactNode }) {
  return <Suspense fallback={render(null)}><PathnameReader render={render} /></Suspense>;
}

function PathnameReader({ render }: { render: (pathname: string | null) => React.ReactNode }) {
  return render(usePathname());
}

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-surface/70 backdrop-blur-xl lg:flex">
      <div className="border-b border-border px-5 py-5">
        <Link href="/dashboard">
          <Logo />
        </Link>
        <p className="mt-3 font-mono text-[10px] tracking-[0.2em] text-accent">HERMES-E · ENGINE</p>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        <WithPathname render={(pathname) => <SidebarLinks pathname={pathname} />} />
      </nav>

      <div className="border-t border-border px-5 py-4 font-mono text-[10px] tracking-widest text-muted">
        v0.4 · HEALTH MONITORING
      </div>
    </aside>
  );
}

function SidebarLinks({ pathname }: { pathname: string | null }) {
  return navGroups.map((group) => (
    <div key={group.title}>
      <p className="label px-3 pb-2 !text-[10px]">{group.title}</p>
      <ul className="space-y-0.5">
        {group.items.map(({ slug, label, icon: Icon }) => {
          const active = isActive(pathname, slug);
          return (
            <li key={slug}>
              <Link
                href={`/${slug}`}
                className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                  active
                    ? "bg-gradient-to-r from-gold/15 to-transparent text-gold-soft"
                    : "text-muted hover:bg-surface-2 hover:text-foreground"
                }`}
              >
                {active && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-gold" />}
                <Icon size={16} className={active ? "text-gold" : "text-muted group-hover:text-accent"} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  ));
}

/** Horizontal module strip shown below the top bar on small screens. */
export function MobileNav() {
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-border bg-surface/70 px-3 py-2 lg:hidden">
      <WithPathname
        render={(pathname) =>
          navItems.map(({ slug, label, icon: Icon }) => (
            <Link
              key={slug}
              href={`/${slug}`}
              className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs ${
                isActive(pathname, slug) ? "bg-gold/15 text-gold-soft" : "text-muted"
              }`}
            >
              <Icon size={13} />
              {label}
            </Link>
          ))
        }
      />
    </nav>
  );
}
