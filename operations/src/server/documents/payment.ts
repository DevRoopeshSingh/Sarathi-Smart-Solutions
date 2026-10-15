import "server-only";
import type { PaymentSnapshot } from "../../lib/payments";
import { a4Document } from "./a4";
export const PAYMENT_RENDERER_VERSION = "sarathi-payment-a4-v1";
export async function renderPayment(snapshot: PaymentSnapshot): Promise<Buffer> {
  const { doc, buffer, wrap, text } = a4Document(snapshot.number);
  const correction = snapshot.purpose === "REVERSAL";
  let y = 42;
  const width = 511;
  const page = () => {
    doc.addPage();
    y = 42;
    text(
      correction
        ? "RECEIPT CORRECTION"
        : snapshot.kind === "REFUND"
          ? "REFUND ACKNOWLEDGEMENT"
          : "PAYMENT RECEIPT",
      42,
      y,
      width,
      true,
      14
    );
    y += 30;
    text(snapshot.number, 42, y, width, true);
    y += 30;
  };
  const block = (value: string, bold = false, size = 10) => {
    for (const row of wrap(value, width, bold, size)) {
      if (y + 20 > 748) page();
      text(row, 42, y, width, bold, size);
      y += 19;
    }
    y += 6;
  };
  page();
  block(snapshot.business.name, true, 13);
  for (const value of [
    snapshot.business.address,
    [snapshot.business.phone, snapshot.business.email].filter(Boolean).join(" | ")
  ])
    if (value) block(value);
  block("Customer: " + snapshot.customer.name, true);
  block("Phone: " + snapshot.customer.phone);
  if (snapshot.customer.address) block(snapshot.customer.address);
  if (snapshot.project) block("Project: " + snapshot.project);
  if (snapshot.quotation) block("Quotation: " + snapshot.quotation);
  if (snapshot.originalReceipt) block("Original receipt: " + snapshot.originalReceipt);
  block(
    (correction
      ? "Receipt amount reversed: ₹"
      : snapshot.kind === "REFUND"
        ? "Amount refunded: ₹"
        : "Amount received: ₹") +
      snapshot.amount +
      " INR",
    true,
    14
  );
  block("Method: " + snapshot.method.replaceAll("_", " ") + " | Purpose: " + snapshot.purpose);
  if (snapshot.reference) block("Transaction reference: " + snapshot.reference);
  const date = (value: string) =>
    new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Kolkata"
    }).format(new Date(value));
  block("Payment time: " + date(snapshot.occurredAt) + " IST");
  block("Recorded: " + date(snapshot.recordedAt) + " IST by " + snapshot.recordedBy);
  if (snapshot.note) block("Staff note: " + snapshot.note);
  block(
    correction
      ? "This corrects an incorrect receipt entry for bookkeeping. It does not record a cash refund or transfer money. The original receipt and this correction remain in the ledger. This is not a tax invoice."
      : "This acknowledges a payment or refund already recorded by staff. It does not transfer money, authenticate a customer, confirm project completion, or act as a tax invoice."
  );
  block(
    "Allocations and current balances may change after this receipt; consult the authorized ledger."
  );
  if (y + 85 > 748) page();
  y += 30;
  doc.moveTo(42, y).lineTo(252, y).strokeColor("#182f4d").stroke();
  y += 12;
  block("Authorized staff signature (to be provided)");
  const pages = doc.bufferedPageRange();
  for (let i = pages.start; i < pages.start + pages.count; i++) {
    doc.switchToPage(i);
    text(
      snapshot.number + " | Page " + (i + 1) + " of " + pages.count,
      42,
      778,
      width,
      false,
      8,
      "#51647b"
    );
  }
  doc.end();
  return buffer;
}
