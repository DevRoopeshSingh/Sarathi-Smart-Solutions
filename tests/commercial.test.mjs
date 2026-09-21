import test from "node:test";
import assert from "node:assert/strict";
import { calculateCommercials, calculatePaymentPosition } from "../server/domain/commercial.mjs";

const draft = (overrides = {}) => ({ bomItems: [], quotationItems: [], ...overrides });
const quote = (rate, overrides = {}) =>
  draft({
    quotationItems: [{ quantity: "1", rate }],
    ...overrides
  });
const ledger = (payments = [], overrides = {}) => ({
  quoteTotal: "100",
  recommendedAdvance: "50",
  payments,
  ...overrides
});

test("commercial calculation reconciles a complete worked quotation", () => {
  const input = {
    bomItems: [
      { quantity: "2", unitCost: "1000" },
      { quantity: "1", unitCost: "500" }
    ],
    quotationItems: [
      { quantity: "2", rate: "1600" },
      { quantity: "1", rate: "800" }
    ],
    contingencyPercent: "10",
    supplierDelivery: "100",
    technicianLabour: "400",
    transport: "50",
    otherDirectCost: "25",
    warrantyCallbackProvision: "75",
    serviceCharges: "500",
    discount: "100",
    taxAmount: "792"
  };
  const original = structuredClone(input);
  assert.deepEqual(calculateCommercials(input), {
    currency: "INR",
    materialCost: "2500.00",
    materialContingency: "250.00",
    materialFundingRequirement: "2850.00",
    estimatedProjectCost: "3400.00",
    quotationSubtotal: "4000.00",
    netRevenue: "4400.00",
    quoteTotal: "5192.00",
    estimatedProfit: "1000.00",
    percentageAdvance: "2596.00",
    uncappedAdvance: "2850.00",
    recommendedAdvance: "2850.00",
    fundingShortfall: "0.00",
    plannedBalance: "2342.00",
    profitMarginPercent: "22.73",
    requiresFundingReview: false
  });
  assert.deepEqual(input, original);
});

test("fractional quantities round each BOM and quotation line half-up before summing", () => {
  const result = calculateCommercials(
    draft({
      bomItems: [
        { quantity: "0.5", unitCost: "0.01" },
        { quantity: "0.5", unitCost: "0.01" }
      ],
      quotationItems: [
        { quantity: "0.5", rate: "0.01" },
        { quantity: "0.5", rate: "0.01" }
      ]
    })
  );
  assert.equal(result.materialCost, "0.02");
  assert.equal(result.quotationSubtotal, "0.02");
  assert.equal(
    calculateCommercials(
      quote("1.23", {
        quotationItems: [{ quantity: "0.004", rate: "1.23" }]
      })
    ).quoteTotal,
    "0.00"
  );
});

test("decimal arithmetic stays exact and percentages round at half a paise", () => {
  const result = calculateCommercials(
    draft({
      bomItems: [{ quantity: "1", unitCost: "0.10" }],
      contingencyPercent: "5",
      quotationItems: [
        { quantity: "1", rate: "0.10" },
        { quantity: "1", rate: "0.20" }
      ],
      targetAdvancePercent: "55"
    })
  );
  assert.equal(result.materialContingency, "0.01");
  assert.equal(result.quoteTotal, "0.30");
  assert.equal(result.percentageAdvance, "0.17");
  assert.equal(result.plannedBalance, "0.13");
});

test("discount applies to goods plus service and tax is excluded from profit", () => {
  const beforeTax = calculateCommercials(quote("100", { serviceCharges: "20", discount: "30" }));
  const afterTax = calculateCommercials(
    quote("100", {
      serviceCharges: "20",
      discount: "30",
      taxAmount: "18"
    })
  );
  assert.equal(afterTax.netRevenue, "90.00");
  assert.equal(afterTax.quoteTotal, "108.00");
  assert.equal(afterTax.estimatedProfit, beforeTax.estimatedProfit);
  assert.equal(afterTax.profitMarginPercent, beforeTax.profitMarginPercent);
  assert.equal(calculateCommercials(quote("100", { discount: "100" })).netRevenue, "0.00");
  assert.throws(() => calculateCommercials(quote("100", { discount: "100.01" })), /discount/);
});

test("loss-making quotes expose negative profit and margin with signed half-away rounding", () => {
  const result = calculateCommercials(quote("32", { technicianLabour: "32.01" }));
  assert.equal(result.estimatedProfit, "-0.01");
  assert.equal(result.profitMarginPercent, "-0.03");
  const tie = calculateCommercials(quote("32", { technicianLabour: "32.04" }));
  assert.equal(tie.profitMarginPercent, "-0.13");
  const positiveTie = calculateCommercials(quote("32", { technicianLabour: "31.96" }));
  assert.equal(positiveTie.profitMarginPercent, "0.13");
});

