import "server-only";
import type { QuoteSnapshot } from "../../lib/quotations";
import { a4Document } from "./a4";
export const QUOTATION_RENDERER_VERSION = "sarathi-quotation-a4-v1";
export async function renderQuotation(snapshot: QuoteSnapshot): Promise<Buffer> {
  const { doc, buffer, wrap, text } = a4Document(snapshot.quotationNumber);
  const left = 42,
    width = 511,
    line = 18,
    bottom = 756;
  let y = 0;
  const page = () => {
    doc.addPage();
    let headerY = 38;
    for (const row of wrap(snapshot.business.name, width, true, 14)) {
      text(row, left, headerY, width, true, 14);
      headerY += 22;
    }
    text("QUOTATION  |  " + snapshot.quotationNumber, left, headerY + 6, width, true, 10);
    y = headerY + 38;
    doc
      .moveTo(left, headerY + 26)
      .lineTo(left + width, headerY + 26)
      .strokeColor("#0d9488")
      .lineWidth(2)
      .stroke();
  };
  const room = (height: number) => {
    if (y + height > bottom) page();
  };
  const block = (value: string, bold = false, size = 10) => {
    for (const row of wrap(value, width, bold, size)) {
      room(line);
      text(row, left, y, width, bold, size);
      y += line;
    }
    y += 5;
  };
  const section = (value: string) => {
    room(42);
    y += 8;
    block(value, true, 11);
  };
  page();
  for (const value of [
    snapshot.business.address,
    [snapshot.business.phone, snapshot.business.email].filter(Boolean).join(" | "),
    snapshot.business.gstin ? "GSTIN: " + snapshot.business.gstin : ""
  ])
    if (value) block(value);
  block(
    "Issued: " +
      snapshot.issuedAt.slice(0, 10) +
      "    Valid until: " +
      snapshot.validUntil +
      "    Revision: " +
      snapshot.version
  );
  section(snapshot.title);
  block("Customer: " + snapshot.customer.name, true);
  block("Phone: " + snapshot.customer.phone);
  for (const value of [snapshot.customer.email, snapshot.customer.address]) if (value) block(value);
  if (snapshot.siteAddress) block("Site / delivery: " + snapshot.siteAddress);
  section("Products and services");
  const xs = [42, 290, 343, 399, 475],
    ws = [240, 47, 49, 70, 78];
  const tableHeader = () => {
    room(28);
    doc.rect(left, y, width, 24).fill("#e9f1f5");
    ["Description", "Qty", "Unit", "Rate INR", "Amount INR"].forEach((value, i) =>
      text(value, xs[i], y + 4, ws[i], true, 8)
    );
    y += 28;
  };
  tableHeader();
  snapshot.items.forEach((item, index) => {
    const description = wrap(String(index + 1) + ". " + item.description, ws[0]);
    const fields = [item.quantity, item.unit, item.rate, item.amount].map((value, i) =>
      wrap(value, ws[i + 1], false, 9)
    );
    let offset = 0;
    const count = Math.max(description.length, ...fields.map((values) => values.length));
    while (offset < count) {
      if (y + line + 8 > bottom) {
        page();
        tableHeader();
      }
      const capacity = Math.max(1, Math.floor((bottom - y - 8) / line));
      const take = Math.min(count - offset, capacity);
      for (let n = 0; n < take; n++) {
        text(description[offset + n] ?? "", xs[0], y + n * line, ws[0]);
        fields.forEach((values, i) =>
          text(values[offset + n] ?? "", xs[i + 1], y + n * line, ws[i + 1], false, 9)
        );
      }
      y += take * line + 8;
      offset += take;
      if (offset < count) {
        page();
        tableHeader();
      }
    }
    if (item.taxPercent !== "0.00" || item.discount !== "0.00") {
      block(
        "Item " +
          (index + 1) +
          " discount INR " +
          item.discount +
          " | Tax " +
          item.taxPercent +
          "%: INR " +
          item.tax +
          " | Total INR " +
          item.total
      );
    }
    doc
      .moveTo(left, y - 3)
      .lineTo(left + width, y - 3)
      .strokeColor("#d8e0e8")
      .lineWidth(0.5)
      .stroke();
  });
  section("Quotation totals");
  block("Subtotal                         ₹" + snapshot.subtotal);
  block("Discount                         ₹" + snapshot.discount);
  if (snapshot.taxMode !== "NONE") {
    block("Taxable value                    ₹" + snapshot.net);
    block(
      (snapshot.taxMode === "GST_INCLUSIVE" ? "GST included" : "GST added") +
        "                     ₹" +
        snapshot.tax
    );
  } else block("Tax treatment: No GST charged");
  block("Grand total (INR)               ₹" + snapshot.total, true, 13);
  section("Terms and conditions");
  block(snapshot.terms);
  block("Valid until " + snapshot.validUntil + " (India time).");
  room(82);
  y += 25;
  doc
    .moveTo(left, y)
    .lineTo(left + 210, y)
    .strokeColor("#182f4d")
    .stroke();
  y += 12;
  text("Authorized signature", left, y, width);
  y += line;
  text("Signature to be provided by authorized staff.", left, y, width, false, 9);
  const pages = doc.bufferedPageRange();
  for (let i = pages.start; i < pages.start + pages.count; i++) {
    doc.switchToPage(i);
    text(
      snapshot.quotationNumber + "  |  Page " + (i + 1) + " of " + pages.count,
      left,
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
