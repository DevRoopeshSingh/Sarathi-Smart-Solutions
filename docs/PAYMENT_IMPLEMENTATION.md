# Milestone 5 — manual payments and receipts

Started 12 October 2026 on `feat/sarathi-business-manager`. Preserve the existing uncommitted foundation, customer and quotation increments. This work does not authorize production migration, deployment, commit or push.

## Delivery and policy

1. Extend the existing append-only payments table in migration 010. Keep every legacy amount, reference, actor and timestamp unchanged. Support project advances and accepted standalone quotations; scope all reads/writes through the existing authenticated DAL, TenantPool and RLS.
2. Record cash/UPI/bank/card/other receipts with exact decimal amounts, durable UUID requests and immutable numbered private PDFs in one transaction. Recording acknowledges an already completed movement; it does not transfer money or authenticate a customer.
3. Effective organization admins record reasoned completed refunds or separately labelled bookkeeping corrections against an original current receipt. Serialize concurrent refunds, cap their total at that receipt, and append allocation reversals. Explicitly authorized operators can record receipts and allocations; viewers cannot access payments or write.
4. Append partial allocations of project advances to an accepted quotation in the same project, or to the same standalone quotation family. Never move money between customers/projects/divisions. Preserve old allocations across quotation revisions. Balances use all actual receipts less refunds/corrections and the current accepted commercial baseline; absent a baseline, show no invented amount due. Show credit separately from outstanding amounts.
5. Reuse the current form, pagination, PDF fonts and route patterns. Cover direct SQL/HTTP authorization, tenant/division isolation, concurrent retries/refunds, interrupted-response recovery using only a browser-stored UUID, artifact/audit rollback, legacy preservation and desktop/mobile workflows. Run Node 22 unit tests, TypeScript, the Next webpack build and the isolated PostgreSQL/HTTPS harness. Document actual results and remaining staging gates.

No new service, package, gateway, invoice/tax assumption, external sending, subscription or organization onboarding is introduced. Historical records without a stored document have no fabricated receipt PDF. Hosted pooling/TLS, print identity, grants, backups and restore remain release prerequisites.

## Final local verification — 12 October 2026

Implemented migration 010, narrowly scoped runtime grants, payment/permission/input/money server modules, responsive list/new/detail/allocation/refund/correction flows, project/quotation balance panels and private PDF routes using existing PDFKit/A4/fonts. New artifacts, signed allocations and audit are immutable; original migrations 001–009 and legacy financial fields were preserved. Source receipt history includes its linked adjustments. Accepted standalone quotations work across all three permitted divisions. No package/environment change was required.

Node 22.22.2 checks passed: 59 operations units, 56 root units, TypeScript, Next webpack production build, root lint and 150 isolated PostgreSQL/HTTPS checks (26 payment database/HTTP and 34 desktop/mobile browser checks included). Final runs have no failed/skipped checks. The interrupted-response test selector was scoped to its form to avoid Next's route announcer; coverage was retained. Initial fixture validation and restricted sandbox PostgreSQL startup were resolved using valid catalog fixtures and the disposable approved harness, respectively.

Synthetic receipt (1 page), refund (2 pages) and correction (1 page) PDFs were rendered and all four pages visually reviewed, including English/Devanagari/rupee, long references, notes, footer and signature area. A4/text bounds/glyph checks passed, and all four font assets are present in the payment PDF route trace. Desktop/mobile receipt/refund screens were reviewed; browser checks cover exact source caps, double-clicks, authorized controls and lost receipt/allocation responses followed by reload.

See [usage](PAYMENT_USAGE.md) and [progress](DEVELOPMENT_PROGRESS.md) for setup/results. Hosted pool/TLS, staging grants, print identity, storage growth, backups and isolated restore remain pending release gates. No configured/production database, migration, deployment, organization onboarding, commit or push was performed. Next planned increment is Milestone 6: manual follow-ups, dashboard and division reports.
