"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  savePayment,
  saveAllocation,
  findPaymentSubmission,
  findAllocationSubmission
} from "@/server/payments";
import { mutationFailure } from "@/server/mutation-errors";
import type { PaymentInput } from "@/lib/payments";
function refresh(id: string) {
  for (const path of [
    "/admin/payments",
    "/admin/payments/" + id,
    "/admin/customers",
    "/admin/projects",
    "/admin/quotes"
  ])
    revalidatePath(path, "layout");
}
export async function savePaymentAction(input: PaymentInput, key: string) {
  try {
    const result = await savePayment(await headers(), input, key);
    refresh(result.id);
    return result;
  } catch (error) {
    return mutationFailure(error);
  }
}
export async function allocatePaymentAction(
  receipt: string,
  quote: string,
  amount: string,
  key: string
) {
  try {
    const result = await saveAllocation(await headers(), receipt, quote, amount, key);
    refresh(receipt);
    return result;
  } catch (error) {
    return mutationFailure(error);
  }
}
export async function findPaymentSubmissionAction(key: string) {
  try {
    return { id: (await findPaymentSubmission(await headers(), key))?.id ?? null };
  } catch (error) {
    return mutationFailure(error);
  }
}
export async function findAllocationSubmissionAction(key: string) {
  try {
    return { id: (await findAllocationSubmission(await headers(), key))?.id ?? null };
  } catch (error) {
    return mutationFailure(error);
  }
}
