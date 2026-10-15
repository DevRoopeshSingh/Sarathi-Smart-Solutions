import "server-only";
import { boundedText, databaseId } from "./input";
import { InputError } from "./mutation-errors";
import { calculateQuotation, type QuoteLineInput, type TaxMode } from "../lib/quotation-money";
export interface QuoteDraftInput {
  customerId: string;
  divisionId: string;
  projectId?: string;
  title: string;
  siteAddress: string;
  discount: string;
  taxMode: TaxMode;
  validUntil: string;
  terms: string;
  items: QuoteLineInput[];
}
export function validDate(raw: unknown): string {
  const value = boundedText(raw, "Validity date", 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value.startsWith("0000") ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    throw new InputError("Enter a valid quotation validity date.");
  return value;
}
export function quoteVersion(value: unknown): number {
  const text = boundedText(value, "Draft version", 10);
  if (!/^[1-9][0-9]{0,9}$/.test(text) || Number(text) > 2147483647)
    throw new InputError("Invalid draft version. Reload the quotation.");
  return Number(text);
}
export function requestId(value: unknown): string {
  const text = boundedText(value, "Submission reference", 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text))
    throw new InputError("Invalid submission reference. Reload the form.");
  return text.toLowerCase();
}
export function validateQuote(input: QuoteDraftInput) {
  if (
    !input ||
    typeof input !== "object" ||
    !Array.isArray(input.items) ||
    input.items.length < 1 ||
    input.items.length > 100
  )
    throw new InputError("Add between 1 and 100 quotation items.");
  const data = {
    customerId: databaseId(input.customerId, "Customer"),
    divisionId: databaseId(input.divisionId, "Division"),
    projectId: input.projectId ? databaseId(input.projectId, "Project") : null,
    title: boundedText(input.title, "Quotation title", 200),
    siteAddress: boundedText(input.siteAddress, "Site / delivery address", 1000, false),
    discount: boundedText(input.discount, "Discount", 15),
    taxMode: input.taxMode,
    validUntil: validDate(input.validUntil),
    terms: boundedText(input.terms, "Terms", 10000),
    items: input.items.map((item, index) => {
      if (!item || typeof item !== "object")
        throw new InputError("Item " + (index + 1) + " is invalid.");
      return {
        description: boundedText(item.description, "Item " + (index + 1) + " description", 2000),
        unit: boundedText(item.unit, "Unit", 30),
        quantity: boundedText(item.quantity, "Quantity", 13),
        rate: boundedText(item.rate, "Rate", 15),
        taxPercent: boundedText(item.taxPercent, "Tax rate", 6)
      };
    })
  };
  if (data.projectId && !data.siteAddress)
    throw new InputError("Enter a site / delivery address for the linked project quotation.");
  try {
    return { ...data, totals: calculateQuotation(data.items, data.discount, data.taxMode) };
  } catch (error) {
    throw new InputError(error instanceof Error ? error.message : "Invalid financial inputs.");
  }
}
export interface DocumentSettings {
  address?: string;
  phone?: string;
  email?: string;
  legalName?: string;
  gstin?: string;
  gstVerified?: boolean;
  gstRates?: string[];
}
export function documentSettings(value: unknown): DocumentSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const data = value as Record<string, unknown>;
  const settings: DocumentSettings = {};
  for (const [key, max] of [
    ["address", 1000],
    ["phone", 50],
    ["email", 254],
    ["legalName", 200],
    ["gstin", 15]
  ] as const) {
    if (data[key] !== undefined)
      settings[key] = boundedText(data[key], "Business " + key, max, false);
  }
  if (data.gstVerified === true) {
    if (
      !settings.gstin ||
      !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(settings.gstin) ||
      !Array.isArray(data.gstRates) ||
      data.gstRates.length < 1 ||
      data.gstRates.length > 20
    )
      throw new InputError("The division tax profile needs owner verification.");
    const rates = data.gstRates.map((rate) => {
      const text = boundedText(rate, "Configured GST rate", 6);
      if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(text) || Number(text) > 100)
        throw new InputError("Invalid configured tax rate.");
      return Number(text).toFixed(2);
    });
    settings.gstVerified = true;
    settings.gstRates = [...new Set(["0.00", ...rates])];
  }
  return settings;
}
export function assertTaxProfile(
  mode: TaxMode,
  items: QuoteLineInput[],
  settings: DocumentSettings
) {
  if (mode === "NONE") return;
  if (!settings.gstVerified)
    throw new InputError(
      "GST is unavailable until this division's registration and rates are verified by the owner."
    );
  if (items.some((item) => !settings.gstRates?.includes(Number(item.taxPercent).toFixed(2))))
    throw new InputError("Choose a tax rate configured for this division.");
}
