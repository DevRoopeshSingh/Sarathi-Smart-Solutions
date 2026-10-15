import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calculateQuotation, type QuoteLineInput } from "../src/lib/quotation-money";
import {
  validDate,
  validateQuote,
  documentSettings,
  assertTaxProfile,
  requestId
} from "../src/server/quotation-input";
const item = (rate = "100", quantity = "1", taxPercent = "0"): QuoteLineInput => ({
  description: "Service",
  unit: "service",
  rate,
  quantity,
  taxPercent
});
test("commercial engine deployment copy matches the existing money engine", () =>
  assert.equal(
    readFileSync(new URL("../src/lib/commercial.mjs", import.meta.url), "utf8"),
    readFileSync(new URL("../../server/domain/commercial.mjs", import.meta.url), "utf8")
  ));
test("line quantities round to paise before adding", () =>
  assert.equal(
    calculateQuotation([item("0.05", "0.5"), item("0.05", "0.5")], "0", "NONE").total,
    "0.06"
  ));
test("discount allocation uses stable largest remainders", () => {
  const result = calculateQuotation([item("0.01"), item("0.01"), item("0.01")], "0.02", "NONE");
  assert.deepEqual(
    result.items.map((row) => row.discount),
    ["0.01", "0.01", "0.00"]
  );
  assert.equal(result.total, "0.01");
});
test("exclusive GST is calculated after allocated discount", () => {
  const r = calculateQuotation(
    [item("100", "2", "18"), item("50", "1", "5")],
    "25",
    "GST_EXCLUSIVE"
  );
  assert.deepEqual(
    [r.subtotal, r.discount, r.tax, r.total],
    ["250.00", "25.00", "34.65", "259.65"]
  );
});
test("inclusive GST keeps the final price fixed and extracts rounded tax", () => {
  const r = calculateQuotation([item("118", "1", "18")], "0", "GST_INCLUSIVE");
  assert.deepEqual([r.net, r.tax, r.total], ["100.00", "18.00", "118.00"]);
});
test("zero price and a full discount remain exact", () => {
  assert.equal(calculateQuotation([item("0")], "0", "NONE").total, "0.00");
  assert.equal(calculateQuotation([item("100", "1", "18")], "100", "GST_EXCLUSIVE").tax, "0.00");
});
test("tax rounding handles half-paise correctly", () =>
  assert.equal(calculateQuotation([item("0.05", "1", "10")], "0", "GST_EXCLUSIVE").tax, "0.01"));
test("negative, scientific, fractional overflow and malformed prices fail", () => {
  for (const value of ["-1", "1e3", "1.999", "NaN", "", "1,000", "1000000000000"])
    assert.throws(() => calculateQuotation([item(value)], "0", "NONE"));
});
test("zero, negative and overprecision quantities fail", () => {
  for (const value of ["0", "-1", "1e2", "1.0001", "1000000000"])
    assert.throws(() => calculateQuotation([item("1", value)], "0", "NONE"));
});
test("aggregate and tax overflow fail instead of truncating", () => {
  assert.throws(() => calculateQuotation([item("999999999999.99"), item("0.01")], "0", "NONE"));
  assert.throws(() =>
    calculateQuotation([item("999999999999.99", "1", "18")], "0", "GST_EXCLUSIVE")
  );
});
test("discount over subtotal and incompatible taxes fail", () => {
  assert.throws(() => calculateQuotation([item()], "101", "NONE"));
  assert.throws(() => calculateQuotation([item("100", "1", "18")], "0", "NONE"));
  assert.throws(() => calculateQuotation([item("100", "1", "101")], "0", "GST_EXCLUSIVE"));
});
test("validity dates require real calendar days", () => {
  assert.equal(validDate("2028-02-29"), "2028-02-29");
  for (const date of ["2026-02-29", "2026-04-31", "0000-01-01", "2026-1-1", "2026-10-10junk"])
    assert.throws(() => validDate(date));
});
test("server recalculates totals and permits blank optional location", () => {
  const input = {
    customerId: "1",
    divisionId: "2",
    title: " Service ",
    siteAddress: "",
    discount: "0",
    taxMode: "NONE" as const,
    validUntil: "2027-01-01",
    terms: "As discussed",
    items: [item("10")],
    total: "1"
  };
  const r = validateQuote(input);
  assert.equal(r.title, "Service");
  assert.equal(r.totals.total, "10.00");
  assert.equal(r.siteAddress, "");
});
test("verified configured rates are required; no assumed GST registration", () => {
  assert.throws(() => assertTaxProfile("GST_EXCLUSIVE", [item("100", "1", "18")], {}));
  const settings = documentSettings({
    gstVerified: true,
    gstin: "27ABCDE1234F1Z5",
    gstRates: ["18"]
  });
  assertTaxProfile("GST_EXCLUSIVE", [item("100", "1", "18")], settings);
  assert.throws(() => assertTaxProfile("GST_EXCLUSIVE", [item("100", "1", "5")], settings));
  assert.throws(() => documentSettings({ gstVerified: true, gstin: "", gstRates: ["18"] }));
});
test("UUID references and bounded line counts fail closed", () => {
  assert.throws(() => requestId("guess"));
  assert.throws(() => calculateQuotation([], "0", "NONE"));
  assert.throws(() =>
    calculateQuotation(
      Array.from({ length: 101 }, () => item()),
      "0",
      "NONE"
    )
  );
});
