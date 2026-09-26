# First deployment: Vercel + Supabase

The application has not yet been deployed. These steps prepare a staging deployment before enabling production; they do not imply that any remote database, environment, or backup has been configured.

## Provision the database

1. Create a Supabase project in a region near the intended Vercel function region and Indian users. Use separate staging and production databases.
2. In an operator shell/secret manager, set `NODE_ENV=production` and `DATABASE_MIGRATION_URL` to an owner connection using the **direct endpoint or session pooler**. Run `npm --prefix operations run migrate`. The runner uses a session advisory lock, so a transaction pooler is unsuitable. Keep this credential out of the Vercel runtime environment.
3. Apply the runtime role grants from `database/runtime-grants.sql` as the database owner, following `database/README.md`. Provision the runtime login separately with a generated password. The runtime login must not own tables or hold schema creation, role management, or unrestricted business writes.
4. Provision an administrator using `npm --prefix operations run admin:provision` with the owner connection and password from standard input, as documented in `operations/README.md`.
5. Enable verified TLS for database connections. Use the project's supported CA/connection settings and test them; do not disable certificate verification. Configure the runtime URL for Supabase transaction pooling with the restricted role. Check the project's actual custom-role username/endpoint rather than guessing the connection string.

## Configure Vercel

- Set the project Root Directory to `operations` and use the Next.js preset with `npm ci` / `npm run build`. Do not run schema migrations as part of every Vercel build.
- Set `DATABASE_URL` to the restricted transaction-pool URL, `DB_POOL_MAX=2`, a newly generated `BETTER_AUTH_SECRET` (at least 32 random characters), and `BETTER_AUTH_URL` to the exact HTTPS staging origin. Set `PUBLIC_SITE_URL` only if an external public-site link is wanted.
- Production requires its own database, secret, and exact origin. Keep preview access protected; do not permit wildcard auth origins. Assign a stable staging domain or supply the exact preview origin for the deployment being tested.
- Leave the platform-provided `VERCEL=1` intact. Authentication trusts only Vercel's `x-vercel-forwarded-for` address under this flag. Never set the flag on a custom proxy deployment to accept caller-controlled forwarding headers.
- Align the function and database regions. The pool limit is **per application instance**; monitor total connections before increasing it. Do not add named prepared statements with transaction pooling without checking provider support.

## Verify staging before first production release

- Run `npm --prefix operations test`, `npm --prefix operations run typecheck`, `npm --prefix operations run build`, and the repository's isolated operations integration suite.
- Confirm `/admin/login`, protected admin pages and `/api/admin/me` return `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, and the intended noindex policy.
- Exercise login, logout, all-device revocation, unauthenticated access, a disabled admin, and cross-origin mutation rejection. Missing environment configuration must produce a generic service error.
- Confirm migration `003_admin_two_factor.sql` and updated runtime grants were applied. Enroll an authenticator at `/admin/security`, sign in with a code, and verify a recovery code works once. Start a second-browser MFA challenge, revoke all devices from the authenticated browser, and confirm the old challenge fails. Practise owner password recovery and explicit MFA reset on a staging-only administrator; re-enroll afterward.
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
