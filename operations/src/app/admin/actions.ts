"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import type { MutationResult } from "@/lib/operations";
import {
  createCustomer,
  createLead,
  createProject,
  updateLeadStatus,
  updateProjectStatus
} from "@/server/dal";
import { customerForm, leadForm, projectForm } from "@/server/input";
import { mutationFailure } from "@/server/mutation-errors";

export async function createLeadAction(formData: FormData): Promise<MutationResult> {
  try {
    await createLead(await headers(), leadForm(formData));
    revalidatePath("/admin");
    revalidatePath("/admin/leads");
    return { success: true };
  } catch (error) {
    return mutationFailure(error);
  }
}

export async function updateLeadStatusAction(
  leadId: string,
  status: string,
  expectedStatus: string
): Promise<MutationResult> {
  try {
    await updateLeadStatus(await headers(), leadId, status, expectedStatus);
    revalidatePath("/admin");
    revalidatePath("/admin/leads");
    return { success: true };
  } catch (error) {
    return mutationFailure(error);
  }
}

export async function createCustomerAction(formData: FormData): Promise<MutationResult> {
  try {
    await createCustomer(await headers(), customerForm(formData));
    revalidatePath("/admin");
    revalidatePath("/admin/customers");
    revalidatePath("/admin/leads");
    revalidatePath("/admin/projects");
    return { success: true };
  } catch (error) {
    return mutationFailure(error);
  }
}

export async function createProjectAction(formData: FormData): Promise<MutationResult> {
  try {
    await createProject(await headers(), projectForm(formData));
    revalidatePath("/admin");
    revalidatePath("/admin/projects");
    revalidatePath("/admin/leads");
    revalidatePath("/admin/customers");
    return { success: true };
  } catch (error) {
    return mutationFailure(error);
  }
}

export async function updateProjectStatusAction(
  projectId: string,
  operationalStatus: string,
  expectedStatus: string,
  reason?: string
): Promise<MutationResult> {
  try {
    await updateProjectStatus(
      await headers(),
      projectId,
      operationalStatus,
      expectedStatus,
      reason
    );
    revalidatePath("/admin");
    revalidatePath("/admin/projects");
    return { success: true };
  } catch (error) {
    return mutationFailure(error);
  }
}
