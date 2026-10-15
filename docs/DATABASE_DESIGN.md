# Database design

## Existing schema

Reuse `sarathi.users`, Better Auth identity/session/account/MFA tables, customers, leads, projects, products, project_costings, bom_items, quotations, quotation_items, payments and status_history. Existing service IDs remain in `projects.service_types`; no duplicate project_services table is needed for this increment. Existing money domains use PostgreSQL exact numeric values and immutable financial/history safeguards. Migration 010 adds payment allocations/documents/events; manual follow-ups remain Milestone 6.

## Migration 006: organization metadata

| Table                    | Ownership and integrity                                                                                                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| organizations            | Stable bigint ID, unique validated slug, name, active flag, creation timestamp.                                                                                                                  |
| divisions                | Organization FK, organization-local unique slug, composite `(organization_id,id)` key, active flag.                                                                                              |
| organization_memberships | Organization/user FKs, unique organization/user pair, composite organization/membership key; existing ADMIN/OPERATOR/VIEWER roles, active flag, explicit payment-write capability default false. |
| division_assignments     | Composite FKs bind both membership and division to the same organization; unique membership/division pair and active flag.                                                                       |

All IDs remain decimal strings at application boundaries. The new user/membership index supports membership lookup. Migration 006 seeds Sarathi and the three approved divisions, copies existing users' roles/active state into memberships, and assigns historical staff to Smart Solutions. Effective organization admins can access all active divisions without extra assignment rows. Public/runtime account creation does not auto-join organizations; provisioning is owner-only and transactional.

The migration is additive and atomic. It changes no existing customer, lead, project, quotation, payment, user-role or authentication values. It records its version only after success; the existing migration runner records SHA-256 checksums. Runtime gets SELECT only on new metadata tables. Initial mappings are transitional, not an inferred assignment for future staff or divisions.

## Migration 007: mandatory business ownership

All ten business tables receive organization ownership; leads/projects also receive division ownership. Existing rows are assigned to Sarathi/Smart Solutions by a constant column default without row UPDATE, preserving frozen/append-only content and timestamps. Constraint validation must succeed atomically; inconsistent legacy relations or missing actor memberships stop the migration rather than deleting history. The upgrade test compares every original field and checks failure rollback.

Composite keys/FKs constrain lead/customer, project/customer/lead/division, costing/project, BOM/project/product, quote/project/customer/creator, item/quote, payment/project/quote/recorder and history/project/actor. Existing globally unique surrogate IDs remain; SKU and payment idempotency uniqueness becomes organization-local. Ownership/division and pagination/history indexes support scoped access. Project services remain in the existing array, including unknown historical IDs.

After backfill, NOT NULL ownership defaults read required transaction-local server settings, with no seed-organization fallback. RLS is enabled for all ten business tables. Root visibility checks organization/membership/division; related tables require a visible owned parent. Writes remain limited to existing customer/lead/project/history workflows, operation-bound and non-viewer. No financial/delete policies are added. Owners bypass RLS for migration/maintenance; application connections reject such roles.

Migration 007 introduces the scoped staff role function; the updated grant recipe revokes the old global function from the runtime role. Metadata assignment/revocation/removal remains owner-managed. Shared identity ceilings cannot be raised by an organization administrator; the runtime function leaves other organizations unchanged.

Do not edit migrations 001–007 once applied. Restore staging backups to verify the upgrade before shared deployment, and apply latest runtime grants as owner. Do not drop populated ownership metadata or disable financial/history safeguards. This upgrade changes the application/runtime contract: a pre-isolation app cannot be used as an automatic rollback. See [deployment](OPERATIONS_DEPLOYMENT.md), [coverage](TENANT_ISOLATION_COVERAGE.md) and [progress](DEVELOPMENT_PROGRESS.md).

## Migration 010: append-only manual payments

Migrations 001–009 remain unchanged. Migration 010 makes the existing project relationship optional for accepted standalone quotations and adds explicit composite-owned customer/division, original receipt reference, purpose, number and actor/request UUID/hash metadata. Existing amount, kind, method, reference, actor and timestamps are not rewritten. Legacy records retain nullable new metadata and have no fabricated artifacts.

| Table               | Integrity and runtime boundary                                                                                                                                                                       |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| payments            | Existing append-only exact ledger; current receipts or source-linked refunds/reversals, actor-bound durable requests and transactionally assigned number. At least project or quotation is required. |
| payment_documents   | Immutable numbered snapshot, private PDF bytes/hash and renderer version; composite payment ownership, scoped reads/inserts and deferred matching-artifact requirement.                              |
| payment_allocations | Immutable signed exact amount against a current receipt/accepted owned quotation; positive assignments consume unallocated funds, negative entries identify their refund/correction.                 |
| payment_events      | Immutable actor/time/action history; automatic trigger inserts, scoped SELECT only.                                                                                                                  |
| payment_counters    | Scoped transactional yearly/division/kind numbering; no runtime table grant.                                                                                                                         |

Payments, documents, allocations and events have RLS. The active membership/division payment-access function distinguishes financial read, receipt creation/allocation and admin-only refunds/corrections. Narrow runtime INSERT grants exclude actor/ownership/number/timestamps; deferred commit checks require the matching stored artifact. No UPDATE, DELETE, TRUNCATE or arbitrary audit write is authorized.

Receipt corrections preserve the existing ledger kind constraint by using `kind=REFUND`, `purpose=REVERSAL`, `payment_method=CORRECTION` and an ADJ number; application reports/PDFs distinguish these bookkeeping reversals from cash refunds. Both are capped together at the original current receipt and cannot target another refund/reversal or an undocumented legacy receipt. Project/family/source locks serialize baseline changes, retries, caps and allocations. Signed allocation history remains intact across quotation revisions; current balances use the accepted commercial baseline and net receipts rather than summing allocations as extra payments. Owner-reviewed legacy reconciliation remains outside the runtime workflow. [Usage and release order](PAYMENT_USAGE.md) document the controlled rollout.
