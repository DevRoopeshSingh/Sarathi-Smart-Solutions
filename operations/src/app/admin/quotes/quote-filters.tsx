"use client";
import { useListFilters } from "../list-controls";
import { quoteStatusLabel } from "@/lib/quotation-money";
export function QuoteFilters() {
  const { filter, setFilter } = useListFilters();
  return (
    <div className="quote-filter">
      <label htmlFor="quote-status">Quotation status</label>
      <select
        id="quote-status"
        className="admin-input"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      >
        {["ALL", "DRAFT", "SENT", "APPROVED", "DECLINED", "EXPIRED", "SUPERSEDED", "VOID"].map(
          (status) => (
            <option key={status} value={status}>
              {status === "ALL" ? "All quotations" : quoteStatusLabel(status)}
            </option>
          )
        )}
      </select>
    </div>
  );
}
