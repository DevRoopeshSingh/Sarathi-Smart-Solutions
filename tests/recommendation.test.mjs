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

test("home, business and housing society each expose three valid size options", () => {
  const expectedValues = ["Compact", "Standard", "Large"];
  for (const space of ["Home", "Business", "Society"]) {
    assert.deepEqual(
      SIZE_OPTIONS[space].map((opt) => opt.value),
      expectedValues
    );
  }
  assert.match(SIZE_OPTIONS.Society[0].description, /building \/ shared entry/);
  assert.match(SIZE_OPTIONS.Society[1].description, /shared parking/);
  assert.match(SIZE_OPTIONS.Society[2].description, /multiple shared zones/);
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

test("a one-camera repair request recommends diagnostics instead of a new camera layout", () => {
  const result = buildRecommendation({
    space: "Home",
    needs: ["cctv"],
    size: "Standard",
    enquiryOptions: { cctv: { work: "Repair / troubleshooting", quantity: "1" } }
  });
  assert.equal(result.title, "CCTV Repair Assessment");
  assert.match(result.items[0].detail, /Diagnose faults affecting 1 camera,/);
  assert.doesNotMatch(result.items[0].detail, /4–6|starting layout|₹/);
  assert.equal(result.items[1].title, "Assessment, service & handover");
  assert.match(result.summary, /CCTV Repair Assessment/);
});

test("a twelve-camera installation overrides compact defaults and requires a tailored quotation", () => {
  const result = buildRecommendation({
    space: "Home",
    needs: ["cctv"],
    size: "Compact",
    enquiryOptions: { cctv: { work: "New installation", quantity: 12 } }
  });
  assert.match(result.items[0].detail, /new installation for 12 cameras/);
  assert.match(result.items[0].detail, /site survey and a tailored quotation/);
  assert.doesNotMatch(result.items[0].detail, /2–3|₹/);
});

test("CCTV maintenance and upgrades review the existing system before quoting", () => {
  for (const [work, title, guidance] of [
    ["Maintenance / AMC", "CCTV Maintenance Plan", /Inspect and maintain 8 cameras/],
    ["Upgrade existing cameras", "CCTV Upgrade Assessment", /Assess 8 cameras for an upgrade/]
  ]) {
    const result = buildRecommendation({
      space: "Business",
      needs: ["cctv"],
      size: "Large",
      enquiryOptions: { cctv: { work, quantity: "8" } }
    });
    assert.equal(result.title, title);
    assert.match(result.items[0].detail, guidance);
    assert.doesNotMatch(result.items[0].detail, /starting layout|new installation|₹/);
    assert.equal(result.items[1].title, "Assessment, service & handover");
  }
});

test("known installation counts use matching starting prices with qualifications", () => {
  for (const [quantity, price] of [
    [2, "13,900"],
    [3, "15,900"],
    [4, "17,900"],
    [8, "30,900"]
  ]) {
    const result = buildRecommendation({
      space: "Home",
      needs: ["cctv"],
      size: "Compact",
      enquiryOptions: { cctv: { work: "New installation", quantity } }
    });
    assert.ok(result.items[0].detail.includes(`${quantity}-camera package starts at ₹${price}`));
    assert.match(result.items[0].detail, /GST and site extras additional/);
    assert.match(result.items[0].detail, /site survey/);
  }
});

test("unspecified work and unpublished counts avoid assuming an installation price", () => {
  for (const values of [
    { quantity: 4 },
    { work: "New installation", quantity: 1 },
    { work: "New installation", quantity: 999 }
  ]) {
    const result = buildRecommendation({
      space: "Home",
      needs: ["cctv"],
      size: "Standard",
      enquiryOptions: { cctv: values }
    });
    assert.ok(result.items[0].detail.includes(`${values.quantity} camera`));
    assert.doesNotMatch(result.items[0].detail, /4–6|₹/);
    if (!values.work) {
      assert.equal(result.title, "CCTV Site Assessment");
      assert.equal(result.items[1].title, "Assessment, service & handover");
    }
  }
});

test("housing societies get a shared-area assessment without assumed camera quantities or prices", () => {
  for (const size of ["Compact", "Standard", "Large"]) {
    const result = buildRecommendation({ space: "Society", needs: ["cctv"], size });
    assert.equal(result.title, "Housing Society Assessment");
    assert.match(result.items[0].detail, /shared entrances, parking and common areas/);
    assert.match(result.items[0].detail, /society permissions/);
    assert.doesNotMatch(result.items[0].detail, /starting layout|₹/);
    assert.match(result.summary, /Space: Society/);
  }
  const counted = buildRecommendation({
    space: "Society",
    needs: ["cctv"],
    size: "Compact",
    enquiryOptions: { cctv: { work: "New installation", quantity: 12 } }
  });
  assert.match(counted.items[0].detail, /requested 12 cameras/);
  assert.doesNotMatch(counted.items[0].detail, /₹/);
  const amc = buildRecommendation({ space: "Society", needs: ["amc"], size: "Compact" });
  assert.match(amc.items[0].detail, /Housing society CCTV health assessment/);
  assert.doesNotMatch(amc.items[0].detail, /home CCTV/);
});

test("smart lock enquiries describe an enquiry instead of a confirmed demo booking", () => {
  assert.equal(SERVICE_CATALOGUE.locks.ctaLabel, "Enquire about smart locks →");
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
  const spaces = ["Home", "Business", "Society"];
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
    null,
    [],
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
  for (const enquiryOptions of [null, [], "invalid"]) {
    assert.throws(
      () => buildRecommendation({ ...base, enquiryOptions }),
      /Invalid enquiry options/
    );
  }
  for (const key of ["constructor", "toString", "__proto__", ""]) {
    assert.throws(() => buildRecommendation({ ...base, needs: [key] }), /Unknown need/);
  }
});

test("CCTV guidance rejects invalid options rather than generating misleading output", () => {
  const base = { space: "Home", needs: ["cctv"], size: "Compact" };
  for (const values of [
    null,
    [],
    { quantity: 0 },
    { quantity: "1.5" },
    { quantity: 1000 },
    { work: "Unknown job" },
    { quantity: {} }
  ]) {
    assert.throws(() => buildRecommendation({ ...base, enquiryOptions: { cctv: values } }));
  }
  for (const space of [["Home"], "constructor", "__proto__"]) {
    assert.throws(() => buildRecommendation({ ...base, space }), /Choose a valid space/);
  }
});

test("CCTV guidance uses only validated own enquiry answers", () => {
  const base = { space: "Home", needs: ["cctv"], size: "Compact" };
  const inherited = { work: "Repair / troubleshooting", quantity: 1000 };
  for (const enquiryOptions of [
    Object.create({ cctv: inherited }),
    { cctv: Object.create(inherited) }
  ]) {
    const result = buildRecommendation({ ...base, enquiryOptions });
    assert.equal(result.title, "Secure Start Bundle");
    assert.match(result.items[0].detail, /2–3 camera/);
    assert.doesNotMatch(result.items[0].detail, /1000|Repair \/ troubleshooting/);
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
