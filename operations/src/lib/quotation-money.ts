import { calculateCommercials } from "./commercial.mjs";
export type TaxMode = "NONE" | "GST_EXCLUSIVE" | "GST_INCLUSIVE";
export interface QuoteLineInput {
  description: string;
  quantity: string;
  unit: string;
  rate: string;
  taxPercent: string;
}
export interface QuoteLine extends QuoteLineInput {
  amount: string;
  discount: string;
  net: string;
  tax: string;
  total: string;
}
export interface QuoteTotals {
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
  net: string;
  items: QuoteLine[];
}
export const minor = (value: string): bigint => {
  if (typeof value !== "string" || !/^[0-9]{1,12}(?:\.[0-9]{1,2})?$/.test(value))
    throw new Error("Enter money as a nonnegative decimal with up to two decimal places.");
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole + fraction.padEnd(2, "0"));
};
export const fixed = (value: bigint) =>
  String(value / 100n) + "." + (value % 100n).toString().padStart(2, "0");
export const round = (numerator: bigint, denominator: bigint) =>
  (numerator + denominator / 2n) / denominator;
export function calculateQuotation(
  items: QuoteLineInput[],
  discount: string,
  mode: TaxMode
): QuoteTotals {
  if (!Array.isArray(items) || items.length < 1 || items.length > 100)
    throw new Error("Add between 1 and 100 quotation items.");
  if (!["NONE", "GST_EXCLUSIVE", "GST_INCLUSIVE"].includes(mode))
    throw new Error("Select a supported tax treatment.");
  const amounts = items.map((item) =>
    minor(
      calculateCommercials({
        bomItems: [],
        quotationItems: [{ quantity: item.quantity, rate: item.rate }],
        targetAdvancePercent: "0"
      }).quotationSubtotal
    )
  );
  const subtotal = amounts.reduce((a, b) => a + b, 0n);
  const reduction = minor(discount);
  if (subtotal > 99999999999999n || reduction > subtotal)
    throw new Error("Discount cannot exceed subtotal; amounts must fit the supported money limit.");
  const shares = amounts.map((amount) => (subtotal === 0n ? 0n : (reduction * amount) / subtotal));
  const order = amounts
    .map((amount, index) => ({
      index,
      remainder: subtotal === 0n ? 0n : (reduction * amount) % subtotal
    }))
    .sort((a, b) =>
      a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1
    );
  let left = reduction - shares.reduce((a, b) => a + b, 0n);
  for (const entry of order) {
    if (left === 0n) break;
    shares[entry.index]++;
    left--;
  }
  const lines = items.map((item, index) => {
    if (typeof item.taxPercent !== "string" || !/^\d{1,3}(?:\.\d{1,2})?$/.test(item.taxPercent))
      throw new Error("Enter a valid tax percentage.");
    const percent = minor(item.taxPercent);
    if (percent > 10000n || (mode === "NONE" && percent !== 0n))
      throw new Error("Tax rates must match the selected treatment.");
    const base = amounts[index] - shares[index];
    const tax =
      mode === "GST_INCLUSIVE"
        ? base - round(base * 10000n, 10000n + percent)
        : round(base * percent, 10000n);
    const net = mode === "GST_INCLUSIVE" ? base - tax : base;
    const total = net + tax;
    if (total > 99999999999999n) throw new Error("Line amount exceeds the supported money limit.");
    return {
      ...item,
      rate: fixed(minor(item.rate)),
      taxPercent: fixed(percent),
      amount: fixed(amounts[index]),
      discount: fixed(shares[index]),
      net: fixed(net),
      tax: fixed(tax),
      total: fixed(total)
    };
  });
  const sum = (field: "net" | "tax" | "total") =>
    lines.reduce((a, item) => a + minor(item[field]), 0n);
  const total = sum("total");
  if (total > 99999999999999n) throw new Error("Grand total exceeds the supported money limit.");
  return {
    subtotal: fixed(subtotal),
    discount: fixed(reduction),
    tax: fixed(sum("tax")),
    net: fixed(sum("net")),
    total: fixed(total),
    items: lines
  };
}
export const quoteStatusLabel = (status: string, expired = false) =>
  expired && status === "SENT"
    ? "Expired"
    : (({ SENT: "Issued", APPROVED: "Accepted", DECLINED: "Rejected" } as Record<string, string>)[
        status
      ] ?? status.charAt(0) + status.slice(1).toLowerCase());
