// Keep this canonicalization identical to migration 008. Preserve entered formatting.
export function normalizeCustomerPhone(phone: string): string {
  let digits = phone.replace(/[^0-9]/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (/^91[6-9][0-9]{9}$/.test(digits)) return digits.slice(2);
  if (/^0[6-9][0-9]{9}$/.test(digits)) return digits.slice(1);
  return digits;
}
export function validCustomerPhone(phone: string): boolean {
  return /^\+?[0-9 () .-]+$/.test(phone) && /^[0-9]{7,15}$/.test(normalizeCustomerPhone(phone));
}
export function customerSearch(query: string): string {
  return /^\+?[0-9 () .-]+$/.test(query) ? normalizeCustomerPhone(query) : query;
}
export interface CustomerDuplicate {
  id: string;
  name: string;
  phone: string;
  match: "PHONE" | "NAME";
}
export type CustomerSaveResult =
  { success: true } | { error: string } | { duplicates: CustomerDuplicate[] };
