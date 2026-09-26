import "server-only";
import { LEAD_STATUSES, PROJECT_STATUSES } from "../lib/operations";
import { InputError } from "./mutation-errors";
export { InputError } from "./mutation-errors";

export function boundedText(value: unknown, label: string, max: number, required = true): string {
  if (typeof value !== "string") throw new InputError(`${label} must be text.`);
  const text = value.trim();
  if ((required && !text) || text.length > max || text.includes("\0")) {
    throw new InputError(`${label} is missing, too long, or contains invalid characters.`);
  }
  return text;
}

export function formText(
  form: FormData,
  name: string,
  label: string,
  max: number,
  required = true
): string {
  if (!(form instanceof FormData)) throw new InputError("Invalid form submission.");
  const values = form.getAll(name);
  if (values.length > 1) throw new InputError(`${label} must occur once.`);
  return boundedText(values[0] ?? "", label, max, required);
}

export function databaseId(value: unknown, label = "Record"): string {
  if (
    typeof value !== "string" ||
    !/^[1-9][0-9]{0,18}$/.test(value) ||
    BigInt(value) > 9223372036854775807n
  ) {
    throw new InputError(`${label} ID is invalid.`);
  }
  return value;
}

export function formId(
  form: FormData,
  name: string,
  label: string,
  required: false
): string | undefined;
export function formId(form: FormData, name: string, label: string, required?: true): string;
export function formId(
  form: FormData,
  name: string,
  label: string,
  required = true
): string | undefined {
  const value = formText(form, name, label, 19, required);
  return !required && value === "" ? undefined : databaseId(value, label);
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T))
    throw new InputError(`Invalid ${label}.`);
  return value as T;
}
export const leadStatus = (value: unknown) => enumValue(value, LEAD_STATUSES, "lead status");
export const projectStatus = (value: unknown) =>
  enumValue(value, PROJECT_STATUSES, "project status");

export interface CreateLeadInput {
  contactName: string;
  phone: string;
  serviceRequested: string;
  source?: string;
  notes?: string;
}
export function validateLead(data: CreateLeadInput) {
  return {
    contactName: boundedText(data.contactName, "Name", 200),
    // Accept Indian landlines with STD codes and international numbers as bounded contact text.
    phone: boundedText(data.phone, "Phone", 32),
    serviceRequested: boundedText(data.serviceRequested, "Service", 200),
    source: boundedText(data.source ?? "MANUAL", "Source", 80, false) || "MANUAL",
    notes: boundedText(data.notes ?? "", "Notes", 5000, false) || null
  };
}
export function leadForm(form: FormData): CreateLeadInput {
  return {
    contactName: formText(form, "contactName", "Name", 200),
    phone: formText(form, "phone", "Phone", 32),
    serviceRequested: formText(form, "serviceRequested", "Service", 200),
    source: formText(form, "source", "Source", 80, false),
    notes: formText(form, "notes", "Notes", 5000, false)
  };
}

export interface CreateCustomerInput {
  name: string;
  phone: string;
  email?: string;
  address?: string;
}
export function validateCustomer(data: CreateCustomerInput) {
  const email = boundedText(data.email ?? "", "Email", 254, false);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new InputError("Enter a valid email address.");
  return {
    name: boundedText(data.name, "Name", 200),
    phone: boundedText(data.phone, "Phone", 32),
    email: email || null,
    address: boundedText(data.address ?? "", "Address", 1000, false) || null
  };
}
export function customerForm(form: FormData): CreateCustomerInput {
  return {
    name: formText(form, "name", "Name", 200),
    phone: formText(form, "phone", "Phone", 32),
    email: formText(form, "email", "Email", 254, false),
    address: formText(form, "address", "Address", 1000, false)
  };
}

export interface CreateProjectInput {
  customerId: string;
  name: string;
  siteAddress: string;
  scope?: string;
  serviceTypes?: string[];
  leadId?: string;
}
export function validateProject(data: CreateProjectInput) {
  const serviceTypes = data.serviceTypes ?? ["cctv"];
  if (!Array.isArray(serviceTypes) || serviceTypes.length < 1 || serviceTypes.length > 20) {
    throw new InputError("Provide between 1 and 20 services.");
  }
  const services = serviceTypes.map((value) => boundedText(value, "Service", 80));
  if (new Set(services).size !== services.length)
    throw new InputError("Services must not be repeated.");
  return {
    customerId: databaseId(data.customerId, "Customer"),
    leadId: data.leadId === undefined ? null : databaseId(data.leadId, "Lead"),
    name: boundedText(data.name, "Project name", 200),
    siteAddress: boundedText(data.siteAddress, "Site address", 1000),
    scope: boundedText(data.scope ?? "", "Scope", 5000, false),
    serviceTypes: services
  };
}
export function projectForm(form: FormData): CreateProjectInput {
  return {
    customerId: formId(form, "customerId", "Customer"),
    leadId: formId(form, "leadId", "Lead", false),
    name: formText(form, "name", "Project name", 200),
    siteAddress: formText(form, "siteAddress", "Site address", 1000),
    scope: formText(form, "scope", "Scope", 5000, false),
    serviceTypes: ["cctv"]
  };
}
