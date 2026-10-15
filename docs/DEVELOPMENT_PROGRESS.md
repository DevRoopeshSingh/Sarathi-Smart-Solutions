# Development progress

## Milestone 5 — Payments, Advances, Refunds, Balances and Receipts (12 October 2026)

**Current position:** Milestone 5 is implemented and verified locally on `feat/sarathi-business-manager`. Existing uncommitted Milestones 1–4 and applied migration files were preserved. No configured/production database, production migration, deployment, additional organization onboarding, commit or push was performed. Milestone 6 is next; it has not started. Earlier entries below describe their own historical scope.

### Implemented

- Read the master plan, architecture, roadmap, progress and operations instructions, then inspected existing payment/quotation/customer schemas, scoped DAL, permissions, RLS/grants, exact-money engine, PDF renderer and isolated harness. Recorded scope before implementation in `PAYMENT_IMPLEMENTATION.md`.
- Added atomic migration 010 without editing 001–009 or updating original financial fields. Current payments have composite-owned customer/division, optional project for accepted standalone quotations, original receipt links, durable request UUID/hash and transactional numbers. New private documents, signed allocations and events are append-only, RLS-scoped and protected against rewrite/delete/truncate. Commit requires the matching stored snapshot/PDF.
- Added manual receipts for cash/UPI/bank/card/other, project advances and accepted standalone quotations. Effective organization admins can record completed refunds or separately labelled receipt corrections with reasons; explicitly authorized operators can record receipts/allocations. Viewers have no payment access; global ADMIN is never a tenant bypass.
- Used exact BigInt paise for entry validation and aggregate balances. Current accepted baseline, receipts, cash refunds and corrections produce net/outstanding/credit independently of allocations. No baseline means no invented amount due. Partial allocations stay in the same project/family; refunds/corrections consume unallocated value first, then append allocation reversals. Source locks cap concurrent adjustments at the original receipt.
- Added responsive searchable/paginated payment list, target lookup, receipt detail/history, private download, allocation and refund/correction forms, and project/quotation balance panels using existing components. Server derives actor/ownership/recording time. Number, payment, immutable snapshot, PDF/hash and audit commit together; failures leave no partial record. Legacy records have no fabricated document or runtime correction path.
- Added durable retries and reload recovery after an interrupted save/allocation response. Browser sessionStorage holds only a request UUID; authenticated actor/current-scope lookup recovers a saved entry once. Same-key changed payloads fail. Source receipt history links refund/correction events, and customer edits/quotation revisions never rewrite stored documents or earlier allocation history.
- Reused PDFKit, shared A4 layout and four licensed Noto fonts for receipt, refund acknowledgement and correction documents. These record staff-confirmed events, with actual/recording times and blank staff signature area; they do not transfer money, authenticate customers or claim tax-invoice status.

### Final verification

All application checks used Node **22.22.2**. Database/browser tests used generated identities and disposable PostgreSQL/HTTPS fixtures, never configured customer data.

