"use client";
import { useEffect, useState } from "react";
import type { CustomerOption } from "@/lib/operations";

export function CustomerSelect({ initial, label }: { initial: CustomerOption[]; label: string }) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState(initial);
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!query) {
      setOptions(initial);
      setPending(false);
      return;
    }
    const controller = new AbortController();
    setPending(true);
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/admin/customer-options?q=${encodeURIComponent(query)}`, {
          signal: controller.signal
        });
        if (!response.ok) throw new Error("Search unavailable");
        const data: { options: CustomerOption[] } = await response.json();
        setOptions(data.options);
        setError("");
      } catch {
        if (!controller.signal.aborted)
          setError("Customer search is unavailable. Please try again.");
      } finally {
        if (!controller.signal.aborted) setPending(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, initial]);
  return (
    <>
      <label htmlFor="customer-search">Search customer directory</label>
      <input
        id="customer-search"
        className="admin-input"
        type="search"
        maxLength={100}
        value={query}
        placeholder="Search by name or phone"
        onChange={(event) => {
          setQuery(event.target.value);
          setValue("");
        }}
      />
      <label htmlFor="customerId">{label}</label>
      <select
        id="customerId"
        name="customerId"
        required
        className="admin-input"
        value={value}
        disabled={pending}
        onChange={(event) => setValue(event.target.value)}
      >
        <option value="">{pending ? "Searching…" : "Choose a customer (first 25 matches)"}</option>
        {options.map((customer) => (
          <option key={customer.id} value={customer.id}>
            {customer.name} ({customer.phone})
          </option>
        ))}
      </select>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
