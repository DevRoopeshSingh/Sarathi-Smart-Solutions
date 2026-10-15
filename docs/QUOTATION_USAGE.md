# Quotation management — Milestone 4

This increment extends the existing Next.js/Better Auth/PostgreSQL application. All four stages are implemented locally; exact verification results are recorded in [development progress](DEVELOPMENT_PROGRESS.md). Existing uncommitted Milestones 1–3 are preserved. No production database, deployment, additional organization onboarding, commit or push was performed.

## Data and financial rules

Migration `009_quotation_management.sql` reuses quotations/items and adds explicit division ownership, optional project association, title/number, family/root/parent revision references, draft edit versions, request UUID/hash and tax treatment. Existing rows inherit their project's division when the new division field is NULL, without modifying frozen content or original timestamps. New runtime rows require explicit valid division, a request reference, current tax treatment and a composite same-organization customer FK; linked projects must match organization, division and customer.

Exact amounts are decimal strings and BigInt paise. The existing commercial engine rounds each quantity/rate line half up before summing. Overall discount is allocated proportionally with deterministic largest remainders. Exclusive GST is rounded per discounted line; inclusive GST extracts the tax from each discounted line. The server independently calculates subtotal, allocated discount, net/tax and grand total, ignoring browser totals. Supported bounds: 100 items, positive quantity with up to three decimals, money up to 999999999999.99 with two decimals, description 2000 characters and terms 10000 characters. INR only. There is no cost/BOM, payment, balance or profitability write in this milestone.

Tax defaults to **No GST charged**. GST is unavailable until the owner records a verified GSTIN and approved rates in the existing division's `document_settings`. No registration or tax rate is presumed. This is a quotation, not a tax invoice. The financial policy and print identity must be reviewed with the owner before enabling GST on a real division.

Database statuses stay compatible (`DRAFT`, `SENT`, `APPROVED`, `DECLINED`, `SUPERSEDED`, `VOID`). UI labels are Draft, Issued, Accepted and Rejected. Expired is derived for issued offers from validity date in Asia/Kolkata; expiry does not cancel an already accepted baseline. Commercial version numbers on linked projects retain the existing project-wide version sequence, so revision numbers may have gaps between separate quotation families. The issued number is allocated by organization/division/India-year, for example `SAR-SMART-2026-000001/R1`.

## Issue, revisions and decisions

Creation retries share a durable actor/organization/request UUID and canonical payload hash. Draft edits use a locked edit version; stale staff edits never overwrite the saved record. Customer, division and project associations are fixed after draft creation. Select an optional existing owned project at creation; otherwise the offer stays a standalone service. No project is automatically created on acceptance. Direct projects still work without any quotation.

Issue locks the project/family and saved quotation, rechecks validity, rates and exact totals, allocates the number and generates the immutable PDF. PDF bytes, SHA-256, renderer version and complete JSON snapshot are inserted into private PostgreSQL storage in the same transaction as the issued status and audit. Deferred integrity checks require a matching artifact before a current quotation can commit as issued. Failure of generation, storage or audit rolls back status, artifact and numbering. The user can safely retry. Issuing an already issued version returns its existing result rather than generating another artifact.

Each revision refers to its original root and immediate parent. Only the latest version can be revised/issued; one pending revision draft is allowed. Issuing a replacement supersedes an unaccepted parent. An accepted parent remains the commercial baseline until the newer revision is accepted. Acceptance supersedes the previous accepted version in the same family; an unrelated accepted project quotation blocks the action. Partial unique indexes enforce one accepted baseline per project and family, even under concurrent requests. Frozen content/items and stored artifacts cannot be updated/deleted. Superseded PDFs remain available to authorized staff.

Acceptance/rejection requires a communication reference and explicit staff acknowledgement, with responsible actor, timestamp and immutable audit event. This records staff communication; it is not verifiable customer authentication or a digital signature. Expired offers cannot be accepted; prepare a new valid revision. Acceptance records no payment. Staff may explicitly move a linked open, unheld project to Procurement. Existing stage rules require an exception reason for skipped stages; closed/later stages are not automatically reopened or reversed. Acceptance and project audit commit together.

## PDF and identity

PDFKit 0.20.2 runs entirely server-side in the existing Node runtime. Local licensed Noto Sans/Noto Sans Devanagari fonts are embedded, including rupee/English/Hindi/Marathi support. Unsupported glyphs fail visibly before issue; no replacement boxes are accepted. The shared A4/font/wrapping utility is reusable later, but no invoices, receipts, work orders or completion reports are implemented now. Long identifiers and rows wrap, tables repeat headings and footers show page counts. The signature area is blank, labelled for authorized staff.

Division display identity comes from the approved organization/division names. Only Smart Solutions' contact fields already verified in the repository are seeded. Other divisions omit unknown addresses/contacts; optional customer/location fields remain blank. Owner-managed `document_settings` supports `legalName`, `address`, `phone`, `email`, `gstVerified`, `gstin`, `gstRates`. Do not insert sample GSTINs, signatures or bank information into live settings.

