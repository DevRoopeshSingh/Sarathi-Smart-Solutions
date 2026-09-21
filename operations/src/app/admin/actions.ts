"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  createCustomer,
  createLead,
  createProject,
  updateLeadStatus,
  updateProjectStatus
} from "@/server/dal";

export async function createLeadAction(formData: FormData) {
  const requestHeaders = await headers();
  const contactName = String(formData.get("contactName") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const serviceRequested = String(formData.get("serviceRequested") || "").trim();
  const source = String(formData.get("source") || "MANUAL").trim();
  const notes = String(formData.get("notes") || "").trim();

  if (!contactName || !phone || !serviceRequested) {
    return { error: "Please provide a contact name, phone number, and service requested." };
  }

  try {
    await createLead(requestHeaders, { contactName, phone, serviceRequested, source, notes });
    revalidatePath("/admin");
    revalidatePath("/admin/leads");
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to create lead." };
  }
}

export async function updateLeadStatusAction(leadId: number, status: string) {
  const requestHeaders = await headers();
  try {
    await updateLeadStatus(requestHeaders, leadId, status);
    revalidatePath("/admin");
    revalidatePath("/admin/leads");
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to update lead status." };
  }
}

export async function createCustomerAction(formData: FormData) {
  const requestHeaders = await headers();
  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const address = String(formData.get("address") || "").trim();

  if (!name || !phone) {
    return { error: "Please provide customer name and phone number." };
  }

  try {
    await createCustomer(requestHeaders, { name, phone, email, address });
    revalidatePath("/admin");
    revalidatePath("/admin/customers");
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to create customer." };
  }
}

export async function createProjectAction(formData: FormData) {
  const requestHeaders = await headers();
  const customerId = Number(formData.get("customerId"));
  const name = String(formData.get("name") || "").trim();
  const siteAddress = String(formData.get("siteAddress") || "").trim();
  const scope = String(formData.get("scope") || "").trim();
  const leadIdRaw = formData.get("leadId");
  const leadId = leadIdRaw ? Number(leadIdRaw) : undefined;

  if (!customerId || !name || !siteAddress) {
    return { error: "Customer, project name, and site address are required." };
  }

  try {
    await createProject(requestHeaders, {
      customerId,
      name,
      siteAddress,
      scope,
      leadId,
      serviceTypes: ["cctv"]
    });
    revalidatePath("/admin");
    revalidatePath("/admin/projects");
    revalidatePath("/admin/leads");
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to create project." };
  }
}

export async function updateProjectStatusAction(projectId: number, operationalStatus: string) {
  const requestHeaders = await headers();
  try {
    await updateProjectStatus(requestHeaders, projectId, operationalStatus);
    revalidatePath("/admin");
    revalidatePath("/admin/projects");
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to update project status." };
  }
}
