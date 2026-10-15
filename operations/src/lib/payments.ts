import { fixed, minor } from "./quotation-money";
export const PAYMENT_METHODS = ["CASH", "UPI", "BANK_TRANSFER", "CARD", "OTHER"] as const;
export const PAYMENT_PURPOSES = ["ADVANCE", "PROGRESS", "FINAL", "OTHER"] as const;
export interface PaymentInput {
  projectId?: string;
  quotationId?: string;
  refundOfId?: string;
  amount: string;
  method: string;
  reference: string;
  note: string;
  occurredAt: string;
  purpose: string;
  acknowledge: boolean;
}
export interface Payment {
  id: string;
  kind: "RECEIPT" | "REFUND";
  amount: string;
  number: string | null;
  projectId: string | null;
  projectName: string | null;
  quotationId: string | null;
  quotationNumber: string | null;
  rootId: string | null;
  customerId: string;
  customerName: string;
  divisionId: string;
  divisionName: string;
  method: string;
  reference: string | null;
  note: string | null;
  purpose: string | null;
  occurredAt: string;
  recordedAt: string;
  recordedBy: string;
  refundOfId: string | null;
  hasDocument: boolean;
  current: boolean;
  refunded: string;
  allocated: string;
}
export interface PaymentSnapshot {
  id: string;
  number: string;
  kind: "RECEIPT" | "REFUND";
  amount: string;
  business: { name: string; address: string; phone: string; email: string };
  customer: { name: string; phone: string; address: string | null };
  project: string | null;
  quotation: string | null;
  originalReceipt: string | null;
  method: string;
  purpose: string;
  reference: string | null;
  note: string | null;
  occurredAt: string;
  recordedAt: string;
  recordedBy: string;
}
export interface PaymentBalance {
  baselineId: string | null;
  baselineNumber: string | null;
  total: string | null;
  received: string;
  refunded: string;
  net: string;
  reversed: string;
  outstanding: string | null;
  credit: string;
}
export function ledgerBalance(
  total: string | null,
  received: string,
  refunded: string,
  reversed = "0.00"
) {
  // An aggregate can exceed the per-entry money domain. Bigint IDs bound the
  // number of rows, so 32 whole digits cover every possible valid ledger sum.
  const aggregate = (value: string) => {
    if (!/^[0-9]{1,32}(?:\.[0-9]{1,2})?$/.test(value)) throw new Error("Invalid ledger aggregate.");
    const [whole, fraction = ""] = value.split(".");
    return BigInt(whole + fraction.padEnd(2, "0"));
  };
  const net = aggregate(received) - aggregate(refunded) - aggregate(reversed);
  const basis = total === null ? null : minor(total);
  return {
    total,
    received,
    refunded,
    reversed,
    net: net < 0n ? "-" + fixed(-net) : fixed(net),
    outstanding: basis === null ? null : fixed(basis > net ? basis - net : 0n),
    credit: fixed(net > (basis ?? 0n) ? net - (basis ?? 0n) : 0n)
  };
}
export function receiptRemaining(payment: Pick<Payment, "amount" | "refunded" | "allocated">) {
  const remaining = minor(payment.amount) - minor(payment.refunded);
  return {
    refundable: fixed(remaining > 0n ? remaining : 0n),
    unallocated: fixed(
      remaining > minor(payment.allocated) ? remaining - minor(payment.allocated) : 0n
    )
  };
}
