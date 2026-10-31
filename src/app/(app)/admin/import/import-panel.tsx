"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Download, FileUp, Upload } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { importColumns, templateCsv, validateImport, type ImportKind, type ImportResult } from "@/lib/import";
import { importData } from "./actions";

const kinds: { key: ImportKind; label: string; note: string }[] = [
  { key: "aircraft", label: "1 · Aircraft", note: "Import aircraft first — engines refer to them by registration." },
  { key: "engines", label: "2 · Engines", note: "Engines with a registration and position are fitted to that aircraft." },
];
const PREVIEW_ROWS = 200;

export function ImportPanel({ today }: { today: string }) {
  const [kind, setKind] = useState<ImportKind>("aircraft");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();

  const parsed = useMemo(() => (text.trim() ? validateImport(kind, text, today) : null), [kind, text, today]);
  const cols = importColumns[kind];
  const errorRows = parsed?.rows.filter((r) => r.errors.length).length ?? 0;
  const canImport = !!parsed && parsed.rows.length > 0 && errorRows === 0 && !pending;

  const choose = (k: ImportKind) => { setKind(k); setText(""); setFileName(""); setResult(null); };
  const download = () => {
    const url = URL.createObjectURL(new Blob([templateCsv(kind)], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `hermes-${kind}-template.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };
  const readFile = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    setText(await file.text());
  };
  const run = () =>
    startTransition(async () => {
      const r = await importData(kind, text);
      setResult(r);
      if (r.ok) { setText(""); setFileName(""); }
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {kinds.map((k) => (
          <button
            key={k.key}
            type="button"
            onClick={() => choose(k.key)}
            className={`rounded-lg border px-4 py-2 text-sm transition ${kind === k.key ? "border-gold/60 bg-gold/10 text-gold-soft" : "border-border text-muted hover:text-foreground"}`}
          >
            {k.label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="panel space-y-4 rounded-2xl p-6 lg:col-span-1">
          <p className="label">Load a file</p>
          <p className="text-sm text-muted">{kinds.find((k) => k.key === kind)!.note}</p>
          <button type="button" onClick={download} className={buttonClass()}>
            <Download size={15} /> Download {kind} template
          </button>
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted transition hover:border-gold/50 hover:text-foreground">
            <FileUp size={20} className="text-accent" />
            {fileName || "Choose a CSV file"}
            <span className="text-xs">Save Excel sheets as “CSV UTF-8”</span>
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => readFile(e.target.files?.[0])} />
          </label>
          <label className="block">
            <span className="label">…or paste rows (with the heading row)</span>
            <textarea
              value={text}
              onChange={(e) => { setText(e.target.value); setFileName(""); setResult(null); }}
              rows={5}
              spellCheck={false}
              wrap="off"
              className="mt-1.5 w-full rounded-lg border border-border bg-background/60 px-3 py-2 font-mono text-xs outline-none focus:border-gold/60"
            />
          </label>
        </section>

        <section className="panel space-y-3 rounded-2xl p-6 lg:col-span-2">
          <p className="label">Columns</p>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {cols.map((c) => (
              <div key={c.key}>
                <dt className="font-mono text-xs text-gold-soft">
                  {c.key}{c.required && <span className="text-danger"> *</span>}
                </dt>
                <dd className="text-xs text-muted">{c.hint || c.label}</dd>
              </div>
            ))}
          </dl>
          <p className="pt-2 text-xs text-muted">
            <span className="text-danger">*</span> required. Rows whose {cols[0].key} already exists update that record — blank cells
            leave the stored value unchanged.
          </p>
        </section>
      </div>

      {result && (
        <div className={`panel rounded-2xl p-5 text-sm ${result.ok ? "!border-success/40" : "!border-danger/40"}`}>
          {result.ok ? (
            <>
              <p className="flex items-center gap-2 text-success">
                <CheckCircle2 size={16} /> Import finished — {result.created} created, {result.updated} updated
                {kind === "engines" && `, ${result.fitted} fitted to aircraft`}.
              </p>
              {!!result.rowErrors?.length && (
                <ul className="mt-3 space-y-1 text-warning">
                  {result.rowErrors.map((e) => <li key={e.line}>Line {e.line}: {e.message}</li>)}
                </ul>
              )}
            </>
          ) : (
            <p className="flex items-start gap-2 text-danger"><AlertTriangle size={16} className="mt-0.5 shrink-0" /> {result.error}</p>
          )}
        </div>
      )}

      {parsed && (
        <section className="panel overflow-hidden rounded-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
            <div>
              <p className="label">Preview</p>
              <p className="mt-1 text-sm">
                {parsed.rows.length} row{parsed.rows.length === 1 ? "" : "s"} ·{" "}
                {errorRows ? <span className="text-danger">{errorRows} with errors — fix them in the file and load it again</span> : <span className="text-success">all valid</span>}
              </p>
              {parsed.fileErrors.map((e) => <p key={e} className="mt-1 text-xs text-warning">{e}</p>)}
            </div>
            <button type="button" disabled={!canImport} onClick={run} className={buttonClass("primary")}>
              <Upload size={15} /> {pending ? "Importing…" : `Import ${parsed.rows.length} ${kind}`}
            </button>
          </div>
          {parsed.rows.length > 0 && (
            <div className="max-h-[32rem] overflow-auto border-t border-border">
              <table className="w-full text-left text-xs">
                <thead className="label sticky top-0 bg-surface">
                  <tr>
                    <th className="px-4 py-2 font-normal">Line</th>
                    {cols.map((c) => <th key={c.key} className="whitespace-nowrap px-4 py-2 font-normal">{c.key}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {parsed.rows.slice(0, PREVIEW_ROWS).map((r) => (
                    <tr key={r.line} className={`border-t border-border align-top ${r.errors.length ? "bg-danger/5" : ""}`}>
                      <td className="px-4 py-2 font-mono text-muted">{r.line}</td>
                      {r.errors.length ? (
                        <td colSpan={cols.length} className="px-4 py-2 text-danger">
                          <span className="font-mono">{r.values[cols[0].key] || "(blank)"}</span> — {r.errors.join(" ")}
                        </td>
                      ) : (
                        cols.map((c) => <td key={c.key} className="whitespace-nowrap px-4 py-2 font-mono">{r.values[c.key] || <span className="text-muted/50">—</span>}</td>)
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed.rows.length > PREVIEW_ROWS && (
                <p className="border-t border-border px-4 py-2 text-xs text-muted">Showing the first {PREVIEW_ROWS} rows; all {parsed.rows.length} are checked.</p>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
