import assert from "node:assert/strict";
import test from "node:test";
import { hasPermission, isRole, PERMISSIONS, ROLES } from "../src/server/permissions";

test("all configured roles have explicit and bounded permission sets", () => {
  assert.deepEqual(ROLES, ["ADMIN", "OPERATOR", "VIEWER"]);
  assert.equal(isRole("ADMIN"), true);
  assert.equal(isRole("TECHNICIAN"), false);
  assert.equal(isRole("UNKNOWN"), false);

  for (const permission of PERMISSIONS) assert.equal(hasPermission("ADMIN", permission), true);
  assert.equal(hasPermission("OPERATOR", "leads.create"), true);
  assert.equal(hasPermission("OPERATOR", "projects.update"), true);
  assert.equal(hasPermission("OPERATOR", "payments.create"), true);
  assert.equal(hasPermission("OPERATOR", "quotations.update"), true);
  assert.equal(hasPermission("OPERATOR", "projects.delete"), false);
  assert.equal(hasPermission("OPERATOR", "admin.security.manage"), false);
  assert.equal(hasPermission("OPERATOR", "admin.users.manage"), false);
  assert.equal(hasPermission("VIEWER", "dashboard.read"), true);
  assert.equal(hasPermission("VIEWER", "leads.read"), true);
  assert.equal(hasPermission("VIEWER", "quotations.read"), true);
  assert.equal(hasPermission("VIEWER", "payments.read"), false);
  assert.equal(hasPermission("VIEWER", "leads.update"), false);
});
