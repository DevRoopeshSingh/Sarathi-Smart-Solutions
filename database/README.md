# Commercial database foundation

Phase 1 supplies a portable PostgreSQL migration and real database verification. It does not connect the existing static website to a database. See [the implementation plan](../docs/V1_IMPLEMENTATION_PLAN.md) for subsequent phases.

## Apply a migration

Use a dedicated development database and a migration owner with schema-creation rights. Supply the connection using your normal PostgreSQL environment or service configuration; never commit credentials.

```sh
psql -X -v ON_ERROR_STOP=1 -d "$SARATHI_DATABASE_URL" -f database/migrations/001_commercial_foundation.sql
```

The migration creates the `sarathi` schema, domain types, relational tables, indexes and trigger functions inside one `BEGIN`/`COMMIT` transaction. It records version 1 in `sarathi.schema_migrations` only after all objects succeed. A failed migration rolls back the schema. Reapplying version 1 intentionally fails; it does not silently accept schema drift. Future changes must be new numbered forward migrations. Once applied to a shared database, do not edit an existing migration. Backup and rollback/recovery procedures are release requirements, not supplied deployment automation.

## Verify with an isolated database

```sh
npm run test:db
# Alternative when PostgreSQL is elsewhere:
PG_BINDIR=/path/to/postgresql/bin node scripts/test-database.mjs
```

The runner discovers `PG_BINDIR`, Homebrew PostgreSQL 18, or `pg_config --bindir`. It requires `initdb`, `pg_ctl`, and `psql`; unavailable binaries produce an error, never a skipped success. It has been executed successfully against PostgreSQL 18. Other versions have not been verified.

It creates a private mode-0700 directory under `/tmp`, initializes a fresh cluster, disables TCP listening and uses only that directory's Unix socket. Local trust authentication is confined by the private directory; host authentication is rejected. Inherited `PG*` connection settings are removed from subprocesses. No existing PostgreSQL service or database is used. Cleanup stops the temporary server and removes its files; a failure to stop retains the path and reports an error for investigation. Restricted sandboxes may deny PostgreSQL shared memory and require permission to run this exact test command outside the sandbox.

Verification covers atomic rollback on an injected migration failure, version recording, duplicate migration rejection, required/nonnegative money, `NaN` and range rejection, quantities and percentages, hold/resume state, customer/project foreign keys, quote arithmetic, version uniqueness, frozen content and item INSERT/UPDATE/DELETE restrictions, valid lifecycle updates, cross-project payment references, idempotency, append-only payments/history and protected table TRUNCATE rejection. A coordinated two-session test holds the freeze transaction, observes the item writer waiting on a database lock, commits the freeze, and verifies that the waiting mutation fails without persisting. This verifies the freeze-first interleaving; the future issuance service must still lock the parent before reading items and calculating the snapshot.

## Data and invariants

- `users` maps an external identity subject to a role and active flag. It contains no credentials or session implementation.
- `customers` and `leads` preserve enquiry details. `leads.requirement_json` retains the existing structured solution requirements as a JSON object; later server validation must allowlist its fields.
- `projects` stores scope, multiple service types, and operational progress: `SURVEY_PENDING`, `SURVEY_COMPLETE`, `COSTING`, `PROCUREMENT`, `INSTALLATION_SCHEDULED`, `INSTALLATION_IN_PROGRESS`, `TESTING`, `COMPLETED`, `CANCELLED`. Holding a project preserves its current status and requires a reason. Completed/cancelled projects cannot be held. Quote, payment and warranty states are separate concerns.
- `products`, `project_costings` and `bom_items` contain private cost inputs. BOM quantities and unit costs/prices are stored; derived line totals are calculated, avoiding separately editable totals.
- `quotations` stores versioned customer/site/terms/financial snapshots and a creator identity; `(project_id, version)` is unique. `quotation_items` stores customer-facing descriptions, quantities and sell prices independently of mutable products/BOMs. Quote headers enforce `total = subtotal + service_charges - discount + tax_amount`, valid discount, and advance no greater than total. A zero total is representable; the service must decide whether it can be issued.
- Quotes must be inserted as `DRAFT`. Issuance changes the status to `SENT` and sets `frozen_at` atomically; an abandoned draft can be frozen as `VOID`. After freezing, all columns are immutable except status, lifecycle timestamps and `updated_at`. Allowed transitions are `SENT` to `APPROVED`/`DECLINED`/`SUPERSEDED`/`VOID`, and `APPROVED` or `DECLINED` to `SUPERSEDED`/`VOID`. There is no unfreezing. New content requires a new version. This is an initial transition policy for the planned server workflow.
- Item mutations take a `FOR UPDATE` lock on their quotation parent and reject frozen parents. Items cannot be reparented. Issuance must lock that same parent before reading its items; locking only after calculating totals would permit a stale snapshot. To allocate versions, lock the project row in a transaction, determine the next version, and insert the new quotation. The unique constraint is the final guard; no allocation API exists yet.
- `payments` records positive `RECEIPT`/`REFUND` amounts, currency, actor, event time, method and unique idempotency key. Its optional quotation reference must belong to the same project. UPDATE, DELETE and TRUNCATE are rejected. Corrections use a new refund/receipt under future business rules. `status_history` is likewise append-only; the future service must write it in the same transaction as each project transition.

