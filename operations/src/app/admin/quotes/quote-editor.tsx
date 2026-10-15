"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CustomerSelect } from "../customer-select";
import { PROJECT_SERVICE_OPTIONS } from "@/lib/project-services";
import type { Quotation } from "@/lib/quotations";
import type { QuoteLineInput, QuoteTotals, TaxMode } from "@/lib/quotation-money";
import type { DocumentSettings, QuoteDraftInput } from "@/server/quotation-input";
import { saveQuoteAction, previewQuoteAction, quoteProjectsAction } from "./actions";
const emptyItem = (): QuoteLineInput => ({
  description: "",
  quantity: "1",
  unit: "service",
  rate: "0",
  taxPercent: "0.00"
});
export function QuoteEditor({
  quote,
  divisions,
  customers
}: {
  quote: Quotation | null;
  divisions: { id: string; name: string; settings: DocumentSettings }[];
  customers: { id: string; name: string; phone: string }[];
}) {
  const router = useRouter(),
    request = useRef<string | null>(null),
    busy = useRef(false);
  const [customerId, setCustomer] = useState(quote?.customerId ?? ""),
    [divisionId, setDivision] = useState(quote?.divisionId ?? divisions[0]?.id ?? "");
  const [projectId, setProject] = useState(quote?.projectId ?? ""),
    [projectSearch, setProjectSearch] = useState("");
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]),
    [projectPending, setProjectPending] = useState(false);
  const [items, setItems] = useState<QuoteLineInput[]>(quote?.items ?? [emptyItem()]);
  const [taxMode, setTaxMode] = useState<TaxMode>(
    quote?.taxMode && quote.taxMode !== "LEGACY" ? quote.taxMode : "NONE"
  );
  const [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [totals, setTotals] = useState<QuoteTotals | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const division = divisions.find((d) => d.id === divisionId);
  useEffect(() => {
    if (!customerId || !divisionId || quote) {
      setProjects([]);
      return;
    }
    let active = true;
    setProjectPending(true);
    const timer = setTimeout(
      () =>
        void quoteProjectsAction(customerId, divisionId, projectSearch)
          .then((result) => {
            if (active) {
              if ("options" in result) setProjects(result.options);
              else {
                setError(result.error);
                setProjects([]);
              }
              setProjectPending(false);
            }
          })
          .catch(() => {
            if (active) {
              setError("Project search failed. Try again.");
              setProjectPending(false);
            }
          }),
      250
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [customerId, divisionId, projectSearch, quote]);
  const updateItem = (index: number, key: keyof QuoteLineInput, value: string) => {
    setItems((rows) => rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
    setTotals(null);
  };
  const input = (): QuoteDraftInput => {
    const values = new FormData(form.current!);
    return {
      customerId,
      divisionId,
      projectId: projectId || undefined,
      title: String(values.get("title") ?? ""),
      siteAddress: String(values.get("siteAddress") ?? ""),
      discount: String(values.get("discount") ?? "0"),
      taxMode,
      validUntil: String(values.get("validUntil") ?? ""),
      terms: String(values.get("terms") ?? ""),
      items
    };
  };
  const submit = async (preview = false) => {
    if (busy.current || !form.current?.reportValidity()) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const data = input();
      if (preview) {
        const result = await previewQuoteAction(data);
        if ("error" in result) setError(result.error);
        else setTotals(result.totals);
      } else {
        request.current ??= crypto.randomUUID();
        const result = await saveQuoteAction(
          data,
          request.current,
          quote?.id,
          quote ? String(quote.draftVersion) : undefined
        );
        if ("error" in result) setError(result.error);
        else {
          router.push("/admin/quotes/" + result.id);
          router.refresh();
        }
      }
    } catch {
      setError(
        "The response was interrupted. Retry the same submission to check whether it was saved."
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  return (
    <section className="workflow-panel quote-editor" aria-label="Quotation editor">
      <h2>{quote ? "Edit draft" : "Create quotation"}</h2>
      <p>
        Save and review your draft, then issue a fixed PDF. Small services can remain standalone.
      </p>
      <form
        ref={form}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        onChange={() => setTotals(null)}
      >
        <fieldset disabled={pending}>
          {quote ? (
            <p>
              Customer: <strong>{quote.customerName}</strong> · Division: {quote.divisionName}
              <br />
              Project: {quote.projectName ?? "Standalone service"}. These associations are fixed;
              create a new quotation to change them.
            </p>
          ) : (
            <>
              <CustomerSelect
                initial={customers}
                label="Customer"
                onChange={(value) => {
                  setCustomer(value);
                  setProject("");
                }}
              />
              <label htmlFor="quote-division">Division</label>
              <select
                id="quote-division"
                className="admin-input"
                value={divisionId}
                required
                onChange={(event) => {
                  setDivision(event.target.value);
                  setProject("");
                  setTaxMode("NONE");
                  setItems((rows) => rows.map((row) => ({ ...row, taxPercent: "0.00" })));
                }}
              >
                {divisions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <label htmlFor="quote-project-search">Find an existing project (optional)</label>
              <input
                id="quote-project-search"
                className="admin-input"
                type="search"
                maxLength={100}
                value={projectSearch}
                onChange={(event) => {
                  setProjectSearch(event.target.value);
                  setProject("");
                }}
              />
              <label htmlFor="quote-project">Project</label>
              <select
                id="quote-project"
                className="admin-input"
                value={projectId}
                disabled={projectPending}
                onChange={(event) => setProject(event.target.value)}
              >
                <option value="">
                  {projectPending ? "Searching..." : "Standalone / no project"}
                </option>
                {projects.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
              <p className="table-subtext">
                Up to 25 matching projects for this customer and division. Acceptance does not
                create a project or record a payment.
              </p>
            </>
          )}
          <label htmlFor="quote-title">Quotation title</label>
          <input
            id="quote-title"
            name="title"
            className="admin-input"
            required
            maxLength={200}
            defaultValue={quote?.title ?? ""}
          />
          <label htmlFor="quote-address">
            Site / delivery address {projectId ? "" : "(optional)"}
          </label>
          <textarea
            id="quote-address"
            name="siteAddress"
            className="admin-input"
            required={Boolean(projectId)}
            maxLength={1000}
            defaultValue={quote?.siteAddress ?? ""}
          />
          <label htmlFor="quote-tax-mode">Tax treatment</label>
          <select
            id="quote-tax-mode"
            className="admin-input"
            value={taxMode}
            onChange={(event) => {
              setTaxMode(event.target.value as TaxMode);
              setItems((rows) => rows.map((row) => ({ ...row, taxPercent: "0.00" })));
            }}
          >
            <option value="NONE">No GST charged</option>
            {division?.settings.gstVerified && (
              <>
                <option value="GST_EXCLUSIVE">GST added to prices</option>
                <option value="GST_INCLUSIVE">Prices include GST</option>
              </>
            )}
          </select>
          {!division?.settings.gstVerified && (
            <p className="table-subtext">
              GST becomes available after the owner verifies this division&apos;s registration and
              rates.
            </p>
          )}
          <h3>Products and services</h3>
          {items.map((item, index) => (
            <fieldset className="quote-line" key={index}>
              <legend>Item {index + 1}</legend>
              <label htmlFor={"catalog-" + index}>Use a catalog description (optional)</label>
              <select
                id={"catalog-" + index}
                className="admin-input"
                value=""
                onChange={(event) => {
                  const service = PROJECT_SERVICE_OPTIONS.find((s) => s.id === event.target.value);
                  if (service) updateItem(index, "description", service.label);
                }}
              >
                <option value="">Choose a service</option>
                {PROJECT_SERVICE_OPTIONS.map((service) => (
                  <option value={service.id} key={service.id}>
                    {service.label}
                  </option>
                ))}
              </select>
              <label htmlFor={"description-" + index}>Description {index + 1}</label>
              <textarea
                id={"description-" + index}
                className="admin-input"
                value={item.description}
                required
                maxLength={2000}
                onChange={(event) => updateItem(index, "description", event.target.value)}
              />
              <div className="quote-line-grid">
                {(
                  [
                    ["quantity", "Quantity", "999999999.999"],
                    ["unit", "Unit", ""],
                    ["rate", "Rate (INR)", "999999999999.99"]
                  ] as const
                ).map(([key, label, max]) => (
                  <div key={key}>
                    <label htmlFor={key + "-" + index}>
                      {label} {index + 1}
                    </label>
                    <input
                      id={key + "-" + index}
                      className="admin-input"
                      required
                      value={item[key]}
                      inputMode={key === "unit" ? "text" : "decimal"}
                      maxLength={key === "unit" ? 30 : key === "quantity" ? 13 : 15}
                      pattern={
                        key === "unit"
                          ? undefined
                          : key === "quantity"
                            ? "[0-9]{1,9}(\\.[0-9]{1,3})?"
                            : "[0-9]{1,12}(\\.[0-9]{1,2})?"
                      }
                      placeholder={max}
                      onChange={(event) => updateItem(index, key, event.target.value)}
                    />
                  </div>
                ))}
              </div>
              {taxMode !== "NONE" && (
                <>
                  <label htmlFor={"tax-" + index}>GST rate {index + 1}</label>
                  <select
                    id={"tax-" + index}
                    className="admin-input"
                    value={item.taxPercent}
                    onChange={(event) => updateItem(index, "taxPercent", event.target.value)}
                  >
                    {division?.settings.gstRates?.map((rate) => (
                      <option key={rate} value={rate}>
                        {rate}%
                      </option>
                    ))}
                  </select>
                </>
              )}
              <button
                type="button"
                className="admin-btn admin-btn-small"
                disabled={items.length === 1}
                onClick={() => {
                  setItems((rows) => rows.filter((_, i) => i !== index));
                  setTotals(null);
                }}
              >
                Remove item {index + 1}
              </button>
            </fieldset>
          ))}
          <button
            type="button"
            className="admin-btn admin-btn-small"
            disabled={items.length >= 100}
            onClick={() => {
              setItems((rows) => [...rows, emptyItem()]);
              setTotals(null);
            }}
          >
            Add item
          </button>
          <label htmlFor="quote-discount">Overall discount (INR)</label>
          <input
            id="quote-discount"
            className="admin-input"
            name="discount"
            required
            inputMode="decimal"
            maxLength={15}
            defaultValue={quote?.discount ?? "0"}
          />
          <label htmlFor="quote-validity">Valid until</label>
          <input
            id="quote-validity"
            className="admin-input"
            name="validUntil"
            type="date"
            required
            defaultValue={quote?.validUntil ?? ""}
          />
          <label htmlFor="quote-terms">Terms and conditions</label>
          <textarea
            id="quote-terms"
            name="terms"
            className="admin-input"
            rows={6}
            required
            maxLength={10000}
            defaultValue={quote?.terms ?? ""}
          />
          {totals && (
            <div role="status" className="quote-totals">
              <p>
                Subtotal: ₹{totals.subtotal} · Discount: ₹{totals.discount} · Tax: ₹{totals.tax}
              </p>
              <strong>Calculated total: ₹{totals.total}</strong>
            </div>
          )}
          <div className="quote-actions">
            <button className="admin-btn" type="submit">
              {pending ? "Saving..." : "Save draft"}
            </button>
            <button
              className="admin-btn admin-btn-small"
              type="button"
              onClick={() => void submit(true)}
            >
              Calculate totals
            </button>
            <Link href={quote ? "/admin/quotes/" + quote.id : "/admin/quotes"}>Cancel</Link>
          </div>
        </fieldset>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
