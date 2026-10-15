# Sarathi Business Manager progress

Updated: 9 October 2026. Development branch: `feat/sarathi-business-manager`.

Extend the existing Next.js application in `operations/`. Keep the public static website's build and deployment separate. The full Business Manager MVP is not complete; this document tracks the first milestone and remaining work.

## Existing foundation

- Authentication, sessions, roles and optional MFA already exist; verify them in staging.
- Customer and lead creation, search, lead conversion, project creation, stage changes and recorded history already exist.
- Quotation and payment screens currently provide read-only views. Their database foundation does not constitute complete entry, issuing or receipt workflows.
- Organization membership, division assignment and organization-scoped data access remain to be designed and implemented.

## First milestone: project services

- [x] Replace the hard-coded form service with catalog-backed selection in **Create New Project** and **Convert Lead to Project**.
- [x] Preserve CCTV as the initial selection and allow multiple services.
- [x] Validate stable service IDs on the server; reject empty, unknown, duplicated and non-text submissions.
- [x] Display saved service labels on the project detail page, preserving unknown historical IDs as text.
- [x] Use accessible checkbox labels and a responsive layout without a new dependency or database migration.
- [x] Complete the full verification run and record its results below.

Key files:

| File                                                                                                                  | Purpose                                                                                  |
| --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| [`operations/src/lib/project-services.ts`](../operations/src/lib/project-services.ts)                                 | Options, validation lookup and display labels derived from the existing service catalog. |
| [`operations/src/lib/recommendation.d.mts`](../operations/src/lib/recommendation.d.mts)                               | Type declaration bridge for the existing catalog module.                                 |
| [`operations/src/server/input.ts`](../operations/src/server/input.ts)                                                 | Repeated form-field parsing and server validation.                                       |
| [`operations/src/app/admin/project-service-select.tsx`](../operations/src/app/admin/project-service-select.tsx)       | Shared selector with CCTV checked by default.                                            |
| [`operations/src/app/admin/projects/projects-manager.tsx`](../operations/src/app/admin/projects/projects-manager.tsx) | Direct project creation form.                                                            |
| [`operations/src/app/admin/leads/leads-manager.tsx`](../operations/src/app/admin/leads/leads-manager.tsx)             | Lead conversion form.                                                                    |
| [`operations/src/app/globals.css`](../operations/src/app/globals.css)                                                 | Responsive service choices and theme styling.                                            |
| [`operations/src/server/workflow.ts`](../operations/src/server/workflow.ts)                                           | Saved services in project details.                                                       |

Regression coverage is added in `operations/tests/business-input.test.ts`, `operations/tests/runtime-business.ts` and `operations/tests/browser.spec.mjs`.

## Verification

Use Node.js 22 or newer; current checks use Node 22.22.2. On this development machine, Node 22 is available at `/opt/homebrew/opt/node@22/bin`; put it first in `PATH` when running these commands.

| Command / check                                            | Current result                                                                                                                                |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm --prefix operations test`                             | Passed: 27 operations unit tests, including organization context checks.                                                                      |
| `npm test`                                                 | Passed: 56 root unit tests.                                                                                                                   |
| `npm --prefix operations run typecheck`                    | Passed.                                                                                                                                       |
| `npm --prefix operations run build`                        | Blocked locally: Turbopack CSS worker could not bind a local port (`EPERM`).                                                                  |
| `npm --prefix operations run build -- --webpack`           | Passed: compilation, TypeScript and route generation; no package script change.                                                               |
| `npm run test:operations`                                  | Passed: 4 migration, 9 organization, 15 HTTP/security, 8 business and 18 desktop/mobile browser tests against isolated PostgreSQL (54 total). |
| `npm run lint`                                             | Passed; root ESLint does not cover operations TypeScript.                                                                                     |
| Changed-file Prettier and `git diff --check`               | All changed source/test/documentation formatting and whitespace checks passed.                                                                |
| Staging authentication, database access and backup restore | Pending; local checks do not verify deployment configuration.                                                                                 |

Manual acceptance checklist for an administrator or operator:

1. Open **Create New Project**. Confirm CCTV starts checked and the service labels match the catalog.
2. Clear all services and submit otherwise valid data. Confirm a service error appears and no project is created.
3. Choose Wi-Fi/networking and biometric/access control, then save. Open the new project, reload and confirm both service labels persist.
4. Open **Convert Lead to Project**. Choose the intended services, assign a customer and submit. Confirm the lead is converted once and the linked project displays the saved choices after reload.
5. Check both forms at a 375px mobile width and with keyboard navigation. Service text should wrap, labels should toggle their checkboxes and the modal should scroll.
6. Sign in as a viewer. Confirm project and conversion writes remain unavailable and direct write attempts remain denied.

## Remaining MVP work

- [x] Add initial organization/division metadata, memberships, a server context resolver and context/assignment security regression tests. See [current development progress](DEVELOPMENT_PROGRESS.md).
- [ ] Complete organization-owned business records and scoped queries/mutations/staff management. Do not onboard additional organizations until this isolation gate passes.
- [ ] Add customer editing and duplicate warnings.
- [ ] Add manual quotation entry, precise server-calculated totals, PDF output and acceptance of a single quotation baseline. Advance the existing project when a quotation is accepted.
- [ ] Add append-only payment recording, refunds, retry protection, balances and receipts.
- [ ] Add manual follow-ups and a basic operational dashboard.
- [ ] Verify hosting compatibility, staging workflows, restricted database access and an isolated backup restore before production.

Keep AI, subscription billing and advanced scheduling outside the initial manual workflow. Deployment work should follow the existing [operations deployment checklist](OPERATIONS_DEPLOYMENT.md), with hosting choices verified before release.

The pending browser verification uncovered a navigation mismatch: project titles were buttons on desktop and plain text on mobile while the service-selector acceptance test expected links. Native Next.js links now preserve the existing design and make both viewport workflows pass. The detailed master plan and current architecture are maintained in [SARATHI_MASTER_PLAN.md](SARATHI_MASTER_PLAN.md) and [ARCHITECTURE.md](ARCHITECTURE.md); this file remains the earlier service-selection milestone reference.
