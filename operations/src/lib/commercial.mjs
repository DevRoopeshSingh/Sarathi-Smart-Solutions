/**
 * Pure commercial calculations intended for the future private server application.
 * All decimals cross this boundary as strings; money uses INR with two decimals.
 * No tax policy is inferred: the caller supplies the final tax amount, which is
 * excluded from revenue and profit. No input is mutated or persisted.
 */

const MAX_MONEY = 99999999999999n;
const MONEY_PATTERN = /^[0-9]{1,12}(?:\.[0-9]{1,2})?$/;
const QUANTITY_PATTERN = /^[0-9]{1,9}(?:\.[0-9]{1,3})?$/;
const PERCENT_PATTERN = /^[0-9]{1,3}(?:\.[0-9]{1,2})?$/;

function record(value, field) {
  if (
    value === null ||
    typeof value !== "object" ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  ) {
    throw new TypeError(`${field} must be a plain object`);
  }
}

function decimal(value, field, pattern, precision) {
  if (typeof value !== "string" || value.trim() !== value || !pattern.test(value)) {
    throw new TypeError(`${field} must be a nonnegative decimal string with valid precision`);
  }
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole + fraction.padEnd(precision, "0"));
}

function money(value, field) {
  return decimal(value, field, MONEY_PATTERN, 2);
}

function optionalMoney(value, field) {
  return money(value === undefined ? "0" : value, field);
}

function percent(value, field, fallback = "0") {
  const parsed = decimal(value === undefined ? fallback : value, field, PERCENT_PATTERN, 2);
  if (parsed > 10000n) throw new RangeError(`${field} must be between 0 and 100`);
  return parsed;
}

function bounded(value, field) {
  if (value > MAX_MONEY || value < -MAX_MONEY) {
    throw new RangeError(`${field} exceeds the money limit of 999999999999.99`);
  }
  return value;
}

function sum(values, field) {
  return bounded(
    values.reduce((total, value) => total + value, 0n),
    field
  );
}

// Half-up for positive amounts; ties on signed margins round away from zero.
function roundedDivide(numerator, denominator) {
  const absolute = numerator < 0n ? -numerator : numerator;
  const result = (absolute + denominator / 2n) / denominator;
  return numerator < 0n ? -result : result;
}

