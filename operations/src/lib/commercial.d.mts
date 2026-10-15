export function calculateCommercials(input: {
  bomItems: { quantity: string; unitCost: string }[];
  quotationItems: { quantity: string; rate: string }[];
  serviceCharges?: string;
  discount?: string;
  taxAmount?: string;
  targetAdvancePercent?: string;
}): { quotationSubtotal: string; quoteTotal: string; [key: string]: string | boolean | null };
