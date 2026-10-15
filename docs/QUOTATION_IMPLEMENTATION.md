# Milestone 4 implementation plan

Stages 4A–4D extend existing quotations/items, Better Auth, tenant transactions and workflows. Preserve migrations 001–008 and all earlier changes. No remote migration, organization onboarding, commit, push or deployment is authorized.

## Foundation and lifecycle

Migration 009 will make project association optional, add division ownership, numbering, optimistic draft revisions, creation request keys, family/revision links, tax modes and recorded line calculations. Existing frozen content is preserved; legacy division visibility derives from its project until an explicit new division exists. New writes require a division. Existing project/customer ownership FKs remain and new same-division constraints add protection. Existing statuses remain DRAFT/SENT/APPROVED/DECLINED/SUPERSEDED/VOID; expiry is a validity-derived condition. New immutable quotation events and issued documents use parent RLS and bound actors.

Reuse the existing exact commercial engine for line/subtotal calculations, with integer-paise discount allocation and tax calculations. No totals supplied by clients are authoritative. NONE is the default tax mode; inclusive/exclusive GST is available only for an owner-configured, verified division GST profile and its configured rates. Do not infer registration or hard-code tax rates. Verified Smart Solutions contacts already in the repository may be reused; other divisions omit unverified contact/tax details.

Drafts select an authorized customer/division and optionally an owned same-customer/same-division project. Small services can remain standalone. Existing direct project creation remains independent of quotations. Issue/accept/reject/revise use locks, idempotent lifecycle checks, audit records and a transactionally allocated organization/division/year quotation number. Accepted revisions may replace their own previous accepted baseline; unrelated offers cannot silently replace it. Any procurement progression is explicit, validated using the existing stage/reason policy and does not create payments or claim payment readiness.

## Packages and document assets (documented before installation)

- Add pinned runtime `pdfkit@0.20.2` for server-side A4 generation without browser/native executables or external services.
- Add pinned development `@types/pdfkit@0.17.6`.
- Vendor Noto Sans and Noto Sans Devanagari regular/bold fonts with SIL Open Font License notices for rupee/English/Devanagari text. Record sources and asset hashes.
- Use temporary Python/PyMuPDF tooling only for local PDF render/text/A4 QA; it is not an application dependency or deployment prerequisite.

Issued PDFs and their immutable snapshot/hash are stored in a private PostgreSQL table, bounded to 10 MB per document. Authenticated no-store download routes enforce the same quotation/division RLS; no filesystem writes, public URL or object-storage credentials are introduced. Retaining exact issued bytes preserves the output across future customer/catalog/font/code changes. A shared server renderer will supply reusable typography/wrapping/pagination utilities, implementing quotations only.

## Intended files

Migration/grants; quotation input/calculation/types; shared commercial-engine copy/sync check; server quotation reader/mutations/PDF renderer; existing lists/workflow/customer profile; quote create/edit/detail pages and actions; private PDF/project-options API routes; CSS; fonts/configuration; package/lock files; unit/runtime/browser tests and isolated harness; architecture/security/coverage/deployment/roadmap/progress documentation.

## Verification

Run all requested commands with Node 22 and disposable PostgreSQL. Cover money rounding, draft/item edits, concurrent numbering/acceptance/revisions, safe retries, immutable snapshots, document access, cross-tenant/division/role denial, legacy regressions and 375px UI. Render single/multiple-page A4 PDFs, inspect every page, verify rupee/Devanagari and long-text wrapping. Record actual counts and limits in development progress. Milestone 5 remains out of scope.

Security maintenance: npm audit identified existing Next.js, sharp and source-map-js advisories. Apply the closest compatible patch Next.js 16.3.8 and refresh sharp/source-map-js within their existing dependency ranges; no major-version migration. Re-run the full verification suite after this update.

## Completed outcome

Stages 4A–4D are implemented and locally verified. Final behavior, limits, field/model relationships, file inventory, exact command counts and staging gates are in [development progress](DEVELOPMENT_PROGRESS.md) and [quotation usage](QUOTATION_USAGE.md). This document retains the pre-implementation plan/package rationale. No deployment, commit or additional organization activation was performed.
