"use client";

import { Printer } from "lucide-react";
import { buttonClass } from "./ui";

/** Opens the browser print dialog — "Save as PDF" produces the report PDF. */
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={buttonClass("primary")}>
      <Printer size={15} /> Print / PDF
    </button>
  );
}