| Check                                            | Final result                                                                                                                                                                                                               |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm --prefix operations test`                   | **59 passed**: 49 previous + 8 payment/input/permission/exact-money + 2 PDF tests                                                                                                                                          |
| `npm test`                                       | **56 passed**                                                                                                                                                                                                              |
| `npm --prefix operations run typecheck`          | Passed                                                                                                                                                                                                                     |
| `npm --prefix operations run build -- --webpack` | Passed: compilation, TypeScript, routes and tracing                                                                                                                                                                        |
| `npm run test:operations`                        | **150 passed**: 4 migration runner + 10 tenancy/upgrade + 15 auth/security + 8 business + 14 isolation + 15 customer + 24 quotation + 26 payment database/HTTP + 34 desktop/mobile browser checks                          |
| `npm run lint`                                   | Passed; root ESLint excludes operations TypeScript and no operations-specific lint script exists                                                                                                                           |
| Changed-file Prettier / `git diff --check`       | Passed                                                                                                                                                                                                                     |
| PDF QA                                           | Receipt 1 page, refund 2 pages, correction 1 page: all four synthetic pages rendered and visually inspected; A4/text bounds/English/Devanagari/rupee/long references/notes/signature/footer checked; no replacement glyphs |
| Deployment trace / viewport QA                   | All four font files present in payment PDF route trace; desktop/mobile receipt/refund screens reviewed, browser overflow/action checks passed                                                                              |
| Hosted pool/TLS/staging/backups/restore          | Not run; release gates remain                                                                                                                                                                                              |

Final suites contain no failed/skipped checks. Initial invalid service fixture was corrected to a catalog-backed ID. PostgreSQL startup under the restricted sandbox required the approved disposable harness execution; no configured database was used. The interrupted-save browser assertion initially matched Next's route announcer as well as the form error; it was scoped to the form, and receipt/allocation reload recovery then passed on desktop/mobile. Earlier TypeScript optional print fields were normalized to empty strings. Tests were not weakened or skipped.

Payment integration coverage includes exact aggregate amounts beyond individual entry limits, private PDF/contact immutability, all three divisions/standalone flows, retry/hash conflicts, concurrency/numbering, partial allocations, revisions/baselines, refund/correction caps, source-linked history/pagination, rollback on rendering/storage/audit failure, revoked membership, operator flag/viewer/foreign/division/anonymous denial, direct SQL/HTTP attacks, immutable/no-truncate safeguards and migration preservation/injected rollback.

### Milestone 5 file inventory and setup

- Database: `database/migrations/010_payment_management.sql`, appended matching `database/runtime-grants.sql`.
- Domain/server: `operations/src/lib/payments.ts`, `server/payment-input.ts`, `payments.ts`, `permissions.ts`, scoped payment list/customer readers; `server/documents/payment.ts` and shared A4 wording.
- UI/routes: `operations/src/app/admin/payments/page.tsx`, `actions.ts`, `payment-form.tsx`, `new/page.tsx`, `[id]/page.tsx`, `app/api/admin/payments/[id]/pdf/route.ts`; `components/workflow/payment-summary.tsx`, project/quotation detail summaries and narrow responsive CSS.
- Tests/scripts: `operations/tests/payment.test.ts`, `payment-pdf.test.ts`, `runtime-payments.ts`, payment additions to `browser.spec.mjs`; `operations/scripts/verify-payment-pdf.ts`, `scripts/test-operations.mjs`.
- Documentation: payment implementation/usage, architecture, security/database design, operations README/deployment, roadmap and this progress entry. Next regenerated `operations/next-env.d.ts` during builds; it was not hand-edited.

**No new packages or environment variables.** See [payment usage](PAYMENT_USAGE.md) for approved development/staging migration/grant order, receipt → partial allocation → refund/correction → private PDF walkthrough, balance/retry semantics and legacy reconciliation. Migration 010/latest grants must precede the matching app. Runtime credentials remain non-owner/non-BYPASSRLS. No gateway, subscription, AI automation, advanced scheduling, external sending, tax invoice or organization onboarding was added.

**Next:** Milestone 6 — manual follow-ups, accurate dashboard and division reports. Hosted transaction-pool/TLS, reviewed runtime grants, print identity, artifact growth, staging upgrade and backup/isolated restore remain release prerequisites. Production migration/deployment and commit/push require separate explicit authorization.

## Milestone 4 — Complete Quotation Management (10 October 2026)

**Current position:** stages **4A, 4B, 4C and 4D are implemented and verified locally** on `feat/sarathi-business-manager`. Existing uncommitted Milestones 1–3 and original applied migration files were preserved. No configured/production database, deployment, organization onboarding, commit or push was performed. Next planned increment is Milestone 5, after release review; it has not been started.

### Implemented

- Inspected approved plans/instructions, branch/changes, existing schemas/migrations, read-only quotation/payment screens, shared commercial calculator, catalog, customer/project workflows, DAL, grants/RLS and test harness. Recorded the approach/packages before implementation in `QUOTATION_IMPLEMENTATION.md`.
- Added migration 009: explicit quotation division, optional composite-owned project/customer, number/family/revision/edit/submission/tax metadata, exact line amounts, immutable audit/private artifacts, scoped counters, current-row artifact requirement and one accepted baseline per project/family. Existing legacy fields/items/timestamps remain intact. Conflicting historic approved baselines stop the migration atomically for owner review.
- Added exact paise calculations using the existing engine, deterministic discount allocation and verified configurable inclusive/exclusive GST. No registration or tax rates are presumed; default remains No GST charged. Server ignores browser-calculated totals.
- Added responsive catalog/manual multi-item drafts, authorized customer/project lookup, saved/preview server totals, edit-version conflict feedback, request-key retry protection, role-aware lifecycle controls, list search/filter/pagination and complete paginated version/audit history. Standalone offers appear in customer profiles; direct projects still work without quotations.
- Added A4 PDFKit rendering with embedded Latin/Devanagari fonts, rupee symbol, measured/wrapped rows and long tokens, repeated table headers, footer counts and blank authorized signature area. Issued snapshots/bytes/hash/renderer version are privately stored in PostgreSQL in the issue transaction; downloads independently authenticate and enforce current RLS/no-store attachment. No public URLs or storage service.
- Added latest-version revisions, immutable issued content, staff-recorded acceptance/rejection with actor/reference/time, idempotent/concurrent issue and decisions, accepted-baseline replacement within a family and explicit reason-validated Procurement progression. Acceptance never records payment or creates a project automatically.
- Added generation/storage/audit rollback, foreign/customer/division/role/anonymous/direct HTTP/SQL attacks, upgrade preservation/conflict, concurrent numbering/baseline, tax, full history pagination and desktop/mobile regression coverage. Initial migration lookup/locking/default-ownership defects were corrected. Browser testing caught a PDF navigation defect; ordinary download anchors now preserve subsequent actions. The searchbox/route-announcer selectors were corrected. Final runs contain no failed/skipped tests.

### Final verification

All checks used Node **22.22.2** and disposable PostgreSQL/HTTPS fixtures; no configured application database was used.

| Check                                            | Final result                                                                                                                                                                                                                        |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm --prefix operations test`                   | **49 passed**: 31 previous + 15 exact-money/input + 3 PDF tests                                                                                                                                                                     |
| `npm test`                                       | **56 passed**                                                                                                                                                                                                                       |
| `npm --prefix operations run typecheck`          | Passed                                                                                                                                                                                                                              |
| `npm --prefix operations run build -- --webpack` | Passed: compile, TypeScript, static/dynamic routes and tracing                                                                                                                                                                      |
| `npm run test:operations`                        | **118 passed**: 4 migration runner + 10 tenancy/upgrade + 15 auth/security + 8 business + 14 isolation + 15 customer + 24 quotation database/HTTP + 28 desktop/mobile browser checks                                                |
| `npm run lint`                                   | Passed; root ESLint excludes operations TypeScript and no operations-specific lint script is configured                                                                                                                             |
| Changed-file Prettier / `git diff --check`       | Passed                                                                                                                                                                                                                              |
| Operations dependency audit                      | **0 vulnerabilities** after compatible patch updates                                                                                                                                                                                |
| PDF QA                                           | 1-page and 7-page synthetic samples rendered, all 8 pages visually inspected; A4 dimensions, text bounds, English/Devanagari/rupee, rows, totals, terms, signature and footers verified; no extra blank pages or replacement glyphs |
| Deployment asset trace                           | All four font files verified in quotation page/editor/PDF route server traces                                                                                                                                                       |
| Hosted pool/TLS/staging/backups/restore          | Not run; existing release gates remain                                                                                                                                                                                              |

