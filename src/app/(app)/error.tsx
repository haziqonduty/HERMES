"use client";

import { useEffect } from "react";
import { StatusScreen } from "@/components/status-screen";
import { ButtonLink, buttonClass } from "@/components/ui";

/** Unexpected errors inside a module. The sidebar and top bar stay, so the user can carry on elsewhere. */
export default function ModuleError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const digest = error instanceof Error && "digest" in error ? String(error.digest) : null;

  return (
    <StatusScreen
      code="SYSTEM FAULT"
      title="This page couldn't load"
      actions={
        <>
          <button type="button" onClick={() => retry()} className={buttonClass("primary")}>Try again</button>
          <ButtonLink href="/dashboard">Go to dashboard</ButtonLink>
        </>
      }
    >
      <p>
        Something went wrong while loading this page. Nothing you saved has been lost. Try again; if it keeps
        happening, check your connection or tell your HERMES administrator.
      </p>
      {digest && <p className="mt-3 font-mono text-[11px] text-muted/70">Reference: {digest}</p>}
    </StatusScreen>
  );
}
