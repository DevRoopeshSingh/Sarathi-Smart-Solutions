import test from "node:test";
import assert from "node:assert/strict";
import { buildRecommendation, SIZE_OPTIONS } from "../recommendation.mjs";

test("home and business each expose three size options", () => {
  assert.equal(SIZE_OPTIONS.Home.length, 3);
  assert.equal(SIZE_OPTIONS.Business.length, 3);
});

test("a compact CCTV request produces a Secure Start bundle", () => {
  const result = buildRecommendation({ space: "Home", needs: ["cctv"], size: "Compact" });
  assert.equal(result.title, "Secure Start Bundle");
  assert.match(result.items[0].detail, /2–3 camera/);
  assert.match(result.summary, /Space: Home/);
});

test("a combined standard request produces a coordinated bundle", () => {
  const result = buildRecommendation({ space: "Business", needs: ["cctv", "network", "biometric"], size: "Standard" });
  assert.equal(result.title, "Connected Control Bundle");
  assert.equal(result.items.length, 4);
  assert.match(result.summary, /Biometric attendance/);
});

test("a large multi-service request produces Smart Site 360", () => {
  const result = buildRecommendation({ space: "Business", needs: ["cctv", "network", "biometric", "intercom"], size: "Large" });
  assert.equal(result.title, "Smart Site 360 Bundle");
});

test("incomplete selections are rejected", () => {
  assert.throws(() => buildRecommendation({ space: "Home", needs: [], size: "Compact" }), /at least one/);
  assert.throws(() => buildRecommendation({ space: "", needs: ["cctv"], size: "Compact" }), /valid space/);
  assert.throws(() => buildRecommendation({ space: "Home", needs: ["cctv"], size: "" }), /valid size/);
});
