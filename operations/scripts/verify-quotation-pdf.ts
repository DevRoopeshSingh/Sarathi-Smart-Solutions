import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { calculateQuotation } from "../src/lib/quotation-money";
import { renderQuotation } from "../src/server/documents/quotation";
import type { QuoteSnapshot } from "../src/lib/quotations";
// Synthetic local QA only. No customer records, authentication or database access.
const directory = process.argv[2];
if (!directory) throw new Error("Supply a scratch output directory.");
await mkdir(directory, { recursive: true });
for (const [name, count] of [
  ["short", 2],
  ["multipage", 18]
] as const) {
  const items = Array.from({ length: count }, (_, i) => ({
    description:
      i === 0
        ? "CCTV installation / सीसीटीवी स्थापना"
        : i === 1 && count > 2
          ? "Long identifier: " + "ABC123".repeat(70)
          : "Network and documentation service " +
            (i + 1) +
            " - supplied and tested at the customer site. ".repeat(count > 2 ? 8 : 1),
    quantity: "2.500",
    unit: "service",
    rate: "1250.25",
    taxPercent: "0.00"
  }));
  const totals = calculateQuotation(items, "25.50", "NONE");
  const snapshot: QuoteSnapshot = {
    schemaVersion: 1,
    quotationNumber: "SAR-SMART-2026-000001/R1",
    version: 1,
    issuedAt: "2026-10-10",
    validUntil: "2026-11-10",
    title: "Sample quotation for local QA",
    currency: "INR",
    business: {
      name: "Sarathi Smart Solutions",
      address: "Bhayander East, Mira-Bhayandar, Thane - 401105",
      phone: "+91 83697 04457",
      email: "sarathismartsolutions@gmail.com"
    },
    customer: { name: "QA customer / ग्राहक", phone: "9999999999", email: null, address: null },
    siteAddress: "",
    taxMode: "NONE",
    items: totals.items,
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    net: totals.net,
    total: totals.total,
    terms:
      count > 2
        ? "Scope and delivery as described above. Warranty only where stated. ".repeat(30)
        : "Delivery to be agreed with the customer. No payment is recorded by this quotation."
  };
  const pdf = await renderQuotation(snapshot);
  const path = join(resolve(directory), "sarathi-quotation-" + name + ".pdf");
  await writeFile(path, pdf);
  console.log(JSON.stringify({ path, bytes: pdf.length, total: totals.total }));
}