Editor screenshots at desktop and 375px mobile were visually reviewed; browser checks also assert no horizontal page overflow. Tests confirm stored issued bytes remain unchanged after customer edits, all three division/standalone flows work, viewers can download only permitted documents, and decision/project updates leave no payments.

### Milestone 4 file inventory

- Database: `database/migrations/009_quotation_management.sql`, `database/runtime-grants.sql`.
- Packages/build: `operations/package.json`, `package-lock.json`, `next.config.ts`, `README.md`; Next regenerated `next-env.d.ts` (not hand-edited).
- Shared/domain types: `operations/src/lib/commercial.mjs`, `commercial.d.mts`, `quotation-money.ts`, `quotations.ts`, `operations.ts`, `workflow.ts`.
- Server: `operations/src/server/quotation-input.ts`, `quotations.ts`, `lists.ts`, `customers.ts`, `workflow.ts`; `documents/a4.ts`, `documents/quotation.ts`; four Noto font files plus `documents/fonts/LICENSE.txt` and `README.md`.
- UI/routes: `operations/src/app/admin/quotes/page.tsx`, `[id]/page.tsx`, `[id]/edit/page.tsx`, `new/page.tsx`, `actions.ts`, `quote-editor.tsx`, `quote-controls.tsx`, `quote-filters.tsx`; `admin/customer-select.tsx`, `app/globals.css`, `components/workflow/record-detail.tsx`, `app/api/admin/quotations/[id]/pdf/route.ts`.
- Scripts/tests: `operations/scripts/sync-commercial.mjs`, `verify-quotation-pdf.ts`; `operations/tests/quotation.test.ts`, `quotation-pdf.test.ts`, `runtime-quotations.ts`, `browser.spec.mjs`; `scripts/sync-seo-assets.mjs`, `scripts/test-operations.mjs`.
- Documentation: `AGENTS.md`, `docs/QUOTATION_IMPLEMENTATION.md`, `QUOTATION_USAGE.md`, `ARCHITECTURE.md`, `SECURITY_MODEL.md`, `TENANT_ISOLATION_COVERAGE.md`, `OPERATIONS_DEPLOYMENT.md`, `DEVELOPMENT_ROADMAP.md` and this file.

