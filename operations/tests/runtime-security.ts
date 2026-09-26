import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { after, beforeEach, test } from "node:test";
import pg from "pg";
import { fixtureTotp } from "./totp-fixture.mjs";

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
  for (const path of ["/admin/login", "/api/admin/me"]) {
    const response = await fetch(`${origin}${path}`);
    assert.equal(response.headers.get("x-frame-options"), "DENY");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  }
  for (const path of [
    "/admin/leads",
    "/admin/customers",
    "/admin/projects",
    "/admin/payments",
    "/admin/quotes"
  ]) {
    const response = await fetch(`${origin}${path}`, { redirect: "manual" });
    assert.ok([302, 303, 307].includes(response.status), path);
  }
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

function mergeCookies(...sets: string[]) {
  const jar = new Map<string, string>();
  for (const set of sets)
    for (const part of set.split("; ").filter(Boolean)) {
      const split = part.indexOf("=");
      jar.set(part.slice(0, split), part.slice(split + 1));
    }
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}

test("optional MFA requires a verified factor, hides tokens and consumes recovery codes once", async () => {
  const initial = await session();
  assert.equal((await send("/api/admin/security", { action: "enable", password })).status, 401);
  assert.equal(
    (
      await send(
        "/api/admin/security",
        { action: "enable", password },
        { Cookie: initial, Origin: "https://attacker.example" }
      )
    ).status,
    403
  );
  const enabled = await send(
    "/api/admin/security",
    { action: "enable", password },
    { Cookie: initial }
  );
  assert.equal(enabled.status, 200);
  const setup = await enabled.json();
  assert.deepEqual(Object.keys(setup).sort(), ["backupCodes", "totpURI"]);
  assert.ok(setup.backupCodes.length >= 2);
  const enrollment = await send(
    "/api/auth/two-factor/verify-totp",
    { code: fixtureTotp(setup.totpURI) },
    { Cookie: mergeCookies(initial, cookies(enabled)) }
  );
  assert.equal(enrollment.status, 200);
  let current = mergeCookies(initial, cookies(enrollment));
  await send("/api/auth/sign-out", {}, { Cookie: current });
  const challenge = await login();
  assert.equal(challenge.status, 200);
  assert.deepEqual(await challenge.json(), { twoFactorRequired: true });
  const pending = cookies(challenge);
  assert.equal((await me(pending)).status, 401, "Password-only challenge is not an admin session");
  const code = fixtureTotp(setup.totpURI);
  const wrong = String((Number(code) + 1) % 1000000).padStart(6, "0");
  assert.equal(
    (await send("/api/auth/two-factor/verify-totp", { code: wrong }, { Cookie: pending })).status,
    401
  );
  const verified = await send("/api/auth/two-factor/verify-totp", { code }, { Cookie: pending });
  assert.equal(verified.status, 200);
  assert.deepEqual(await verified.json(), { ok: true });
  current = cookies(verified);
  assert.equal((await me(current)).status, 200);
  const revokedChallenge = await login();
  assert.deepEqual(await revokedChallenge.json(), { twoFactorRequired: true });
  assert.equal((await send("/api/admin/revoke-sessions", {}, { Cookie: current })).status, 200);
  assert.equal((await me(current)).status, 401);
  // Isolate revocation semantics from the plugin's three-verifications/10s quota.
  await client.query("DELETE FROM sarathi.auth_ratelimits");
  assert.equal(
    (
      await send(
        "/api/auth/two-factor/verify-totp",
        { code: fixtureTotp(setup.totpURI) },
        { Cookie: cookies(revokedChallenge) }
      )
    ).status,
    401
  );
  const backupChallenge = await login();
  const backup = await send(
    "/api/auth/two-factor/verify-backup-code",
    { code: setup.backupCodes[0] },
    { Cookie: cookies(backupChallenge) }
  );
  assert.equal(backup.status, 200);
  current = cookies(backup);
  assert.equal((await me(current)).status, 200);
  await send("/api/auth/sign-out", {}, { Cookie: current });
  const retry = await login();
  assert.equal(
    (
      await send(
        "/api/auth/two-factor/verify-backup-code",
        { code: setup.backupCodes[0] },
        { Cookie: cookies(retry) }
      )
    ).status,
    401
  );
  const fresh = await send(
    "/api/auth/two-factor/verify-backup-code",
    { code: setup.backupCodes[1] },
    { Cookie: cookies(retry) }
  );
  assert.equal(fresh.status, 200);
  const disabled = await send(
    "/api/admin/security",
    { action: "disable", password },
    { Cookie: cookies(fresh) }
  );
  assert.equal(disabled.status, 200);
  assert.equal(
    (
      await client.query(
        "SELECT two_factor_enabled FROM sarathi.auth_users WHERE email='admin@example.test'"
      )
    ).rows[0].two_factor_enabled,
    false
  );
});

test("owner recovery resets only an existing active admin and revokes sessions/challenges", async () => {
  const email = "provisioned@example.test";
  const before = await login(email);
  assert.equal(before.status, 200);
  const identity = (await client.query("SELECT id FROM sarathi.auth_users WHERE email=$1", [email]))
    .rows[0].id;
  await client.query(
    "INSERT INTO sarathi.auth_verifications(id,identifier,value,expires_at) VALUES ('recovery-fixture','2fa-recovery-fixture',$1,now()+interval '5 minutes')",
    [identity]
  );
  const replacement = randomBytes(32).toString("base64url");
  const recovered = spawnSync(
    process.execPath,
    ["--conditions=react-server", "--import", "tsx", "scripts/recover-admin.ts"],
    {
      env: { ...process.env, SARATHI_ADMIN_EMAIL: email, SARATHI_RESET_MFA: "1" },
      input: `${replacement}\n`,
      encoding: "utf8",
      timeout: 15000
    }
  );
  assert.equal(recovered.status, 0, recovered.stderr);
  assert.equal((await me(cookies(before))).status, 401);
  assert.equal(
    (await client.query("SELECT 1 FROM sarathi.auth_verifications WHERE value=$1", [identity]))
      .rowCount,
    0
  );
  assert.equal((await login(email, password)).status, 401);
  assert.equal((await login(email, replacement)).status, 200);
});
