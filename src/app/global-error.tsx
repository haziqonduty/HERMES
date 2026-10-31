"use client";

import "./globals.css";
import { StatusScreen } from "@/components/status-screen";
import { buttonClass } from "@/components/ui";

/** Last-resort error page when the root layout itself fails. Replaces the whole document. */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full px-4 sm:px-6">
        <title>Error · Hermes</title>
        <StatusScreen
          code="SYSTEM FAULT"
          title="HERMES couldn't start"
          actions={<button type="button" onClick={() => retry()} className={buttonClass("primary")}>Try again</button>}
        >
          An unexpected error stopped the application from loading. Try again in a moment.
        </StatusScreen>
      </body>
    </html>
  );
}
