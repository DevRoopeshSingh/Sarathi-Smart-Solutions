# Sarathi Digital Seva Kendra — website and operations plan

Date: 30 September 2026

## Direction

Add Sarathi Digital Seva Kendra as a distinct service area on the existing Sarathi website. Launch useful business information first, then add operational features in response to real customer needs. The user agreed to proceed with this direction; the exact business relationship and operating details still need confirmation.

The first milestone is complete when a visitor can understand the services available, find the centre, and contact the correct team. Implementation must use confirmed business information rather than typical Seva Kendra services inferred from the name.

## Phase 0 — discovery completed

| Source inspected                                                    | Finding and consequence                                                                                                                                                                                                             |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `README.md`, `index.html`                                           | Existing public positioning is CCTV, networking and smart security. Keep that customer journey focused and add a distinct Seva page.                                                                                                |
| `recommendation.mjs`                                                | `CONTACT_CONFIG` and `SERVICE_CATALOGUE` belong to Smart Solutions. The catalogue drives equipment recommendations; Seva services should have their own content definition. `buildWhatsAppUrl` is an existing URL-building pattern. |
| `scripts/site-config.mjs`, `scripts/build.mjs`, `scripts/serve.mjs` | The static build copies `PUBLIC_FILES` into `dist`. The preview server currently resolves explicit filenames. A clean Seva URL needs explicit preview routing and deployment-compatible output.                                     |
| `operations/src/app/(public)/page.tsx`                              | The Next homepage reads a separate `operations/public/index.html`. Changing the root HTML alone does not update that homepage.                                                                                                      |
| `operations/src/app/(public)/layout.tsx`                            | Public layout metadata and structured data describe CCTV, installation prices and CCTV FAQs. They must be scoped to the homepage before another business page inherits this layout, or the Seva page must use a separate layout.    |
| `operations/next.config.ts`                                         | Existing static legal pages use explicit clean-URL rewrites. Check route consistency when adding Seva.                                                                                                                              |
| `operations/src/lib/operations.ts`, `docs/ADMIN_WORKFLOW_UX.md`     | Existing operations follow leads, survey, costing and installation projects. Seva requests need separate states.                                                                                                                    |
| `docs/OPERATIONS_IMPLEMENTATION_STATUS.md`                          | Local implementation and verification are documented; this does not establish the current live deployment.                                                                                                                          |
| `operations/AGENTS.md` and installed Next documentation             | Read local framework documentation before Next code changes. Page components and server `Metadata` exports are supported patterns.                                                                                                  |

Framework references read: `operations/node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md` and `14-metadata-and-og-images.md`.

Use existing HTML/CSS patterns, existing WhatsApp URL encoding, and documented Next page/metadata APIs. The presence milestone needs no database, external service API, authentication or document upload.

## Business content confirmed (30 September 2026)

| Detail                  | Confirmed status                                                                                                                                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Display name            | **Sarathi Digital Seva Kendra**                                                                                                                                                                                                 |
| Division & Relationship | Co-located sister division of Sarathi Smart Solutions sharing retail presence in Bhayander East; operates with dedicated digital & documentation services.                                                                      |
| Physical address        | RNP Park, Bhayander East, Mira-Bhayandar, Thane, Maharashtra - 401105                                                                                                                                                           |
| Google Maps location    | Lat: 19.3152633, Lng: 72.8586247 (Place ID: `ChIJ4Ydlu3av5zsRPe9y8mQmG0Y`)                                                                                                                                                      |
| Operating hours         | Monday to Saturday: 9:30 AM – 8:30 PM (Sunday: Closed / Prior appointment)                                                                                                                                                      |
| Phone & WhatsApp        | +91 83697 04457 (WhatsApp: `https://wa.me/918369704457`)                                                                                                                                                                        |
| Official email          | `sarathidigitalsevakendra@gmail.com`                                                                                                                                                                                            |
| Primary website URL     | `https://sarathismartsolutions.in/digital-seva-kendra`                                                                                                                                                                          |
| Service Catalogue       | Master catalogue confirmed: 177 services and 14 packages overall; the Seva page includes 153 services across 9 categories and 12 packages, excluding Smart Solutions entries (`Sarathi_Master_Service_Pricing_Catalogue.xlsx`). |
| Pricing transparency    | Assistance charges clearly separated from government/statutory fees; free portals (e.g. Udyam) explicitly noted.                                                                                                                |

### Confirmed Service Categories & Scope

1. **Government & Citizen Services (30 services)**: PAN card (new, correction, reprint, linking), Aadhaar appointment & guidance, Voter ID (Form 6, 8), Passport application assistance, Ayushman Bharat, Domicile & Income certificate guidance, Driving licence & vehicle portal support.
2. **Business Registration & Compliance (24 services)**: Udyam MSME registration assistance (noting government portal is free; fee is for digital guidance), Gumasta / Shop Act intimation & registration, GST registration, amendment, LUT and filing assistance.
3. **Pharmacy & Healthcare Documentation (13 services)**: Maharashtra FDA retail and wholesale drug licence application assistance, licence renewal/retention, pharmacist registration, and premises change documentation.
4. **Food, Restaurant & Hospitality (10 services)**: FoSCoS / FSSAI Basic, State, and Central licence assistance, modification, and renewal; Cloud Kitchen and Restaurant startup documentation packages.
5. **Property & Real Estate (10 services)**: MahaRERA agent registration & renewal assistance, rent agreement data preparation, leave & licence document checklists, society NOC drafting.
6. **E-commerce & Online Sellers (10 services)**: Amazon, Flipkart, and Meesho seller account setup assistance, marketplace product listings, digital catalogue PDFs, and IEC import-export assistance.
7. **Student & Career Services (16 services)**: ABC ID creation assistance, FYJC and Mumbai University online admission form filling, scholarship and competitive exam application support, ATS resume preparation.
8. **Design & Business Growth (20 services)**: Logo design, visiting cards, shop boards, letterheads, invoice/challan design, social media creative packages.
9. **Printing, Photo & Office Services (20 services)**: B&W/colour printing, photocopy, document scanning, A4/A3 lamination, passport photos, and photo editing.

