# First deployment: Vercel + Supabase

The application has not yet been deployed. These steps prepare a staging deployment before enabling production; they do not imply that any remote database, environment, or backup has been configured.

## Provision the database

1. Create a Supabase project in a region near the intended Vercel function region and Indian users. Use separate staging and production databases.
2. In an operator shell/secret manager, set `NODE_ENV=production` and `DATABASE_MIGRATION_URL` to an owner connection using the **direct endpoint or session pooler**. Run `npm --prefix operations run migrate`. The runner uses a session advisory lock, so a transaction pooler is unsuitable. Keep this credential out of the Vercel runtime environment.
3. Apply the runtime role grants from `database/runtime-grants.sql` as the database owner, following `database/README.md`. Provision the runtime login separately with a generated password. The runtime login must not own tables or hold schema creation, role management, or unrestricted business writes.
4. Provision an administrator using `npm --prefix operations run admin:provision` with the owner connection and password from standard input, as documented in `operations/README.md`.
5. Enable verified TLS for database connections. Use the project's supported CA/connection settings and test them; do not disable certificate verification. Configure the runtime URL for Supabase transaction pooling with the restricted role. Check the project's actual custom-role username/endpoint rather than guessing the connection string.

## Configure Vercel

For an existing database created with the older runner, follow the [one-time checksum baseline procedure](../database/README.md#one-time-baseline-for-existing-databases) before release. Verify the applied SQL against the original release first. Do not add `--baseline-checksums` to routine deployment commands; historical checksum mismatches must stop deployment.

- Set the project Root Directory to `operations` and use the Next.js preset with `npm ci` / `npm run build`. Do not run schema migrations as part of every Vercel build.
- Set `DATABASE_URL` to the restricted transaction-pool URL, `DB_POOL_MAX=2`, a newly generated `BETTER_AUTH_SECRET` (at least 32 random characters), and `BETTER_AUTH_URL` to the exact HTTPS staging origin. Set `PUBLIC_SITE_URL` only if an external public-site link is wanted.
- Production requires its own database, secret, and exact origin. Keep preview access protected; do not permit wildcard auth origins. Assign a stable staging domain or supply the exact preview origin for the deployment being tested.
- Leave the platform-provided `VERCEL=1` intact. Authentication trusts only Vercel's `x-vercel-forwarded-for` address under this flag. Never set the flag on a custom proxy deployment to accept caller-controlled forwarding headers.
- Align the function and database regions. The pool limit is **per application instance**; monitor total connections before increasing it. Do not add named prepared statements with transaction pooling without checking provider support.

## Verify staging before first production release

- For workflow guidance, apply migration **005** and the latest runtime grants before deploying. Check first-login introduction, account-level completion/replay, role-aware detail links and recorded activity. Follow the [workflow UX checklist](ADMIN_WORKFLOW_UX.md#apply-and-verify-checklist). No additional environment variables are needed.

- Run `npm --prefix operations test`, `npm --prefix operations run typecheck`, `npm --prefix operations run build`, and the repository's isolated operations integration suite.
- Confirm `/admin/login`, protected admin pages and `/api/admin/me` return `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, and the intended noindex policy.
- Exercise login, logout, all-device revocation, unauthenticated access, a disabled admin, and cross-origin mutation rejection. Missing environment configuration must produce a generic service error.
- Confirm all migrations including `004_role_based_access.sql` and the updated runtime grants were applied. Verify an operator and viewer can sign in, viewer writes and payments are denied, and only administrators can open `/admin/users` and `/admin/security`. Change an existing user's role at `/admin/users` and verify it takes effect immediately; the final active administrator cannot be demoted. Enroll an authenticator at `/admin/security`, sign in with a code, and verify a recovery code works once. Start a second-browser MFA challenge, revoke all devices from the authenticated browser, and confirm the old challenge fails. Practise owner password recovery and explicit MFA reset on a staging-only administrator; re-enroll afterward.
- Saturate login attempts from one network/IP using test accounts, then confirm a second network/IP can still log in with a different account. Repeated attempts for the same account remain throttled across IPs. Many people behind one Indian mobile/carrier NAT may share an IP, so monitor false positives before tuning limits.
- Attempt to inject `x-sarathi-auth-client-ip`, `x-forwarded-for`, and `x-vercel-forwarded-for` through the public edge; verify caller input cannot choose the trusted quota address. Local tests cannot prove the deployed edge boundary.
- Create/edit each supported business record with the restricted role, exercise rejected transitions and conversions, and reload to confirm durable results. Verify failures do not show success or leave partial records.
- Check a list containing more than 50 matching records: next-page navigation, search and status filters must agree. Verify customer lookup finds records beyond its initial 25 options. Confirm skipped/backward/reopened project stages save a reason and history entry, stale edits fail, and displayed dates use India time.
- Inspect connection usage under modest concurrent traffic. Confirm backup retention for the selected Supabase plan and restore a backup into an isolated database before relying on recovery. Record operator recovery access.

## Primary references

- [Vercel request headers](https://vercel.com/docs/headers/request-headers): platform client address and forwarding-header trust boundary.
- [Supabase database connections](https://supabase.com/docs/guides/database/connecting-to-postgres): transaction pooling for transient/serverless connections versus direct/session connections.
- [Supabase SSL enforcement](https://supabase.com/docs/guides/platform/ssl-enforcement): TLS configuration and certificate verification.

Reviewed against the provider documentation on 2026-09-25. Actual project settings, grants, backup availability and edge behaviour still require deployment verification.

## Organization ownership release (Milestone 2)

Migrations 006 and 007 must be applied through the owner runner after staging backup/restore review; reapply `database/runtime-grants.sql` as owner. Migration 007 backfills existing records into Sarathi/Smart Solutions without modifying original fields, then enforces mandatory ownership, composite relationships and RLS. Inconsistent historical actor/reference data aborts the upgrade for review. Test frozen snapshots and counts before/after the staging upgrade.

The runtime URL must use a non-owner role without SUPERUSER/BYPASSRLS/owner membership. The application and grant recipe fail closed for bypass roles. Check that the old global role function is no longer executable by runtime and the scoped role function is. Test LOCAL context binding/cleanup through the actual hosted transaction pooler; local PostgreSQL tests cannot verify a provider deployment. Keep owner credentials out of the application.

CLI provisioning/recovery accepts optional owner-only `SARATHI_ORGANIZATION_SLUG` (default `sarathi`). Recovery requires an active admin membership in that active organization; it resets the identity credentials and revokes all that identity's sessions. Provisioning requires the active Smart Solutions division and rolls back if unavailable. Shared-identity ceiling promotion remains owner-managed. No organization creation/switcher or staff assignment/removal UI is enabled.

Deploy schema, grants and the matching app as a reviewed maintenance release. A pre-isolation app is not a valid rollback against the new schema: unscoped reads return empty data and inserts fail. Retain backups and use reviewed restore/forward-fix recovery. Additional organization onboarding remains disabled pending staging verification. No staging or production environment was changed during local development. See [coverage](TENANT_ISOLATION_COVERAGE.md), [security](SECURITY_MODEL.md) and [progress](DEVELOPMENT_PROGRESS.md).

## Quotation release checklist (Milestone 4)

Follow [quotation setup and walkthrough](QUOTATION_USAGE.md). Apply migration 009 and reapply the matching runtime grants on an approved staging database after verified backup/restore. Preflight multiple `APPROVED` rows per project: the migration aborts rather than choosing or deleting history. Owner-reviewed reconciliation is required before retrying an inconsistent legacy database.

Install operations from its lockfile, build with Node 22+ and ensure all four `src/server/documents/fonts/*.ttf` assets are present in deployed server traces. No new environment variables, storage credentials, provider or production hosting migration are required. PDFKit runs server-side; artifacts/snapshots live in the existing private database and must be included in backups. Confirm hosted function duration and pool transactions under concurrent issue; measure artifact storage growth. Deploy schema/grants and matching app together through the existing approval process.

Verify create/edit/issue/download/revision/decision on desktop and 375px mobile with real staging staff roles. A download must keep the quotation page usable. Check viewer/foreign/division/anonymous denial and no-store attachment headers; edit a customer and verify the original issued bytes remain unchanged. Simulate generation/storage/audit failure in disposable data and confirm no issued success or partial artifact. Verify one project baseline and staff-only acceptance semantics, optional stage reason/history, and absence of new payments. Keep unknown business contacts/GSTIN/signatures blank; GST stays unavailable until owner verification. Historic PDFs without stored provenance are not fabricated. Additional organizations remain disabled.

## Payment release checklist (Milestone 5)

Follow [payment usage](PAYMENT_USAGE.md). On an approved staging database, verify backup/isolated restore, apply pending migrations through additive 010 with the owner runner, reapply matching runtime grants, then deploy the matching Node 22+ app. Never edit applied 001–009 or supply owner/BYPASSRLS credentials to runtime. The isolated harness already covers original legacy fields and injected migration rollback; repeat preservation checks against synthetic staging data. No new package, environment variable, gateway, provider or storage account is required.

Verify project advances, accepted standalone receipts in all permitted divisions, partial allocations, completed refunds, separate receipt corrections and private PDF downloads on desktop/mobile. Exercise explicit operator membership authorization, admin-only refunds/corrections, viewer/foreign/division/anonymous denial, source caps and concurrent numbering/retries. Simulate a lost save/allocation response and reload: the same durable request must recover one entry. Confirm customer edits and accepted revisions do not rewrite stored artifacts or allocation history, and receipt history links its refunds/corrections.

Check hosted transaction-pool context cleanup, TLS, function duration and all four font files in payment route traces. Review print identity, exact baseline/net/outstanding/credit semantics, legacy reconciliation and storage growth. Back up payment PDFs/snapshots/events/allocations with the database and prove isolated restore. Keep additional organizations disabled and retain explicit approval for production migration/deployment. Local tests do not complete these staging gates.
