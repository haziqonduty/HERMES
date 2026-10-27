/** Shown when 0005_defects_reliability.sql has not been applied yet. */
export function SetupNotice({ module = "Defect Management" }: { module?: string }) {
  return (
    <div className="panel mx-auto max-w-2xl rounded-2xl p-8">
      <p className="label !text-gold">Setup required</p>
      <h1 className="mt-3 text-xl font-medium">{module} not set up yet</h1>
      <p className="mt-2 text-sm text-muted">
        Run <code className="text-gold-soft">supabase/migrations/0005_defects_reliability.sql</code> in the Supabase SQL Editor, then refresh this page.
      </p>
    </div>
  );
}
