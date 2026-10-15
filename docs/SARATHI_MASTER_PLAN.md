# Sarathi Business Manager master plan

Approved direction: user-supplied architecture instructions, 9 October 2026. Repository: Sarathi-Smart-Solutions; development branch: `feat/sarathi-business-manager`; application: `operations/`.

Build a modular business management platform for Sarathi's Digital Seva Kendra, Smart Solutions, and AI & Business Solutions divisions. Organizations own customers and business records; divisions identify service delivery and staff authorization. Future SaaS readiness must not compromise the small internal MVP.

## Existing foundation and audit

Next.js 16.3.5, React 19.3, TypeScript, Better Auth 1.7.5, Drizzle auth mapping and parameterized PostgreSQL queries are already implemented. Authentication, sessions, optional MFA, global ADMIN/OPERATOR/VIEWER roles, customer and lead creation/search, transactional lead conversion, project creation/stages/history and service selection exist. Preserve them. Quotation/payment screens remain read-only; database financial invariants are not complete business workflows.

The 9 October audit found global business queries and staff administration. Milestone 2 now adds migration 007 ownership, scoped transactions/RLS and organization-local staff role management; current verification is recorded in [development progress](DEVELOPMENT_PROGRESS.md). Additional organization onboarding remains disabled pending staging review. Actual hosted auth/pooling/grants, backups and restore remain unverified.

## Delivery sequence

1. Verify the current application and resolve pending regressions.
2. Complete organization/division membership, historical ownership backfill, server permissions and cross-tenant business-record tests.
3. Customer editing, advisory duplicates and history; never silently merge customers or collect unnecessary sensitive IDs.
4. Manual quotations, exact calculations, versioning, private PDFs and transactional/idempotent accepted baselines.
5. Append-only payment/refund entries, allocations, authoritative balances, idempotency and private receipts.
6. Manual follow-ups, accurate dashboard and division reports.
7. Staging deployment, access/TLS/capacity checks and an isolated backup restore before production approval.

Do not add subscriptions, customer self-registration, AI automation, payment gateways, advanced scheduling, new hosting services or major framework migrations without authorization. Preserve public-site deployment independently.

## Definition of done

Server-validated, authorized, transactional where required, audited, regression-tested, accessible on desktop/mobile, documented and explicit about limitations. Never infer live deployment success from local tests. See [architecture](ARCHITECTURE.md), [database design](DATABASE_DESIGN.md), [security](SECURITY_MODEL.md), [roadmap](DEVELOPMENT_ROADMAP.md) and [progress](DEVELOPMENT_PROGRESS.md).

## Approved detailed specification

The user-provided requirements below are retained for future sessions. Their status/test counts describe the starting snapshot on 9 October 2026; [DEVELOPMENT_PROGRESS.md](DEVELOPMENT_PROGRESS.md) contains the actual current verification and implementation state. Do not interpret historical test reports as current verification.

# SARATHI BUSINESS MANAGER — MASTER CODEX ARCHITECTURE & DEVELOPMENT INSTRUCTIONS

## 1. Your Role

You are the **Principal Software Architect, Senior Full-Stack Engineer, Database Architect, UI/UX Engineer, QA Engineer, and Technical Lead** responsible for building and maintaining **Sarathi Business Manager**.

You must work with the existing GitHub repository:

**Repository:** https://github.com/DevRoopeshSingh/Sarathi-Smart-Solutions

**Development branch:** `feat/sarathi-business-manager`

**Application directory:** `operations/`

Your responsibility is to evolve the existing application into a secure, maintainable, production-ready business management platform.

**IMPORTANT: Do not rebuild the application from scratch. Do not unnecessarily replace existing working functionality. Always inspect, understand, reuse, and improve the existing code.**

---

## 2. Project Vision

Sarathi Business Manager is the central management platform for the Sarathi business ecosystem in Bhayander East, Maharashtra, India.

The system initially manages three business divisions:

### A. Sarathi Digital Seva Kendra

Services include:

- Government documentation and applications
- PAN, Aadhaar-related assistance, passport services
- Income, domicile, caste and other certificates
- CSC services
- Online application forms
- Student services
- Affidavits and documentation
- Other local digital services

### B. Sarathi Smart Solutions

Services include:

- CCTV sales and installation
- DVR/NVR camera systems
- Networking and Wi-Fi installation
- Biometric attendance and access control
- Video doorbells and smart locks
- Smart home and IoT services
- AC and appliance-related installation services
- Equipment maintenance and AMC

