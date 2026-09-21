# Sarathi Smart Solutions V1 implementation plan

Date: 20 September 2026

Source: `Sarathi_Smart_Solutions_System_Design_Technical_Documentation.docx`, sections 1–20.

This plan extends the existing public website into a private business operations system. The first implementation milestone is a database foundation and independently testable commercial calculations. The first usable business milestone is enquiry → customer/project → BOM → frozen quotation. Subsequent phases complete surveys, payments, installation, and warranty records.

The original `IMPLEMENTATION_PLAN.md` describes the existing static website. This document governs the new operations platform. Existing uncommitted website and deployment changes belong to the current workspace and must be preserved.

## Phase 0 — Discovery and implementation boundaries

Discovery completed before foundation implementation:

| Evidence                                                            | Current behavior                                                            | Consequence                                                                                             |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `package.json`, `tests/recommendation.test.mjs`                     | ESM JavaScript, Node built-in tests, ESLint, Playwright                     | Start with dependency-free `.mjs` domain code and existing test discovery.                              |
| `recommendation.mjs`, `app.js`                                      | Public service catalogue, recommendation text, WhatsApp enquiry preparation | Reuse catalogue identifiers and requirement fields; these are not persisted leads or formal quotations. |
| `app.js`, `README.md`                                               | Customer must send the prepared WhatsApp message; no backend submission     | Do not display “saved” or “booked” until a real server transaction succeeds.                            |
| `scripts/site-config.mjs`, `scripts/build.mjs`, `scripts/serve.mjs` | Explicit public-file allowlist                                              | Private source, SQL, costs, and snapshots must remain outside the static build and preview routes.      |
| `IMPLEMENTATION_PLAN.md`                                            | Records the existing static architecture                                    | Preserve it as historical implementation documentation; introduce the operations runtime separately.    |

Baseline verification: 15 unit tests and ESLint passed before changes. Local PostgreSQL 18 binaries are installed; no running database was available at discovery. Database checks must create a disposable test cluster, not use an existing business database.

### Documented APIs and patterns

