import type { LeadStatus, ProjectStatus, QuotationRecord, UserRole } from "./operations";

export type WorkflowKind = "lead" | "quote" | "project";
export type Stage = { label: string; description: string; next: string; previous: string };
export const LEAD_STAGES: Record<LeadStatus, Stage> = {
  NEW: {
    label: "New enquiry",
    description: "An enquiry has been captured; contact and requirements still need checking.",
    previous: "The customer enquired about a service.",
    next: "Contact the customer and confirm their phone number, site and service needs."
  },
  CONTACTED: {
    label: "Contacted",
    description: "The team has spoken to the customer. Confirm whether the requirement is a fit.",
    previous: "The enquiry was recorded and the customer contacted.",
    next: "Confirm scope, location and timing, then mark the lead Qualified if it is a fit."
  },
  QUALIFIED: {
    label: "Qualified",
    description: "The enquiry is a fit and is ready for project setup and a site survey.",
    previous: "The team checked the customer’s requirements.",
    next: "Choose or create the customer, then convert this lead to a project for survey and costing."
  },
  CONVERTED: {
    label: "Converted",
    description:
      "A customer-linked project was created from this lead. Conversion does not mean a quotation was approved.",
    previous: "The lead was linked to a customer and a project was created.",
    next: "Open the linked project to follow its survey, quotation and delivery progress."
  },
  LOST: {
    label: "Lost",
    description: "This enquiry is not proceeding. Its record is kept for reference.",
    previous: "An enquiry was reviewed but did not proceed.",
    next: "No next step is required. If the customer returns, review the requirement and reopen the lead before conversion."
  }
};
export const QUOTE_STAGES: Record<QuotationRecord["status"], Stage> = {
  DRAFT: {
    label: "Draft",
    description:
      "A quotation is being prepared. Prices and scope are not yet issued to the customer.",
    previous: "The project’s survey and costing inform the estimate.",
    next: "Review scope, quantities, prices and terms before issuing. Quotation editing and sending are not available in this workspace yet."
  },
  SENT: {
    label: "Sent",
    description:
      "The issued quotation is frozen. Await the customer’s decision; changes need a new version.",
    previous: "The quotation was prepared and issued.",
    next: "Follow up with the customer. Approval must be recorded through the team’s current quotation process."
  },
  APPROVED: {
    label: "Approved",
    description:
      "Customer approval is recorded. This does not prove an advance has been received or installation has started.",
    previous: "The customer accepted the issued quotation.",
    next: "Confirm agreed payment and material readiness with the team, then plan delivery in the linked project."
  },
  DECLINED: {
    label: "Declined",
    description:
      "The customer declined this version. It is retained as part of the commercial record.",
    previous: "An issued quotation was reviewed by the customer.",
    next: "Discuss the reason with the customer. A revised offer needs a new quotation version; do not overwrite this one."
  },
  SUPERSEDED: {
    label: "Superseded",
    description:
      "This quotation was replaced by a newer version. It remains available for reference.",
    previous: "A newer quotation replaced this version.",
    next: "Review the other quotations linked to this project and confirm the current commercial agreement."
  },
  VOID: {
    label: "Void",
    description: "This version was withdrawn and should not be used as the current offer.",
    previous: "The quotation was withdrawn.",
    next: "No action is needed on this version. Check the project for a replacement or revised plan."
  }
};
export const PROJECT_STAGES: Record<ProjectStatus, Stage> = {
  SURVEY_PENDING: {
    label: "Survey pending",
    description: "The project is set up. A site visit or requirement check is still needed.",
    previous: "A project was created directly or from a lead.",
    next: "Arrange the site survey and confirm location, access, measurements and service needs."
  },
  SURVEY_COMPLETE: {
    label: "Survey complete",
    description: "The site survey is complete and the team can prepare scope and costing.",
    previous: "The site survey was completed.",
    next: "Check survey notes and prepare the bill of materials and cost estimate with the team."
  },
  COSTING: {
    label: "Costing & quotation",
    description: "The team is working out materials, labour and the customer quotation.",
    previous: "The survey established the site requirements.",
    next: "Review the quotation and customer approval. Confirm agreed payment before planning procurement; this stage alone does not confirm either."
  },
  PROCUREMENT: {
    label: "Procurement",
    description: "Materials are being arranged for the agreed work.",
    previous: "Scope, commercial terms and funding should have been confirmed by the team.",
    next: "Confirm materials are available and agree an installation date with the customer."
  },
  INSTALLATION_SCHEDULED: {
    label: "Installation scheduled",
    description: "The installation has been planned with the customer and team.",
    previous: "Materials and scheduling were reviewed.",
    next: "Confirm team availability, site access and equipment before installation starts."
  },
  INSTALLATION_IN_PROGRESS: {
    label: "Installation in progress",
    description: "The team is carrying out the installation at the customer’s site.",
    previous: "The installation date and site access were arranged.",
    next: "Complete installation, check the agreed scope, then test the system."
  },
  TESTING: {
    label: "Testing",
    description: "The installed system is being checked before customer handover.",
    previous: "Installation work reached the testing stage.",
    next: "Resolve test issues, demonstrate the system and confirm customer handover before marking Completed."
  },
  COMPLETED: {
    label: "Completed",
    description:
      "Operational handover is complete. Payments and warranty obligations remain separate.",
    previous: "The team recorded completion of testing and handover.",
    next: "No further operational stage is required. Review outstanding obligations separately; reopening needs a recorded reason."
  },
  CANCELLED: {
    label: "Cancelled",
    description:
      "Work has stopped. Records are retained; cancellation does not refund or remove payments.",
    previous: "The team cancelled the project with a recorded reason.",
    next: "Review commitments with the team. Reopening is an exception and needs a recorded reason."
  }
};
export function stageInfo(kind: WorkflowKind, status: string): Stage {
  const stages: Record<string, Stage> =
    kind === "lead" ? LEAD_STAGES : kind === "quote" ? QUOTE_STAGES : PROJECT_STAGES;
  return (
    stages[status] ?? {
      label: "Unrecognised stage",
      description: "Ask an administrator to review this record.",
      previous: "Check recorded activity for context.",
      next: "Review the record before making changes."
    }
  );
}
export const ROLE_GUIDANCE: Record<UserRole, string> = {
  ADMIN:
    "You can capture and update leads, customers and projects, and manage users, roles and account security.",
  OPERATOR:
    "You can capture and update leads, add customers and move projects through their stages. Ask an administrator about user access or account settings.",
  VIEWER:
    "You can review leads, quotations and projects. Your access is read-only; ask an operator or administrator to change a record."
};
export const FLOW_STEPS = [
  {
    id: "lead",
    title: "Capture the lead",
    text: "Contact the customer, confirm requirements and qualify the enquiry.",
    href: "/admin/leads"
  },
  {
    id: "setup",
    title: "Set up & survey",
    text: "Convert the lead to a customer-linked project. Survey the site and prepare costing before a quotation.",
    href: "/admin/projects"
  },
  {
    id: "quote",
    title: "Agree the quotation",
    text: "Review the offer and customer decision. Quote approval and receipt of payment are separate.",
    href: "/admin/quotes"
  },
  {
    id: "delivery",
    title: "Deliver the project",
    text: "Arrange materials, install, test and hand over. Keep a reason for exceptional stage changes.",
    href: "/admin/projects"
  }
] as const;
export type FlowStep = (typeof FLOW_STEPS)[number]["id"];
export function projectFlow(status: ProjectStatus): FlowStep {
  if (status === "COSTING") return "quote";
  return status === "SURVEY_PENDING" || status === "SURVEY_COMPLETE" ? "setup" : "delivery";
}
export interface ActivityEvent {
  id: string;
  at: string;
  title: string;
  description: string | null;
  actor: string | null;
}
export interface RecordLink {
  label: string;
  href: string;
}
export interface WorkflowDetail {
  id: string;
  kind: WorkflowKind;
  title: string;
  status: string;
  fields: { label: string; value: string | null }[];
  related: RecordLink[];
  events: ActivityEvent[];
  historyTruncated: boolean;
  onHold?: boolean;
  holdReason?: string | null;
}
