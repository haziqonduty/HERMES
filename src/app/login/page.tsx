import { Suspense } from "react";
import Link from "next/link";
import { LogoMark } from "@/components/logo";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="relative isolate grid min-h-screen place-items-center overflow-hidden px-4 py-16 sm:px-6">
      <div className="bg-grid pointer-events-none absolute inset-0 -z-10" />
      <div className="pointer-events-none absolute left-1/2 top-1/3 -z-10 h-[30rem] w-[30rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/10 blur-[120px]" />

      <div className="w-full max-w-md">
        <Link href="/" className="mx-auto mb-8 flex flex-col items-center gap-4">
          <LogoMark className="h-16 w-auto drop-shadow-[0_0_24px_rgba(233,180,76,0.35)]" />
          <span className="text-gold-gradient text-2xl font-semibold tracking-[0.4em]">HERMES</span>
        </Link>

        <div className="panel rounded-2xl p-8">
          <h1 className="text-xl font-medium">Engineering Operations Center</h1>
          <p className="mt-1 text-sm text-muted">Authorised personnel only. All access is logged.</p>
          <div className="mt-8">
            <Suspense>
              <LoginForm />
            </Suspense>
          </div>
        </div>

        <p className="mt-6 text-center font-mono text-[11px] tracking-widest text-muted">
          ACCOUNTS ARE ISSUED BY YOUR HERMES ADMINISTRATOR
        </p>
      </div>
    </div>
  );
}
