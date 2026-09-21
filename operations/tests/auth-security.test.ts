import test from "node:test";
import assert from "node:assert/strict";
import { readServerEnvironment } from "../src/server/env";
import { readBoundedJson, rejectUnsafeMutation, RequestBodyError } from "../src/server/http";

const valid = {
  DATABASE_URL: "postgresql://local@localhost/sarathi",
  BETTER_AUTH_URL: "https://operations.example.test",
  BETTER_AUTH_SECRET: "test-only-secret-with-more-than-32-characters",
  NODE_ENV: "production" as const
};

test("environment requires explicit credentials, origin and production HTTPS", () => {
  assert.equal(readServerEnvironment(valid).secureCookies, true);
  for (const patch of [
    { DATABASE_URL: "" },
    { DATABASE_URL: "https://example.test/db" },
    { BETTER_AUTH_SECRET: "short" },
    { BETTER_AUTH_URL: "http://localhost:3000" },
    { BETTER_AUTH_URL: "https://ops.example.test/path" },
    { BETTER_AUTH_URL: "https://user:password@ops.example.test" },
    { BETTER_AUTH_URL: "https://ops.example.test?query=1" }
  ])
    assert.throws(() => readServerEnvironment({ ...valid, ...patch }));
  assert.equal(
    readServerEnvironment({
      ...valid,
      NODE_ENV: "development",
      BETTER_AUTH_URL: "http://127.0.0.1:3000"
    }).secureCookies,
    false
  );
  assert.throws(() =>
    readServerEnvironment({
      ...valid,
      NODE_ENV: "development",
      BETTER_AUTH_URL: "http://example.test"
    })
  );
});

test("optional public website link rejects executable URLs, credentials and remote HTTP", () => {
  for (const value of [
    "javascript:alert(1)",
    "https://user:pass@example.test",
    "http://example.test",
    "//example.test"
  ]) {
    assert.throws(() => readServerEnvironment({ ...valid, PUBLIC_SITE_URL: value }));
  }
  assert.equal(
    readServerEnvironment({ ...valid, PUBLIC_SITE_URL: "https://sarathi.example/contact" })
      .publicSiteUrl,
    "https://sarathi.example/contact"
  );
});

test("mutations require exact origin, same-origin fetch metadata and JSON", () => {
  const previous = { ...process.env };
  Object.assign(process.env, valid);
  try {
    const make = (headers: Record<string, string>) =>
      new Request("https://operations.example.test/api/admin/revoke-sessions", {
        method: "POST",
        headers
      });
    const headers = { origin: valid.BETTER_AUTH_URL, "content-type": "application/json" };
    assert.equal(rejectUnsafeMutation(make(headers)), null);
    assert.equal(rejectUnsafeMutation(make({ ...headers, "sec-fetch-site": "same-origin" })), null);
    assert.equal(
      rejectUnsafeMutation(make({ ...headers, origin: "https://attacker.test" }))?.status,
      403
    );
    assert.equal(rejectUnsafeMutation(make({ ...headers, origin: "null" }))?.status, 403);
    assert.equal(rejectUnsafeMutation(make({ "content-type": "application/json" }))?.status, 403);
    assert.equal(
      rejectUnsafeMutation(make({ ...headers, "sec-fetch-site": "same-site" }))?.status,
      403
    );
    assert.equal(
      rejectUnsafeMutation(make({ ...headers, "sec-fetch-site": "cross-site" }))?.status,
      403
    );
    assert.equal(
      rejectUnsafeMutation(make({ ...headers, "content-type": "text/plain" }))?.status,
      415
    );
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
  }
});

test("JSON body bound measures streamed UTF-8 bytes and cancels oversize bodies", async () => {
  const request = (body: string) =>
    new Request("https://operations.example.test", { method: "POST", body });
  assert.deepEqual(await readBoundedJson(request('{"email":"owner@example.test"}')), {
    email: "owner@example.test"
  });
  await assert.rejects(readBoundedJson(request("{")), RequestBodyError);
  await assert.rejects(
    readBoundedJson(request(JSON.stringify({ value: "é".repeat(2100) }))),
    RequestBodyError
  );
  let cancelled = false;
  let pulls = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulls++;
      controller.enqueue(new Uint8Array(2048));
    },
    cancel() {
      cancelled = true;
    }
  });
  const streamed = new Request("https://operations.example.test", {
    method: "POST",
    body: stream,
    duplex: "half"
  } as RequestInit);
  await assert.rejects(readBoundedJson(streamed), RequestBodyError);
  assert.equal(cancelled, true);
  assert.ok(pulls <= 4);
});
