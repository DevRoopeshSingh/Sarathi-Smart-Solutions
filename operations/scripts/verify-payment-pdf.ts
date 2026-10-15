/** Generate only synthetic QA documents; no database or configured credentials. */
import { mkdir, writeFile } from "node:fs/promises";
import { renderPayment } from "../src/server/documents/payment";
import type { PaymentSnapshot } from "../src/lib/payments";
const directory = "/private/tmp/sarathi-payment-pdf-qa";
await mkdir(directory, { recursive: true });
const sample: PaymentSnapshot = {
  id: "1",
  number: "SAR-RCPT-2-2026-000001",
  kind: "RECEIPT",
  amount: "12345.67",
  business: {
    name: "Sarathi Smart Solutions",
    address: "Bhayander East, Mira-Bhayandar, Thane - 401105",
    phone: "+91 83697 04457",
    email: "sarathismartsolutions@gmail.com"
  },
  customer: {
    name: "Synthetic QA ग्राहक",
    phone: "9999999999",
    address: "Synthetic Bhayandar address"
  },
  project: "Synthetic CCTV installation",
  quotation: "SAR-SMART-2026-000001/R1",
  originalReceipt: null,
  method: "UPI",
  purpose: "ADVANCE",
  reference: "SYNTHETIC-REFERENCE",
  note: "Synthetic QA payment only. No money was received.",
  occurredAt: "2026-10-12T04:30:00Z",
  recordedAt: "2026-10-12T04:35:00Z",
  recordedBy: "Synthetic QA staff"
};
for (const [name, data] of [
  ["receipt", sample],
  [
    "correction",
    {
      ...sample,
      number: "SAR-ADJ-2-2026-000003",
      kind: "REFUND" as const,
      purpose: "REVERSAL",
      method: "CORRECTION",
      originalReceipt: sample.number,
      reference: "SYNTHETIC-CORRECTION",
      note: "Synthetic duplicate entry corrected. No money was transferred."
    }
  ],
  [
    "refund-long",
    {
      ...sample,
      number: "SAR-RFND-2-2026-000002",
      kind: "REFUND" as const,
      purpose: "REFUND",
      originalReceipt: sample.number,
      note: "Synthetic refund reason and installation reference. ".repeat(38),
      reference: "SYNTHETIC-".repeat(19)
    }
  ]
] as const) {
  const pdf = await renderPayment(data);
  await writeFile(directory + "/" + name + ".pdf", pdf);
  console.log(JSON.stringify({ name, bytes: pdf.length }));
}
