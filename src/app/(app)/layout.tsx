import { Suspense } from "react";
import { MobileNav, Sidebar } from "@/components/sidebar";
import { Topbar, TopbarUserMenu, TopbarUserSkeleton } from "@/components/topbar";
import { getCurrentUser } from "@/lib/auth";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="relative isolate flex min-h-screen">
      <div className="bg-grid pointer-events-none fixed inset-0 -z-10 opacity-60 print:hidden" />
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar>
          <Suspense fallback={<TopbarUserSkeleton />}>
            <TopbarUser />
          </Suspense>
        </Topbar>
        <MobileNav />
        <main className="flex-1 px-6 py-8 print:p-0">
          <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
        </main>
      </div>
    </div>
  );
}

async function TopbarUser() {
  const user = await getCurrentUser();
  return <TopbarUserMenu name={user.name} role={user.role} />;
}

function PageSkeleton() {
  return (
    <div className="mx-auto max-w-7xl animate-pulse space-y-6">
      <div className="h-10 w-72 rounded-lg bg-surface-2" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-36 rounded-2xl bg-surface-2/70" />
        ))}
      </div>
      <div className="h-72 rounded-2xl bg-surface-2/50" />
    </div>
  );
}