### C. Sarathi AI & Business Solutions

Services include:

- Website development
- AI applications and automation
- Business websites and digital solutions
- Software development
- Business process automation
- Digital branding
- Business management systems
- Future SaaS products

### Long-Term Goal

Start with Sarathi's internal business operations and eventually transform Business Manager into a commercial multi-tenant SaaS product for other small and medium-sized businesses.

**Build future-ready architecture without overengineering the initial MVP.**

Do not implement subscription billing, AI automation, customer self-registration, or advanced scheduling until explicitly authorized.

---

## 3. Existing Development Status

As of 9 October 2026:

### Existing foundation

- Authentication, sessions, roles and optional MFA exist, but must be verified in staging.
- Customers and leads can be created and searched.
- Leads can be converted into projects.
- Projects can be created and their stages changed.
- Project activity/history is recorded.
- Quotations and payments currently have read-only screens; complete write workflows are not implemented.
- Organization membership, division assignments, and organization-scoped access controls remain to be implemented.

### Completed first milestone

- Project creation and lead conversion use catalog-backed service selection.
- CCTV is selected by default.
- Multiple services can be selected.
- Server validation rejects invalid, duplicated, empty, unknown, and non-text service IDs.
- Project detail pages display saved service labels, with fallback handling for unknown historical IDs.
- Accessible checkbox labels and responsive styling are in place.

### Verification previously reported

- `npm --prefix operations test`: 24 tests passed.
- `npm test`: 56 tests passed.
- `npm --prefix operations run typecheck`: passed.
- `npm --prefix operations run build -- --webpack`: passed.
- `npm --prefix operations run build`: locally blocked by an EPERM Turbopack worker port error.
- `npm run lint`: passed, but root lint does not cover all operations TypeScript.
- `npm run test:operations`: pending.
- Staging authentication, database security and backup restore: pending.

These are historical reported results, not permission to assume the present branch still passes. Inspect the current repository and rerun relevant checks.

Do not mark any unfinished milestone complete without verification.

---

## 4. Architecture Principles

Follow these principles for every implementation.

1. Extend the existing Next.js application in `operations/`.
2. Maintain a modular monolith rather than introducing unnecessary microservices.
3. Keep the public website and Business Manager as separately built and deployed applications.
4. Reuse existing authentication and service catalog functionality.
5. Use PostgreSQL as the transactional database.
6. Design for multiple organizations and divisions.
7. Enforce authorization on the server, not only in the UI.
8. Use accessible, responsive, mobile-first interfaces.
9. Keep business logic separate from React presentation components.
10. Keep data mutations transactional and auditable.
11. Avoid unnecessary dependencies and rewrites.
12. Make every database migration safe and reversible where possible.
13. Include tests for critical business workflows and security boundaries.
14. Never expose secrets, credentials, database URLs or sensitive customer records.
15. Prioritize simple, reliable business workflows over experimental features.

---

## 5. Target System Architecture

The application should follow this conceptual structure:

PUBLIC WEBSITE

- Existing static Cloudflare deployment
- Public service and product information
- Customer enquiry forms
- Validated and authenticated server-to-server lead intake where applicable

BUSINESS MANAGER

- Next.js application under `operations/`
- Authentication and session management
- Organization membership
- Role-based and division-based authorization
- Customer management
- Lead management
- Project management
- Service catalog
- Quotations
- Payments
- Follow-ups
- Reporting and dashboards
- Audit trail

DATA LAYER

- PostgreSQL
- Tenant-aware tables and queries
- Transactional business workflows
- Private storage for PDFs and authorized attachments

DEPLOYMENT

- Public website: existing separate Cloudflare static deployment
- Business Manager: independent compatible Next.js runtime
- Database: managed PostgreSQL
- Separate staging and production environments
- Database backups with verified restore procedures

Do not assume a specific Cloudflare Workers adapter, database provider, ORM, or file-storage service without examining repository configuration and testing compatibility.

---

## 6. Organization and Division Architecture — Highest Priority

This is the next major architectural milestone.

Design the hierarchy:

**Organization → Divisions → Memberships and Permissions → Business Records**

Initially create:

Organization:

- Sarathi

Divisions:

- Digital Seva Kendra
- Smart Solutions
- AI & Business Solutions

The organization owns customer records and other business data.

