import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRecommendation,
  formatEnquiryMessage,
  buildWhatsAppUrl,
  CONTACT_CONFIG,
  NEED_LABELS,
  SIZE_OPTIONS,
  SERVICE_CATALOGUE
} from "../recommendation.mjs";

test("home and business each expose three valid size options", () => {
  assert.equal(SIZE_OPTIONS.Home.length, 3);
  assert.equal(SIZE_OPTIONS.Business.length, 3);
  const expectedValues = ["Compact", "Standard", "Large"];
  assert.deepEqual(
    SIZE_OPTIONS.Home.map((opt) => opt.value),
    expectedValues
  );
  assert.deepEqual(
    SIZE_OPTIONS.Business.map((opt) => opt.value),
    expectedValues
  );
});

test("contact configuration exposes required company details", () => {
  assert.equal(CONTACT_CONFIG.whatsappNumber, "918369704457");
  assert.equal(CONTACT_CONFIG.phone, "+918369704457");
  assert.equal(CONTACT_CONFIG.email, "sarathismartsolutions@gmail.com");
  assert.match(CONTACT_CONFIG.address, /Bhayander East/);
  assert.match(CONTACT_CONFIG.disclaimer, /site survey/);
});

test("a compact CCTV request produces a Secure Start bundle", () => {
  const result = buildRecommendation({
    space: "Home",
    needs: ["cctv"],
    size: "Compact"
  });
  assert.equal(result.title, "Secure Start Bundle");
  assert.match(result.items[0].detail, /2–3 camera/);
  assert.match(result.summary, /Space: Home/);
  assert.match(result.summary, /Approx. size: Compact/);
  assert.match(result.summary, /Recommended starting bundle: Secure Start Bundle/);
});

test("a combined standard request produces a Connected Control bundle", () => {
  const result = buildRecommendation({
    space: "Business",
    needs: ["cctv", "network", "biometric"],
    size: "Standard"
  });
  assert.equal(result.title, "Connected Control Bundle");
  assert.equal(result.items.length, 4); // 3 chosen needs + 1 setup item
  assert.match(result.summary, /Biometric attendance/);
  assert.match(result.intro, /coordinated business solution/);
});

test("a large multi-service request produces Smart Site 360", () => {
  const result = buildRecommendation({
    space: "Business",
    needs: ["cctv", "network", "biometric", "intercom"],
    size: "Large"
  });
  assert.equal(result.title, "Smart Site 360 Bundle");
  assert.equal(result.items.length, 5);
});

test("every valid space and size permutation generates a valid recommendation", () => {
  const spaces = ["Home", "Business"];
  const sizes = ["Compact", "Standard", "Large"];
  const needsKeys = Object.keys(NEED_LABELS);

  for (const space of spaces) {
    for (const size of sizes) {
      for (const need of needsKeys) {
        const result = buildRecommendation({ space, needs: [need], size });
        assert.ok(result.title);
        assert.ok(result.intro);
        assert.ok(result.summary.includes(NEED_LABELS[need]));
        assert.ok(result.items[0].detail);
        assert.equal(result.items.length, 2);
      }
    }
  }
});

test("all planned services and their enquiry options reach the recommendation and message", () => {
  for (const need of [
    "appliance",
    "electrical",
    "cctv",
    "network",
    "it",
    "automation",
    "tv",
    "ev"
  ]) {
    assert.ok(SERVICE_CATALOGUE[need], `Missing planned service: ${need}`);
    const values = Object.fromEntries(
      SERVICE_CATALOGUE[need].fields.map((field) => [
        field.id,
        field.type === "select"
          ? field.options[0]
          : field.type === "number"
            ? "2"
            : "Model A & B <details>"
      ])
    );
    const result = buildRecommendation({
      space: "Business",
      needs: [need],
      size: "Standard",
      enquiryOptions: { [need]: values }
    });
    for (const value of Object.values(values)) {
      assert.ok(result.summary.includes(value));
      assert.ok(result.items[0].detail.includes(value));
    }
    const url = new URL(buildWhatsAppUrl(CONTACT_CONFIG.whatsappNumber, result.summary));
    assert.equal(url.searchParams.get("text"), result.summary);
    if (["appliance", "electrical", "it", "tv", "ev"].includes(need))
      assert.doesNotMatch(result.title, /Secure Start/);
  }
});

