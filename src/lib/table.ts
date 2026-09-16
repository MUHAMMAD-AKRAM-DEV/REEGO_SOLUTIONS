/**
 * Shared list controls: search, filter, sort, paginate.
 *
 * Everything lives in the URL rather than component state, so a filtered view
 * is a link — someone can paste "all of Raman's expiring credentials" into
 * chat and the person who opens it sees the same rows.
 */

export type SortDirection = "asc" | "desc";

export type TableQuery = {
  q: string;
  sort: string;
  dir: SortDirection;
  page: number;
  filters: Record<string, string>;
};

export type SearchParams = Record<string, string | string[] | undefined>;

export const PAGE_SIZE = 50;

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

/**
 * `allowedSorts` is a whitelist — a sort key arriving from the URL is never
 * passed to the database without appearing in it, so the query string cannot
 * be used to order by a column the page does not expose.
 */
export function parseQuery(
  searchParams: SearchParams,
  options: {
    allowedSorts: readonly string[];
    defaultSort: string;
    defaultDir?: SortDirection;
    filterKeys?: readonly string[];
  },
): TableQuery {
  const requestedSort = first(searchParams.sort);
  const sort = options.allowedSorts.includes(requestedSort)
    ? requestedSort
    : options.defaultSort;

  const requestedDir = first(searchParams.dir);
  const dir: SortDirection =
    requestedDir === "asc" || requestedDir === "desc"
      ? requestedDir
      : (options.defaultDir ?? "asc");

  const filters: Record<string, string> = {};
  for (const key of options.filterKeys ?? []) {
    const value = first(searchParams[key]);
    if (value) filters[key] = value;
  }

  const page = Math.max(1, Number(first(searchParams.page)) || 1);

  return { q: first(searchParams.q).trim(), sort, dir, page, filters };
}

/** Build a querystring for a link that changes one thing and keeps the rest. */
export function buildQueryString(
  query: TableQuery,
  overrides: Partial<TableQuery> & { [key: string]: unknown },
): string {
  const params = new URLSearchParams();
  const merged = { ...query, ...overrides };

  if (merged.q) params.set("q", String(merged.q));
  if (merged.sort) params.set("sort", String(merged.sort));
  if (merged.dir) params.set("dir", String(merged.dir));

  const filters = (overrides.filters ?? query.filters) as Record<string, string>;
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }

  // Any page change is explicit; changing a sort or filter resets to page 1.
  const page = Number(merged.page ?? 1);
  if (page > 1) params.set("page", String(page));

  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/** Clicking the active column flips direction; a new column starts ascending. */
export function nextDirection(
  query: TableQuery,
  column: string,
): SortDirection {
  if (query.sort !== column) return "asc";
  return query.dir === "asc" ? "desc" : "asc";
}

/**
 * Translate a sort key into a Prisma orderBy. Dotted keys become nested
 * ordering, e.g. "client.name" -> { client: { name: "asc" } }.
 */
export function orderBy(
  query: TableQuery,
): Record<string, unknown> | Record<string, unknown>[] {
  const segments = query.sort.split(".");
  return segments.reduceRight<Record<string, unknown>>(
    (accumulator, segment, index) =>
      index === segments.length - 1
        ? { [segment]: query.dir }
        : { [segment]: accumulator },
    {},
  );
}

export function skipTake(query: TableQuery) {
  return { skip: (query.page - 1) * PAGE_SIZE, take: PAGE_SIZE };
}

/** Days from today, negative once the date is in the past. */
export function daysUntil(date: Date | null | undefined): number | null {
  if (!date) return null;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - startOfToday.getTime()) / 86_400_000);
}
