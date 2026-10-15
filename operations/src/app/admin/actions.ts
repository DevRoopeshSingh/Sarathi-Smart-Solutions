"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import type { MutationResult } from "@/lib/operations";
import {
  createCustomer,
  createLead,
  createProject,
  setManagedUserRole,
  updateCustomer,
  updateLeadStatus,
  updateProjectStatus
} from "@/server/dal";
import { customerForm, formText, leadForm, projectForm } from "@/server/input";
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

export async function createCustomerAction(
  formData: FormData
): Promise<import("@/lib/customer-contact").CustomerSaveResult> {
  try {
    await createCustomer(await headers(), customerForm(formData), {
      requestId: formText(formData, "requestId", "Submission reference", 36),
      confirmDuplicates:
        formText(formData, "confirmDuplicates", "Duplicate confirmation", 5, false) === "true"
    });
    revalidatePath("/admin");
    revalidatePath("/admin/customers");
    revalidatePath("/admin/leads");
    revalidatePath("/admin/projects");
    return { success: true };
  } catch (error) {
    const { DuplicateCustomerError } = await import("@/server/customer-mutations");
    if (error instanceof DuplicateCustomerError) return { duplicates: error.duplicates };
    return mutationFailure(error);
  }
}

export async function updateCustomerAction(formData: FormData): Promise<MutationResult> {
  try {
    const id = formText(formData, "customerId", "Customer", 19);
    await updateCustomer(
      await headers(),
      id,
      customerForm(formData),
      formText(formData, "version", "Edit version", 10)
    );
    for (const path of [
      "/admin/customers",
      `/admin/customers/${id}`,
      "/admin/leads",
      "/admin/projects",
      "/admin/quotes"
    ])
      revalidatePath(path);
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

export async function setManagedUserRoleAction(
  userId: string,
  role: string
): Promise<MutationResult> {
  try {
    await setManagedUserRole(await headers(), userId, role);
    revalidatePath("/admin/users");
    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    return mutationFailure(error);
  }
}
