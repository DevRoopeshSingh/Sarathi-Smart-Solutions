import test from "node:test";
import assert from "node:assert/strict";
import { requiresProjectTransitionReason } from "../src/lib/operations";
import {
  boundedText,
  databaseId,
  formText,
  formId,
  InputError,
  leadStatus,
  projectStatus,
  validateLead,
  validateCustomer,
  validateProject,
  projectForm
} from "../src/server/input";
import { AccessDeniedError, mutationFailure } from "../src/server/mutation-errors";

test("form fields reject files, duplicates, missing values and embedded NUL", () => {
  const form = new FormData();
  assert.throws(() => formText(form, "name", "Name", 200), InputError);
  assert.equal(formText(form, "notes", "Notes", 5000, false), "");
  form.set("name", new Blob(["name"]), "name.txt");
  assert.throws(() => formText(form, "name", "Name", 200), InputError);
  form.set("name", "test");
  form.append("name", "second");
  assert.throws(() => formText(form, "name", "Name", 200), InputError);
  for (const input of ["\0", "a\0b", "a".repeat(201), "  ", 123, null]) {
    assert.throws(() => boundedText(input, "Name", 200), InputError);
  }
  assert.equal(boundedText("  ग्राहक  ", "Name", 200), "ग्राहक");
});

test("database IDs preserve full bigint precision and reject coercion", () => {
  assert.equal(databaseId("9007199254740993"), "9007199254740993");
  assert.equal(databaseId("9223372036854775807"), "9223372036854775807");
  for (const id of [
    0,
    1,
    9007199254740992,
    null,
    undefined,
    "",
    "0",
    "01",
    "-1",
    "1.2",
    "1e3",
    "+1",
    " 1",
    "1 ",
    "9223372036854775808",
    "9".repeat(20)
  ]) {
    assert.throws(() => databaseId(id), InputError);
  }
  const form = new FormData();
  assert.equal(formId(form, "leadId", "Lead", false), undefined);
  form.set("customerId", "1");
  form.append("customerId", "2");
  assert.throws(() => formId(form, "customerId", "Customer"), InputError);
  form.set("leadId", new Blob(["1"]), "lead.txt");
  assert.throws(() => formId(form, "leadId", "Lead", false), InputError);
});

test("all creation paths validate lengths, emails and service inputs", () => {
  const lead = { contactName: "Customer", phone: "+91 22 2345 6789", serviceRequested: "CCTV" };
  assert.equal(validateLead(lead).phone, lead.phone);
  assert.equal(validateLead(lead).source, "MANUAL");
  assert.throws(() => validateLead({ ...lead, notes: "a".repeat(5001) }), InputError);
  assert.throws(() => validateLead({ ...lead, phone: "9".repeat(33) }), InputError);
  const customer = { name: "Customer", phone: "022-12345678", email: "owner@example.in" };
  assert.equal(validateCustomer(customer).email, customer.email);
  for (const email of ["bad", "a @b.in", "a@@b.in", "a@b", "a".repeat(255)]) {
    assert.throws(() => validateCustomer({ ...customer, email }), InputError);
  }
  const project = { customerId: "1", name: "Office", siteAddress: "Mumbai" };
  assert.deepEqual(validateProject(project).serviceTypes, ["cctv"]);
  for (const patch of [
    { customerId: "1.1" },
    { leadId: "0" },
    { siteAddress: "a".repeat(1001) },
    { serviceTypes: [] },
    { serviceTypes: ["cctv", "cctv"] },
    { serviceTypes: ["  "] },
    { serviceTypes: ["a".repeat(81)] }
  ])
    assert.throws(() => validateProject({ ...project, ...patch }), InputError);
  const form = new FormData();
  Object.entries(project).forEach(([key, value]) => form.set(key, value));
  form.set("leadId", "9007199254740993");
  assert.equal(projectForm(form).leadId, "9007199254740993");
  form.append("leadId", "2");
  assert.throws(() => projectForm(form), InputError);
});

test("status validation and exceptional transition reasons follow policy", () => {
  assert.equal(leadStatus("NEW"), "NEW");
  assert.equal(projectStatus("TESTING"), "TESTING");
  for (const value of ["bad", "completed", null, 1, {}, ["NEW"]]) {
    assert.throws(() => leadStatus(value), InputError);
    assert.throws(() => projectStatus(value), InputError);
  }
  assert.equal(requiresProjectTransitionReason("SURVEY_PENDING", "SURVEY_COMPLETE"), false);
  assert.equal(requiresProjectTransitionReason("TESTING", "COMPLETED"), false);
  assert.equal(requiresProjectTransitionReason("COMPLETED", "COMPLETED"), false);
  for (const [from, to] of [
    ["SURVEY_PENDING", "COSTING"],
    ["COSTING", "SURVEY_COMPLETE"],
    ["COSTING", "CANCELLED"],
    ["COMPLETED", "TESTING"],
    ["CANCELLED", "SURVEY_PENDING"]
  ])
    assert.equal(requiresProjectTransitionReason(from, to), true);
});

test("only safe action failures escape; database details and customer data never log", () => {
  assert.deepEqual(mutationFailure(new InputError("Please choose a customer.")), {
    error: "Please choose a customer."
  });
  assert.deepEqual(mutationFailure(new AccessDeniedError()), {
    error: "Administrator access is required."
  });
  const original = console.error;
  const messages: string[] = [];
  console.error = (message: string) => messages.push(message);
  try {
    const result = mutationFailure(
      Object.assign(new Error("secret-db-host customer-phone"), {
        code: "23505",
        detail: "private@example.in",
        query: "SELECT sensitive FROM users"
      })
    );
    assert.match(result.error, /^Unable to save this change\. Reference: [\da-f-]{36}$/);
    assert.equal(messages.length, 1);
    const log = JSON.parse(messages[0]);
    assert.deepEqual(Object.keys(log).sort(), ["code", "event", "reference"]);
    assert.equal(log.code, "23505");
    assert.ok(result.error.includes(log.reference));
    mutationFailure({ code: "password=secret" });
    assert.equal(JSON.parse(messages[1]).code, "UNKNOWN");
    assert.doesNotMatch(messages.join(""), /secret|customer-phone|private@example|sensitive/);
  } finally {
    console.error = original;
  }
});