test("zero revenue has a null margin even when costs or tax exist", () => {
  const result = calculateCommercials(draft({ technicianLabour: "10", taxAmount: "5" }));
  assert.equal(result.estimatedProfit, "-10.00");
  assert.equal(result.profitMarginPercent, null);
  assert.equal(result.quoteTotal, "5.00");
  assert.equal(calculateCommercials(draft()).recommendedAdvance, "0.00");
});

test("advance is capped at the gross quote while shortfalls trigger funding review", () => {
  const result = calculateCommercials(
    quote("100", {
      bomItems: [{ quantity: "1", unitCost: "120" }],
      supplierDelivery: "5"
    })
  );
  assert.equal(result.uncappedAdvance, "125.00");
  assert.equal(result.recommendedAdvance, "100.00");
  assert.equal(result.fundingShortfall, "25.00");
  assert.equal(result.plannedBalance, "0.00");
  assert.equal(result.requiresFundingReview, true);
  const noRevenue = calculateCommercials(draft({ bomItems: [{ quantity: "1", unitCost: "1" }] }));
  assert.equal(noRevenue.fundingShortfall, "1.00");
});

test("undefined optional values use defaults and percentage boundaries are inclusive", () => {
  const result = calculateCommercials(
    quote("10", { serviceCharges: undefined, targetAdvancePercent: undefined })
  );
  assert.equal(result.recommendedAdvance, "5.00");
  assert.equal(
    calculateCommercials(quote("10", { targetAdvancePercent: "0" })).recommendedAdvance,
    "0.00"
  );
  assert.equal(
    calculateCommercials(quote("10", { targetAdvancePercent: "100" })).recommendedAdvance,
    "10.00"
  );
});

test("malformed decimal money values are rejected instead of coerced", () => {
  for (const value of [
    0,
    1,
    NaN,
    Infinity,
    null,
    "",
    " ",
    " 1",
    "1 ",
    "1\n",
    "-1",
    "+1",
    "1e2",
    ".1",
    "1.",
    "1.001",
    "NaN",
    "Infinity",
    "1000000000000",
    {},
    [],
    true,
    1n
  ]) {
    assert.throws(() => calculateCommercials(quote(value)), { name: "TypeError" });
    assert.throws(() => calculateCommercials(draft({ transport: value })), { name: "TypeError" });
  }
});

test("invalid quantities and percentages are rejected", () => {
  for (const quantity of [
    undefined,
    null,
    1,
    "0",
    "0.000",
    "-1",
    "1.0001",
    "1000000000",
    "1e2",
    " 1"
  ]) {
    assert.throws(() => calculateCommercials(draft({ bomItems: [{ quantity, unitCost: "1" }] })));
  }
  for (const value of [null, 1, "-1", "100.01", "101", "0.001", "1e2", "1 "]) {
    for (const key of ["contingencyPercent", "targetAdvancePercent"]) {
      assert.throws(() => calculateCommercials(draft({ [key]: value })));
    }
  }
  assert.equal(
    calculateCommercials(draft({ bomItems: [{ quantity: "999999999.999", unitCost: "0.01" }] }))
      .materialCost,
    "10000000.00"
  );
});

test("all optional money fields reject explicit null", () => {
  for (const field of [
    "supplierDelivery",
    "technicianLabour",
    "transport",
    "otherDirectCost",
    "warrantyCallbackProvision",
    "serviceCharges",
    "discount",
    "taxAmount"
  ]) {
    assert.throws(() => calculateCommercials(draft({ [field]: null })), new RegExp(field));
  }
});

test("required records, arrays and line fields are validated including sparse arrays", () => {
  for (const value of [undefined, null, [], 1, "input", new Date()]) {
    assert.throws(() => calculateCommercials(value));
    assert.throws(() => calculatePaymentPosition(value));
  }
  for (const field of ["bomItems", "quotationItems"]) {
    for (const value of [undefined, null, {}, "items", [null], [[]], [{}], new Array(1)]) {
      assert.throws(() => calculateCommercials(draft({ [field]: value })));
    }
  }
});

