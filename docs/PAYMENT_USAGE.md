# Manual payments and receipts — Milestone 5

Locally implemented on `feat/sarathi-business-manager`. This module records staff-confirmed money already received/refunded and append-only receipt corrections. It does not move funds, authenticate a customer or generate a tax invoice. Production migration/deployment and additional organizations remain gated.

## Controlled development/staging setup

Use Node 22+ and existing PostgreSQL/Better Auth configuration. No new dependencies or environment variables are required. Only on an approved development/staging database, with a verified backup and isolated restore:

1. Install operations from the existing lockfile: `npm --prefix operations ci`.
2. Run `npm --prefix operations run migrate` using the existing owner-only `DATABASE_MIGRATION_URL` configuration. It applies pending migrations through `010_payment_management.sql`; do not edit applied migrations or baseline checksum mismatches without review.
3. Reapply `database/runtime-grants.sql` as owner using the existing restricted runtime role: `psql -X -v ON_ERROR_STOP=1 -v runtime_role=sarathi_runtime -f database/runtime-grants.sql`. Use existing operator connection configuration; keep credentials out of commands/logs and app runtime.
4. Build the existing app with `npm --prefix operations run build -- --webpack` and start it using the existing HTTPS setup. `DATABASE_URL` must use a non-owner role without SUPERUSER/BYPASSRLS/owner membership.
5. Verify active organization/division membership and the business print identity before live documents. Effective organization ADMIN can record all manual payment actions. OPERATOR can record receipts/allocations only when its active membership explicitly has `can_record_payments`; enabling that flag is owner-managed, not a browser field. VIEWER cannot read or write payments.

The automated `npm run test:operations` harness creates disposable PostgreSQL and HTTPS fixtures, strips configured database/auth variables and applies all migrations/grants. It never tests configured/production customer data. Hosted pool/TLS, staging upgrade, reviewed grants, backups/restore and artifact storage growth still require release verification.

## Record a receipt

Open Payments → Record receipt, or the permitted payment link on a project/quotation detail. Select a visible existing project for an advance/progress/final receipt, or an accepted standalone quotation for a counter service. Quotation links must belong to the same customer/project/division; an accepted revision family retains its historical records. A project advance does not require an accepted quotation.

Enter a positive INR amount with up to two decimal places, actual payment time in India time, method (cash, UPI, bank transfer, card or other), transaction reference and optional note. References are required except for cash. Confirm that the money was already received, then save. Browser totals are not authoritative; the server validates the exact amount and current authorization.

Number, ledger row, immutable snapshot, stored private PDF/hash and audit commit together. A directly linked accepted quotation receives an automatic full allocation. Open the saved receipt to download its private A4 PDF, view current balance and paginated immutable history. Recording time/actor are server-derived. Changing customer details later does not change the stored document.

## Allocate an advance

Once the same project's current quotation is accepted, open a receipt with unallocated value. Allocate a positive exact amount up to that value to the current accepted baseline. Standalone allocations remain within the same quotation family. The original receipt and PDF remain unchanged; allocation is a new immutable event. It does not create another receipt or alter total money received. An accepted revision changes the current commercial baseline while retaining earlier allocation history.

## Refund or correct a receipt

An effective organization ADMIN opens the original current receipt and chooses the entry type. For a completed cash/bank refund, enter actual amount, method/reference/time and a reason of at least eight characters, then confirm money was already refunded. For a bookkeeping correction, choose Receipt correction, give a correction reference/reason and confirm that it reverses an incorrect entry without transferring money.

Both actions append a source-linked entry, separate numbered private document and audit. Corrections have ADJ numbers and are reported separately from cash refunds. Combined refunds/corrections cannot exceed the original receipt; concurrent submissions are serialized. Unallocated value is consumed first, then automatic negative allocations reverse assigned value while preserving its history. Source receipt history links the adjustment records. To replace an incorrect receipt, reverse the incorrect amount and record the correct receipt separately after checking actual money received.

Financial entries, PDFs and audit history cannot be edited or deleted. Refunds/corrections can target a current original receipt only, never another refund/correction. Mistaken adjustment entries or undocumented legacy records require owner-reviewed reconciliation; do not invent retrospective documents or bypass immutable safeguards.

## Balances and retries

`Net received = receipts − completed refunds − receipt corrections`. With a current accepted quotation, `outstanding = max(accepted total − net received, 0)` and `credit = max(net received − accepted total, 0)`. Without an accepted baseline, the amount due is unknown and net receipts are shown as advance held. Scope is the owned project or standalone quotation family. Allocation is not another cash movement, and these commercial balances are not tax invoices or proof of external bank settlement.

The form retains a durable request UUID until the server confirms success. Retry an uncertain save with the same submitted details. Changing a payload for an already saved UUID is rejected. On reload in the same browser session, the app looks up the pending UUID for the same authenticated actor and current scope and recovers a saved receipt/allocation once. Browser storage holds only that UUID, not customer/form data. If membership/division access is revoked, recovery and downloads are denied. If the original session is lost, inspect the ledger/reference before recording again.

Historical receipts without a stored artifact remain readable to permitted staff but have no fabricated PDF or new runtime refund/allocation path. Review staging print identity, font coverage, function/pool behavior and backup restore before live use. No configured database, production migration, deployment, commit or push was performed during local implementation. Actual verification is recorded in [development progress](DEVELOPMENT_PROGRESS.md). Next planned work is Milestone 6: manual follow-ups, dashboard and division reports.
