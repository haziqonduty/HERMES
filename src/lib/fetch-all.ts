type PgError = { code?: string; message: string };
type Page<T> = PromiseLike<{ data: T[] | null; error: PgError | null }>;

/** Supabase (PostgREST) returns at most 1000 rows per request by default and silently drops the rest. */
export const PAGE_SIZE = 1000;

/**
 * Fetches every row of a query, one page at a time. `query(from, to)` must build a fresh
 * query with a stable order (end with a unique column) and apply `.range(from, to)`.
 */
export async function fetchAll<T>(query: (from: number, to: number) => Page<T>): Promise<{ data: T[] | null; error: PgError | null }> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await query(from, from + PAGE_SIZE - 1);
    if (error) return { data: null, error };
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return { data: rows, error: null };
  }
}