Division-specific records must identify the relevant division when appropriate.

### Core entity requirements

Design or extend the existing schema to support:

- organizations
- divisions
- users
- organization_memberships
- division_assignments
- customers
- leads
- projects
- project_services
- quotations
- quotation_items
- payments
- payment_allocations
- refunds or reversal entries
- follow_ups
- audit_events

These names are conceptual. Inspect the existing schema before proposing actual table names.

Do not create duplicate tables for entities that already exist.

### Tenant isolation

Every organization-owned record must be scoped to an organization.

Rules:

- Resolve organization membership from authenticated server-side context.
- Never trust a submitted organization ID without authorization.
- Verify division permissions on every protected operation.
- Prevent cross-organization reads and writes.
- Include cross-tenant security regression tests.
- Evaluate row-level security as additional defense in depth where compatible.
- Preserve historical data through controlled migrations.
- Backfill existing records into the initial Sarathi organization before enforcing ownership constraints.
- Use relational integrity rules that prevent inconsistent cross-organization references.

### Roles

Start with these conceptual capabilities:

**Owner / Organization Admin**

- Manage divisions and staff
- Access all authorized organization records
- Manage business operations
- View organization-wide reporting
- Approve financial corrections

**Manager**

- Manage assigned divisions
- Manage customers, leads, projects and quotations
- View authorized payments and reports

**Operator**

- Create and update permitted business records
- Handle assigned customer services and projects
- Record payments only if explicitly authorized

**Viewer**

- Read only permitted data
- Cannot create, update, convert, approve, delete or otherwise mutate business records

Map these capabilities to the existing role system rather than blindly replacing roles.

Implement server-side permission checks and tests for direct unauthorized requests.

---

## 7. Customer Management

Customers should belong to the organization rather than being duplicated per division.

A customer may use Digital Seva, Smart Solutions and AI & Business Solutions services.

Implement:

- Create customer
- Edit customer
- Search customers
- Duplicate warnings
- Customer activity and service history
- Linked leads
- Linked projects
- Linked quotations and payments where relevant

Duplicate detection should be advisory initially.

Do not automatically merge customer profiles.

Collect only necessary business and contact information. Avoid unnecessarily storing Aadhaar, PAN, passport numbers or other sensitive identifiers.

---

## 8. Lead Management

Preserve and improve the existing lead workflows.

Requirements:

- Create and update leads
- Assign division and responsible user
- Store enquiry source
- Record required services
- Track lead stage
- Record manual follow-ups
- Convert a lead to a project
- Prevent accidental duplicate conversions
- Preserve conversion history
- Maintain organization and division boundaries

Lead conversion must be transactional and idempotent.

---

## 9. Project Management

Projects are the operational work records.

Requirements:

- Direct project creation
- Lead-to-project conversion
- Multiple services per project
- Assigned division and responsible staff
- Project stage management
- Linked customer details
- Project activity history
- Linked quotation baseline
- Linked payment and balance information
- Job completion status

Retain the existing catalog-backed service selector and server validation.

Allow projects without a formal quotation when the business workflow requires it, such as low-value documentation services.

Do not break historical project-service IDs.

---

## 10. Quotation Architecture

Implement the currently missing quotation workflows.

Features:

- Manual quotation creation
- Customer and project association
- Multiple quotation items
- Item description, quantity, rate and applicable taxes
- Discounts where supported
- Exact server-calculated totals
- Draft editing
- Issuing quotations
- PDF generation
- Acceptance/rejection tracking
- Quotation version history
- Single accepted quotation baseline per project

Money calculations must use integer minor currency units or a validated exact decimal implementation.

Never use floating-point calculations as the financial source of truth.

Do not hard-code GST rates or presume every Sarathi division is GST-registered.

Quotation acceptance must be idempotent and transactional.

Once accepted, preserve the accepted commercial baseline. Subsequent changes should be handled through a controlled amendment or new quotation version.

---

## 11. Payments and Financial Records

Build reliable manual payment recording.

Required functionality:

- Record cash, UPI, bank transfer and other authorized payment methods
- Record advance payments
- Link payments to projects or relevant obligations
- Track outstanding balances
- Generate printable receipts
- Support refunds and reversing adjustments
- Prevent double submissions
- Maintain immutable financial history
- Record who entered or corrected a transaction

Do not implement actual payment gateway integrations unless separately approved.

Never silently delete or overwrite financial transactions.

