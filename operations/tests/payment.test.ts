import { test } from "node:test";
import assert from "node:assert/strict";
import { ledgerBalance, receiptRemaining, type PaymentInput } from "../src/lib/payments";
import { paymentAmount, paymentTime, validatePayment } from "../src/server/payment-input";
import { hasOrganizationPermission } from "../src/server/tenancy";
const input: PaymentInput = {
  projectId: "1",
  amount: "0.10",
  method: "CASH",
  reference: "",
  note: "",
  purpose: "ADVANCE",
  occurredAt: "2026-01-01T10:15:00+05:30",
  acknowledge: true
};
test("payment money stays exact, positive and bounded", () => {
  assert.equal(paymentAmount("0.1"), "0.10");
  assert.equal(paymentAmount("999999999999.99"), "999999999999.99");
  for (const invalid of ["0", "-1", "0.001", "1e2", "NaN", 1, null, "1000000000000"])
    assert.throws(() => paymentAmount(invalid));
  assert.equal(ledgerBalance("0.30", "0.10", "0.00").outstanding, "0.20");
});
test("balances distinguish outstanding, overpayment and no accepted baseline", () => {
  assert.deepEqual(ledgerBalance("100.00", "130.01", "10.00"), {
    total: "100.00",
    received: "130.01",
    refunded: "10.00",
    reversed: "0.00",
    net: "120.01",
    outstanding: "0.00",
    credit: "20.01"
  });
  assert.equal(ledgerBalance(null, "50.00", "0.00").outstanding, null);
  assert.equal(ledgerBalance(null, "50.00", "0.00").credit, "50.00");
  assert.equal(ledgerBalance("100", "1", "2").outstanding, "101.00");
});
test("aggregate balances exceed the per-entry limit without losing precision", () => {
  const result = ledgerBalance("100.00", "1999999999999.98", "0.00");
  assert.equal(result.net, "1999999999999.98");
  assert.equal(result.credit, "1999999999899.98");
  assert.throws(() => ledgerBalance("100", "1e30", "0"));
});
test("allocation never counts as an additional payment and refunds release capacity", () => {
  assert.deepEqual(receiptRemaining({ amount: "100.01", refunded: "20.00", allocated: "50.00" }), {
    refundable: "80.01",
    unallocated: "30.01"
  });
});
test("receipt and refund validation reject malformed associations, references and acknowledgement", () => {
  assert.equal(validatePayment(input).occurredAt, "2026-01-01T04:45:00.000Z");
  for (const patch of [
    { projectId: "" },
    { acknowledge: false },
    { method: "CRYPTO" },
    { method: "UPI" },
    { amount: "-1" },
    { refundOfId: "1", purpose: "REFUND" },
    { purpose: "REFUND" },
    { projectId: 1 }
  ])
    assert.throws(() => validatePayment({ ...input, ...patch } as PaymentInput));
  assert.equal(
    validatePayment({
      ...input,
      projectId: undefined,
      refundOfId: "1",
      purpose: "REFUND",
      note: "Customer refund completed"
    }).refundOfId,
    "1"
  );
});
test("payment times require explicit timezone, real dates and bounded past/future", () => {
  for (const time of [
    "2026-02-30T12:00:00Z",
    "2026-01-01T10:00",
    "1999-01-01T00:00:00Z",
    "2099-01-01T00:00:00Z"
  ])
    assert.throws(() => paymentTime(time));
  assert.equal(
    paymentTime("2026-01-01T12:00:00Z", Date.parse("2026-01-01T11:59:00Z")),
    "2026-01-01T12:00:00.000Z"
  );
});
test("receipt corrections are explicit, separate from cash refunds and exact in balances", () => {
  const correction = validatePayment({
    ...input,
    projectId: undefined,
    refundOfId: "1",
    purpose: "REVERSAL",
    method: "CORRECTION",
    reference: "Approved correction",
    note: "Duplicate receipt entry recorded"
  });
  assert.equal(correction.purpose, "REVERSAL");
  assert.throws(() =>
    validatePayment({
      ...input,
      projectId: undefined,
      refundOfId: "1",
      purpose: "REVERSAL",
      method: "CASH",
      note: "Incorrect receipt"
    })
  );
  const balance = ledgerBalance("10.00", "12.00", "1.00", "2.00");
  assert.equal(balance.net, "9.00");
  assert.equal(balance.outstanding, "1.00");
  assert.equal(balance.refunded, "1.00");
  assert.equal(balance.reversed, "2.00");
});
test("financial membership grants are explicit and refunds require organization admins", () => {
  assert.equal(hasOrganizationPermission("OPERATOR", "OPERATOR", "payments.create"), false);
  assert.equal(hasOrganizationPermission("OPERATOR", "OPERATOR", "payments.allocate", true), true);
  assert.equal(hasOrganizationPermission("OPERATOR", "OPERATOR", "payments.refund", true), false);
  assert.equal(hasOrganizationPermission("ADMIN", "OPERATOR", "payments.refund", true), false);
  assert.equal(hasOrganizationPermission("VIEWER", "ADMIN", "payments.create", true), false);
  assert.equal(hasOrganizationPermission("ADMIN", "ADMIN", "payments.refund"), true);
});
