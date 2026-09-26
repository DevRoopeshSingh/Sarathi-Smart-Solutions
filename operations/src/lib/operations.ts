export const LEAD_STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "LOST"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export const PROJECT_STATUSES = [
  "SURVEY_PENDING",
  "SURVEY_COMPLETE",
  "COSTING",
  "PROCUREMENT",
  "INSTALLATION_SCHEDULED",
  "INSTALLATION_IN_PROGRESS",
  "TESTING",
  "COMPLETED",
  "CANCELLED"
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

// Keep exceptional admin changes available, but require an auditable explanation.
export function requiresProjectTransitionReason(from: string, to: string): boolean {
  if (from === to) return false;
  const fromIndex = PROJECT_STATUSES.indexOf(from as ProjectStatus);
  const toIndex = PROJECT_STATUSES.indexOf(to as ProjectStatus);
  return (
    fromIndex < 0 ||
    toIndex < 0 ||
    from === "COMPLETED" ||
    from === "CANCELLED" ||
    to === "CANCELLED" ||
    toIndex !== fromIndex + 1
  );
}

export type MutationResult = { success: true; error?: never } | { error: string; success?: never };

export interface AdminActor {
  id: string;
  displayName: string;
  email: string;
}

export interface LeadRecord {
  id: string;
  customerId: string | null;
  contactName: string;
  phone: string;
  serviceRequested: string;
  source: string;
  status: "NEW" | "CONTACTED" | "QUALIFIED" | "CONVERTED" | "LOST";
  notes: string | null;
  requirementJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerRecord {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  projectCount: number;
  createdAt: string;
}

export interface ProjectRecord {
  id: string;
  customerId: string;
  customerName: string;
  leadId: string | null;
  name: string;
  siteAddress: string;
  scope: string;
  serviceTypes: string[];
  operationalStatus: ProjectStatus;
  onHold: boolean;
  holdReason: string | null;
  createdAt: string;
}

export interface QuotationRecord {
  id: string;
  projectId: string;
  projectName: string;
  customerId: string;
  customerName: string;
  version: number;
  status: "DRAFT" | "SENT" | "APPROVED" | "DECLINED" | "SUPERSEDED" | "VOID";
  subtotal: string;
  discount: string;
  taxAmount: string;
  quoteTotal: string;
  issuedAt: string | null;
  createdAt: string;
}

export interface PaymentRecord {
  id: string;
  projectId: string;
  projectName: string;
  quotationId: string | null;
  kind: "RECEIPT" | "REFUND";
  amount: string;
  paymentMethod: string;
  reference: string | null;
  createdAt: string;
}

export type CustomerOption = Pick<CustomerRecord, "id" | "name" | "phone">;