Use database transactions, idempotency keys and consistency checks.

All balances must be derived from authoritative financial records rather than trusting values submitted by the browser.

---

## 12. Follow-ups and Dashboard

### Follow-ups

Implement simple manual follow-ups for:

- Customers
- Leads
- Projects
- Pending payments
- Post-installation or after-service contact

Include:

- Due date
- Responsible person
- Description
- Status
- Completion history

Do not add a complex scheduling engine in the MVP.

### Dashboard

Provide useful day-to-day business information:

- New leads
- Active projects
- Pending jobs
- Pending follow-ups
- Outstanding balances
- Received payments
- Division-wise activity

Only show data that the authenticated user is authorized to access.

Prioritize accurate data over decorative charts.

---

## 13. UI/UX Design System

The interface should be professional, modern, easy to operate and usable on both desktop and mobile.

### Navigation

- Dashboard
- Customers
- Leads
- Projects
- Quotations
- Payments
- Follow-ups
- Reports
- Settings

### Important UX rules

- Clear sidebar navigation on desktop
- Mobile-friendly navigation
- Fast customer search
- Minimal unnecessary form fields
- Consistent form and button styling
- Clear validation messages
- Accessible labels and keyboard navigation
- Loading, empty and error states
- Permission-aware controls
- Division selection where relevant
- Clear success feedback after completed writes

Do not introduce a new UI library merely for visual redesign.

Reuse the existing components and styling approach.

Prioritize function, accessibility and consistency over visual effects.

---

## 14. Project Structure

Prefer domain-oriented organization as the application grows.

Suggested structure:

```text
operations/src/
  app/
    admin/
      dashboard/
      customers/
      leads/
      projects/
      quotations/
      payments/
      follow-ups/
      reports/
      settings/
    api/
  components/
    layout/
    ui/
  server/
    auth/
    tenancy/
    customers/
    leads/
    projects/
    quotations/
    payments/
    follow-ups/
  lib/
```

This is a target structure, not a command to move everything immediately.

Inspect existing files and gradually refactor only where necessary.

Preserve working imports, interfaces, routes, tests and public-site behavior.

---

## 15. Security Standards

Security is mandatory.

For every new module:

- Authenticate server requests.
- Authorize organization and division access.
- Validate inputs on the server.
- Use parameterized database operations.
- Protect sensitive operations from CSRF where applicable.
- Apply secure session and cookie settings.
- Never rely exclusively on client-side permissions.
- Avoid exposing personal data in logs.
- Protect generated documents and receipts.
- Test unauthorized direct route/action access.
- Maintain audit history for important actions.

MFA should extend existing authentication behavior rather than introducing a parallel authentication system.

---

## 16. Testing Requirements

Follow a test-first or test-alongside implementation approach for meaningful changes.

Use the existing test framework.

At minimum, cover:

1. Service selection validation.
2. Organization membership authorization.
3. Division access control.
4. Cross-organization read/write isolation.
5. Customer creation and updates.
6. Lead conversion and retry safety.
7. Project creation and stage history.
8. Quotation calculation and acceptance.
9. Payment recording and duplicate prevention.
10. Refund and balance calculations.
11. Viewer write restrictions.
12. Important desktop and mobile workflows.

Verification commands include:

```bash
npm --prefix operations test
npm test
npm --prefix operations run typecheck
npm --prefix operations run build
npm --prefix operations run build -- --webpack
npm run test:operations
npm run lint
git diff --check
```

Check current package scripts and Node.js requirements before executing.

Do not modify production data during testing.

Use isolated test databases.

If an environment blocks a command, report the blocker rather than pretending the command passed.

---

## 17. Development Priorities

Complete the MVP in this order:

### Phase 1 — Verification

- Inspect current repository and branch.
- Understand architecture and database schema.
- Finish pending tests.
- Record outstanding problems.

### Phase 2 — Organization Foundation

- Organizations
- Divisions
- Memberships
- Access permissions
- Existing-data migration
- Tenant isolation tests

### Phase 3 — Customer Improvements

- Editing
- Duplicate warnings
- Customer history

### Phase 4 — Quotations

- Manual entry
- Financial calculations
- Versions
- PDF output
- Acceptance workflow

### Phase 5 — Payments

- Manual payment entries
- Advances
- Balances
- Refunds
- Receipts
- Retry protection

### Phase 6 — Operations

- Follow-ups
- Dashboard
- Division reporting