test("maximum monetary value is supported and derived overflow is rejected", () => {
  const max = "999999999999.99";
  assert.equal(calculateCommercials(quote(max)).quoteTotal, max);
  for (const input of [
    quote(max, { taxAmount: "0.01" }),
    quote(max, { serviceCharges: "0.01", discount: "0.01" }),
    quote(max, { quotationItems: [{ quantity: "2", rate: max }] }),
    draft({ bomItems: [{ quantity: "1", unitCost: max }], supplierDelivery: "0.01" }),
    draft({ bomItems: [{ quantity: "1", unitCost: max }], contingencyPercent: "0.01" }),
    draft({ technicianLabour: max, warrantyCallbackProvision: "0.01" }),
    draft({
      quotationItems: [
        { quantity: "1", rate: max },
        { quantity: "1", rate: "0.01" }
      ]
    })
  ])
    assert.throws(() => calculateCommercials(input), /money limit/);
});

test("empty payment ledger and partial receipts report separate balance and advance due", () => {
  assert.deepEqual(calculatePaymentPosition(ledger()), {
    receivedTotal: "0.00",
    refundedTotal: "0.00",
    netReceived: "0.00",
    outstandingBalance: "100.00",
    overpayment: "0.00",
    advanceOutstanding: "50.00"
  });
  assert.deepEqual(calculatePaymentPosition(ledger([{ kind: "RECEIPT", amount: "25" }])), {
    receivedTotal: "25.00",
    refundedTotal: "0.00",
    netReceived: "25.00",
    outstandingBalance: "75.00",
    overpayment: "0.00",
    advanceOutstanding: "25.00"
  });
});

test("refund reconciliation is order independent and uses exact aggregate receipts", () => {
  const payments = [
    { kind: "REFUND", amount: "5.10" },
    { kind: "RECEIPT", amount: "30.10" },
    { kind: "RECEIPT", amount: "10.20" }
  ];
  const result = calculatePaymentPosition(ledger(payments));
  assert.deepEqual(result, calculatePaymentPosition(ledger([...payments].reverse())));
  assert.equal(result.netReceived, "35.20");
  assert.equal(result.outstandingBalance, "64.80");
  assert.equal(result.advanceOutstanding, "14.80");
  assert.throws(
    () => calculatePaymentPosition(ledger([{ kind: "REFUND", amount: "1" }])),
    /refunds exceed/
  );
});

test("overpayment is reported separately and a full refund restores outstanding amounts", () => {
  const received = { kind: "RECEIPT", amount: "120" };
  assert.deepEqual(calculatePaymentPosition(ledger([received])), {
    receivedTotal: "120.00",
    refundedTotal: "0.00",
    netReceived: "120.00",
    outstandingBalance: "0.00",
    overpayment: "20.00",
    advanceOutstanding: "0.00"
  });
  assert.equal(
    calculatePaymentPosition(ledger([received, { kind: "REFUND", amount: "120" }]))
      .outstandingBalance,
    "100.00"
  );
  assert.equal(
    calculatePaymentPosition(ledger([received], { quoteTotal: "0", recommendedAdvance: "0" }))
      .overpayment,
    "120.00"
  );
});

test("payment inputs reject invalid kinds, amounts, shapes and advance greater than quote", () => {
  for (const payments of [
    undefined,
    null,
    {},
    [null],
    [[]],
    [{}],
    new Array(1),
    [{ kind: "receipt", amount: "1" }]
  ]) {
    assert.throws(() => calculatePaymentPosition({ ...ledger(), payments }));
  }
  for (const amount of [
    undefined,
    null,
    1,
    "0",
    "0.00",
    "-1",
    "+1",
    "1.001",
    "1e2",
    "1\n",
    "1000000000000"
  ]) {
    assert.throws(() => calculatePaymentPosition(ledger([{ kind: "RECEIPT", amount }])));
  }
  assert.throws(
    () => calculatePaymentPosition(ledger([], { recommendedAdvance: "100.01" })),
    /exceeds quoteTotal/
  );
  assert.throws(() => calculatePaymentPosition(ledger([], { quoteTotal: 100 })));
  assert.throws(() => calculatePaymentPosition(ledger([], { recommendedAdvance: null })));
});

test("payment totals cannot overflow even when refunds would cancel receipts", () => {
  assert.throws(
    () =>
      calculatePaymentPosition(
        ledger([
          { kind: "RECEIPT", amount: "999999999999.99" },
          { kind: "REFUND", amount: "999999999999.99" },
          { kind: "RECEIPT", amount: "0.01" }
        ])
      ),
    /receivedTotal.*money limit/
  );
  assert.throws(
    () =>
      calculatePaymentPosition(
        ledger([
          { kind: "REFUND", amount: "999999999999.99" },
          { kind: "REFUND", amount: "0.01" }
        ])
      ),
    /refundedTotal.*money limit/
  );
});
