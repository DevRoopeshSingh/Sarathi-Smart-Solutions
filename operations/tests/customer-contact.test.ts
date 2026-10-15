import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  normalizeCustomerPhone,
  validCustomerPhone,
  customerSearch
} from "../src/lib/customer-contact";
import { validateCustomer } from "../src/server/input";
import { validateCustomerSubmission } from "../src/server/customer-mutations";
import { hasPermission } from "../src/server/permissions";
test("customer phones canonicalize Indian mobile variants and preserve landline/international codes", () => {
  for (const phone of ["9820098200", "+91 98200-98200", "0091 9820098200", "09820098200"])
    assert.equal(normalizeCustomerPhone(phone), "9820098200");
  for (const [phone, result] of [
    ["022-12345678", "02212345678"],
    ["+44 (20) 1234 5678", "442012345678"],
    ["+91 22 12345678", "912212345678"]
  ]) {
    assert.equal(normalizeCustomerPhone(phone), result);
    assert.equal(validCustomerPhone(phone), true);
  }
  assert.equal(customerSearch("+91 98200 98200"), "9820098200");
  assert.equal(customerSearch("ग्राहक"), "ग्राहक");
});
test("customer contact validation rejects malformed phones/emails and keeps optional fields empty", () => {
  for (const phone of [
    "",
    "123",
    "abc9820098200",
    "9820098200 ext 1",
    "++91 9820098200",
    "9".repeat(16)
  ])
    assert.throws(() => validateCustomer({ name: "Customer", phone }));
  assert.deepEqual(
    validateCustomer({ name: " Customer ", phone: "9820098200", email: " ", address: " " }),
    { name: "Customer", phone: "9820098200", email: null, address: null }
  );
  assert.throws(() =>
    validateCustomer({ name: "Customer", phone: "9820098200", email: "invalid" })
  );
});
test("submission references require UUID v4 and explicit boolean duplicate confirmation", () => {
  assert.equal(
    validateCustomerSubmission({ requestId: randomUUID(), confirmDuplicates: false })
      .confirmDuplicates,
    false
  );
  for (const value of [
    undefined,
    {},
    { requestId: "1", confirmDuplicates: false },
    { requestId: randomUUID(), confirmDuplicates: "true" }
  ])
    assert.throws(() => validateCustomerSubmission(value as never));
});
test("operators can edit customers but viewers cannot create or edit them", () => {
  assert.equal(hasPermission("OPERATOR", "customers.update"), true);
  for (const permission of ["customers.create", "customers.update"] as const)
    assert.equal(hasPermission("VIEWER", permission), false);
});
