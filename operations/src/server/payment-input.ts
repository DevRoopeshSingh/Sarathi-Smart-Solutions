import "server-only";
import { PAYMENT_METHODS, PAYMENT_PURPOSES, type PaymentInput } from "../lib/payments";
import { minor, fixed } from "../lib/quotation-money";
import { boundedText, databaseId } from "./input";
import { InputError } from "./mutation-errors";
export function paymentAmount(raw: unknown) {
  try {
    const value = minor(boundedText(raw, "Amount", 16));
    if (value <= 0n || value > 99999999999999n) throw new Error();
    return fixed(value);
  } catch {
    throw new InputError("Enter a positive amount with at most two decimal places.");
  }
}
export function paymentTime(raw: unknown, now = Date.now()) {
  const value = boundedText(raw, "Payment time", 35);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value))
    throw new InputError("Enter a valid payment time with a timezone.");
  const date = new Date(value);
  const day = value.slice(0, 10);
  if (
    Number(value.slice(11, 13)) > 23 ||
    Number(value.slice(14, 16)) > 59 ||
    (value[16] === ":" && Number(value.slice(17, 19)) > 59) ||
    !Number.isFinite(date.getTime()) ||
    new Date(day).toISOString().slice(0, 10) !== day ||
    date.getTime() < Date.parse("2000-01-01T00:00:00Z") ||
    date.getTime() > now + 300000
  )
    throw new InputError("Payment time must be valid and cannot be in the future.");
  return date.toISOString();
}
export function validatePayment(input: PaymentInput) {
  if (!input || typeof input !== "object" || input.acknowledge !== true)
    throw new InputError("Confirm the completed payment/refund or approved receipt correction.");
  const method = boundedText(input.method, "Payment method", 20);
  const purpose = boundedText(input.purpose, "Payment purpose", 20);
  if (
    ![...PAYMENT_METHODS, "CORRECTION"].includes(method as "CASH") ||
    ![...PAYMENT_PURPOSES, "REFUND", "REVERSAL"].includes(purpose as "ADVANCE")
  )
    throw new InputError("Select a supported payment method and purpose.");
  const reference = boundedText(input.reference, "Transaction reference", 200, false);
  const note = boundedText(input.note, "Payment note", 2000, false);
  if (method !== "CASH" && !reference) throw new InputError("Enter the transaction reference.");
  const id = (value: unknown) =>
    value === undefined || value === "" ? null : databaseId(value, "Record");
  const projectId = id(input.projectId),
    quotationId = id(input.quotationId),
    refundOfId = id(input.refundOfId);
  if (refundOfId) {
    if (projectId || quotationId || !["REFUND", "REVERSAL"].includes(purpose) || note.length < 8)
      throw new InputError(
        "Refunds need an original receipt and a reason of at least eight characters."
      );
  } else if ((!projectId && !quotationId) || ["REFUND", "REVERSAL"].includes(purpose))
    throw new InputError("Select a project or accepted quotation for this receipt.");
  if ((purpose === "REVERSAL") !== (method === "CORRECTION"))
    throw new InputError("Receipt corrections must use the internal correction method.");
  return {
    projectId,
    quotationId,
    refundOfId,
    amount: paymentAmount(input.amount),
    method,
    purpose,
    reference,
    note,
    occurredAt: paymentTime(input.occurredAt)
  };
}
