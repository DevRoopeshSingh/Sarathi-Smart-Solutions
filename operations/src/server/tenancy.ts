import "server-only";
import type { Pool } from "pg";
import { getIdentityActor } from "./identity";
import { getPool } from "./db";
import { databaseId } from "./input";
import { AccessDeniedError } from "./mutation-errors";
import { hasPermission, isRole, PERMISSIONS, type Permission, type Role } from "./permissions";

export interface DivisionAccess {
  id: string;
  slug: string;
  name: string;
}
export interface OrganizationContext {
  organization: { id: string; slug: string; name: string };
  membershipId: string;
  role: Role;
  divisions: DivisionAccess[];
  permissions: Permission[];
}

// Membership cannot elevate a global role; viewer writes always fail closed.
export function hasOrganizationPermission(
  actorRole: Role,
  membershipRole: Role,
  permission: Permission,
  canRecordPayments = false
): boolean {
  if (
    !PERMISSIONS.includes(permission) ||
    !isRole(actorRole) ||
    !isRole(membershipRole) ||
    !hasPermission(actorRole, permission) ||
    !hasPermission(membershipRole, permission)
  )
    return false;
  if (permission.startsWith("payments.") && permission !== "payments.read") {
    return (actorRole === "ADMIN" && membershipRole === "ADMIN") || canRecordPayments;
  }
  return true;
}

export function assertDivisionAccess(context: OrganizationContext, rawDivisionId: string): void {
  const id = databaseId(rawDivisionId, "Division");
  if (!context.divisions.some((division) => division.id === id)) throw new AccessDeniedError();
}

// Internal persistence boundary: actorId MUST come from the authenticated DAL.
// TenantPool rechecks this context inside every business transaction.
export async function resolveOrganizationContext(
  pool: Pick<Pool, "query">,
  rawActorId: string,
  rawOrganizationId: string,
  permission: Permission,
  rawDivisionId?: string
): Promise<OrganizationContext> {
  const actorId = databaseId(rawActorId, "User");
  const organizationId = databaseId(rawOrganizationId, "Organization");
  type ContextRow = {
    id: string;
    slug: string;
    name: string;
    membershipId: string;
    role: Role;
    actorRole: Role;
    canRecordPayments: boolean;
    divisions: DivisionAccess[];
  };
  // One statement revalidates all active states and division permissions in the same snapshot.
  const result = await pool.query<ContextRow>(
    `
    SELECT o.id::text, o.slug, o.name, m.id::text AS "membershipId", m.role,
      u.role AS "actorRole", m.can_record_payments AS "canRecordPayments",
      COALESCE((SELECT jsonb_agg(jsonb_build_object('id',d.id::text,'slug',d.slug,'name',d.name) ORDER BY d.id)
        FROM sarathi.divisions d WHERE d.organization_id=o.id AND d.active AND (
          (u.role='ADMIN' AND m.role='ADMIN') OR EXISTS (
            SELECT 1 FROM sarathi.division_assignments a WHERE a.organization_id=o.id
              AND a.membership_id=m.id AND a.division_id=d.id AND a.active
          ))), '[]'::jsonb) AS divisions
    FROM sarathi.organization_memberships m
    JOIN sarathi.organizations o ON o.id=m.organization_id AND o.active
    JOIN sarathi.users u ON u.id=m.user_id AND u.active
    WHERE m.user_id=$1 AND m.organization_id=$2 AND m.active
  `,
    [actorId, organizationId]
  );
  const row = result.rows[0];
  if (
    !row ||
    !hasOrganizationPermission(row.actorRole, row.role, permission, row.canRecordPayments)
  ) {
    throw new AccessDeniedError();
  }
  const context: OrganizationContext = {
    organization: { id: row.id, slug: row.slug, name: row.name },
    membershipId: row.membershipId,
    role: row.role,
    divisions: row.divisions,
    permissions: PERMISSIONS.filter((p) =>
      hasOrganizationPermission(row.actorRole, row.role, p, row.canRecordPayments)
    )
  };
  if (rawDivisionId !== undefined) assertDivisionAccess(context, rawDivisionId);
  return context;
}

export async function requireOrganizationPermission(
  headers: Headers,
  organizationId: string,
  permission: Permission,
  divisionId?: string
): Promise<OrganizationContext> {
  const actor = await getIdentityActor(headers);
  if (!actor) throw new AccessDeniedError();
  return resolveOrganizationContext(getPool(), actor.id, organizationId, permission, divisionId);
}

// No tenant selector is accepted from request headers/forms. Until an authorized
// switcher exists, choose the first active membership deterministically.
export async function currentOrganization(actorId: string, permission: Permission) {
  const result = await getPool().query<{ id: string }>(
    `SELECT m.organization_id::text AS id
    FROM sarathi.organization_memberships m JOIN sarathi.organizations o ON o.id=m.organization_id AND o.active
    WHERE m.user_id=$1 AND m.active ORDER BY m.organization_id LIMIT 1`,
    [actorId]
  );
  if (!result.rows[0]) throw new AccessDeniedError();
  return resolveOrganizationContext(getPool(), actorId, result.rows[0].id, permission);
}