Money uses `numeric(14,2)` (12 integer digits, two decimals), quantities `numeric(12,3)`, percentages `numeric(5,2)`. Required fields also use `NOT NULL`: a domain CHECK alone does not reject SQL NULL. Numeric domains reject `NaN`; numeric precision bounds reject infinities and overflow. PostgreSQL coerces numeric scale by rounding, so the application must reject excess precision before sending input. The forthcoming adapter must use decimal strings or integer minor units, never floating-point arithmetic or implicit JavaScript number conversion. Individual values fitting the schema does not guarantee a sum fits; the domain calculator/server must validate aggregate bounds.

## Explicit limitations and next phases

This schema is not an authentication or authorization boundary. Phase 3 must implement authenticated server-only access, role and assignment checks, safe response DTOs, and migration-owner versus least-privilege runtime roles. Never connect public clients directly. Runtime roles must not own tables, disable triggers, modify schema or grant themselves privileges. An owner/superuser can bypass these guards. Customer-safe snapshots do not make entire quote/project records public: use an explicit field allowlist.

Phase 3 must enforce transition permissions and prerequisites, one approved commercial baseline, snapshot/item sum reconciliation, total calculation while holding locks, customer/lead conversion consistency, actor attribution, idempotent write semantics, and timestamp consistency. This migration does not automatically update `updated_at`, create costing rows, or generate status-history records. Quote lifecycle timestamps remain mutable metadata, so authorized services must validate them.

Phase 5 must add payment authorization and aggregate safeguards: refunds cannot exceed receipts, transactions must serialize concurrent refund checks, outstanding balance uses actual net receipts, and overpayments must be reported explicitly. No cross-row CHECK is used for these rules. Inserting an arbitrary positive refund is currently possible for a database writer. Idempotency conflicts also require the service to compare the original payload before returning a prior result.

Tax is an explicit stored amount defaulting to zero, not a configured business rate or tax advice. Tax policy and issue validation need business configuration before real quotations are sent. Supplier identities, procurement records, survey details/photos, warranty/service records, quote-link tokens/revocation, private files, PDF generation, backups and deployment are deferred to later migrations and phases. This migration intentionally contains no internal profit/cost quote snapshot; a future private snapshot model is needed to preserve historical profitability independently of live project costing.

PostgreSQL references: [constraints](https://www.postgresql.org/docs/current/ddl-constraints.html), [CREATE TRIGGER](https://www.postgresql.org/docs/current/sql-createtrigger.html), and [transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html).

## Phase 2 migrations and authentication

The separate `operations/` Next.js server owns authentication. The static public site still has no database credentials. Install its dependencies with `npm ci --prefix operations`, configure its local environment, and apply numbered migrations with:

```sh
# Export a dedicated schema-owner connection through your secret manager or shell.
# DATABASE_MIGRATION_URL is preferred; DATABASE_URL is the fallback.
npm run operations:migrate
```

The runner loads `database/migrations/NNN_name.sql` in strict numeric order, requires a sequence starting at 001 without gaps, and validates every existing `(version, name)` in the original `sarathi.schema_migrations` ledger. It accepts an already-applied Phase 1 migration and rejects unknown versions, gaps and changed names. It takes one session advisory lock on the same PostgreSQL connection for the entire run, applies each SQL file's own transaction, and checks its recorded version afterward. Running it again is a no-op. It does not create an ORM migration ledger. It does not checksum historical SQL: keep applied files immutable in version control and review all new migrations.

`DATABASE_MIGRATION_URL` is for the migration owner. `DATABASE_URL` is for the runtime and must not be the owner/superuser in a shared deployment. The isolated runtime test uses its temporary owner for migrations and fixtures, then switches the application to a restricted non-owner role using `database/runtime-grants.sql`. The test verifies that role cannot create schema objects, mutate actors, read BOM/costing tables or truncate sessions. Deployments must separately provision their own runtime login role and apply the reviewed grants, independently of commercial writers. No commercial write endpoint or customer access is introduced in Phase 2. Database ownership, grants and secret provisioning remain deployment work.

The Phase 2 schema adds private email/password identity, sessions and shared authentication rate limits. Administrator access also requires an active `ADMIN` record in `sarathi.users`; possessing an identity or session alone does not grant administrator access. Credentials and session tokens must never be returned from admin DTOs, rendered into pages, or placed in public files. Public registration is closed; administrators are provisioned using the local command documented in `operations/README.md`.

### Isolated runtime verification

```sh
npm ci
npm ci --prefix operations
npm run operations:typecheck
npm run operations:test
npm run operations:build
npx playwright install chromium
npm run test:operations
```

The runtime harness creates a fresh private PostgreSQL cluster using the same binary discovery rules as `test:db`, applies all migrations twice, inserts only ephemeral authentication fixtures, starts the real production Next.js server behind a disposable HTTPS proxy at `https://127.0.0.1:3107` (upstream loopback port 3108), and exercises HTTP and Chromium browser authentication. Both ports are fixed; an occupied port fails the run rather than probing or stopping another service. All credentials and the auth secret are generated for this process. OpenSSL creates a temporary certificate with localhost and 127.0.0.1 subject alternative names; only test child processes trust it through `NODE_EXTRA_CA_CERTS`. Chromium accepts this test certificate locally. Production HTTPS and secure-cookie validation stay enabled. OpenSSL is therefore an additional test prerequisite. It overrides inherited database/auth settings and never connects to `DATABASE_URL` supplied by the caller. It stops its application, HTTPS proxy and cluster and removes temporary database and certificate files in cleanup, including after test failure. The ordinary public-site and commercial tests remain separate. A restrictive sandbox may require escalation for this exact isolated test command because PostgreSQL needs local shared memory and the runtime needs a loopback listener.
