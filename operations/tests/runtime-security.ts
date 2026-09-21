import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { after, beforeEach, test } from "node:test";
import pg from "pg";

if (process.env.OPERATIONS_TEST_ISOLATED !== "1")
  throw new Error("Use the isolated runtime harness.");
const origin = process.env.OPERATIONS_TEST_URL!;
const password = process.env.OPERATIONS_TEST_PASSWORD!;
const client = new pg.Client({ connectionString: process.env.DATABASE_MIGRATION_URL });
await client.connect();
after(() => client.end());
beforeEach(() => client.query("DELETE FROM sarathi.auth_ratelimits"));
const send = (path: string, body: object = {}, extra: Record<string, string> = {}) =>
  fetch(`${origin}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin, ...extra },
    body: JSON.stringify(body),
    redirect: "manual"
  });
const login = (
  email = "admin@example.test",
  suppliedPassword = password,
  extra: Record<string, string> = {}
) => send("/api/auth/sign-in/email", { email, password: suppliedPassword }, extra);
function cookies(response: Response) {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}
const me = (cookie: string) => fetch(`${origin}/api/admin/me`, { headers: { Cookie: cookie } });
async function session() {
  const response = await login();
  assert.equal(response.status, 200);
  return cookies(response);
}

test("anonymous private routes reject access and auth route allowlist closes registration", async () => {
  const page = await fetch(`${origin}/admin`, { redirect: "manual" });
  assert.ok([307, 303, 302].includes(page.status));
  assert.match(page.headers.get("location")!, /\/login/);
  assert.equal((await me("")).status, 401);
  assert.equal((await send("/api/admin/revoke-sessions")).status, 401);
  for (const path of ["sign-up/email", "reset-password", "update-user", "get-session"]) {
    assert.equal((await send(`/api/auth/${path}`)).status, 404);
    assert.equal((await fetch(`${origin}/api/auth/${path}`)).status, 404);
  }
});

test("sign-in mutations require exact origin, JSON and same-origin fetch metadata", async () => {
  assert.equal(
    (await login("admin@example.test", password, { Origin: "https://attacker.example" })).status,
    403
  );
  assert.equal((await login("admin@example.test", password, { Origin: "" })).status, 403);
  assert.equal(
    (await login("admin@example.test", password, { "Sec-Fetch-Site": "cross-site" })).status,
    403
  );
  const form = await fetch(`${origin}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/x-www-form-urlencoded" },
    body: "email=admin"
  });
  assert.equal(form.status, 415);
});

test("wrong credentials, technicians, inactive and unmapped identities cannot create admin sessions", async () => {
  for (const email of [
    "admin@example.test",
    "missing@example.test",
    "technician@example.test",
    "inactive@example.test",
    "unmapped@example.test"
  ]) {
    const response = await login(
      email,
      email === "admin@example.test" ? "wrong-password-value" : password
    );
    assert.equal(response.status, 401, email);
    assert.deepEqual(await response.json(), { error: "Invalid email or password." });
    assert.equal(cookies(response), "");
  }
});

test("valid login sets secure HTTP-only cookies, safe actor DTO and private no-store responses", async () => {
  const response = await login();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.clone().json(), { ok: true });
  const cookieHeaders = response.headers.getSetCookie();
  assert.ok(
    cookieHeaders.some(
      (cookie) =>
        /session_token/.test(cookie) &&
        /HttpOnly/i.test(cookie) &&
        /Secure/i.test(cookie) &&
        /SameSite=Lax/i.test(cookie)
    )
  );
  const cookie = cookies(response);
  const actor = await me(cookie);
  assert.equal(actor.status, 200);
  assert.match(actor.headers.get("cache-control")!, /no-store/);
  const body = await actor.json();
  assert.deepEqual(Object.keys(body), ["actor"]);
  assert.deepEqual(Object.keys(body.actor).sort(), ["displayName", "email", "id"]);
  assert.equal(body.actor.email, "admin@example.test");
  const page = await fetch(`${origin}/admin`, { headers: { Cookie: cookie } });
  assert.equal(page.status, 200);
  assert.doesNotMatch(
    await page.text(),
    /password_hash|auth_accounts|purchase_cost|unit_cost|DATABASE_URL|BETTER_AUTH_SECRET/
  );
  for (const path of [
    "/src/server/auth.ts",
    "/database/migrations/001_commercial_foundation.sql",
    "/.env",
    "/api/admin/costings"
  ]) {
    assert.equal((await fetch(`${origin}${path}`)).status, 404, path);
  }
});

test("authenticated mutations reject cross-origin logout and revocation", async () => {
  const cookie = await session();
  for (const path of ["/api/auth/sign-out", "/api/admin/revoke-sessions"]) {
    assert.equal(
      (await send(path, {}, { Cookie: cookie, Origin: "https://attacker.example" })).status,
      403
    );
    assert.equal((await me(cookie)).status, 200);
  }
});

