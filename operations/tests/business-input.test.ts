import test from "node:test";
import assert from "node:assert/strict";
import { requiresProjectTransitionReason } from "../src/lib/operations";
import {
  getProjectServiceLabel,
  isProjectService,
  PROJECT_SERVICE_OPTIONS
} from "../src/lib/project-services";
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
  form.set("serviceTypes", "cctv");
  form.set("leadId", "9007199254740993");
  assert.equal(projectForm(form).leadId, "9007199254740993");
  form.append("leadId", "2");
  assert.throws(() => projectForm(form), InputError);
});

test("project services preserve the CCTV API default and accept catalogue selections", () => {
  const project = { customerId: "1", name: "Office", siteAddress: "Mumbai" };
  assert.deepEqual(validateProject(project).serviceTypes, ["cctv"]);
  assert.deepEqual(validateProject({ ...project, serviceTypes: ["network"] }).serviceTypes, [
    "network"
  ]);
  const selected = ["biometric", "cctv", "network"];
  assert.deepEqual(validateProject({ ...project, serviceTypes: selected }).serviceTypes, selected);
  const allServices = PROJECT_SERVICE_OPTIONS.map(({ id }) => id);
  assert.deepEqual(
    validateProject({ ...project, serviceTypes: allServices }).serviceTypes,
    allServices
  );
  assert.equal(isProjectService("cctv"), true);
  assert.equal(isProjectService("it"), true);
  assert.equal(getProjectServiceLabel("cctv"), "CCTV surveillance & mobile viewing");
  assert.equal(getProjectServiceLabel("legacy-service"), "legacy-service");
  for (const id of ["__proto__", "constructor", "toString"]) {
    assert.equal(isProjectService(id), false);
    assert.equal(getProjectServiceLabel(id), id);
  }
});

test("project service validation rejects malformed, unknown and repeated selections", () => {
  const project = { customerId: "1", name: "Office", siteAddress: "Mumbai" };
  const invalidServices: unknown[] = [
    null,
    "cctv",
    { cctv: true },
    [],
    new Array(1),
    ["cctv", "cctv"],
    Array(PROJECT_SERVICE_OPTIONS.length + 1).fill("cctv"),
    ["legacy-service"],
    ["__proto__"],
    ["constructor"],
    ["toString"],
    ["hasOwnProperty"],
    ["CCTV"],
    [" cctv "],
    [""],
    ["  "],
    ["cctv\0"],
    ["a".repeat(81)],
    [123],
    [null],
    [undefined],
    [{}],
    [["cctv"]],
    [new Blob(["cctv"])],
    ["cctv", undefined]
  ];
  for (const serviceTypes of invalidServices) {
    assert.throws(
      () => validateProject({ ...project, serviceTypes: serviceTypes as string[] }),
      InputError
    );
  }
});

function validProjectForm(): FormData {
  const form = new FormData();
  form.set("customerId", "1");
  form.set("name", "Office");
  form.set("siteAddress", "Mumbai");
  return form;
}

test("project forms parse repeated checkbox values and keep text-field protections", () => {
  const form = validProjectForm();
  form.append("serviceTypes", "network");
  assert.deepEqual(projectForm(form).serviceTypes, ["network"]);
  form.append("serviceTypes", "cctv");
  assert.deepEqual(projectForm(form).serviceTypes, ["network", "cctv"]);
  assert.deepEqual(validateProject(projectForm(form)).serviceTypes, ["network", "cctv"]);
  form.append("name", "Another name");
  assert.throws(() => projectForm(form), InputError);
  form.set("name", new Blob(["Office"]), "name.txt");
  assert.throws(() => projectForm(form), InputError);
});

test("project forms require a selection and reject invalid checkbox payloads", () => {
  assert.throws(() => projectForm(validProjectForm()), /Choose between 1 and \d+ services\./);
  for (const selections of [
    [""],
    ["unknown"],
    ["__proto__"],
    ["constructor"],
    ["toString"],
    ["cctv", "cctv"],
    ["cctv", "unknown"],
    [" cctv "],
    ["cctv\0"],
    Array(PROJECT_SERVICE_OPTIONS.length + 1).fill("cctv")
  ]) {
    const form = validProjectForm();
    selections.forEach((value) => form.append("serviceTypes", value));
    assert.throws(() => projectForm(form), InputError);
  }
  const fileForm = validProjectForm();
  fileForm.append("serviceTypes", "cctv");
  fileForm.append("serviceTypes", new Blob(["network"]), "service.txt");
  assert.throws(() => projectForm(fileForm), InputError);
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
