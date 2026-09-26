Sarathi Operations — engineering and security review, 25 September 2026

This is a repository review and proposed remediation package. The patches below have **not been applied to the application or a database**. Existing tests were run against the current implementation. The proposed patches need the new regression tests described below before deployment.

1. Overall assessment

- The actual application is Next.js 16.3.5, React 19.3.0, TypeScript, Better Auth 1.7.5, Drizzle 0.45.2 and `pg` 8.23.0. There is no Prisma schema or Supabase Auth integration. Supabase can host this PostgreSQL schema without replacing the current auth implementation.
- Authentication has a sound baseline: public signup is closed; sessions use secure HttpOnly cookies in production; admin access is checked at the DAL and mutation boundary; role changes take effect on subsequent requests; SQL uses parameters. No authentication bypass or critical vulnerability was established.
- The newer customer/lead/project features have outgrown the original read-only runtime permissions and test coverage. Business writes, consistency, and truthful error handling are the main release blockers.
- Schema protections for immutable quotations and append-only payments/history are useful. Application project transitions currently bypass the intended audit workflow. Quotations and payments are read-only screens; bookings, identity services and property-management flows were not found in this repository.
- This is suitable for a small admin team after the high-priority fixes. Server-side pagination and a small database pool will matter more than adding infrastructure or replacing the ORM.
- Live deployment permissions, Supabase API exposure, TLS, backups, database region and Vercel project settings remain unverified. No real database was accessed. Environment variable names were inspected without printing their values.

2. Verification performed