## Phase 1 — public business presence

### Page structure

Confirmed URL: `/digital-seva-kendra`.

1. **Header:** Sarathi Digital Seva Kendra identity, cross-link back to Smart Solutions (CCTV & Security) and primary contact actions (Call & WhatsApp).
2. **Hero & Value Proposition:** Clear business positioning for Mira-Bhayandar residents and shop owners, featuring trust badges, working hours, and transparent pricing notice.
3. **Category Explorer & Service Cards:** Interactive tabbed interface for exploring the 9 service verticals, featuring transparent starting rates, required document guidance, and direct WhatsApp enquiry buttons.
4. **Curated Startup & Business Packages:** High-value bundles (New Medical Store Setup, Restaurant Startup, Small Business Launch, Real Estate Broker Starter, etc.).
5. **Transparency & Regulatory Notice:** Explicit policy clarifying that government/statutory fees are extra at actual, regulated services are documentation assistance, and government portal services like Udyam are free on official portals.
6. **Visit & Contact Section:** Full address at RNP Park Bhayander East, opening hours, direct call button, WhatsApp chat trigger, and Google Maps directions link.
7. **Frequently Asked Questions (FAQ):** 8+ comprehensive questions addressing common customer inquiries, document readiness, processing times, and fees.
8. **Footer:** Business identity, sister division links, privacy policy reference, and copyright.

### Implementation Checklist

- [x] Confirmed master service catalogue, pricing rules, and business details.
- [ ] Create `digital-seva-kendra.html` with responsive layout, semantic HTML, and accessibility compliance.
- [ ] Add `/digital-seva-kendra` navigation link and homepage feature card on `index.html` and `operations/public/index.html`.
- [ ] Add `/digital-seva-kendra` to `PUBLIC_FILES` in `scripts/site-config.mjs` and sitemap `sitemap.xml`.
- [ ] Configure clean-URL routing in `scripts/serve.mjs`, `_redirects`, and `operations/next.config.ts`.
- [ ] Scope Next.js public layout metadata and JSON-LD structured data to avoid inheriting CCTV pricing and CCTV FAQ schemas on Seva Kendra pages.
- [ ] Verify responsive layout, keyboard navigation, WhatsApp link construction, and zero horizontal overflow.
- [ ] Run test suite (`npm test`) and build verification (`npm run build`).

## Phase 2 — local visibility

After the accurate page exists, use its canonical URL in the appropriate business listing and shop materials. Confirm whether the real-world business qualifies for its own Google Business Profile rather than assuming every service division needs another listing.

Reference: https://support.google.com/business/answer/3038177?hl=en

Prepare a QR code for the final URL once the live domain and path are established. Verify the code on a phone and confirm all published business details match the page. Gather real enquiry patterns to identify which services deserve additional explanation or functionality.

Business listing changes and outreach are separate from website implementation; no account changes or messages are implied by this planning document.

## Phase 3 — service-request operations

Use one administration platform with distinct Smart Solutions and Digital Seva work areas if ownership and access requirements support that arrangement.

Initial Seva module candidates:

- Service catalogue and service-specific requirement checklists.
- Request reference, assigned staff, notes and recorded status history.
- Proposed progression: new request → requirements pending → ready to process → processing → completed. Define cancellation, rejection and collection states only where actual services need them.
- Independent division filters and reporting.

Copy authentication, permission checks, authorized data access and audit conventions from the operations application. Model a Seva request separately from an installation project; do not force survey, procurement or installation stages onto it. Sharing customer records depends on the confirmed business relationship and staff access needs.

Before implementation, inspect current server/data patterns and document the allowed APIs and migration path. Verify permission boundaries, valid state transitions and division-specific reporting with representative requests. This plan introduces no database migration now.

## Phase 4 — additional features and final verification

Prioritize appointments, receipts, payment records, notifications, document handling and customer status access only after the service workflow is established. Each feature needs a separate scoped implementation plan based on its actual data and integrations. A request marked complete must not imply an external authority approved an application.

For each release, verify the implemented behavior against the documented patterns, check relevant regressions, and review customer-facing wording. Confirm the actual production deployment before publishing so the reviewed page is the one customers receive.

## Current delivery status

Phase 0 discovery and business content confirmation are complete. Phase 1 public business presence implementation is active.

## Database-free implementation update (2 October 2026)

The public page now uses an explicit WhatsApp enquiry handoff and staff-assisted status questions. It creates no request record or tracking ID. See [delivery and QA notes](DIGITAL_SEVA_KENDRA_QA.md) for the hosting paths, generation command, fixes and regression coverage. Phase 3 remains a future backend project.
