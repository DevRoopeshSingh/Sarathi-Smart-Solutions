"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import type { QuoteDraftInput } from "@/server/quotation-input";
import type { StaffDecision } from "@/server/quotations";
import {
  saveQuotation,
  previewQuotation,
  issueQuotation,
  reviseQuotation,
  decideQuotation,
  quotationProjects
} from "@/server/quotations";
import { mutationFailure } from "@/server/mutation-errors";
import type { QuoteResult } from "@/lib/quotations";
const refresh = (id: string) => {
  for (const path of [
    "/admin",
    "/admin/quotes",
    "/admin/quotes/" + id,
    "/admin/customers",
    "/admin/projects"
  ])
    revalidatePath(path, "layout");
};
export async function saveQuoteAction(
  input: QuoteDraftInput,
  key: string,
  id?: string,
  version?: string
): Promise<QuoteResult> {
  try {
    const saved = await saveQuotation(await headers(), input, key, id, version);
    refresh(saved.id);
    return saved;
  } catch (error) {
    return mutationFailure(error);
  }
}
export async function previewQuoteAction(input: QuoteDraftInput) {
  try {
    return { totals: await previewQuotation(await headers(), input) };
  } catch (error) {
    return mutationFailure(error);
  }
}
export async function issueQuoteAction(id: string, version: string): Promise<QuoteResult> {
  try {
    const result = await issueQuotation(await headers(), id, version);
    refresh(id);
    return result;
  } catch (error) {
    return mutationFailure(error);
  }
}
export async function reviseQuoteAction(id: string, key: string): Promise<QuoteResult> {
  try {
    const result = await reviseQuotation(await headers(), id, key);
    refresh(id);
    return result;
  } catch (error) {
    return mutationFailure(error);
  }
}
export async function decisionQuoteAction(
  id: string,
  accept: boolean,
  input: StaffDecision
): Promise<QuoteResult> {
  try {
    const result = await decideQuotation(await headers(), id, accept, input);
    refresh(id);
    return result;
  } catch (error) {
    return mutationFailure(error);
  }
}
export async function quoteProjectsAction(customerId: string, divisionId: string, search: string) {
  try {
    return { options: await quotationProjects(await headers(), customerId, divisionId, search) };
  } catch (error) {
    return mutationFailure(error);
  }
}