function fixed(value) {
  const absolute = value < 0n ? -value : value;
  return `${value < 0n ? "-" : ""}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
}

function linesTotal(items, rateField, field) {
  if (!Array.isArray(items)) throw new TypeError(`${field} must be an array`);
  const amounts = [];
  for (const [index, item] of items.entries()) {
    const prefix = `${field}[${index}]`;
    record(item, prefix);
    const quantity = decimal(item.quantity, `${prefix}.quantity`, QUANTITY_PATTERN, 3);
    if (quantity === 0n) throw new RangeError(`${prefix}.quantity must be positive`);
    const rate = money(item[rateField], `${prefix}.${rateField}`);
    amounts.push(bounded(roundedDivide(quantity * rate, 1000n), prefix));
  }
  return sum(amounts, field);
}

function formatAmounts(amounts) {
  return Object.fromEntries(
    Object.entries(amounts).map(([field, value]) => [field, fixed(bounded(value, field))])
  );
}

/**
 * Calculate costing, revenue, profit and a capped recommended advance.
 *
 * Required arrays: bomItems [{ quantity, unitCost }] and quotationItems
 * [{ quantity, rate }]. Quantities are positive decimal strings (9 whole / 3
 * fractional digits). Money inputs are nonnegative strings (12 whole / 2
 * fractional digits). Each line is rounded to paise before summing.
 *
 * Optional money inputs default to "0" only when undefined: supplierDelivery,
 * technicianLabour, transport, otherDirectCost, warrantyCallbackProvision,
 * serviceCharges, discount and taxAmount. contingencyPercent defaults to "0";
 * targetAdvancePercent defaults to "50". Percentages range from "0" to "100"
 * with at most two fractional digits. Empty arrays are valid for a draft.
 *
 * Results are two-decimal strings, except currency, requiresFundingReview and
 * profitMarginPercent (null when net revenue is zero). Negative profit and
 * margin are supported. Throws TypeError for malformed inputs and RangeError
 * for invalid business values or monetary overflow.
 *
 * @example
 * calculateCommercials({
 *   bomItems: [{ quantity: "2", unitCost: "100" }],
 *   quotationItems: [{ quantity: "2", rate: "150" }]
 * }); // quoteTotal "300.00", recommendedAdvance "200.00", estimatedProfit "100.00"
 */
export function calculateCommercials(input) {
  record(input, "input");
  const materialCost = linesTotal(input.bomItems, "unitCost", "bomItems");
  const quotationSubtotal = linesTotal(input.quotationItems, "rate", "quotationItems");
  const contingency = percent(input.contingencyPercent, "contingencyPercent");
  const targetAdvance = percent(input.targetAdvancePercent, "targetAdvancePercent", "50");
  const materialContingency = roundedDivide(materialCost * contingency, 10000n);
  const supplierDelivery = optionalMoney(input.supplierDelivery, "supplierDelivery");
  const technicianLabour = optionalMoney(input.technicianLabour, "technicianLabour");
  const transport = optionalMoney(input.transport, "transport");
  const otherDirectCost = optionalMoney(input.otherDirectCost, "otherDirectCost");
  const warrantyCallbackProvision = optionalMoney(
    input.warrantyCallbackProvision,
    "warrantyCallbackProvision"
  );
  const serviceCharges = optionalMoney(input.serviceCharges, "serviceCharges");
  const discount = optionalMoney(input.discount, "discount");
  const taxAmount = optionalMoney(input.taxAmount, "taxAmount");
  const materialFundingRequirement = sum(
    [materialCost, materialContingency, supplierDelivery],
    "materialFundingRequirement"
  );
  const estimatedProjectCost = sum(
    [
      materialFundingRequirement,
      technicianLabour,
      transport,
      otherDirectCost,
      warrantyCallbackProvision
    ],
    "estimatedProjectCost"
  );
  const beforeDiscount = sum([quotationSubtotal, serviceCharges], "beforeDiscount");
  if (discount > beforeDiscount) throw new RangeError("discount exceeds revenue before discount");
  const netRevenue = beforeDiscount - discount;
  const quoteTotal = sum([netRevenue, taxAmount], "quoteTotal");
  const estimatedProfit = netRevenue - estimatedProjectCost;
  const profitMarginPercent =
    netRevenue === 0n ? null : fixed(roundedDivide(estimatedProfit * 10000n, netRevenue));
  const percentageAdvance = roundedDivide(quoteTotal * targetAdvance, 10000n);
  const uncappedAdvance =
    percentageAdvance > materialFundingRequirement ? percentageAdvance : materialFundingRequirement;
  const recommendedAdvance = uncappedAdvance < quoteTotal ? uncappedAdvance : quoteTotal;
  const fundingShortfall =
    materialFundingRequirement > recommendedAdvance
      ? materialFundingRequirement - recommendedAdvance
      : 0n;
  const plannedBalance = quoteTotal - recommendedAdvance;

  return {
    currency: "INR",
    ...formatAmounts({
      materialCost,
      materialContingency,
      materialFundingRequirement,
      estimatedProjectCost,
      quotationSubtotal,
      netRevenue,
      quoteTotal,
      estimatedProfit,
      percentageAdvance,
      uncappedAdvance,
      recommendedAdvance,
      fundingShortfall,
      plannedBalance
    }),
    profitMarginPercent,
    requiresFundingReview: fundingShortfall > 0n
  };
}

/**
 * Reconcile an aggregate payment ledger against a gross quote and its advance.
 * All amounts are decimal strings with the same money limits as above; payment
 * amounts must be strictly positive. Kinds are RECEIPT or REFUND. Refunds cannot
 * exceed aggregate receipts; array order has no chronological meaning here.
 * Transaction posting/order validation belongs to the future ledger service.
 * The recommended advance cannot exceed the quote. Returns two-decimal strings.
 *
 * @example
 * calculatePaymentPosition({ quoteTotal: "100", recommendedAdvance: "50",
 *   payments: [{ kind: "RECEIPT", amount: "25" }] });
 * // outstandingBalance "75.00", advanceOutstanding "25.00"
 */
export function calculatePaymentPosition(input) {
  record(input, "input");
  const quoteTotal = money(input.quoteTotal, "quoteTotal");
  const recommendedAdvance = money(input.recommendedAdvance, "recommendedAdvance");
  if (recommendedAdvance > quoteTotal) {
    throw new RangeError("recommendedAdvance exceeds quoteTotal");
  }
  if (!Array.isArray(input.payments)) throw new TypeError("payments must be an array");
  let receivedTotal = 0n;
  let refundedTotal = 0n;
  for (const [index, payment] of input.payments.entries()) {
    const prefix = `payments[${index}]`;
    record(payment, prefix);
    if (payment.kind !== "RECEIPT" && payment.kind !== "REFUND") {
      throw new TypeError(`${prefix}.kind must be RECEIPT or REFUND`);
    }
    const amount = money(payment.amount, `${prefix}.amount`);
    if (amount === 0n) throw new RangeError(`${prefix}.amount must be positive`);
    if (payment.kind === "RECEIPT") receivedTotal = sum([receivedTotal, amount], "receivedTotal");
    else refundedTotal = sum([refundedTotal, amount], "refundedTotal");
  }
  if (refundedTotal > receivedTotal) throw new RangeError("refunds exceed receipts");
  const netReceived = receivedTotal - refundedTotal;
  return formatAmounts({
    receivedTotal,
    refundedTotal,
    netReceived,
    outstandingBalance: quoteTotal > netReceived ? quoteTotal - netReceived : 0n,
    overpayment: netReceived > quoteTotal ? netReceived - quoteTotal : 0n,
    advanceOutstanding: recommendedAdvance > netReceived ? recommendedAdvance - netReceived : 0n
  });
}