Issued downloads always return the stored bytes through authenticated `/api/admin/quotations/{id}/pdf`, with current organization/division RLS, `private, no-store`, `nosniff` and attachment disposition. There are no public file URLs, storage credentials or additional storage service. Font assets are explicitly included in Next.js server tracing. Future renderer/font changes do not change existing PDFs. Historical quotations without item/tax provenance or a stored PDF stay readable; automatic historic PDF/revision reconstruction is deliberately unavailable until owner reconciliation, to avoid fabricated commercial terms.

## Setup and release prerequisites

No new environment variables or hosting providers. Keep the existing Node 22+, Better Auth, HTTPS and restricted PostgreSQL runtime setup. New packages are `pdfkit@0.20.2` and dev-only `@types/pdfkit@0.17.6`. Existing Next.js was patched to 16.3.8; sharp/source-map-js were updated within existing compatible ranges after audit identified advisories. Root and operations builds remain separate.

Before applying migration 009 on an approved local/staging database, inspect historical conflicting accepted project baselines as the migration owner:

```sql
SELECT organization_id, project_id, count(*)
FROM sarathi.quotations
WHERE status='APPROVED' AND project_id IS NOT NULL
GROUP BY organization_id, project_id HAVING count(*) > 1;
```

If rows appear, stop and obtain an owner-reviewed reconciliation that retains every original quotation/content/history. The migration fails atomically rather than deleting or choosing a baseline. An isolated test verifies this failure and preservation behavior. Back up and verify restore before a hosted upgrade.

```bash
# From the repository root, with Node 22+ and existing local operator configuration:
npm --prefix operations ci
npm --prefix operations run migrate
# Use the approved owner connection through local operator configuration, never runtime:
psql -X -v ON_ERROR_STOP=1 -v runtime_role=sarathi_runtime -f database/runtime-grants.sql
npm --prefix operations run build -- --webpack
npm --prefix operations run dev
```

For the local development command above, set `BETTER_AUTH_URL` to the exact loopback browser origin, for example `http://localhost:3000`, using the existing `.env.local` setup. Production `start` requires the configured HTTPS reverse proxy/origin; do not treat the HTTP development server as a production deployment.

Apply schema and updated grants together with the matching application after approval. The runtime role never uses migration-owner credentials. Storage backup/restore must include `quotation_documents`; monitor database growth and actual hosted transaction-pool behavior. Additional organization onboarding remains disabled. Production and staging settings/restore are not verified by local tests.

## Local walkthrough

1. Sign in as ADMIN or an assigned OPERATOR and open `/admin/quotes`. Choose **Create quotation**.
2. Search/select an authorized customer, choose an allowed division, optionally search/select that customer's project in the same division. Leave Project blank for a counter service.
3. Enter title, site/delivery address if linked, two or more manual/catalog descriptions, positive quantities, rates, discount, validity and your approved terms. Use **Calculate totals**, then **Save draft** and review the saved server totals.
4. Edit the draft, save and review again. In two tabs, save the first edit and check that the stale second edit shows a reload message.
5. Confirm the saved content and choose **Issue quotation**. Verify the number, download the PDF and confirm A4 layout, rupee symbol, all rows, totals, terms and signature area. Downloads retain the quotation page so subsequent actions work.
6. Enter the actual customer communication reference, acknowledge the staff record and choose **Record acceptance** or **Record rejection**. For a linked project, optionally select Procurement progression and supply a skip-stage reason when required. Check actor/time/reason in quotation audit and project history; no payment should appear.
7. Create a revision of the latest issued/accepted/rejected version, edit and issue. An accepted original remains the baseline until revised acceptance. Compare both PDFs after changing the customer contact details: the original bytes/data must remain fixed.
8. Test search, status filters, expired offers and older event/version pages. A VIEWER sees assigned records/PDFs but no mutation controls. An unauthorized division/organization and an anonymous PDF request must receive no document.

Automated verification uses `npm --prefix operations test`, `npm test`, `npm --prefix operations run typecheck`, `npm --prefix operations run build -- --webpack`, `npm run test:operations`, `npm run lint` and changed-file formatting/diff checks. The integration harness creates disposable PostgreSQL/HTTPS fixtures and never uses configured application data. Root ESLint excludes operations TypeScript; no separate operations lint command is configured.

For synthetic PDF visual QA (no database or real customer data):

```bash
cd operations
node --conditions=react-server --import tsx scripts/verify-quotation-pdf.ts /tmp/sarathi-quotation-qa
```

Render and inspect every page using a PDF renderer. The local review used isolated PyMuPDF in scratch storage; it is not an application dependency. Short and long samples were checked for A4 dimensions, bounds, embedded text, currency, Unicode and visual wrapping/footer/signature layout.

Next planned development: **Milestone 5 — Payments, Advance Collection, Refunds, Balances and Receipts**, after Milestone 4 verification and release review. Do not infer received payments or balances from acceptance.
