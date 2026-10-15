# Development roadmap

Updated 12 October 2026. Follow [the master plan](SARATHI_MASTER_PLAN.md); do not jump from metadata foundations into financial/UI features.

| Phase                             | State and next gate                                                                                                                                                                                               |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Verify existing foundation     | Implemented and locally verified; existing public/auth/project workflow regressions remain covered. Actual results recorded in progress.                                                                          |
| 2a. Organization metadata/context | Additive migration 006, initial divisions, owner-managed memberships, context endpoint and security tests implemented; see progress for verification.                                                             |
| 2b. Business ownership/isolation  | Migration 007, scoped transactional data access, RLS, staff isolation and cross-organization tests implemented. Final verification recorded in progress; additional organizations remain gated by staging review. |
| 3. Customers                      | Implemented and verified locally: customer editing, advisory duplicates, safe retries and scoped linked profiles; 88 isolated checks passed.                                                                      |
| 4. Quotations                     | Stages 4A–4D implemented and locally verified: exact drafts/items, immutable private A4 PDFs, revisions/staff decisions and one project baseline; 118 isolated checks. Hosted release gates remain.               |
| 5. Payments                       | Implemented and locally verified: manual receipts, refunds/corrections, partial allocations, exact balances, private PDFs and interrupted-save recovery; 150 isolated checks. Staging gates remain.               |
| 6. Operations                     | Next planned increment: manual follow-ups, accurate dashboard and division reporting; not started.                                                                                                                |
| 7. Release                        | Staging auth/runtime compatibility, security checks, backups and isolated restore; production deployment needs approval.                                                                                          |

No AI automation, subscriptions, payment gateway, advanced scheduler or major dependency migration in the current scope. Organization staff administration UI follows isolation; no public organization creation or tenant switcher is introduced by phase 2a.
