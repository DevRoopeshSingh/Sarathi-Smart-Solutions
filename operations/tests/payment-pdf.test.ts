import { test } from "node:test";
import assert from "node:assert/strict";
import { renderPayment } from "../src/server/documents/payment";
import type { PaymentSnapshot } from "../src/lib/payments";
export const sample: PaymentSnapshot = {
  id: "1",
  number: "SAR-RCPT-2-2026-000001",
  kind: "RECEIPT",
  amount: "100.01",
  business: {
    name: "Sarathi Smart Solutions",
    address: "Bhayander East",
    phone: "+91 83697 04457",
    email: "sarathismartsolutions@gmail.com"
  },
  customer: { name: "QA ग्राहक", phone: "9999999999", address: "Mira-Bhayandar" },
  project: "QA CCTV project",
  quotation: "SAR-SMART-2026-000001",
  originalReceipt: null,
  method: "UPI",
  purpose: "ADVANCE",
  reference: "SYNTHETIC-REFERENCE",
  note: "Synthetic QA payment only.",
  occurredAt: "2026-10-12T04:30:00Z",
  recordedAt: "2026-10-12T04:35:00Z",
  recordedBy: "QA staff"
};
test("A4 receipt and refund PDFs embed rupee/Hindi fonts and fit short records on one page", async () => {
  for (const snapshot of [
    sample,
    {
      ...sample,
      kind: "REFUND" as const,
      number: "SAR-RFND-2-2026-000002",
      purpose: "REFUND",
      originalReceipt: sample.number
    },
    {
      ...sample,
      kind: "REFUND" as const,
      number: "SAR-ADJ-2-2026-000003",
      purpose: "REVERSAL",
      method: "CORRECTION",
      originalReceipt: sample.number
    }
  ]) {
    const pdf = await renderPayment(snapshot),
      source = pdf.toString("latin1");
    assert.ok(pdf.subarray(0, 5).equals(Buffer.from("%PDF-")));
    assert.equal((source.match(/\/Type \/Page\b/g) ?? []).length, 1);
    assert.match(source, /\/MediaBox \[0 0 595.28 841.89\]/);
    assert.match(source, /\/Subtype \/Type0/);
  }
});
test("receipt long notes paginate and unsupported glyphs fail rather than becoming boxes", async () => {
  const pdf = await renderPayment({ ...sample, note: "Customer reference ".repeat(300) });
  assert.ok((pdf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length > 2);
  await assert.rejects(renderPayment({ ...sample, note: "😀" }), /cannot be printed/);
});