- Copy the `test(name, fn)` and `assert.equal` / `assert.deepEqual` / `assert.throws` patterns in `tests/recommendation.test.mjs`; see the [Node test runner](https://nodejs.org/api/test.html) and [strict assertions](https://nodejs.org/api/assert.html).
- Follow [PostgreSQL constraints](https://www.postgresql.org/docs/current/ddl-constraints.html): pair `CHECK` with `NOT NULL`; use foreign keys and unique constraints for relationships. A `CHECK` must not attempt to validate totals in other rows.
- Use the documented [trigger syntax](https://www.postgresql.org/docs/current/sql-createtrigger.html), including `BEFORE UPDATE OR DELETE ... FOR EACH ROW EXECUTE FUNCTION`, to protect issued quotation content and immutable payment records.
- Follow [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html). Allocate quotation versions under a project-row lock plus a unique constraint; do not use unprotected `MAX(version) + 1`.
- Before implementing the Next.js runtime, reread the [Next.js authentication guide](https://nextjs.org/docs/app/guides/authentication). Put authorization close to data access and inside each mutation. Layout restrictions and hidden buttons are insufficient.

These references establish patterns, not package-version choices. Pin and verify framework, ORM, and authentication versions when Phase 2 starts. Never invent library methods from this plan.

## Business rules resolved for implementation

### Money and rounding

The initial currency is INR. This is an explicit implementation assumption based on the existing Indian business site, not a multi-currency feature.

- Accept money as decimal strings with at most 12 integral digits and two fractional digits. Accept positive quantities with at most nine integral digits and three fractional digits. Accept percentages from 0 to 100 with at most two fractional digits.
- Reject JavaScript numeric inputs, exponents, whitespace, negative costs, excessive precision, and overflow. Return money as strings with exactly two fractional digits.
- Calculate with scaled integers internally. Round each quantity × unit amount to paise, half up, before summation. Round percentage amounts to paise. Round signed margin percentages half away from zero.
- Store monetary fields as PostgreSQL `numeric(14,2)` and quantities as `numeric(12,3)`. The application must validate precision before insertion because PostgreSQL numeric coercion can round incoming values.
- Only omitted optional inputs receive defaults. Explicit invalid inputs must fail visibly.

### Costing and advance

```text
materialCost = sum(round(quantity × unitCost))
materialContingency = round(materialCost × contingencyPercent / 100)
materialFundingRequirement = materialCost + materialContingency + supplierDelivery
estimatedProjectCost = materialFundingRequirement + technicianLabour + transport
                     + otherDirectCost + warrantyCallbackProvision
quotationSubtotal = sum(round(quantity × rate))
netRevenue = quotationSubtotal + serviceCharges - discount
quoteTotal = netRevenue + taxAmount
estimatedProfit = netRevenue - estimatedProjectCost
profitMarginPercent = estimatedProfit / netRevenue × 100, or null when netRevenue = 0
percentageAdvance = round(quoteTotal × targetAdvancePercent / 100)
recommendedAdvance = min(quoteTotal, max(percentageAdvance, materialFundingRequirement))
fundingShortfall = max(materialFundingRequirement - recommendedAdvance, 0)
plannedBalance = quoteTotal - recommendedAdvance
```

The default target advance is 50%, a configurable initial assumption rather than an approved customer term. Discounts cannot exceed subtotal plus service charges. Tax is an explicit supplied amount in the foundation; no tax rate or registration status is inferred. Tax is excluded from revenue and profit. Enter project costs on a consistent basis including nonrecoverable costs; tax recovery and accounting are outside this phase.

If material funding exceeds the quote total, the calculator returns a capped advance and an explicit funding warning. The later quotation-issue service must require repricing or an admin acknowledgement with a reason. Never silently hide the shortfall. Zero-value drafts may be calculated; issuing free work requires an explicit reason in the later service.

### Payments

```text
netReceived = totalReceipts - totalRefunds
outstandingBalance = max(acceptedQuoteTotal - netReceived, 0)
overpayment = max(netReceived - acceptedQuoteTotal, 0)
advanceOutstanding = max(agreedAdvance - netReceived, 0)
```

Receipts and refunds are separate positive, append-only entries. Aggregate refunds cannot exceed receipts. The pure calculator evaluates a complete ledger independent of order; the payment service must enforce the limit transactionally when recording a refund. Outstanding balance comes from actual receipts, not the planned balance after advance. An idempotency key prevents retrying a payment request from creating duplicates.

Draft or superseded quotations do not create a new receivable. Phase 5 must designate one active accepted quotation for a project and allocate payments consistently. Changing an accepted quotation after receipts requires a documented revision/adjustment policy, not replacing its historic total.

### Lifecycle and visibility

Separate the states that the source document combines:

- Lead: new, contacted, qualified, converted, lost.
- Project operations: survey pending, survey complete, costing, procurement, installation scheduled, installation in progress, testing, completed, cancelled.
- Quotation: draft, sent, approved, declined, superseded, void.
- Payment position: derived from accepted commercial terms and net receipts.
- Hold: a reversible project flag with reason/history, preserving the operational state.
- Warranty: asset dates and service history, independent of project completion.

The database initially constrains valid state values. Phase 3 adds allowed transitions, required evidence, optimistic conflict checks, and transactional history. A state enum alone is not workflow enforcement.

Customer output must use an explicit allowlist containing customer-facing identity, scope, item descriptions, quantities, rates, totals, terms, and dates. It must omit purchase rates, supplier prices, labour cost, profit, internal notes, and funding warnings. Never serialize an ORM project or costing object directly into HTML, React props, PDF data, or a public JSON response.

## Phase 1 — Commercial and relational foundation

Status: implemented and verified locally on 20 September 2026. This completes the foundation milestone, not the end-to-end operations application.

### Deliverables

1. Add `server/domain/commercial.mjs` with `calculateCommercials(input)` and `calculatePaymentPosition(input)`. Use the contract above and copy the repository's pure-module and test patterns.
2. Add `tests/commercial.test.mjs` covering worked examples, fractional quantities, rounding, malformed inputs, overflow, discounts, tax exclusion, zero revenue, negative margin, capped advance, partial payments, refunds, and overpayments.
3. Add `database/migrations/001_commercial_foundation.sql`, applied atomically, and `database/README.md` with migration and verification instructions.
4. Model users/identity references, customers, leads, projects, products, project cost inputs, BOM items, quotations, quotation items, payments, and status history. Add appropriate foreign keys, indexes, uniqueness, and value constraints.
5. Protect issued quotation content and child items from later modification. Keep allowed lifecycle metadata mutable. Lock the parent quotation when editing children to prevent a concurrent freeze race.
6. Make payment records append-only and reject quotation references belonging to a different project. Record actor/timestamps; preserve history.
7. Add real SQL verification using a temporary local PostgreSQL cluster. Do not create or modify a production database.

### Verification and guards

- Run unit tests, ESLint, formatting for changed files, and the existing static build with a verification-only site origin.
- Execute the migration and SQL tests against PostgreSQL; verify constraints, frozen headers/items, payment integrity, and cleanup of the disposable cluster.
- Verify `server/` and `database/` never enter `dist/` or the preview-server allowlist.
- Do not use floating-point money arithmetic, broad object serialization, mutable issued quotes, or database credentials in client code.
- This phase does not deliver authentication, an API, lead persistence, admin screens, PDF generation, or a deployed operations system. Database tables are not authorization controls.

## Phase 2 — Application runtime and administrator access

### Implementation

Read the Next.js authentication guide and the chosen pinned authentication/ORM documentation before adding dependencies. Create a TypeScript Next.js runtime with a server-only data-access layer, standard secure-session library, environment validation, and migrations integrated through one authoritative migration history. The Phase 1 SQL must be imported/baselined explicitly if the selected ORM has its own migration tracker; do not initialize a second competing schema.

Keep the existing public website operational during construction. Copy service content and brand assets from the current catalogue/site when moving public routes into Next.js. Preserve current anchor links, policy URLs, contact details, mobile behavior, and SEO. Reuse the tested calculation module behind typed server adapters. Make the final public-route switch only after parity tests pass.

Provision admin identity without public signup. Add login, logout, session revocation, inactive-user rejection, CSRF/origin protections, and durable/shared rate limiting. Select hosting only after checking PostgreSQL connectivity, Node PDF support, private object storage, and backup/restore capabilities.

### Verification and guards

- Verify private routes and each mutation reject anonymous/inactive users; test session expiry/logout and cross-origin requests.
- Ensure secrets and database packages cannot enter client bundles.
- Run existing public-site Playwright scenarios against the migrated routes before replacing production hosting.
- Never deploy the private application as static-only hosting, hand-roll password/session cryptography, or claim a hidden admin URL provides access control.

## Phase 3 — Persisted leads and the first usable commercial workflow

### Implementation

Read `app.js` lead-form validation and `recommendation.mjs` requirement formatting before adding a narrowly scoped public enquiry endpoint. Validate on the server, retain the requirement payload and consent record, rate-limit abuse, and return only an opaque submission acknowledgement. Do not return customer/project/internal IDs or search capabilities.

Build admin lead list, customer selection/creation, and lead-to-project conversion in one transaction. Make retries idempotent. Support multiple service needs per project from the existing catalogue. Do not merge customers merely because a phone matches without admin review.

Add products, project costing inputs, editable BOM and customer-facing quotation items. Recompute totals server-side using Phase 1. Allocate quotation versions while locking the project row. Freeze a customer-facing snapshot when issued, with addresses, descriptions, prices, tax presentation, terms, and rounding policy preserved. All PDF and customer-page output must read the frozen projection. Resolve business wording/tax settings before enabling issue/send.

### Verification and guards

- Integration test enquiry → lead → customer/project → BOM → issued quotation and retry behavior.
- Test simultaneous lead conversion and quotation version allocation.
- Change catalogue rates after issue and verify historical quotation content stays identical.
- Test attempts to inject costs/supplier fields into public responses and snapshot payloads.
- Verify transition updates and history writes commit or roll back together.

## Phase 4 — Mobile surveys, photos, PDF, and customer sharing

### Implementation

Read the chosen S3 SDK's current upload/signing documentation and PDF renderer documentation. Add `site_surveys`, `survey_points`, and `survey_photos` through a new migration with project relationships and object metadata.

Support field-work drafts, image compression, size/count limits, server-side file inspection, orientation handling, and EXIF removal. Use generated object keys, private storage, short-lived signed uploads/reads, and ownership checks. Model upload pending/ready/failed so an interrupted upload cannot masquerade as a stored photo; provide retry and orphan cleanup.

Render PDFs from the immutable customer snapshot through one explicit data projection. Add manual WhatsApp sharing. If enabling `/q/[token]`, use at least 32 random bytes, store only a token hash, bind it to one quotation version, default to 30-day expiry, and support revocation. Treat expiry as configurable. Reissuing a link invalidates the old one. Apply no-store/noindex/no-referrer behavior and redact tokens from logs. Do not include private survey images by default.

### Verification and guards

- Test phone viewport, permission denial, interrupted upload, invalid image content, wrong-project access, and expired signatures.
- Assert PDFs and customer HTML/JSON contain only allowlisted fields, including HTML escaping of user content.
- Verify expired/revoked/wrong tokens fail without exposing resource existence.
- No public storage bucket, user-controlled storage path, guessed SDK method, or automatic WhatsApp send.

## Phase 5 — Payments, procurement, installation, and service

### Implementation

Build receipt/refund recording around the append-only ledger and Phase 1 payment calculator. Lock the project's payment/accepted-quotation context while checking refunds and recording idempotent mutations. Record refunds against original receipts and use an explicit correction workflow. Review credit/adjustment behavior before allowing post-payment quotation changes.

Add lightweight procurement records for required items, ordered/received quantity, supplier, expected date, and actual cost. This is project procurement, not warehouse inventory or accounting. Keep actual cost separate from quoted estimates.

Add installation dates, technician assignment, testing/completion evidence, and hold/resume reasons. Add installed assets/serial numbers, customer and supplier warranty periods, service visits, notes, and outcomes. Completion does not automatically delete outstanding amounts or end warranties.

### Verification and guards

- Test partial advance, multiple receipts, duplicate retries, refunds, overpayments, and concurrent refund attempts.
- Test approved-quote revisions with existing payments and audit history.
- Verify hold/resume preserves the prior operational state and warranty survives completion.
- Exercise the full mobile flow through payment and installation completion.
- Do not overwrite financial history, conflate planned advance with received cash, or introduce full accounting/inventory scope.

## Phase 6 — Release verification and recovery

### Implementation

Reread the source document's security, portability, testing, and V1-done sections. Configure database backups plus separately stored dumps, object backups/retention, migration rollout/rollback procedure, restore rehearsal, error monitoring, and log redaction. Add container/environment deployment instructions and a provider-exit rehearsal.

Initial operational targets to confirm before launch: daily database backups, a maximum 24-hour data-loss window, a restore exercise targeting four hours, and phone usability on ordinary mobile broadband. Measure core admin navigation at p95 under two seconds under an explicitly recorded test workload; do not treat the document's “feel immediate” wording as a measured result.

### Release gate

- Verify implemented APIs against pinned documentation and grep for known unsafe patterns.
- Unit/integration/authorization/concurrency tests, mobile E2E, public-site regressions, and migration tests pass.
- Restore an isolated database and private photos; record duration and counts/checksums.
- Verify backup credentials, expiry, rate limits, financial visibility, and logs in the deployed environment.
- Run at least one owner-reviewed real project through the full workflow before expanding V2 scope.
- Deployment and production data entry are separate from completion of the local foundation.

## Decisions still needed before the relevant phase

| Decision                                                                                               | Needed by          | Safe interim behavior                                                  |
| ------------------------------------------------------------------------------------------------------ | ------------------ | ---------------------------------------------------------------------- |
| Admin login/recovery method, ORM, hosting                                                              | Phase 2            | No exposed backend; no invented credentials.                           |
| Legal business identity, currency confirmation, tax configuration, quote validity and warranty wording | Phase 3 issue/send | Draft-only commercial data; no inferred tax rate.                      |
| Advance percentage, free-work and funding-shortfall approval policy                                    | Phase 3 issue/send | Configurable 50% planning assumption; show explicit warning.           |
| Photo retention, customer-link lifetime                                                                | Phase 4            | Private photos; proposed 30-day links only after token controls exist. |
| Receipt correction, refunds, accepted-quote revision policy                                            | Phase 5            | Append-only foundation; no financial edit UI until policy is encoded.  |
| Backup retention, recovery targets, production domain/provider                                         | Phase 6            | Local testing only; confirm targets and rehearse recovery.             |

## Session verification record

Implemented files:

- `server/domain/commercial.mjs` and `tests/commercial.test.mjs`: exact calculations and payment reconciliation.
- `database/migrations/001_commercial_foundation.sql`: relational schema, quote freezing, immutable payment/history records, and table-truncation guards.
- `database/tests/commercial_foundation.sql`, `scripts/test-database.mjs`, and `database/README.md`: executable database verification and migration instructions.
- `package.json`: `npm run test:db`; `eslint.config.js`: built-in globals for private domain modules.

Verification results follow. ESLint passed, and all changed code and Markdown files passed targeted Prettier checks. Temporary PostgreSQL test directories were removed after verification.

| Check                                            | Result                                                                                                                                                                        |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                                       | 33 passed: 15 existing and 18 commercial tests.                                                                                                                               |
| Independent arithmetic review                    | 3,465 cost/revenue/advance combinations satisfied reconciliation invariants.                                                                                                  |
| `npm run test:db`                                | PostgreSQL 18 checks passed in a disposable local cluster: migration rollback, version recording, constraints, immutable snapshots, payment integrity, and protected history. |
| Concurrent quotation freeze                      | A second session's item insert waited for the freeze lock, then failed after commit; no item persisted.                                                                       |
| `SITE_URL=https://sarathi.example npm run build` | Passed; verification origin only, not a published site.                                                                                                                       |
| `npm run test:e2e`                               | All 28 existing browser tests passed.                                                                                                                                         |
| Public output isolation                          | Exactly the 21 allowlisted public files; no private domain, SQL, or plan files.                                                                                               |
| Code review                                      | Project-state alignment and TRUNCATE gaps corrected; no remaining Phase 1 blocker identified.                                                                                 |

The calculation module and schema are not yet connected to a server or admin UI. Authentication, persisted public enquiries, application-level authorization, full transaction services, PDF generation, and production deployment remain in later phases. Real business tax/terms configuration is still required before issuing customer documents. The original Word document and existing website behavior were preserved.