| Check                                      | Result                                                                                                                                                                       |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm --prefix operations test`             | 7/7 passed                                                                                                                                                                   |
| `npm --prefix operations run typecheck`    | Passed                                                                                                                                                                       |
| `npm --prefix operations run build`        | Passed; public home is static, admin/API routes dynamic                                                                                                                      |
| `npm run test:operations`                  | 10/10 isolated HTTP/auth/security checks and 2/2 desktop/mobile browser tests passed                                                                                         |
| Disposable PostgreSQL reproduction         | Runtime customer INSERT fails with SQLSTATE 42501; bigint IDs arrive as strings; a failed second conversion statement leaves the project persisted and its lead NEW/unlinked |
| `npm audit --prefix operations --omit=dev` | 0 reported production vulnerabilities at review time; not a security guarantee or a dev-dependency audit                                                                     |

The isolated runtime harness applies migrations, provisions generated test identities, checks restricted-role access, starts a production build behind temporary HTTPS, and cleans up its own PostgreSQL cluster. Sandbox shared-memory restrictions required running that local harness outside the sandbox. It never used the configured application database. Tests ran on local Node 25.9.0; CI specifies Node 22, so reproduce the release checks on the deployment's selected Node version.

The AST exploration tool could not parse the TypeScript files; source inspection used targeted reads instead. Build/type generation regenerated `operations/next-env.d.ts`; it was already modified when this review began. No handwritten application source was edited.

3. Detailed findings

Paths and line numbers below refer to the reviewed source, before applying proposed changes. “Confirmed” means established from the source or a local reproduction; it does not assert that the same configuration is deployed.

| ID / severity                                         | Location                                                                                                            | Finding and impact                                                                                                                                                                                                                                                                                                                                    | Fix                                                                                                                                                                                                                                             |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1 **High**, confirmed                                | `database/runtime-grants.sql:13`; `operations/src/server/dal.ts:199,261,314,355`                                    | The supplied runtime role has SELECT only on business tables, while the UI now creates leads/customers/projects and updates statuses. These writes fail under the documented role. Using an owner connection to make the forms work would remove an important boundary.                                                                               | Add only required INSERT and column-level UPDATE permissions. Keep identity mapping, money tables, costs and DDL protected. Verify actual writes using the restricted role. Patch A.                                                            |
| F2 **High**, confirmed                                | `operations/src/server/dal.ts:314–331`                                                                              | Lead conversion inserts a project and updates the lead using separate autocommit queries. A failed second query leaves a committed project with an unconverted lead. A retry hits the unique lead constraint. A lead already associated with another customer can also be reassigned without an explicit policy.                                      | One checked-out client and transaction; lock/validate the lead, reject conflicting customer linkage, write project and lead together. Patch B.                                                                                                  |
| F3 **High**, confirmed                                | `operations/src/app/admin/leads/leads-manager.tsx:47`; `operations/src/app/admin/projects/projects-manager.tsx:150` | Both status handlers ignore `{error}` returned by the server and update local state anyway. The current permissions failure therefore looks like a successful change until reload.                                                                                                                                                                    | Check the result before changing state, show errors outside modals, and handle transport failures. Patch C.                                                                                                                                     |
| F4 **High**, confirmed design defect; not load-tested | `operations/src/app/api/auth/[...all]/route.ts:26,83`; `operations/src/server/auth.ts:36–44`                        | All callers share 30 sign-in attempts/minute and the same synthetic IP. One caller sending requests with the allowed Origin can exhaust the global quota. Origin/Fetch Metadata checks prevent browser CSRF; non-browser callers can supply those headers. Logout also shares a global quota.                                                         | Use Vercel's platform-controlled client IP, retain account throttling, and reserve any global quota for a much higher emergency ceiling. Do not trust arbitrary forwarding headers on other platforms. Patch D.                                 |
| F5 **Medium**, confirmed                              | `operations/src/app/admin/actions.ts:31,43,64,94,107`; DAL create functions                                         | Actions return raw `Error.message`, including PostgreSQL table/constraint errors, directly to the browser. Validation mostly checks nonempty values; IDs accept floats/negative values and text has no field-specific bounds. A `File` can become `[object File]`. Authenticated callers can send malformed records or expose internals in UI output. | Controlled user-input errors, generic unexpected errors, a safe request reference and allowlisted SQLSTATE logging. Validate at the server boundary and DAL. Patch E.                                                                           |
| F6 **Medium**, confirmed                              | `operations/src/server/dal.ts:11–76`; `operations/src/app/admin/actions.ts:70,75`; migration 001 bigint columns     | `pg` returns bigint as a string, but DTOs and handlers claim IDs are numbers. The query generic does not convert or validate values. `Number()` can silently round IDs above 2^53−1. `PaymentRecord.reference` is also nullable in SQL but typed as non-null.                                                                                         | Represent IDs as decimal strings end-to-end; validate against signed bigint bounds. Correct nullable DTO fields and move shared DTOs out of server implementation files. Do not globally convert int8 to Number.                                |
| F7 **Medium**, confirmed                              | `operations/src/server/dal.ts:214,337`; `database/migrations/001_commercial_foundation.sql:263`                     | Status updates allow any enum value from any prior stage, do not write `status_history`, and report success for nonexistent IDs. Directly setting a lead to CONVERTED does not require a project. Concurrent edits overwrite each other.                                                                                                              | Define transition policy, require an expected previous status, lock the project, enforce hold/terminal-state rules, UPDATE plus INSERT history in one transaction, and require exactly one affected row. Convert leads through conversion only. |
| F8 **Medium**, confirmed                              | `operations/src/server/dal.ts:162,228,273,361,381`; projects/leads page loaders                                     | Lists load every row, then filter in the browser. Projects/leads also fetch the entire customer directory including unnecessary contacts and project counts. This increases query work, RSC payload, browser memory and PII exposure.                                                                                                                 | Server-side search/status filters, stable keyset pagination, small selector DTOs and aggregate counts separate from page rows. Add order indexes after checking query plans.                                                                    |
| F9 **Medium**, conditional deployment risk            | `operations/src/server/db.ts:11`; `operations/scripts/migrate.ts:44,58,66`; `.env.example`                          | A pool of 10 is created per app instance. Horizontal scaling can exhaust direct Postgres connections. The migration runner uses a session advisory lock and falls back to DATABASE_URL; using the transaction pooler for migrations breaks the session assumption. Runtime DB TLS is not enforced in code.                                            | Small app pool plus Supabase transaction pooling; separate owner URL using direct/session connection for migrations; verified TLS. Never run migrations through a transaction pooler.                                                           |
| F10 **Medium**, confirmed config issue                | `operations/next.config.ts:17–50`                                                                                   | The last catch-all rule overrides admin/API `X-Frame-Options: DENY` with SAMEORIGIN and `Referrer-Policy: no-referrer` with strict-origin-when-cross-origin. This weakens the stated policy; it does not permit arbitrary cross-origin framing.                                                                                                       | Put baseline rules first and private-route rules last; assert actual response headers. Add CSP separately after testing the inline theme script/fonts.                                                                                          |
| F11 **Medium**, confirmed coverage gap                | `operations/tests/browser.spec.mjs:3`; `operations/tests/runtime-security.ts:199`; `.github/workflows/ci.yml`       | The browser tests navigate empty business lists but do not create/update/convert records. The auth suite cannot detect F1–F3. Existing CI coverage is substantial but focused on the previous feature set.                                                                                                                                            | Add restricted-role business E2E, failure-path UI tests, transaction rollback/concurrency checks, malformed input and unauthorized Server Action checks.                                                                                        |
| F12 **Medium**, conditional exposure risk             | `database/migrations/001_commercial_foundation.sql`; `002_admin_authentication.sql`; Supabase deployment settings   | The custom `sarathi` schema has no RLS. That is not automatically an exploit with the current server-only, restricted-role architecture. Exposing it through Supabase's Data API with broad anon/authenticated grants would expose business/auth tables.                                                                                              | Keep `sarathi` out of exposed schemas; verify PUBLIC/anon/authenticated grants. If direct client access is added later, design RLS for that access model first. Never grant public access to auth tables.                                       |
| F13 **Medium**, conditional availability risk         | `operations/src/app/api/auth/[...all]/route.ts:18`; `operations/src/server/env.ts:13`; `operations/README.md`       | Required env configuration is validated at request time; wrong origin/credentials can break login after a successful build. Some validation occurs outside the route catch. Deployment docs are stale and omit a concrete Vercel/Supabase release procedure.                                                                                          | Keep builds independent of DB secrets, but add a staging runtime smoke gate, explicit deployment configuration and safe error logging. Match exact HTTPS browser origin.                                                                        |
| F14 **Low**, confirmed                                | `operations/src/server/dal.ts` timestamp projections; `operations/src/app/admin/page.tsx:33`                        | `to_char()` discards timezone information. Parsing the result in another timezone can shift displayed times, and en-IN locale alone does not select India time.                                                                                                                                                                                       | Return ISO timestamps with offsets; explicitly format using `timeZone: 'Asia/Kolkata'`. Use `occurred_at` for payment event time when appropriate.                                                                                              |
| F15 **Low**, confirmed                                | `.github/dependabot.yml:2`; `eslint.config.js`; `operations/README.md`                                              | Dependabot scans only the root npm package, missing the app's separate lockfile. Root lint excludes all operations code. README still describes no commercial writes and a root redirect, although `/` now serves the public site.                                                                                                                    | Add `/operations` dependency updates, TypeScript/React lint coverage, and update architecture/setup documentation.                                                                                                                              |
| F16 **Low**, confirmed                                | `operations/src/app/admin/nav.tsx:148`; create-form handlers                                                        | Nav logout redirects even on network/server failure, while the session can remain valid. Form handlers without finally can remain stuck after rejected actions. `?new=1` dashboard links are not consumed by the managers.                                                                                                                            | Reuse the checked logout flow, add catch/finally to forms, and either handle the query flag or link directly to a functional action.                                                                                                            |

No user-controlled server-side URL fetch was found in the reviewed operations code, so no concrete SSRF finding is claimed. Admin values render through React rather than raw HTML. Public `dangerouslySetInnerHTML` consumes a repository-owned HTML file, not a customer submission; its script-removal regex is not a general sanitizer and must never be reused for uploaded/customer HTML. JSON-LD should escape `<` if it later incorporates untrusted values.

Server Actions have framework Origin/Host checks and call authorized DAL functions. Missing middleware is not itself a vulnerability. Add explicit tests for action requests; do not apply the auth API's JSON-only request helper to FormData actions. Current Next.js guidance treats every exposed action as a public endpoint requiring its own authorization and validation: [Next.js data security](https://nextjs.org/docs/app/guides/data-security).

4. Priority and effort

| Window                                                              | Work                                                                                                                                                                                                           | Release outcome                                                                                                        |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Quick wins, each under 30 minutes excluding full release validation | C: stop false UI success; E: generic unexpected errors; reorder headers; add `/operations` Dependabot coverage; document exact deployed origins and role separation                                            | Failed operations are visible and the intended response policy is restored.                                            |
| Short term, 1–2 days for a focused first pass                       | A+B: restricted write grants plus transactional conversion; D: IP-scoped rate limiting; complete server validation and string IDs; add business E2E/rollback tests; configure pooled runtime/direct migrations | Core customer/lead/project workflow becomes deployable. Deploy grants together with the validated application changes. |
| Medium term, 1–2 weeks depending on product rules                   | Project transition/audit policy; pagination and query measurement; scoped DTOs; idempotent creation/retries; MFA/recovery; migration checksums; backup restore drill; CSP and TS lint                          | Reliable operations with a clear path to larger datasets and stronger administrator account protection.                |

Do not enable payment or quotation mutations merely by granting more permissions. Their aggregate/refund/idempotency and quotation issuance rules are documented as future work. No Redis, additional ORM, separate API service or queue is required for these fixes.

5. Proposed patches for the five immediate priorities

Apply these in a branch and run the listed new tests. Patch B uses the current numeric ID signatures for minimal compatibility; it rejects unsafe numbers until F6's string-ID migration is completed. The existing DTO type mismatch remains a separate required short-term fix.

A. Give the runtime only the business permissions currently needed (F1)

Append the following before COMMIT in `database/runtime-grants.sql`. This is the existing operator grant recipe, not a schema migration. Run it as the owner with the intended `runtime_role` variable; do not use an owner DATABASE_URL in the app.

```sql
GRANT INSERT (name, phone, email, address)
  ON sarathi.customers TO :"runtime_role";