test("role changes and deactivation invalidate admin access on existing sessions", async () => {
  const cookie = await session();
  try {
    await client.query(
      "UPDATE sarathi.users SET role = 'TECHNICIAN' WHERE identity_subject = (SELECT id FROM sarathi.auth_users WHERE email = 'admin@example.test')"
    );
    assert.equal((await me(cookie)).status, 401);
    await client.query(
      "UPDATE sarathi.users SET role = 'ADMIN', active = false WHERE identity_subject = (SELECT id FROM sarathi.auth_users WHERE email = 'admin@example.test')"
    );
    assert.equal((await me(cookie)).status, 401);
  } finally {
    await client.query(
      "UPDATE sarathi.users SET role = 'ADMIN', active = true WHERE identity_subject = (SELECT id FROM sarathi.auth_users WHERE email = 'admin@example.test')"
    );
  }
});

test("durable session expiry, logout and revoke-all invalidate copied cookies", async () => {
  const expired = await session();
  await client.query("UPDATE sarathi.auth_sessions SET expires_at = now() - interval '1 minute'");
  assert.equal((await me(expired)).status, 401);
  const loggedOut = await session();
  assert.equal((await send("/api/auth/sign-out", {}, { Cookie: loggedOut })).status, 200);
  assert.equal((await me(loggedOut)).status, 401);
  const first = await session();
  const second = await session();
  assert.equal((await send("/api/admin/revoke-sessions", {}, { Cookie: second })).status, 200);
  assert.equal((await me(first)).status, 401);
  assert.equal((await me(second)).status, 401);
});

test("durable per-account throttling cannot be bypassed with forged forwarding headers", async () => {
  for (let index = 0; index < 5; index++) {
    assert.equal(
      (
        await login("blocked@example.test", "wrong-password-value", {
          "X-Forwarded-For": `192.0.2.${index + 1}`,
          "X-Real-IP": `192.0.2.${index + 1}`
        })
      ).status,
      401
    );
  }
  const blocked = await login("blocked@example.test", password, {
    "X-Forwarded-For": "198.51.100.1"
  });
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get("retry-after")) > 0);
  const persisted = await client.query(
    "SELECT key, count FROM sarathi.auth_ratelimits WHERE count >= 6"
  );
  assert.ok(persisted.rowCount! > 0);
  for (const row of persisted.rows) assert.match(row.key, /^[a-f0-9]{64}$/);
});

test("runtime role cannot own schema, mutate commercial records or read purchase costs", async () => {
  const runtime = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await runtime.connect();
  try {
    const role = await runtime.query(
      "SELECT rolsuper, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname = current_user"
    );
    assert.deepEqual(role.rows[0], { rolsuper: false, rolcreatedb: false, rolcreaterole: false });
    for (const sql of [
      "CREATE TABLE sarathi.must_not_exist(id int)",
      "SELECT * FROM sarathi.bom_items",
      "SELECT * FROM sarathi.project_costings",
      "DELETE FROM sarathi.users",
      "TRUNCATE sarathi.auth_sessions"
    ]) {
      await assert.rejects(
        runtime.query(sql),
        (error: unknown) => (error as { code?: string }).code === "42501"
      );
    }
  } finally {
    await runtime.end();
  }
});

test("owner provisioning creates a usable administrator and refuses silent credential replacement", async () => {
  const email = "provisioned@example.test";
  const provision = (candidatePassword: string) =>
    spawnSync(
      process.execPath,
      ["--conditions=react-server", "--import", "tsx", "scripts/provision-admin.ts"],
      {
        env: {
          ...process.env,
          SARATHI_ADMIN_EMAIL: email,
          SARATHI_ADMIN_NAME: "Provisioned administrator"
        },
        input: `${candidatePassword}\n`,
        encoding: "utf8",
        timeout: 15000
      }
    );
  const first = provision(password);
  assert.equal(first.status, 0, "Initial owner provisioning must succeed.");
  assert.equal((await login(email)).status, 200);
  const snapshot = () =>
    client.query(
      "SELECT account.password, actor.role, actor.active FROM sarathi.auth_accounts account JOIN sarathi.auth_users identity ON identity.id = account.user_id JOIN sarathi.users actor ON actor.identity_subject = identity.id WHERE identity.email = $1",
      [email]
    );
  const before = (await snapshot()).rows[0];
  const duplicate = provision(randomBytes(32).toString("base64url"));
  assert.equal(duplicate.status, 1, "Duplicate provisioning must fail.");
  assert.match(duplicate.stderr, /already exists/);
  const after = (await snapshot()).rows[0];
  assert.ok(
    before.password === after.password,
    "Duplicate provisioning must preserve the credential hash."
  );
  assert.equal(after.role, "ADMIN");
  assert.equal(after.active, true);
  assert.equal((await login(email)).status, 200);
});