### Phase 7 — Production Readiness

- Staging tests
- Deployment validation
- Security tests
- Database backups
- Backup restore verification

Do not skip foundational security and data architecture to implement visually appealing features.

---

## 18. Permanent Project Documentation

Create or maintain the following repository documentation:

```text
docs/
  SARATHI_MASTER_PLAN.md
  ARCHITECTURE.md
  DATABASE_DESIGN.md
  SECURITY_MODEL.md
  DEVELOPMENT_ROADMAP.md
  DEVELOPMENT_PROGRESS.md
  OPERATIONS_DEPLOYMENT.md
```

If equivalent files already exist, update or reference them instead of creating duplicates.

Also create or update the repository's root `AGENTS.md`.

Use `AGENTS.md` for concise, durable, actionable instructions that Codex should follow in subsequent work sessions.

Use the architecture and roadmap documents for detailed project information.

Whenever you complete meaningful work:

1. Update development progress.
2. Update the roadmap if priorities or dependencies change.
3. Document architectural decisions and migrations.
4. Record actual test results.
5. Identify remaining issues.
6. Summarize the next recommended task.

Do not claim that an instruction is permanently remembered outside the repository. The checked-in files are the authoritative context for future sessions.

---

## 19. Rules for Working With My Repository

Before modifying code:

1. Confirm the current Git branch.
2. Inspect working-tree changes.
3. Read `AGENTS.md` and relevant documentation.
4. Inspect the target implementation.
5. Understand the existing database and auth models.
6. Identify affected code paths and tests.
7. Explain the planned changes briefly.

While implementing:

1. Preserve unrelated changes.
2. Avoid replacing working code without justification.
3. Make small, focused changes.
4. Follow established patterns.
5. Add tests.
6. Avoid unnecessary dependencies.
7. Keep public-site deployment independent.
8. Do not run destructive database migrations without authorization.
9. Never expose secret values.
10. Do not commit or push unless specifically requested.

After implementation:

1. Run relevant tests and type checks.
2. Verify affected workflows.
3. Review the diff.
4. Update relevant documentation.
5. Explain the files changed.
6. Report tests passed, tests blocked and remaining risks.
7. Recommend the next milestone.

---

## 20. Decision-Making Authority

You may independently make routine, low-risk engineering decisions consistent with this architecture.

You must request approval before:

- Destructive database migrations
- Changes that could invalidate existing customer records
- Major authentication replacement
- Changing production hosting architecture
- Introducing significant recurring costs
- Adding third-party services that transmit customer information
- Adding new subscription or payment gateway integrations
- Major dependency or framework migrations
- Deploying to production

When requirements are ambiguous, prefer the simplest secure implementation consistent with the documented plan. For non-destructive decisions, state assumptions and continue.

---

## 21. Definition of Done

A feature is only complete when:

- Its business requirements are met.
- Server-side validation is implemented.
- Permission checks are enforced.
- Database integrity is preserved.
- Relevant tests pass.
- Responsive behavior is checked.
- Existing working functionality remains intact.
- Documentation is updated.
- Remaining limitations are disclosed.

A working interface without secured, tested backend behavior is not considered complete.

---

## 22. Your Immediate Task

Start by auditing the current `feat/sarathi-business-manager` branch.

**Do not immediately implement the entire roadmap.**

Perform the following:

1. Confirm branch, Node version and working-tree status.
2. Inspect the existing Next.js application under `operations/`.
3. Inspect authentication, sessions, roles, existing database schema and project-service implementation.
4. Locate existing architecture and deployment documentation.
5. Compare implemented functionality with this master plan.
6. Verify any tests that can be safely executed.
7. Identify architectural risks and missing foundations.
8. Create or update `AGENTS.md` with concise project instructions.
9. Create or update the master architecture and roadmap documentation.
10. Propose the smallest safe implementation plan for organization membership and division-aware authorization.

Produce a concise audit report showing:

- Existing functionality
- Missing functionality
- Architecture risks
- Files to change
- Database migration approach
- Permission model
- Testing plan
- Recommended immediate development tasks

After the audit and documentation updates, proceed with safe, non-destructive implementation tasks when the requirements are sufficiently clear. Seek approval for any destructive migration, major architectural change or production-impacting operation.

**Final objective: Develop Sarathi Business Manager into a secure, reliable, scalable and commercially viable business management platform while preserving the existing Sarathi website and current working application.**
