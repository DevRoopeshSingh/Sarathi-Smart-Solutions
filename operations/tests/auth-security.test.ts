import test from "node:test";
import assert from "node:assert/strict";
import { readServerEnvironment } from "../src/server/env";
import { readBoundedJson, rejectUnsafeMutation, RequestBodyError } from "../src/server/http";
import { getClientIp, authRequestHeaders } from "../src/server/client-ip";

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

test("runtime database pools are small and explicitly bounded", () => {
  assert.equal(readServerEnvironment(valid).databasePoolMax, 2);
  assert.equal(readServerEnvironment({ ...valid, DB_POOL_MAX: "5" }).databasePoolMax, 5);
  for (const value of ["", "0", "11", "2.5", "-1", "NaN", "2junk", "Infinity"]) {
    assert.throws(() => readServerEnvironment({ ...valid, DB_POOL_MAX: value }));
  }
});

test("Vercel client IP accepts only its trusted header and normalizes IPv6", () => {
  const request = (ip?: string) =>
    new Request("https://operations.example.test", {
      headers: {
        "x-forwarded-for": "192.0.2.99",
        "x-real-ip": "192.0.2.98",
        "x-sarathi-auth-client-ip": "192.0.2.97",
        ...(ip === undefined ? {} : { "x-vercel-forwarded-for": ip })
      }
    });
  const source = { ...valid, VERCEL: "1" };
  assert.equal(getClientIp(request("192.0.2.1"), source), "192.0.2.1");
  assert.notEqual(
    getClientIp(request("192.0.2.1"), source),
    getClientIp(request("192.0.2.2"), source)
  );
  assert.equal(
    getClientIp(request("2001:0DB8:0000:0000:0000:0000:0000:0001"), source),
    "2001:db8::1"
  );
  for (const ip of [
    undefined,
    "",
    "unknown",
    "192.0.2.1, 192.0.2.2",
    "192.0.2.1:1234",
    "[2001:db8::1]"
  ]) {
    assert.throws(() => getClientIp(request(ip), source));
  }
});

test("loopback fallback uses configured origin, never caller Host or forwarding headers", () => {
  const request = new Request("https://localhost/api/auth/sign-in/email", {
    headers: {
      host: "localhost",
      "x-forwarded-host": "localhost",
      "x-vercel-forwarded-for": "192.0.2.1"
    }
  });
  assert.throws(() => getClientIp(request, valid));
  assert.equal(
    getClientIp(request, { ...valid, BETTER_AUTH_URL: "https://127.0.0.1:3000" }),
    "127.0.0.1"
  );
  assert.throws(() =>
    getClientIp(new Request("https://localhost"), {
      ...valid,
      VERCEL: "1",
      BETTER_AUTH_URL: "https://localhost"
    })
  );
});

test("auth forwarding replaces injected internal IP and removes other address headers", () => {
  const supplied = new Headers({
    "x-sarathi-auth-client-ip": "192.0.2.99",
    "x-forwarded-for": "192.0.2.98",
    "x-vercel-forwarded-for": "192.0.2.97",
    "x-real-ip": "192.0.2.96",
    forwarded: "for=192.0.2.95",
    "content-length": "999",
    cookie: "session=test",
    origin: valid.BETTER_AUTH_URL
  });
  const forwarded = authRequestHeaders(supplied, "192.0.2.1");
  assert.equal(forwarded.get("x-sarathi-auth-client-ip"), "192.0.2.1");
  for (const name of [
    "x-forwarded-for",
    "x-vercel-forwarded-for",
    "x-real-ip",
    "forwarded",
    "content-length"
  ]) {
    assert.equal(forwarded.has(name), false);
  }
  assert.equal(forwarded.get("cookie"), "session=test");
  assert.equal(forwarded.get("origin"), valid.BETTER_AUTH_URL);
  assert.equal(supplied.get("x-sarathi-auth-client-ip"), "192.0.2.99");
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
