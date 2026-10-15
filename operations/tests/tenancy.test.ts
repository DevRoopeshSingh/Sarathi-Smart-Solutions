import assert from "node:assert/strict";
import test from "node:test";
import {
  hasOrganizationPermission,
  assertDivisionAccess,
  type OrganizationContext
} from "../src/server/tenancy";
import { AccessDeniedError, InputError } from "../src/server/mutation-errors";
import { PERMISSIONS, type Role, type Permission } from "../src/server/permissions";

test("organization permissions intersect membership and global roles; viewers never write", () => {
  for (const permission of PERMISSIONS) {
    assert.equal(hasOrganizationPermission("ADMIN", "ADMIN", permission), true);
    if (!permission.endsWith(".read")) {
      assert.equal(hasOrganizationPermission("ADMIN", "VIEWER", permission, true), false);
      assert.equal(hasOrganizationPermission("VIEWER", "ADMIN", permission, true), false);
    }
    assert.equal(hasOrganizationPermission("UNKNOWN" as Role, "ADMIN", permission), false);
  }
  assert.equal(
    hasOrganizationPermission("ADMIN", "ADMIN", "unknown.permission" as Permission),
    false
  );
  assert.equal(hasOrganizationPermission("OPERATOR", "ADMIN", "admin.users.manage"), false);
  assert.equal(hasOrganizationPermission("ADMIN", "OPERATOR", "admin.users.manage"), false);
  assert.equal(hasOrganizationPermission("ADMIN", "VIEWER", "projects.read"), true);
});

test("non-admin financial writes require explicit membership authorization", () => {
  for (const permission of ["payments.create", "payments.update"] as const) {
    assert.equal(hasOrganizationPermission("OPERATOR", "OPERATOR", permission), false);
    assert.equal(hasOrganizationPermission("OPERATOR", "OPERATOR", permission, true), true);
    assert.equal(hasOrganizationPermission("ADMIN", "OPERATOR", permission), false);
  }
  assert.equal(hasOrganizationPermission("OPERATOR", "OPERATOR", "payments.delete", true), false);
  assert.equal(hasOrganizationPermission("OPERATOR", "OPERATOR", "payments.read"), true);
});

test("division checks reject unassigned IDs and malformed IDs without bigint coercion", () => {
  const context: OrganizationContext = {
    organization: { id: "1", slug: "sarathi", name: "Sarathi" },
    membershipId: "1",
    role: "OPERATOR",
    permissions: ["projects.read"],
    divisions: [{ id: "9007199254740993", slug: "smart-solutions", name: "Smart Solutions" }]
  };
  assert.doesNotThrow(() => assertDivisionAccess(context, "9007199254740993"));
  assert.throws(() => assertDivisionAccess(context, "2"), AccessDeniedError);
  for (const id of ["", "1 OR 1=1", "01", "-1", "1.5"])
    assert.throws(() => assertDivisionAccess(context, id), InputError);
});
