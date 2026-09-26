"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function useListFilters() {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.delete("after");
    next.delete("new");
    if (!value || value === "ALL") next.delete(key);
    else next.set(key, value);
    router.push(`${path}?${next}`, { scroll: false });
  };
  return {
    filter: params.get("status") || "ALL",
    search: params.get("q") || "",
    setFilter: (value: string) => update("status", value),
    setSearch: (value: string) => update("q", value),
    clearFilters: () => router.push(path, { scroll: false })
  };
}

export function ListSearch({ placeholder }: { placeholder: string }) {
  const { search, setSearch } = useListFilters();
  const [draft, setDraft] = useState(search);
  useEffect(() => setDraft(search), [search]);
  return (
    <form
      className="toolbar-search"
      onSubmit={(event) => {
        event.preventDefault();
        setSearch(draft);
      }}
    >
      <label className="sr-only" htmlFor="list-search">
        Search records
      </label>
      <input
        id="list-search"
        type="search"
        className="admin-input"
        placeholder={placeholder}
        maxLength={100}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      <button className="admin-btn admin-btn-small" type="submit">
        Search
      </button>
    </form>
  );
}

export function ListNavigation({
  query,
  total,
  next,
  base,
  search = false
}: {
  query: { q?: string; status?: string; after?: string };
  total: number;
  next: string | null;
  base: string;
  search?: boolean;
}) {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.status) params.set("status", query.status);
  const first = `${base}?${params}`;
  if (next) params.set("after", next);
  return (
    <nav
      aria-label="Record pages"
      style={{ margin: "20px 0", display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}
    >
      {search && <ListSearch placeholder="Search project, customer or reference..." />}
      <span>{total.toLocaleString("en-IN")} matching records · up to 50 per page</span>
      {query.after && <Link href={first}>First page</Link>}
      {next && <Link href={`${base}?${params}`}>Next page →</Link>}
    </nav>
  );
}
