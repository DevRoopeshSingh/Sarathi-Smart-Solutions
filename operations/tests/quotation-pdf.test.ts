import { test } from "node:test";
import assert from "node:assert/strict";
import { renderQuotation } from "../src/server/documents/quotation";
import { calculateQuotation } from "../src/lib/quotation-money";
import type { QuoteSnapshot } from "../src/lib/quotations";
const totals = calculateQuotation(
  [
    {
      description: "Installation / स्थापना",
      quantity: "1",
      rate: "100.01",
      unit: "service",
      taxPercent: "0"
    }
  ],
  "0",
  "NONE"
);
const snapshot: QuoteSnapshot = {
  schemaVersion: 1,
  quotationNumber: "SAR-SMART-2026-000001/R1",
  version: 1,
  issuedAt: "2026-10-10",
  validUntil: "2026-11-10",
  title: "QA quotation",
  currency: "INR",
  business: { name: "Sarathi Smart Solutions" },
  customer: { name: "QA ग्राहक", phone: "9999999999", email: null, address: null },
  siteAddress: "",
  taxMode: "NONE",
  terms: "Delivery by agreement.",
  ...totals
};
test("short A4 PDFs embed fonts and keep footers on the same page", async () => {
  const pdf = await renderQuotation(snapshot);
  const source = pdf.toString("latin1");
  assert.ok(pdf.subarray(0, 5).equals(Buffer.from("%PDF-")));
  assert.equal((source.match(/\/Type \/Page\b/g) ?? []).length, 1);
  assert.match(source, /\/MediaBox \[0 0 595.28 841.89\]/);
  assert.match(source, /\/Subtype \/Type0/);
});
test("long descriptions and terms produce bounded multiple-page PDFs", async () => {
  const pdf = await renderQuotation({
    ...snapshot,
    items: [{ ...totals.items[0], description: "CCTV-".repeat(400) }],
    terms: "Verified scope and delivery. ".repeat(300)
  });
  assert.ok((pdf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length > 2);
  assert.ok(pdf.length < 10 * 1024 * 1024);
});
test("unsupported glyphs fail visibly instead of printing replacement boxes", async () => {
  await assert.rejects(
    renderQuotation({ ...snapshot, customer: { ...snapshot.customer, name: "Customer 😀" } }),
    /character.*cannot be printed/
  );
});
