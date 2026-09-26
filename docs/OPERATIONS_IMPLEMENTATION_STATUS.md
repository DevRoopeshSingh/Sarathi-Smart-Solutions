# Operations review implementation status — 26 September 2026

This records the local implementation following [the original review](OPERATIONS_REVIEW_2026-09-25.md). The review's snippets and line numbers describe the earlier snapshot; use the current source for deployment. Nothing has been deployed or applied to a remote database.

## Implemented and verified locally

- **Business integrity:** restricted customer/lead/project write grants; atomic lead conversion and audit history; concurrent conversion protection; optimistic status checks; required reasons for skipped, backward, reopened and cancelled project stages. Held projects reject stage changes.
- **Validation and safe failures:** bounded server input, duplicate/File field rejection, string bigint IDs, accurate nullable DTOs, generic unexpected errors with safe reference IDs, and UI state that changes only after a successful write.
- **Authentication and configuration:** trusted Vercel IP quotas, bounded runtime pool, separate production migration credentials, corrected private response headers, checked logout, optional authenticator MFA, single-use recovery codes and owner-only credential recovery. All-device revocation also removes pending MFA challenges.
- **Performance and usability:** 50-row keyset pages, server search/status filters, 25-option customer lookup, aggregate dashboard counts, UTC timestamps with India display time, working create shortcuts and corrected populated mobile dashboard layout.
- **Maintenance:** operations dependency updates, deployment/recovery documentation and expanded security/business/browser regression coverage. No new production dependency was added.

## Verification evidence

- Operations unit tests: **17 passed**; TypeScript check and production build passed.
- Isolated PostgreSQL integration: repeated/concurrent migration execution, **12 HTTP/security tests** and **7 business/database tests** passed using the restricted runtime role.
- Playwright: **6 passed** across desktop and mobile, including authenticator enrollment/sign-in, persistent writes, generic failure messages and audited stage exceptions.
- Root unit tests: **33 passed**; root ESLint passed. Root lint still excludes operations TypeScript; the TypeScript compiler checks it.
- Repository formatting and whitespace checks passed after formatting the existing layout/theme files and the review document.

The integration harness creates and removes its own PostgreSQL cluster and HTTPS endpoint. These results do not establish Vercel edge behaviour, live Supabase grants/TLS, production capacity or backup recovery.

## Apply and verify

1. Follow [the staging deployment checklist](OPERATIONS_DEPLOYMENT.md). Supply a separate owner connection to the release shell and a restricted pooled connection to Vercel.
2. Apply migrations through **003**, then reapply `database/runtime-grants.sql` as owner before deploying this app version.
3. Set `DB_POOL_MAX=2`, the exact HTTPS `BETTER_AUTH_URL` and a strong stable `BETTER_AUTH_SECRET`. Keep owner credentials out of the runtime. Back up the auth secret securely because MFA records depend on it.
4. Provision an administrator; test login, optional MFA, recovery codes, all-device revocation and operator recovery in staging. Re-enroll after any explicit MFA reset.
5. Verify restricted business writes, rollback, stale edits, stage reasons, paginated search and India date display. Run the public edge IP/header checks and a modest concurrency check.
6. Keep the private `sarathi` schema out of Supabase exposed schemas and confirm public/anon/authenticated roles lack access. Confirm backup retention and perform an isolated restore drill before production.

## Remaining medium-term work

- Generic creation idempotency for ambiguous network failures. Conversion is protected against duplicates, but customer/lead creation can duplicate if an operator retries after a lost successful response; check the list before retrying.
- Migration content checksums; the runner currently verifies sequence/names and atomic transactions, not changes to the contents of an already applied migration.
- A tested CSP rollout and TypeScript/React ESLint coverage.
- Query-plan/load measurement with representative data. Pagination bounds response size, but substring search and exact counts may still scan many records; add indexes based on measured plans.
- Deployment-only verification: real edge IP trust, restricted-role TLS, connection capacity, secret handling and backup restoration. MFA enrollment currently remains optional.

Payment/quotation writes, costing and other later product features remain outside this remediation milestone.