test("deselected service details never leak into enquiries and duplicate services are counted once", () => {
  const result = buildRecommendation({
    space: "Home",
    needs: ["tv", "tv"],
    size: "Compact",
    enquiryOptions: {
      appliance: { notes: "OLD AC DETAILS" },
      tv: { work: "TV wall mounting", notes: "55 inch TV" }
    }
  });
  assert.equal(result.items.length, 2);
  assert.match(result.summary, /55 inch TV/);
  assert.doesNotMatch(result.summary, /OLD AC DETAILS/);
});

test("invalid service-specific enquiry values are rejected", () => {
  const base = { space: "Home", needs: ["appliance"], size: "Compact" };
  for (const values of [
    { quantity: "0" },
    { quantity: "1.5" },
    { quantity: "1000" },
    { quantity: "NaN" },
    { work: "Unknown job" },
    { notes: "x".repeat(301) },
    { unsupported: "value" }
  ]) {
    assert.throws(() => buildRecommendation({ ...base, enquiryOptions: { appliance: values } }));
  }
  for (const key of ["constructor", "toString", "__proto__", ""]) {
    assert.throws(() => buildRecommendation({ ...base, needs: [key] }), /Unknown need/);
  }
});

test("incomplete or invalid inputs are rejected with clear errors", () => {
  assert.throws(
    () => buildRecommendation({ space: "Home", needs: [], size: "Compact" }),
    /Choose at least one need/
  );
  assert.throws(
    () => buildRecommendation({ space: "Home", needs: "not-an-array", size: "Compact" }),
    /Choose at least one need/
  );
  assert.throws(
    () => buildRecommendation({ space: "", needs: ["cctv"], size: "Compact" }),
    /Choose a valid space/
  );
  assert.throws(
    () => buildRecommendation({ space: "InvalidSpace", needs: ["cctv"], size: "Compact" }),
    /Choose a valid space/
  );
  assert.throws(
    () => buildRecommendation({ space: "Home", needs: ["cctv"], size: "" }),
    /Choose a valid size/
  );
  assert.throws(
    () => buildRecommendation({ space: "Home", needs: ["cctv"], size: "Huge" }),
    /Choose a valid size/
  );
});

test("unknown need keys throw descriptive error", () => {
  assert.throws(
    () =>
      buildRecommendation({
        space: "Home",
        needs: ["cctv", "non_existent_service"],
        size: "Compact"
      }),
    /Unknown need: non_existent_service/
  );
});

test("formatEnquiryMessage produces consistent multi-line text", () => {
  const message = formatEnquiryMessage({
    space: "Home",
    needs: ["cctv", "locks"],
    size: "Standard",
    title: "Connected Control Bundle"
  });
  assert.match(message, /^SARATHI SMART SOLUTIONS — ENQUIRY/);
  assert.match(message, /Space: Home/);
  assert.match(message, /Approx. size: Standard/);
  assert.match(message, /Needs: CCTV surveillance & mobile viewing, Smart locks/);
  assert.match(message, /Recommended starting bundle: Connected Control Bundle/);
});

test("buildWhatsAppUrl generates safe, properly formatted wa.me URLs", () => {
  const url = buildWhatsAppUrl("+91 83697 04457", "Hello from Sarathi & Co.");
  assert.equal(url, "https://wa.me/918369704457?text=Hello%20from%20Sarathi%20%26%20Co.");

  const fallbackUrl = buildWhatsAppUrl("918369704457", "");
  assert.equal(fallbackUrl, "https://wa.me/918369704457?text=");
});
