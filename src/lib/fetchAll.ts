// Supabase returns at most 1,000 rows per request. This keeps asking for the next page until everything is in.

export async function fetchAll<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
  size = 1000,
  max = 50000
): Promise<{ data: T[]; error: any }> {
  const out: T[] = []
  for (let from = 0; from < max; from += size) {
    const { data, error } = await page(from, from + size - 1)
    if (error) return { data: out, error }
    out.push(...(data ?? []))
    if (!data || data.length < size) break
  }
  return { data: out, error: null }
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}
