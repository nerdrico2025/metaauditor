// Supabase returns at most 1000 rows per query by default. For datasets that can
// exceed that (e.g. campaign_metrics with date × campaign rows), build the query
// up to but NOT including .range/.limit, then pass the builder factory here.
//
// Usage:
//   const rows = await fetchAllPaginated(() =>
//     supabase.from('campaign_metrics').select('...').eq('company_id', id)
//   );

/** Safe batch size for PostgREST `.in('column', ids)` filters (URL length). */
export const IN_FILTER_CHUNK = 150;

export async function fetchAllPaginated<T>(
  buildQuery: () => any,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < pageSize) break;
    from += pageSize;
    if (from > 500_000) break; // safety
  }
  return all;
}

/**
 * Runs fetchAllPaginated for each chunk of IDs and merges results.
 * Use when `.in('foreign_id', allIds)` would exceed PostgREST URL limits.
 */
export async function fetchAllPaginatedInChunks<T>(
  ids: string[],
  buildQuery: (chunkIds: string[]) => any,
  pageSize = 1000,
): Promise<T[]> {
  if (ids.length === 0) return [];
  const all: T[] = [];
  for (let i = 0; i < ids.length; i += IN_FILTER_CHUNK) {
    const chunk = ids.slice(i, i + IN_FILTER_CHUNK);
    const rows = await fetchAllPaginated<T>(() => buildQuery(chunk), pageSize);
    all.push(...rows);
  }
  return all;
}