### Packages, setup and limitations

New runtime package: `pdfkit@0.20.2`; dev types: `@types/pdfkit@0.17.6`. Existing Next.js was patched 16.3.5 → **16.3.8**, sharp → **0.35.5** and source-map-js → **1.2.2** within compatible ranges after npm audit identified advisories. Fonts use SIL Open Font License 1.1 with source hashes/license retained. PyMuPDF was installed only in a scratch QA environment, not the application. **No new environment variables.**

See [quotation usage](QUOTATION_USAGE.md) for exact setup commands, preflight query, migration/grant order and local create → draft → issue → PDF → decision → revision walkthrough. On an approved development/staging database only: install from the lockfile, run the existing migration runner, reapply runtime grants as owner, build and start the existing Node application. Do not supply owner credentials to runtime.

GST/business print identity needs owner review before live use. Customer/project/division associations are fixed at draft creation. Historic quotations lacking item/tax provenance or a stored PDF require owner reconciliation rather than fabricated retrospective output. Latin/Devanagari are supported; unsupported glyphs prevent issue with a clear error. Private database artifact growth and hosted function/pool/TLS/backup restore behavior still require staging verification. No verifiable customer approval/signature, automatic project creation, external sending, invoices, receipts, payment recording or balance calculation was added.

**Next:** Milestone 5 — Payments, Advance Collection, Refunds, Balances and Receipts. Keep additional organizations disabled and obtain approval before production migration/deployment or commit/push.

The earlier milestone entries below are historical records of their own scope and verification.

## Milestone 3 — Customer Management V2 (10 October 2026)

Scope confirmed by the user: implement Customer Management V2; retain the local hiring-marketplace strategy for a later roadmap discussion. Branch remains `feat/sarathi-business-manager`. Existing Milestone 2 working-tree changes were preserved. No packages, environment variables, production changes, additional organization onboarding, commits or pushes were introduced.

### Implemented

- Inspected customer schema, list/search/options, creation form/action, DAL, permission resolver, RLS/grants, existing workflow detail and regression harness before editing.
- Added migration `008_customer_management.sql`: normalized-phone/index support, optimistic edit versions, durable organization/actor/request UUID + payload hash, narrow update policy and atomic immutable customer-change auditing. Migrations 001–007 remain untouched by this milestone.
- Reused the authenticated DAL and transactional tenant pool for editing, duplicate detection and profiles. Kept the original contact fields, project picker and linked IDs; frozen quotation customer snapshots and payments remain unchanged.
- Added exact normalized-phone and deterministic similar-name warnings, an explicit separate-customer override, submission-key retry protection and serialized same-phone concurrent checks. No merge or cross-organization candidate data is exposed.
- Added a prepopulated reusable customer form and profile with current design, phone/email validation, optional empty values, keyboard dialog, duplicate-click/loading/error/success handling and stale-edit feedback.
- Added server-paginated linked leads/projects/services/stages, customer/project activity and existing financial read-only tabs. Division labels/history/counts use only accessible records; viewers cannot edit or read payments. No follow-up or balance is fabricated.
- Added four unit tests, fifteen isolated database/HTTP tests and four desktop/mobile browser cases. Updated the old raw customer UPDATE assertion to verify zero unscoped writes and continued denial for ownership/version/audit/delete changes. The existing lead conversion fixture now explicitly confirms its shared-phone customer warning.

