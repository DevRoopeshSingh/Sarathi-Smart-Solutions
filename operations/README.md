# Sarathi operations runtime

This Next.js application serves the public website at `/` and a protected operations workspace at `/admin`. The workspace supports customer records, leads, lead-to-project conversion, project statuses, dashboard counts, and administrator session management. It uses Better Auth, Drizzle and PostgreSQL. Costing, surveys, PDFs, and payment entry remain later phases in [the V1 plan](../docs/V1_IMPLEMENTATION_PLAN.md).

## Local setup

Use Node.js 22 or newer and PostgreSQL. From the repository root:

```sh
npm --prefix operations ci
cp operations/.env.example operations/.env.local
```

Set `DATABASE_URL` to your own local PostgreSQL database, `BETTER_AUTH_URL` to the exact browser origin (for example `http://localhost:3000`), and `BETTER_AUTH_SECRET` to a unique random secret of at least 32 characters. Do not commit environment files. `PUBLIC_SITE_URL` is optional; when supplied it must be an HTTP(S) URL for the existing public website. No website link appears when it is omitted.

Apply the existing SQL migration history before starting the runtime. The migration command reads environment variables from the shell; Next.js itself loads `.env.local` for development. Export the database URL in the shell or use your environment/secret manager to supply it, then run:

```sh
npm --prefix operations run migrate
```

The authoritative migration history is in `database/migrations/`. Do not run Drizzle schema push or create an independent ORM migration history. See [database instructions](../database/README.md) for database ownership and migration details.

## Administrator provisioning

There is no public registration endpoint. An operator with database access provisions an account using the pinned authentication library's password hashing. Supply `DATABASE_URL` (or a separate `DATABASE_MIGRATION_URL`), `SARATHI_ADMIN_EMAIL`, and `SARATHI_ADMIN_NAME` through your shell/environment manager. The password must arrive on standard input as a single line of 12–128 characters. Never put a password in a command argument, shell history, or tracked file.

Run `npm --prefix operations run admin:provision` with password input piped from a trusted secret manager. The command creates the authentication identity and administrator mapping in one transaction. An existing email is rejected without resetting its password or changing permissions. No account is created by application startup or a build.

Then start development:

```sh
npm --prefix operations run dev
```

Open the exact origin configured in `BETTER_AUTH_URL`, followed by `/admin/login`. The development server binds to the local machine. Anonymous visitors to `/admin` are redirected to sign-in. The sign-in form sends same-origin requests, and sessions are validated again at data access. Errors displayed in the browser do not disclose database or authentication internals.

## Verification

```sh
npm --prefix operations run typecheck
npm --prefix operations test
npm --prefix operations run build
```

`typecheck` generates current Next route types and checks the application, server code, scripts and TypeScript tests. The tests use Node's test runner and `tsx`, with the `react-server` condition for server-only modules. Production compilation does not need a live database or deployment secrets; environment validation happens when the runtime needs them.

The root repository owns additional checks for SQL migrations, isolated authentication integration tests, public-site regressions, and static-output isolation. This package has its own lockfile; root `npm ci` does not install its dependencies.

## Runtime and security boundaries

The production app requires a Node.js server and a PostgreSQL connection. Use `npm --prefix operations run build`, then `npm --prefix operations start`; `start` binds to loopback for use behind a correctly configured HTTPS reverse proxy. Set `BETTER_AUTH_URL` to the exact HTTPS origin in production and pass secrets through the runtime environment. A static export cannot serve this application.

Authentication/database imports live in server-only modules. UI code receives only explicit administrator/count projections. The application sends noindex, no-referrer and frame-denial headers. Authorization is enforced in the data-access layer and each mutation, independently of the navigation UI. There are no demo counts, generated business records or seeded real credentials.

See [the first-deployment checklist](../docs/OPERATIONS_DEPLOYMENT.md) for Vercel + Supabase setup. Runtime pools default to two connections per process (`DB_POOL_MAX`, allowed range 1–10). Production migrations require `DATABASE_MIGRATION_URL` explicitly because their session advisory lock requires a direct connection or session pooler.

Login/logout quotas use Vercel's `x-vercel-forwarded-for` only when the platform supplies `VERCEL=1`; account throttling remains separate. Caller-supplied internal address headers are replaced. Missing or invalid platform addresses fail closed. Outside Vercel, loopback fallback is available only when the configured `BETTER_AUTH_URL` is a loopback origin; request Host headers cannot enable it. A non-Vercel remote deployment needs a reviewed proxy trust adapter before sign-in will work. Never manually set `VERCEL=1` to trust public forwarding headers.

## Authenticator enrollment and recovery

Apply migration `003_admin_two_factor.sql` and reapply runtime grants before deploying this version. No additional runtime secret or paid service is needed. Keep `BETTER_AUTH_SECRET` stable and backed up securely: authenticator secrets and recovery codes are encrypted with it.

Administrators can enroll at `/admin/security` using their current password, a time-based authenticator app and a confirmation code. Enrollment is optional initially. Save the displayed one-use recovery codes in a password manager before confirming enrollment. Future sign-ins require the authenticator or one unused recovery code. The same page can replace recovery codes or disable the authenticator after password verification. Setup keys and codes are displayed only during setup/replacement; no third-party QR service receives them.

For a lost password, an operator must supply the owner `DATABASE_MIGRATION_URL`, `NODE_ENV=production`, and `SARATHI_ADMIN_EMAIL`, then run `npm --prefix operations run admin:recover` with a new 12–128 character password piped from a trusted secret manager through standard input. This command only updates an existing active administrator; it does not create or elevate users. It revokes sessions and pending second-factor challenges in the same transaction. MFA remains enabled unless the operator explicitly supplies `SARATHI_RESET_MFA=1` for a lost authenticator and unavailable recovery codes. Re-enroll immediately after an MFA reset. Never store owner credentials or recovery input in Vercel runtime variables, command arguments, logs or tracked files.

## Business records

Lists fetch at most 50 rows per page, with server-side search/status filters and an ID cursor. Customer selectors fetch at most 25 matching options. Record IDs stay strings throughout the application to preserve PostgreSQL bigint precision. Dates travel as UTC ISO timestamps and display in `Asia/Kolkata`.

Lead conversion and project history updates run in transactions. Status changes check the previously displayed status to reject stale edits. Skipped, backward, reopened and cancelled project stages require a recorded reason; ordinary forward transitions remain available without an exception reason. Held projects cannot change stage. Validation and database failures leave the displayed status unchanged and return a safe error reference.

## Pinned implementation references

- [Next.js installation](https://nextjs.org/docs/app/getting-started/installation): Next.js 16.3.5 and React 19.3.0, manually scaffolded with App Router and TypeScript.
- [Next.js authentication guide](https://nextjs.org/docs/app/guides/authentication): authorization close to data access, explicit returned data, and server/client boundaries.
- [Better Auth installation](https://better-auth.com/docs/installation): Better Auth 1.7.5 with Drizzle ORM 0.45.2 and PostgreSQL driver `pg` 8.23.0.

Exact direct dependencies and the resolved dependency tree are recorded in `package.json` and `package-lock.json`.
