"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import {
  buildQueryString,
  nextDirection,
  type TableQuery,
} from "@/lib/table";

/**
 * A sortable column heading. Renders as a link so sorting is a normal
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
      className={`label border-b border-line px-4 py-2.5 whitespace-nowrap ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      <Link
        href={href}
        className={`inline-flex items-center gap-1 hover:text-ink ${
          active ? "text-accent-ink" : ""
        }`}
      >
        {children}
        <span aria-hidden="true" className="text-[0.8em] leading-none">
          {active ? (query.dir === "asc" ? "▲" : "▼") : " "}
        </span>
      </Link>
    </th>
  );
}

/** Debounced search box. Typing updates the URL, which re-runs the query. */
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
  // not synced back from the URL afterwards: doing so fights the keystrokes,
  // and the only cost is that Back does not rewrite the box text.
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
    <label className="flex items-center gap-2">
      <span className="sr-only">{placeholder}</span>
      <input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        className="w-56 rounded-[3px] border border-line bg-surface px-3 py-1.5 text-sm text-ink transition-colors placeholder:text-faint hover:border-faint focus:border-accent"
      />
    </label>
  );
}

/** A row of mutually exclusive filter chips, each a link. */
export function FilterChips({
  paramName,
  options,
  basePath,
  query,
}: {
  paramName: string;
  options: { value: string; label: string; count?: number }[];
  basePath: string;
  query: TableQuery;
}) {
  const current = query.filters[paramName] ?? "";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {[{ value: "", label: "All" }, ...options].map((option) => {
        const selected = current === option.value;
        const filters = { ...query.filters, [paramName]: option.value };
        const href = `${basePath}${buildQueryString(query, { filters, page: 1 })}`;

        return (
          <Link
            key={option.value || "all"}
            href={href}
            aria-current={selected ? "true" : undefined}
            className={`rounded-[3px] border px-2.5 py-1 font-mono text-[0.6875rem] tracking-wide uppercase transition-colors ${
              selected
                ? "border-accent bg-accent-soft text-accent-ink"
                : "border-line text-muted hover:bg-surface-2"
            }`}
          >
            {option.label}
            {typeof option.count === "number" ? (
              <span className="ml-1.5 opacity-70">{option.count}</span>
            ) : null}
          </Link>
        );
      })}
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
    <div className="flex items-center justify-between gap-4 px-4 py-2.5">
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
      <span className="rounded-[3px] border border-line-soft px-2.5 py-1 text-xs text-faint">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="rounded-[3px] border border-line px-2.5 py-1 text-xs text-ink-2 transition-colors hover:bg-surface-2"
    >
      {children}
    </Link>
  );
}