### Verification

All final checks ran locally with Node 22.22.2. No configured application database was contacted.

| Check                                            | Final result                                                                                                                                                      |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm --prefix operations test`                   | **31 passed** (27 prior + 4 customer unit tests)                                                                                                                  |
| `npm test`                                       | **56 passed**                                                                                                                                                     |
| `npm --prefix operations run typecheck`          | Passed                                                                                                                                                            |
| `npm --prefix operations run build -- --webpack` | Passed: compilation, TypeScript and route generation                                                                                                              |
| `npm run test:operations`                        | **88 passed:** 4 migration runner, 10 tenancy/upgrade, 15 auth/security, 8 business, 14 isolation, 15 customer database/HTTP and 22 desktop/mobile browser checks |
| `npm run lint`                                   | Passed; root ESLint excludes operations TypeScript, and operations has no separate lint script                                                                    |
| Changed-file Prettier / `git diff --check`       | Passed                                                                                                                                                            |
| Staging runtime/pool/TLS/backups/restore         | Not run; existing release gate                                                                                                                                    |

The initial duplicate-query syntax failure was corrected. The HTTP test's multipart encoding was adjusted to the installed React prefix and streaming field order; the final tests exercise actual authorization/duplicate responses rather than missing-field errors. Added an audit-insertion failure test proving the customer/version update rolls back and a browser double-click check proving only one customer is created. Final isolated runs contain no failed or skipped checks. Desktop/mobile profile screenshots were visually reviewed. The requested webpack build passed; the previously blocked default Turbopack command was not repeated or claimed successful.

### Files changed for Milestone 3

- Database: `database/migrations/008_customer_management.sql`, `database/runtime-grants.sql`.
- Server: `operations/src/server/customer-mutations.ts`, `customers.ts`, `transaction.ts`, `business.ts`, `dal.ts`, `input.ts`, `lists.ts`, `permissions.ts`.
- UI/types: `operations/src/app/admin/actions.ts`, `customers/customers-manager.tsx`, `customers/customer-form.tsx`, `customers/[id]/page.tsx`, `globals.css`, `operations/src/lib/customer-contact.ts`, `operations.ts`.
- Tests: `operations/tests/customer-contact.test.ts`, `runtime-customers.ts`, `runtime-business.ts`, `browser.spec.mjs`, `scripts/test-operations.mjs`.
- Documentation: architecture, security model, tenant coverage, roadmap and this progress file. `operations/next-env.d.ts` may be regenerated by Next type/build tooling; it is not hand-edited.

### Local setup and walkthrough

Use the existing PostgreSQL/Better Auth settings and Node 22+. No new package or environment setup is required. Only on an approved local/development database, apply pending migrations with `npm --prefix operations run migrate`, then reapply `database/runtime-grants.sql` as the migration owner with the existing runtime role (`psql -X -v ON_ERROR_STOP=1 -v runtime_role=sarathi_runtime -f database/runtime-grants.sql`). Supply the database connection using existing local operator configuration; never use owner credentials as `DATABASE_URL`. The automated harness applies all migrations/grants to a fresh temporary database without using configured data.

1. Sign in as ADMIN or OPERATOR; open `/admin/customers` and create a customer with name, valid phone and optional email/address.
2. Repeat the same mobile using `+91` or leading `0`: inspect the warning and existing-profile link. Cancel without saving, or explicitly choose **Create separate customer**, then Save for a genuinely different customer.
3. Open the customer's linked name; choose **Edit Customer**, verify prefilled fields, change contact details and save. Open **Recent activity** to see actor and changed fields. Two simultaneous stale edits must not overwrite each other.
4. Inspect projects/services, converted leads, existing quotations/payments and pagination. Compare an admin with a Smart-only operator; inaccessible division records must stay absent.
5. Sign in as VIEWER: creation/edit controls and payments are absent. Verify existing lead conversion, project service selection and stage history remain functional.

Staging runtime/pool/TLS/backup-restore validation remains a release gate. Duplicate warnings are advisory, capped at ten and intentionally use deterministic normalized-name matching rather than probabilistic fuzzy matching. No standalone follow-up data model exists, so none is displayed. Financial tabs are read-only records, not an authoritative balance calculation.

Next after verified Milestone 3: **Milestone 4 — Manual Quotation Entry, PDF Generation and Acceptance Workflow**. Do not begin it in this increment; the hiring strategy remains deferred.

Updated 10 October 2026. Branch: `feat/sarathi-business-manager`. Working-tree changes from the existing project-service milestone were preserved. [Historical service-selection progress](BUSINESS_MANAGER_PROGRESS.md) and [previous remediation status](OPERATIONS_IMPLEMENTATION_STATUS.md) remain references.

## Milestone 2 — 10 October 2026

**Current development position:** organization ownership and tenant isolation for every existing business access path are implemented and verified locally. The next product increment is organization-scoped customer editing, duplicate warnings and linked history. Additional-organization onboarding stays disabled until staging/backup/pool review. Quotation/payment writes remain deferred.

### Implemented

- Audited the full source tree and recorded the pre-change coverage matrix in `TENANT_ISOLATION_COVERAGE.md` before implementation. Preserved the previous uncommitted organization/service-selector work.
- Added migration **007_business_ownership.sql**: mandatory organization ownership on ten existing business tables, lead/project division ownership, validated composite relationships including audit actors, scoped SKU/idempotency uniqueness and indexes. Constant ADD COLUMN defaults backfill without UPDATE, preserving original frozen/append-only records and timestamps; runtime defaults require bound server context.
- Centralized identity lookup, effective membership roles and authorization. Every DAL/list/detail/dashboard/options/mutation path uses a scoped transactional database facade. Rechecks occur on checkout and RLS checks revocation per statement; LOCAL settings do not survive pool reuse. Owner/superuser/BYPASSRLS/role-creation/database-creation configurations fail closed.
- Scoped staff listing and role changes to the current organization; revoked the runtime global role function. Shared identity ceiling changes are owner-managed, including inactive memberships. Organization admins cannot modify another membership or demote themselves. Existing single-membership role behavior remains tested.
- Preserved lead conversion division, saved service arrays, stage locking, optimistic conflict checks and atomic audit writes. An authenticated actor is required for history; final-audit failure tests still verify full rollback.
- Owner provisioning/recovery checks the selected active organization using optional `SARATHI_ORGANIZATION_SLUG=sarathi`; provisioning checks its active Smart Solutions division transactionally. No additional runtime metadata write or financial/delete grant was added.
- Added bidirectional read/search/detail tests, foreign IDs/references, division/financial/staff restrictions, stale contexts, revoked HTTP sessions, pool reuse, owner misconfiguration, direct server-action HTTP requests and ten-table immutable upgrade/rollback checks.

### Final verification

Supported local Node: **22.22.2**. All tests below executed locally; no configured database was contacted.

| Check                                            | Result                                                                                                                              |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `npm --prefix operations test`                   | **27 passed**                                                                                                                       |
| `npm test`                                       | **56 passed**                                                                                                                       |
| `npm --prefix operations run typecheck`          | Passed; final webpack build also verified TypeScript                                                                                |
| `npm --prefix operations run build -- --webpack` | Passed: compilation, types and route generation                                                                                     |
| `npm run test:operations`                        | **69 passed:** 4 migration runner, 10 metadata/upgrade, 15 HTTP/auth, 8 business, 14 isolation and 18 desktop/mobile browser checks |
| `npm run lint`                                   | Passed; root ESLint excludes operations TypeScript and there is no separate operations lint script                                  |
| Changed-file Prettier / `git diff --check`       | Passed                                                                                                                              |
| Default Turbopack build                          | Previously blocked by local CSS-worker port `EPERM`; not rerun or claimed successful in Milestone 2                                 |
| Staging/provider pool/TLS/backups/restore        | Not run                                                                                                                             |

Tighter authorization exposed a nondeterministic old fixture selecting an inactive admin; it now selects the known active test identity. Dashboard browser assertions now count the authenticated organization rather than foreign fixture rows. Direct-action tests use the existing RSC/error-only result contract. These test corrections preserve the intended boundary and all existing workflow checks. Final runs have no failed/skipped checks. No new dependency was installed and no historical migration 001–006 was edited.

### Changed files in Milestone 2

| Area                      | Files                                                                                                                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database                  | `database/migrations/007_business_ownership.sql`, `database/runtime-grants.sql`                                                                                                                                           |
| Server                    | `operations/src/server/identity.ts`, `tenant-pool.ts`, `tenancy.ts`, `dal.ts`, `business.ts`, `lists.ts`, `workflow.ts`                                                                                                   |
| Owner tools/config        | `operations/scripts/provision-admin.ts`, `recover-admin.ts`, `operations/.env.example`                                                                                                                                    |
| Tests/harness             | `operations/tests/runtime-isolation.ts`, `runtime-tenancy.ts`, `runtime-business.ts`, `runtime-fixtures.ts`, `browser.spec.mjs`, `scripts/test-operations.mjs`                                                            |
| Engineering documentation | `AGENTS.md`, `docs/ARCHITECTURE.md`, `SECURITY_MODEL.md`, `DATABASE_DESIGN.md`, `SARATHI_MASTER_PLAN.md`, `DEVELOPMENT_ROADMAP.md`, `DEVELOPMENT_PROGRESS.md`, `TENANT_ISOLATION_COVERAGE.md`, `OPERATIONS_DEPLOYMENT.md` |

The working tree also contains the preserved earlier foundation/service-selector changes listed in the historical increment below. Generated `operations/next-env.d.ts` remains uncommitted. No commit, push, deployment, staging or production migration was performed.

### Reproduce locally

From the Sarathi repository root, activate Node 22+; Homebrew on this Mac can use `export PATH="/opt/homebrew/opt/node@22/bin:$PATH"`. Existing prerequisites are PostgreSQL binaries (`initdb`, `pg_ctl`, `psql`), OpenSSL and Chromium. On a fresh checkout, install pinned dependencies with `npm ci` and `npm ci --prefix operations`, then install Chromium with `npx playwright install chromium`.

```sh
npm --prefix operations test
npm test
npm --prefix operations run typecheck
npm --prefix operations run build -- --webpack
npm run test:operations
npm run lint
git diff --check
```

The isolated harness generates credentials, overrides inherited database/auth settings, creates and cleans a private PostgreSQL cluster, applies all migrations, switches the app to a restricted role, starts disposable HTTPS on ports 3107/3108 and runs actual HTTP/actions/browser tests. It does not use the database in `.env.local`. Stop only your own services using those ports before running; the harness will fail on conflicts. Manual local/staging configuration must use a dedicated database, owner migrations plus latest runtime grants, a separate restricted `DATABASE_URL`, and an exact auth origin; see `OPERATIONS_DEPLOYMENT.md`. Do not run migrations against production as a test.

### Remaining limits and next work

No known cross-organization gap was found in the current implemented paths under the isolated restricted-role tests. Owner credentials intentionally bypass application policies; hosted pooling, staging grants/security/TLS and backup restore remain release gates. There is no tenant switcher, organization onboarding, invite/division-assignment/revocation/removal UI, export/file module or financial-write workflow. Metadata changes remain privileged owner administration. Shared identities cannot have their global ceiling raised by a tenant administrator. New forms default to authorized Smart Solutions or a sole assigned division; ambiguous assignments need a future authorized selector before broader division writes.

Review Milestone 2, then develop **customer editing, advisory duplicates and linked history** using the same scoped boundary and regression pattern. Keep quotation/payment write workflows gated until that review; additional organization activation requires separately verified staging setup.

## Previous increment — 9 October 2026

## Audit and increment

- Inspected branch/changes, auth/session/role/DAL, PostgreSQL schema/grants/migration runner, service selection and deployment/test harness.
- Added durable root `AGENTS.md` and the master plan, architecture, database design, security model and roadmap.
- Reproduced the pending full-runtime verification: 4 migration, 15 HTTP/security and 8 business tests passed; 16/18 browser tests passed. The two failures expected a named project link, but desktop used a navigation button and mobile title was plain text. Saved data was present.
- Changed project titles to native Next.js links on both layouts, preserving styling and workflows; the existing browser test remains the regression check.
- Added atomic metadata migration 006 with Sarathi's three divisions, membership role/active-state backfill and same-organization assignment constraints. Existing business/authentication data is unchanged.
- Added server context resolution with active-state checks, role intersection, explicit operator financial authorization and permitted division lists; added a protected read-only context API. Owner provisioning creates initial membership in the same account transaction; new runtime metadata grants are read-only.
- Added unit and isolated PostgreSQL/HTTP tests for role restrictions, cross-organization context denial, revocation, composite FK integrity, runtime write rejection and migration rollback/backfill.

## Verification

Local Node 22.22.2; use `/opt/homebrew/opt/node@22/bin` first in PATH.

| Command/check                                    | Final result                                                                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `npm --prefix operations test`                   | Passed: 27 unit tests, including new membership/permission/division checks.                                               |
| `npm test`                                       | Passed: 56 public-site unit tests; public-site implementation preserved.                                                  |
| `npm --prefix operations run typecheck`          | Passed. The final webpack build also completed TypeScript verification.                                                   |
| `npm --prefix operations run build`              | Blocked: existing Turbopack CSS worker port binding restriction, `EPERM`; no success claimed.                             |
| `npm --prefix operations run build -- --webpack` | Passed: compilation, TypeScript and route generation, including organization context.                                     |
| `npm run test:operations`                        | Passed: 4 migration, 9 organization/DB/HTTP, 15 auth/security, 8 business and 18 desktop/mobile browser tests (54 total). |
| `npm run lint`                                   | Passed; root ESLint still does not cover operations TypeScript.                                                           |
| Changed-file Prettier and `git diff --check`     | Passed.                                                                                                                   |
| Staging access/TLS/backups/restore               | Not run; pending before production.                                                                                       |

The previously failing project-service browser checks now pass on desktop and mobile. The new foreign-key test fixture was adjusted to avoid an existing primary-key pair masking its intended FK check. No application security check was weakened. Runtime tests use fresh disposable databases and generated identities; the configured application database was not contacted.

## Files changed in this increment

| Area                         | Files                                                                                                                                                                                    |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PostgreSQL foundation/grants | `database/migrations/006_organization_foundation.sql`, `database/runtime-grants.sql`                                                                                                     |
| Server context/API           | `operations/src/server/tenancy.ts`, `operations/src/app/api/admin/organization-context/route.ts`                                                                                         |
| Provisioning/navigation      | `operations/scripts/provision-admin.ts`, `operations/src/app/admin/projects/projects-manager.tsx`                                                                                        |
| Tests/harness                | `operations/tests/tenancy.test.ts`, `operations/tests/runtime-tenancy.ts`, `operations/tests/runtime-fixtures.ts`, `operations/tests/runtime-security.ts`, `scripts/test-operations.mjs` |
| Durable instructions/design  | `AGENTS.md`, `docs/SARATHI_MASTER_PLAN.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE_DESIGN.md`, `docs/SECURITY_MODEL.md`, `docs/DEVELOPMENT_ROADMAP.md`                                   |
| Progress/deployment          | `docs/DEVELOPMENT_PROGRESS.md`, `docs/BUSINESS_MANAGER_PROGRESS.md`, `docs/OPERATIONS_DEPLOYMENT.md`                                                                                     |

The pre-existing project-service selector/input/style/test changes were retained. `operations/next-env.d.ts` was already modified and is generated by Next.js; no handwritten change was made to it. No dependency/package changes or historical migration edits were required.

## Next

Complete phase 2b: organization-owned business records and request-scoped authorization across **all** lists, details, counts, writes, conversion/stage transactions and staff administration. Add cross-organization business read/write regression tests before enabling more organizations. Metadata/context checks alone do not secure the historical global application.

Staging authentication, actual runtime role/TLS/pool configuration and backup restore are pending. No production database, migration, deployment, commit or push was performed.
