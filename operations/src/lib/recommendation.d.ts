export interface ContactConfig {
  phone: string;
  phoneDisplay: string;
  whatsappNumber: string;
  email: string;
  address: string;
  serviceAreas: string;
  disclaimer: string;
}

export interface ServiceCatalogueEntry {
  label: string;
  description: string;
  icon: string;
  details: Record<string, string>;
  fields: Array<{
    id: string;
    label: string;
    type: "select" | "number" | "text";
    options?: readonly string[];
    min?: number;
    max?: number;
    maxLength?: number;
    placeholder?: string;
  }>;
  category: "core" | "additional";
  ctaLabel: string;
}

export interface SizeOption {
  value: "Compact" | "Standard" | "Large";
  title: string;
  description: string;
}

export interface RecommendationItem {
  key: string;
  title: string;
  detail: string;
}

export interface RecommendationResult {
  title: string;
  intro: string;
  items: RecommendationItem[];
  summary: string;
}

export const CONTACT_CONFIG: ContactConfig;
export const SERVICE_CATALOGUE: Record<string, ServiceCatalogueEntry>;
export const NEED_LABELS: Record<string, string>;
export const SIZE_OPTIONS: {
  Home: readonly SizeOption[];
  Business: readonly SizeOption[];
};

export function buildRecommendation(input: {
  space: "Home" | "Business";
  needs: string[];
  size: "Compact" | "Standard" | "Large";
  enquiryOptions?: Record<string, Record<string, string | number>>;
}): RecommendationResult;

export function formatEnquiryMessage(params: {
  space: string;
  needs: string[];
  size: string;
  title: string;
  enquiryOptions?: Record<string, Record<string, string | number>>;
}): string;

export function buildWhatsAppUrl(phoneNumber: string, messageText: string): string;

export function formatLeadWhatsAppMessage(params: {
  name?: string;
  phone?: string;
  locality?: string;
  propertyType?: string;
  service?: string;
  message?: string;
  formSource?: string;
}): string;

export function formatPackageWhatsAppMessage(params: {
  packageName: string;
  startingPrice: string;
}): string;
