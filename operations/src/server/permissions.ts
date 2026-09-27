import "server-only";

export const ROLES = ["ADMIN", "OPERATOR", "VIEWER"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "dashboard.read",
  "leads.read",
  "leads.create",
  "leads.update",
  "leads.delete",
  "customers.read",
  "customers.create",
  "customers.update",
  "customers.delete",
  "projects.read",
  "projects.create",
  "projects.update",
  "projects.delete",
  "quotations.read",
  "quotations.create",
  "quotations.update",
  "quotations.delete",
  "payments.read",
  "payments.create",
  "payments.update",
  "payments.delete",
  "admin.security.manage",
  "admin.users.manage"
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const operatorPermissions = new Set<Permission>([
  "dashboard.read",
  "leads.read",
  "leads.create",
  "leads.update",
  "customers.read",
  "customers.create",
  "projects.read",
  "projects.create",
  "projects.update",
  "quotations.read",
  "quotations.create",
  "quotations.update",
  "payments.read",
  "payments.create",
  "payments.update"
]);

const viewerPermissions = new Set<Permission>([
  "dashboard.read",
  "leads.read",
  "customers.read",
  "projects.read",
  "quotations.read"
]);

export function hasPermission(role: Role, permission: Permission): boolean {
  if (role === "ADMIN") return true;
  return (role === "OPERATOR" ? operatorPermissions : viewerPermissions).has(permission);
}

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}
