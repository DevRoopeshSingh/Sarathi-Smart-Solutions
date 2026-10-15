# Project Roadmap & Post-Launch TODO List

Last Updated: September 29, 2026

Status: **Production Website Live** ([sarathismartsolutions.in](https://sarathismartsolutions.in/))

---

## ✅ Completed (Milestone 1: Domain & Edge Deployment)

- [x] **Cloudflare Nameserver Switch**: Switched nameservers from parking to `jimmy.ns.cloudflare.com` and `val.ns.cloudflare.com`.
- [x] **DNS Record Cleanup**: Removed conflicting Hostinger `A` and `AAAA` records while preserving active Hostinger `MX` mail server records.
- [x] **Cloudflare Worker Custom Domains**: Bound `sarathismartsolutions.in` and `www.sarathismartsolutions.in` to Worker assets.
- [x] **Universal SSL Provisioning**: Active Google Trust Services SSL certificate issued for both apex and `www`.
- [x] **Cloudflare Edge Settings**: Enabled _Always Use HTTPS_, _Automatic HTTPS Rewrites_, and _Full SSL_.
- [x] **SEO Canonical Redirect**: Automated 301 redirect from `https://www.sarathismartsolutions.in` to `https://sarathismartsolutions.in`.

---

## 📋 Phase 2: Live Smoke-Testing & Verification

- [ ] **Mobile & Cellular Network Smoke-Test**:
  - Open `https://sarathismartsolutions.in` on a smartphone using cellular data (Jio / Airtel) to verify behavior without local Wi-Fi DNS cache.
- [ ] **Cross-Device Browser Checks**:
  - Test iOS Safari (bottom bar safe area, keyboard pop-up on form inputs).
  - Test Android Chrome (sticky Call / WhatsApp / Survey action buttons).
- [ ] **Live Form & WhatsApp Handoff**:
  - Complete the "Book Free Site Survey" form with a valid number and submit.
  - Verify that WhatsApp launches with the clean pre-formatted enquiry draft.
  - Test the "Custom Security Planner" reset, copy, and share buttons on a phone.

---

## 🚀 Phase 3: Post-Launch SEO & Business Presence

- [x] **Google Search Console**:
  - [x] Verified ownership for property `https://sarathismartsolutions.in` via Cloudflare DNS.
  - [x] Optimized clean canonical URLs in `sitemap.xml` (eliminated 307 redirects on policy routes).
  - [x] Submitted clean sitemap: `https://sarathismartsolutions.in/sitemap.xml`.
  - [x] Manually requested priority indexing for homepage, `/digital-seva-kendra`, and legal policies.
- [x] **On-Page SEO Optimization**:
  - [x] Formatted homepage title (60 chars) and meta description (157 chars) under Google SERP limits.
  - [x] Formatted Digital Seva Kendra title (56 chars) and meta description (158 chars) under limits.
- [ ] **Google Business Profile (Local SEO)**:
  - Create / update listing at `RNP Park, Bhayander East, Thane - 401105` (Place ID: `ChIJ4Ydlu3av5zsRPe9y8mQmG0Y`).
  - Configure primary/secondary categories, opening hours, and phone `+91 83697 04457`.
- [ ] **Open Graph / Social Sharing Validation**:
  - Test WhatsApp and Facebook card previews for proper logo, title, and description.

---

## 📸 Phase 4: Business Content & Reviews

- [ ] **Client Reviews & Testimonials**:
  - Gather genuine customer feedback and permission to replace initial quote placeholders.
- [ ] **Workmanship Gallery Updates**:
  - Refresh installation photos with recent completed projects in Mira-Bhayandar / Thane.
- [ ] **Quotation Item Rates**:
  - Finalize approved per-meter cabling and accessory rates for customer estimates.

---

## 🛠️ Phase 5: Sarathi Business Manager (`operations/` on `feat/sarathi-business-manager`)

- [x] **Milestone 1 — Multi-Service Project Catalog Selection**:
  - Replaced single service with catalog-backed multi-service selection in Create Project and Convert Lead.
  - Preserved CCTV default; server validates stable IDs and preserves legacy unknown IDs.
- [x] **Milestone 2 — Multi-Organization Tenant Foundation & Composite Security**:
  - Migrations 006 & 007: Composite FKs, RLS, and scoped DAL (`authorizedDatabase`/`TenantPool`).
  - Server context resolution with active-state checks, role intersection, and division isolation.
- [x] **Milestone 3 — Safe Customer Management V2**:
  - Migration 008: Composite-owned customer editing, advisory duplicates, safe retries, and scoped linked history.
- [x] **Milestone 4 — Complete Quotation Management**:
  - Migration 009: Exact paise calculations, line items, A4 PDF generation via PDFKit with Noto fonts.
  - Revisions, staff decisions, and accepted baseline tracking per project/family.
- [x] **Milestone 5 — Payments, Advances, Refunds, Balances & Receipts**:
  - Migration 010: Manual receipts (Cash, UPI, Bank, Card), project advances, accepted standalone quotation links.
  - Partial allocations, exact net balances, staff refund/correction audit trail, and private PDF receipts.
- [ ] **Milestone 6 — Operations, Follow-ups & Reporting (Pending)**:
  - Manual follow-ups, staff activity timeline, unified dashboard metrics, and division-level reporting.
- [ ] **Milestone 7 — Production Release Gates (Pending)**:
  - Staging verification with production-like connection pool (`DB_POOL_MAX=2`).
  - Runtime grants reapplication as owner; backup restoration test drill before live release.
