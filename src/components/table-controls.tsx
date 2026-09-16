"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { buildQueryString, nextDirection, type TableQuery } from "@/lib/table";

/**
 * A sortable column heading. A link, not a button, so sorting is ordinary
 * navigation — shareable, bookmarkable, and it works without JavaScript.
 */
export function SortTh({
  column,
  query,
  basePath,
  children,
  align = "left",
}: {
  column: string;
  query: TableQuery;
  basePath: string;
  children: ReactNode;
  align?: "left" | "right";
}) {
  const active = query.sort === column;
  const dir = nextDirection(query, column);
  const href = `${basePath}${buildQueryString(query, { sort: column, dir, page: 1 })}`;

  return (
    <th
      scope="col"
      aria-sort={active ? (query.dir === "asc" ? "ascending" : "descending") : "none"}
      className={`label border-b border-line bg-surface-2/60 px-4 py-2.5 whitespace-nowrap ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      <Link
        href={href}
        className={`group inline-flex items-center gap-1 transition-colors hover:text-ink ${
          active ? "text-accent-ink" : ""
        }`}
      >
        {children}
        <Caret active={active} direction={query.dir} />
      </Link>
    </th>
  );
}

function Caret({ active, direction }: { active: boolean; direction: string }) {
  return (
    <svg
      width="8"
      height="10"
      viewBox="0 0 8 10"
      aria-hidden="true"
      className={
        active ? "opacity-100" : "opacity-0 transition-opacity group-hover:opacity-40"
      }
    >
      <path
        d="M4 0.5 L7 4 L1 4 Z"
        fill="currentColor"
        opacity={!active || direction === "asc" ? 1 : 0.25}
      />
      <path
        d="M4 9.5 L1 6 L7 6 Z"
        fill="currentColor"
        opacity={!active || direction === "desc" ? 1 : 0.25}
      />
    </svg>
  );
}

/** Debounced search. Typing rewrites the URL, which re-runs the query. */
export function SearchBox({
  placeholder = "Search…",
  paramName = "q",
}: {
  placeholder?: string;
  paramName?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Seeded from the URL once, then owned by the person typing. Deliberately
  // not synced back afterwards: that fights the keystrokes.
  const [value, setValue] = useState(() => searchParams.get(paramName) ?? "");

  useEffect(() => {
    const current = searchParams.get(paramName) ?? "";
    if (value === current) return;

    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(paramName, value);
      else params.delete(paramName);
      params.delete("page");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, 250);

    return () => clearTimeout(timer);
  }, [value, searchParams, paramName, pathname, router]);

  return (
    <div className="relative min-w-0 flex-1 sm:max-w-xs">
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-faint"
      >
        <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10.5 10.5 L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full rounded-card border border-line bg-surface py-1.5 pr-3 pl-8 text-sm text-ink transition-colors placeholder:text-faint hover:border-line-strong focus:border-accent"
      />
    </div>
  );
}

/**
 * Filters as a select, not a row of chips.
 *
 * Chip rows looked fine with four options and became a wall with fourteen.
 * A select stays one line however many options a filter grows, and navigating
 * on change keeps the state in the URL where the rest of the list state lives.
 */
export function FilterSelect({
  paramName,
  label,
  options,
  basePath,
  query,
  allLabel = "All",
}: {
  paramName: string;
  label: string;
  options: { value: string; label: string }[];
  basePath: string;
  query: TableQuery;
  allLabel?: string;
}) {
  const router = useRouter();
  const current = query.filters[paramName] ?? "";

  // Callers assemble option lists from several sources, so the same value can
  // legitimately arrive twice ("Mine" and the same person in the staff list).
  // First spelling wins.
  const seen = new Set<string>();
  const unique = options.filter((option) => {
    if (seen.has(option.value)) return false;
    seen.add(option.value);
    return true;
  });

  return (
    <label className="flex items-center gap-1.5">
      <span className="label whitespace-nowrap">{label}</span>
      <select
        value={current}
        onChange={(event) => {
          const filters = { ...query.filters, [paramName]: event.target.value };
          router.push(`${basePath}${buildQueryString(query, { filters, page: 1 })}`);
        }}
        className={`rounded-card border py-1.5 pr-7 pl-2.5 text-sm transition-colors focus:border-accent ${
          current
            ? "border-accent bg-accent-softer font-medium text-accent-ink"
            : "border-line bg-surface text-ink-2 hover:border-line-strong"
        }`}
      >
        <option value="">{allLabel}</option>
        {unique.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * A small set of mutually exclusive choices that deserve to stay visible —
 * the expiry window on credentialing, for instance, which is the first thing
 * anyone reaches for. Rendered as a segmented control, not loose chips.
 */
export function SegmentedFilter({
  paramName,
  options,
  basePath,
  query,
  allLabel = "All",
}: {
  paramName: string;
  options: { value: string; label: string }[];
  basePath: string;
  query: TableQuery;
  allLabel?: string;
}) {
  const current = query.filters[paramName] ?? "";

  return (
    <div className="inline-flex items-center rounded-card border border-line bg-surface p-0.5 shadow-panel">
      {[{ value: "", label: allLabel }, ...options].map((option) => {
        const selected = current === option.value;
        const filters = { ...query.filters, [paramName]: option.value };
        const href = `${basePath}${buildQueryString(query, { filters, page: 1 })}`;

        return (
          <Link
            key={option.value || "all"}
            href={href}
            aria-current={selected ? "true" : undefined}
            className={`rounded-[3px] px-2.5 py-1 font-mono text-[0.6875rem] tracking-wide whitespace-nowrap uppercase transition-all ${
              selected
                ? "bg-accent text-on-accent shadow-panel"
                : "text-muted hover:bg-surface-2 hover:text-ink-2"
            }`}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}

/** Wraps the controls above a table into one calm bar. */
export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-panel border border-line bg-surface-2 px-4 py-3">
      {children}
    </div>
  );
}

export function Pagination({
  total,
  pageSize,
  query,
  basePath,
}: {
  total: number;
  pageSize: number;
  query: TableQuery;
  basePath: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;

  const from = (query.page - 1) * pageSize + 1;
  const to = Math.min(query.page * pageSize, total);

  return (
    <div className="flex items-center justify-between gap-4 bg-surface-2 px-4 py-2.5">
      <span className="figure text-xs text-muted">
        {from}–{to} of {total}
      </span>
      <span className="flex items-center gap-2">
        <PageLink
          disabled={query.page <= 1}
          href={`${basePath}${buildQueryString(query, { page: query.page - 1 })}`}
        >
          Previous
        </PageLink>
        <span className="figure text-xs text-muted">
          {query.page} / {pages}
        </span>
        <PageLink
          disabled={query.page >= pages}
          href={`${basePath}${buildQueryString(query, { page: query.page + 1 })}`}
        >
          Next
        </PageLink>
      </span>
    </div>
  );
}

function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: ReactNode;
}) {
  if (disabled) {
    return (
      <span className="rounded-card border border-line-soft px-2.5 py-1 text-xs text-faint">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="rounded-card border border-line bg-surface px-2.5 py-1 text-xs text-ink-2 transition-colors hover:border-line-strong hover:bg-surface-2"
    >
      {children}
    </Link>
  );
}
