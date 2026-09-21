# Sarathi operations runtime

This private Next.js application runs separately from the existing static website. It provides administrator sign-in, a protected workspace with real database record counts, and current/all-device sign-out. Lead entry, costing screens, surveys, PDFs, and payment entry remain later phases in [the V1 plan](../docs/V1_IMPLEMENTATION_PLAN.md).

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

Open the exact origin configured in `BETTER_AUTH_URL`, followed by `/admin/login`. The development server binds to the local machine. The root route redirects to `/admin`; an anonymous visitor is redirected to sign-in. The sign-in form sends same-origin requests, and sessions are validated again at data access. Errors displayed in the browser do not disclose database or authentication internals.

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

Deployment, email recovery, public-site migration, production database setup, and hosting selection are not performed by this local phase. Keep administrative operator access available for account recovery until an explicit recovery workflow is implemented.

## Pinned implementation references

- [Next.js installation](https://nextjs.org/docs/app/getting-started/installation): Next.js 16.3.5 and React 19.3.0, manually scaffolded with App Router and TypeScript.
- [Next.js authentication guide](https://nextjs.org/docs/app/guides/authentication): authorization close to data access, explicit returned data, and server/client boundaries.
- [Better Auth installation](https://better-auth.com/docs/installation): Better Auth 1.7.5 with Drizzle ORM 0.45.2 and PostgreSQL driver `pg` 8.23.0.

Exact direct dependencies and the resolved dependency tree are recorded in `package.json` and `package-lock.json`.