GRANT INSERT (contact_name, phone, service_requested, source, notes, status)
  ON sarathi.leads TO :"runtime_role";
GRANT UPDATE (status, customer_id, updated_at)
  ON sarathi.leads TO :"runtime_role";
GRANT INSERT (customer_id, lead_id, name, site_address, scope,
              service_types, operational_status)
  ON sarathi.projects TO :"runtime_role";
GRANT UPDATE (operational_status, updated_at)
  ON sarathi.projects TO :"runtime_role";
GRANT INSERT (project_id, from_status, to_status, was_on_hold,
              is_on_hold, reason, changed_by)
  ON sarathi.status_history TO :"runtime_role";
```

These tables use GENERATED ALWAYS AS IDENTITY; ordinary inserts omitting the identity column do not require a blanket grant on all sequences. Test with the actual Supabase role rather than adding unrelated sequence/schema privileges. No DELETE or UPDATE on history/payments, no mutations to `sarathi.users`, and no cost-table access are added.

DB/schema: no new table or changed historical migration. Apply the reviewed grant recipe to each environment after migrations. Environment: runtime `DATABASE_URL` uses the restricted login; `DATABASE_MIGRATION_URL` remains operator/release-only.

Manual test: create a customer and lead, convert to a project, update allowed statuses, reload and verify persistence. Automated test: perform the same operations as the runtime role; assert DELETE customers, UPDATE users, SELECT costs and CREATE TABLE still fail with 42501. Verify the role owns no application schema/table and inherits no owner role. The existing test named “cannot mutate commercial records” should be renamed to reflect the new limited permissions.

B. Convert leads atomically (F2)

Add `InputError` from patch E to the DAL imports. Replace `createProject` in `operations/src/server/dal.ts` with this implementation. Its return value changes to the inserted ID only; the existing action discards the return value, so no caller relies on the larger result.

```ts
export async function createProject(
  headers: Headers,
  data: {
    customerId: number;
    name: string;
    siteAddress: string;
    scope?: string;
    serviceTypes?: string[];
    leadId?: number;
  }
): Promise<{ id: string }> {
  const actor = await requireAdmin(headers);
  if (!Number.isSafeInteger(data.customerId) || data.customerId <= 0) {
    throw new InputError("Choose a valid customer.");
  }
  if (data.leadId !== undefined && (!Number.isSafeInteger(data.leadId) || data.leadId <= 0)) {
    throw new InputError("Choose a valid lead.");
  }
  const name = boundedText(data.name, "Project name", 200);
  const siteAddress = boundedText(data.siteAddress, "Site address", 1000);
  const scope = boundedText(data.scope ?? "", "Scope", 5000, false);
  const serviceTypes = data.serviceTypes ?? ["cctv"];
  // The current action only implements CCTV. Extend this allowlist alongside
  // a real service selector, rather than silently storing every project as CCTV.
  if (serviceTypes.length !== 1 || serviceTypes[0] !== "cctv") {
    throw new InputError("Choose a supported service.");
  }
  const leadId = data.leadId ?? null;
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '3s'");
    await client.query("SET LOCAL statement_timeout = '10s'");
    if (leadId !== null) {
      const lead = await client.query<{
        customerId: string | null;
        status: string;
      }>(
        `SELECT customer_id::text AS "customerId", status
         FROM sarathi.leads WHERE id = $1 FOR UPDATE`,
        [leadId]
      );
      const row = lead.rows[0];
      if (!row) throw new InputError("Lead no longer exists.");
      if (row.status === "CONVERTED" || row.status === "LOST") {
        throw new InputError("This lead cannot be converted in its current state.");
      }
      if (row.customerId !== null && row.customerId !== String(data.customerId)) {
        throw new InputError("Lead is linked to a different customer.");
      }
      const existing = await client.query("SELECT 1 FROM sarathi.projects WHERE lead_id = $1", [
        leadId
      ]);
      if (existing.rowCount) throw new InputError("Lead already has a project.");
    }
    const customer = await client.query("SELECT 1 FROM sarathi.customers WHERE id = $1", [
      data.customerId
    ]);
    if (!customer.rowCount) throw new InputError("Customer no longer exists.");
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO sarathi.projects
         (customer_id, lead_id, name, site_address, scope,
          service_types, operational_status)
       VALUES ($1, $2, $3, $4, $5, $6, 'SURVEY_PENDING')
       RETURNING id::text AS id`,
      [data.customerId, leadId, name, siteAddress, scope, serviceTypes]
    );
    if (leadId !== null) {
      const updated = await client.query(
        `UPDATE sarathi.leads SET status = 'CONVERTED', customer_id = $1,
           updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [data.customerId, leadId]
      );
      if (updated.rowCount !== 1) throw new Error("Lead conversion invariant failed.");
    }
    await client.query(
      `INSERT INTO sarathi.status_history
         (project_id, from_status, to_status, was_on_hold,
          is_on_hold, reason, changed_by)
       VALUES ($1, NULL, 'SURVEY_PENDING', false, false, $2, $3)`,
      [inserted.rows[0].id, leadId === null ? "Project created" : "Lead converted", actor.id]
    );
    await client.query("COMMIT");
    return inserted.rows[0];
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
```

`boundedText` is supplied by patch E and must also be imported. The customer lookup uses a plain SELECT; the subsequent project's foreign key is the final concurrency guard if the customer is removed between statements. Lead FOR UPDATE is covered by its column-level UPDATE grant.

DB/schema: reuse the unique `projects.lead_id`, foreign keys, and existing `status_history`; apply A first. Environment: none. Product assumption: LOST leads must be reopened explicitly before conversion; confirm this workflow before release. This writes creation history, not subsequent status history; F7 still needs the transition implementation.

Manual test: convert once and confirm the lead's customer/status and project agree; retry and show a controlled conflict. Automated tests: inject a failure into the lead UPDATE or history INSERT and assert no project persists; run simultaneous conversions of the same lead and assert one project; reject another customer's lead, missing IDs and unsafe numeric IDs. Do not retry a create blindly after an ambiguous connection loss; add idempotency keys for reliable generic creation retries in the next phase.

C. Only show successful status changes after server confirmation (F3)

Replace the lead handler with:

```tsx
async function handleStatusChange(leadId: number, newStatus: string) {
  setErrorMessage("");
  try {
    const result = await updateLeadStatusAction(leadId, newStatus);
    if (result.error) {
      setErrorMessage(result.error);
      return;
    }
    setLeads((previous) =>
      previous.map((lead) =>
        lead.id === leadId ? { ...lead, status: newStatus as LeadRecord["status"] } : lead
      )
    );
  } catch {
    setErrorMessage("Unable to save the status. Please retry.");
  }
}
```

Replace the project handler with:

```tsx
async function handleStatusChange(projectId: number, newStatus: string) {
  setUpdatingId(projectId);
  setErrorMessage("");
  try {
    const result = await updateProjectStatusAction(projectId, newStatus);
    if (result.error) {
      setErrorMessage(result.error);
      return;
    }
    setProjects((previous) =>
      previous.map((project) =>
        project.id === projectId ? { ...project, operationalStatus: newStatus } : project
      )
    );
  } catch {
    setErrorMessage("Unable to save the status. Please retry.");
  } finally {
    setUpdatingId(null);
  }
}
```

Add this directly inside each manager's outer `admin-view`, so errors remain visible when no modal is open:

```tsx
{
  errorMessage && (
    <p role="alert" className="form-error-banner">
      {errorMessage}
    </p>
  );
}
```

Disable a row's status control while its request is pending; introduce the same per-row pending state for leads as projects. For full concurrency correctness use the expected-prior-status contract in F7; this patch specifically prevents false success on a failed response.

Also make each DAL UPDATE check the affected row count:

```diff
-  await getPool().query(
+  const updated = await getPool().query(
     `UPDATE sarathi.leads SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
     [status, leadId]
   );
+  if (updated.rowCount !== 1) throw new InputError("Lead no longer exists.");
```

Apply the equivalent change to the project UPDATE, with “Project no longer exists.” Add positive safe-integer validation to these two functions while they retain numeric signatures.

DB/schema/environment: none. Manual test: temporarily deny the status UPDATE in a disposable staging database, change status and verify the old value remains with an error; reload to confirm. Automated test: trigger a real server rejection and a network failure, assert the control retains its old value; verify a successful change survives reload and a nonexistent ID is not reported as successful.

D. Scope auth limits to the deployment's trustworthy client IP (F4)

Create `operations/src/server/client-ip.ts`:

```ts
import "server-only";
import { isIP } from "node:net";

export function authClientIp(request: Request): string {
  if (process.env.VERCEL === "1") {
    // Vercel overwrites this header at its edge. This trust must not be
    // carried over to a server reachable behind an arbitrary reverse proxy.
    const ip = request.headers.get("x-forwarded-for")?.trim();
    if (!ip || !isIP(ip)) throw new Error("Trusted client IP is unavailable.");
    return ip;
  }
  const host = new URL(request.url).hostname;
  if (["localhost", "127.0.0.1", "[::1]"].includes(host)) return "127.0.0.1";
  throw new Error("Configure a trusted deployment IP source.");
}
```

Update `operations/src/app/api/auth/[...all]/route.ts`:

```diff
+import { authClientIp } from "@/server/client-ip";
@@
   try {
-    const global = await consumeRateLimit(`http:${path}`, {
+    const clientIp = authClientIp(request);
+    const clientLimit = await consumeRateLimit(`http:${path}:${clientIp}`, {
       window: 60,
       max: path.endsWith("/sign-in/email") ? 30 : 100
     });
-    if (!global.allowed)
+    if (!clientLimit.allowed)
       return jsonResponse({ error: "Too many attempts. Try again later." }, 429, {
-        "Retry-After": String(global.retryAfter)
+        "Retry-After": String(clientLimit.retryAfter)
       });
@@
-    headers.set("x-sarathi-auth-client-ip", "127.0.0.1");
+    headers.set("x-sarathi-auth-client-ip", clientIp);
```

Update the stale comment in `auth.ts` to say the wrapper supplies the trusted IP. Retain its configured `ipAddressHeaders: ['x-sarathi-auth-client-ip']` and custom DB-backed storage. This changes both layers from global to client-scoped limits. Keep the existing five attempts/account/five minutes initially. That account quota can still be targeted to temporarily deny access to a known email; consider challenge-based escalation if observed, while preserving brute-force protection. Shared office/mobile NATs will share the IP bucket, so measure before tightening it.

DB/schema: existing HMAC-keyed rate counters suffice. Environment: Vercel sets `VERCEL=1`; do not set it on a self-hosted server merely to accept client-supplied headers. Local isolated tests continue using loopback. For custom reverse proxies configure and verify header stripping before changing this helper. [Vercel request headers](https://vercel.com/docs/headers/request-headers) documents the forwarding-header boundary.

Manual staging test: saturate attempts from one client, then verify a second client can sign in. Automated tests: trusted IP A/B have separate counters; same account across IPs remains limited; caller-supplied `x-sarathi-auth-client-ip` is overwritten; malformed/missing trusted IP fails closed; cross-origin rejection and logout still work. Test the actual Vercel edge, not only mocked forwarded headers. IPv6 prefix aggregation can be added if abuse warrants it.

E. Validate server inputs and keep unexpected errors private (F5)

Create `operations/src/server/input.ts`:

```ts
import "server-only";

export class InputError extends Error {}

export function boundedText(value: unknown, label: string, max: number, required = true): string {
  if (typeof value !== "string") throw new InputError(`${label} must be text.`);
  const text = value.trim();
  if ((required && !text) || text.length > max || text.includes("\0")) {
    throw new InputError(`${label} is missing or too long.`);
  }
  return text;
}

export function formText(
  form: FormData,
  name: string,
  label: string,
  max: number,
  required = true
): string {
  const values = form.getAll(name);
  if (values.length > 1) throw new InputError(`${label} must occur once.`);
  return boundedText(values[0] ?? "", label, max, required);
}

export function safeNumericId(value: unknown, label: string): number {
  if (typeof value !== "string" || !/^[1-9][0-9]{0,18}$/.test(value)) {
    throw new InputError(`${label} is invalid.`);
  }
  const id = Number(value);
  if (!Number.isSafeInteger(id)) throw new InputError(`${label} is out of range.`);
  return id;
}
```

In `actions.ts`, import `randomUUID` from `node:crypto`, `InputError`, `formText`, `safeNumericId` from `@/server/input`, and `AccessDeniedError` from the DAL. Add this non-exported helper:

```ts
function mutationFailure(error: unknown): { error: string } {
  if (error instanceof InputError || error instanceof AccessDeniedError) {
    return { error: error.message };
  }
  const reference = randomUUID();
  const candidate = error && typeof error === "object" && "code" in error ? error.code : undefined;
  const code =
    typeof candidate === "string" && /^[0-9A-Z]{5}$/.test(candidate) ? candidate : "UNKNOWN";
  // Never log error.message/detail, SQL parameters, cookies or credentials here.
  console.error(JSON.stringify({ event: "admin_mutation_failed", reference, code }));
  return { error: `Unable to save this change. Reference: ${reference}` };
}
```

Replace the return statement in **all five** action catches with `return mutationFailure(error);`. Move field extraction into each try, so validation errors use that result channel. Replace the lead action with this complete version:

```ts
export async function createLeadAction(formData: FormData) {
  try {
    const requestHeaders = await headers();
    await createLead(requestHeaders, {
      contactName: formText(formData, "contactName", "Name", 200),
      phone: formText(formData, "phone", "Phone", 32),
      serviceRequested: formText(formData, "serviceRequested", "Service", 200),
      source: formText(formData, "source", "Source", 80, false) || "MANUAL",
      notes: formText(formData, "notes", "Notes", 5000, false)
    });
    revalidatePath("/admin");
    revalidatePath("/admin/leads");
    return { success: true };
  } catch (error) {
    return mutationFailure(error);
  }
}
```

For `createCustomerAction`, use these exact replacements inside its try:

```ts
const name = formText(formData, "name", "Name", 200);
const phone = formText(formData, "phone", "Phone", 32);
const email = formText(formData, "email", "Email", 254, false);
const address = formText(formData, "address", "Address", 1000, false);
if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  throw new InputError("Enter a valid email address.");
}
```

For `createProjectAction`, replace its current Number/String extraction with:

```ts
const customerId = safeNumericId(formData.get("customerId"), "Customer");
const name = formText(formData, "name", "Project name", 200);
const siteAddress = formText(formData, "siteAddress", "Site address", 1000);
const scope = formText(formData, "scope", "Scope", 5000, false);
const rawLeadId = formData.get("leadId");
const leadId =
  rawLeadId === null || rawLeadId === "" ? undefined : safeNumericId(rawLeadId, "Lead");
```

Apply the same `boundedText` constraints inside `createLead` and `createCustomer`, after `requireAdmin`, so future callers cannot bypass the action parser. Replace their ordinary validation Error with InputError. For status setters validate both the ID and the status type/allowlist before SQL, and use InputError for invalid or nonexistent records. TypeScript annotations alone do not validate a Server Action request.

Phone policy: initially accept bounded contact text so existing Indian landlines and international contacts remain usable. Before normalizing, explicitly support Indian mobile `+91`/10-digit forms and landlines with STD codes; do not reject every non-mobile number with a mobile-only regex. Never log phone/address/name fields in failure telemetry.

DB/schema: no immediate migration; later add compatible text-length constraints in a new numbered migration after checking existing rows. Do not edit 001/002. Environment: none. Manual tests: blank/overlong names, malformed email, invalid IDs and a duplicate conversion show controlled messages; SQL errors never show table names or constraints. Automated tests: FormData File values, repeated fields, NUL, fractional/negative/unsafe IDs, unknown status, missing row, unauthorized user and simulated database failure.

6. Additional concrete changes for the next pass

For F6, change all bigint-backed DTO properties (`id`, `customerId`, `leadId`, `projectId`, `quotationId`) from number to string, retaining null where present. Change the action/DAL/manager ID signatures and `updatingId` to strings; remove `Number(formData.get(...))`. Keep `version`, `projectCount` and overview counts numeric. Set `PaymentRecord.reference: string | null`. A string-ID parser can replace safeNumericId:

```ts
export function databaseId(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[1-9][0-9]{0,18}$/.test(value) ||
    BigInt(value) > 9223372036854775807n
  ) {
    throw new InputError("Invalid record ID.");
  }
  return value;
}
```

Test an ID above 9007199254740991 without losing precision. `pg`'s query generic is a compile-time assertion, not a row decoder. [node-postgres type parsing](https://node-postgres.com/features/types) explains its string fallback.

For F7, use this transaction order: authorize; lock project FOR UPDATE; compare the caller's expected status; check allowed transition/hold state; UPDATE the project; INSERT status_history with actor.id and reason; COMMIT. Require a reason for exceptions if admins may skip/reopen stages. Do not invent a sequential-only business rule without confirming operational needs. Reject direct lead changes to CONVERTED and changes away from CONVERTED while a project exists. Test two concurrent changes from the same initial status; one should report a conflict rather than silently overwrite.

For F8, begin with 50-row keyset pages ordered by `(created_at DESC, id DESC)`, retrieving 51 rows to detect a next page. Apply search/status predicates in SQL. Customer selectors should return only id/name and an optional distinguishing phone suffix. Keep metrics as explicit aggregate queries; a paginated page length is not a total. Add corresponding indexes in `003_operations_list_indexes.sql` only after query-plan validation:

```sql
BEGIN;
CREATE INDEX leads_created_id_idx ON sarathi.leads(created_at DESC, id DESC);
CREATE INDEX customers_created_id_idx ON sarathi.customers(created_at DESC, id DESC);
CREATE INDEX projects_created_id_idx ON sarathi.projects(created_at DESC, id DESC);
CREATE INDEX quotations_created_id_idx ON sarathi.quotations(created_at DESC, id DESC);
CREATE INDEX payments_created_id_idx ON sarathi.payments(created_at DESC, id DESC);
INSERT INTO sarathi.schema_migrations(version, name)
VALUES (3, 'operations_list_indexes');
COMMIT;
```

This migration assumes 003 is still the next free version. Regular CREATE INDEX can block writers; for large live tables schedule a maintenance window or extend the migration process for concurrent index creation outside a transaction. Do not use CREATE INDEX CONCURRENTLY inside this runner's transaction-wrapped files.

For F10, move the existing `source: '/:path*'` header object to the **first** position in the array; leave `/admin/:path*` and `/api/:path*` afterwards. No new header values are needed to fix the override. Next.js explicitly documents last-match precedence: [Next.js headers](https://nextjs.org/docs/app/api-reference/config/next-config-js/headers). Assert DENY/no-referrer on login, authenticated admin pages and API responses after deploying. CSP is a separate hardening task; begin report-only and account for the inline theme script and Google fonts before enforcement.

For F14, return `Date.toISOString()` from DAL mapping, then format with:

```ts
const indiaDateTime = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  dateStyle: "medium",
  timeStyle: "short"
});
```

Use decimal strings or integer paise for calculations; keep the current NUMERIC storage and do not introduce JS floating-point arithmetic for invoices/refunds. Currency formatting can use en-IN grouping for display. Preserve numeric bounds when converting display values.

For F15, add this object to `.github/dependabot.yml`'s updates array:

```yaml
- package-ecosystem: "npm"
  directory: "/operations"
  schedule:
    interval: "weekly"
  open-pull-requests-limit: 5
```

7. Vercel + Supabase configuration and verification checklist

The repo contains two independent build targets. For the operations deployment, set Vercel Root Directory to `operations`, framework to Next.js, install to `npm ci` and build to `npm run build`. The repository-root `npm run build` builds the static website. Keep migrations in a separate release job/CLI operating from the repository root, because their history is in `database/migrations/`. The absence of vercel.json is not itself a defect; dashboard settings can express this configuration.

| Variable                                    | Where / intended value                                                                                                                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                              | Runtime secret: restricted login through Supabase's transaction pooler, using verified TLS. Copy the actual endpoint and custom-role username format from the project connection details.  |
| `DATABASE_MIGRATION_URL`                    | Release/operator secret only: schema owner via a direct connection or session pooler. Required explicitly in the production migration job because this runner uses session advisory locks. |
| `BETTER_AUTH_SECRET`                        | Runtime secret: cryptographically random, at least 32 bytes; different for staging/production. Coordinate rotation with session invalidation.                                              |
| `BETTER_AUTH_URL`                           | Exact HTTPS origin used in the browser, with no path. Staging gets a staging origin and separate database/credentials.                                                                     |
| `PUBLIC_SITE_URL`                           | Build/runtime canonical public HTTPS URL; avoid credentials, scripts or user-entered content.                                                                                              |
| `SITE_URL`                                  | Only for the separate root static-site build. Not a replacement for BETTER_AUTH_URL.                                                                                                       |
| `SARATHI_ADMIN_EMAIL`, `SARATHI_ADMIN_NAME` | Operator provisioning only; password supplied via stdin, never a build-time admin seed.                                                                                                    |

No NEXT_PUBLIC database password, auth secret or service-role key is needed. Do not give preview deployments production data or owner credentials. Avoid wildcard auth trusted origins; use a stable staging alias or exact configured preview origin.

Supabase recommends transaction pooling for serverless connections. Keep a small application pool, initially 2–5 connections per instance, and measure rather than assuming the single-process global pool covers all Vercel instances. Match the Vercel function region to the database region; for a mainly Indian user base use a supported nearby region consistent with the database location. [Supabase connections](https://supabase.com/docs/guides/database/connecting-to-postgres) and [pooling guidance](https://supabase.com/docs/guides/database/connecting-to-postgres/pooling-and-limits).

Use certificate verification and Supabase SSL enforcement; do not solve connectivity by setting `rejectUnauthorized: false`. The correct CA/hostname configuration depends on the selected direct/pooler endpoint. [Supabase TLS enforcement](https://supabase.com/docs/guides/platform/ssl-enforcement).

- [ ] Confirm whether real customer data exists, inspect deployed runtime-role ownership/grants, and keep `sarathi` private from the Supabase Data API. Do not infer deployed grants from the repository recipe alone.
- [ ] Back up staging/production and prove a restore path before schema changes. Keep migration-owner secrets out of the web runtime.
- [ ] Apply A–E together in a branch; finish string IDs and the chosen transition policy before relying on high-integrity workflows. Add new migrations rather than editing applied ones.
- [ ] Run unit/type/build checks, the isolated database/auth harness, and the new restricted-role business, rollback and concurrent-update tests on the selected production Node version.
- [ ] Test login on the exact configured origin: anonymous, bad password, inactive/technician identity, expired session, current/all-device logout, copied cookies and changed role. Check no token/credential appears in responses.
- [ ] Test business success and failure: create customer/lead/project, convert once and twice, fail the second DB write, update a missing record, lose network mid-save, and reload to confirm the UI matches persisted state.
- [ ] In Vercel staging, verify header precedence, IP rate-limit isolation, server-action cross-origin rejection, pooled connections, TLS, safe error references and no private caching. Check Supabase active connections under modest concurrent admin traffic.
- [ ] With a larger synthetic dataset, inspect payload sizes and query plans before shipping pagination. Verify India-time timestamps across midnight and INR display using representative amounts.
- [ ] Deploy the validated build with reviewed grants/migrations, repeat smoke checks, monitor 401/429/5xx and DB latency, and retain the previous app artifact plus a forward-recovery plan.

The two clarification questions remain relevant to implementation: whether production currently uses an owner or restricted role, and whether stage exceptions should be allowed with a recorded reason. Neither blocks the confirmed findings in this review.
