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

- [ ] **Google Search Console**:
  - Add property `https://sarathismartsolutions.in`.
  - Submit sitemap: `https://sarathismartsolutions.in/sitemap.xml`.
  - Request priority indexing for homepage and policy URLs.
- [ ] **Google Business Profile (Local SEO)**:
  - Update primary website link to `https://sarathismartsolutions.in`.
  - Confirm opening hours and category (CCTV installation, security system supplier).
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

## 🛠️ Phase 5: Operations & Crewing Desk (`operations/`)

- [ ] **Database Setup**:
  - Verify local/production PostgreSQL schema for technician management.
- [ ] **Crewing Desk & Dispatch Feature**:
  - Technician scheduling, active service tickets, and site survey assignments.
- [ ] **Authentication & Security**:
  - Role-based access control for desk admins and field technicians.
