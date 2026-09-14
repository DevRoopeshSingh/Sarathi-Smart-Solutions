# Production-Ready Implementation Plan: Sarathi Smart Solutions Website

This document records the architectural decisions, accessibility standards, security controls, SEO improvements, testing strategy, and DevOps setup implemented to transform the Sarathi Smart Solutions repository into a production-ready, static-first company website.

---

## 1. Context and Architectural Principles

- **Static-First & Lightweight**: The website runs purely on HTML5, modern CSS, vanilla ES modules, and zero client-side or server-side frameworks. No React, Next.js, database, or backend services are needed.
- **Single Source of Truth**:
  - `recommendation.mjs`: Pure business rules, recommendation engine, contact configurations, message formatting, and WhatsApp URL generation.
  - `app.js`: Browser UI interactions, accessible multi-step form management, DOM updates via safe APIs, clipboard, and Web Share API integrations.
- **Preserved Business Identity**: All existing contact details (`+91 83697 04457`, `sarathismartsolutions@gmail.com`, Bhayander East / Thane address), genuine equipment brand partnerships, and advertised package pricing are retained without fabricating claims or statistics.
- **Owner-Maintainable**: Business configurations, contact details, pricing starting points, and service lists are centralised in clear constants with JSDoc descriptions so a small business owner can update them without touching rendering logic.

---

## 2. Security Hardening

1. **Elimination of `innerHTML`**:
   - Dynamic inputs or options rendered in `app.js` (`renderSizes`, `renderResult`, `showStep`) are constructed strictly using `document.createElement()`, `textContent`, `setAttribute()`, and `replaceChildren()`.
   - Completely removes any DOM-based Cross-Site Scripting (XSS) attack surface.
2. **Safe URL & Contact Sanitisation**:
   - Telephone and WhatsApp links are normalised and encoded using `encodeURIComponent()` via pure helper functions (`buildWhatsAppUrl`).
   - All external outbound links specify `rel="noopener noreferrer"` to prevent reverse tabnabbing.
3. **Repository Hygiene**:
   - Update `.gitignore` to prevent committing `.env*` files, coverage reports, build artifacts (`dist/`), test reports, and operating system metadata (`.DS_Store`, `Thumbs.db`).
   - Add `SECURITY.md` defining responsible disclosure guidelines and contact channels.
   - Include a security checklist in `README.md`.

---

## 3. Accessibility (Target: WCAG 2.2 AA)

1. **Semantic HTML & Navigation**:
   - Meaningful landmarks (`<header>`, `<main>`, `<section>`, `<aside>`, `<footer>`, `<nav>`).
   - Fieldset and `<legend tabindex="-1">` elements for grouped radio and checkbox inputs.
   - Moving between steps programmatically moves focus to the legend, prompting assistive technologies to read the current step question immediately.
2. **Accessible Form Progress & Error Announcements**:
   - Progress bar enhanced with `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, and `aria-valuetext="Step X of 3: [Step Name]"`.
   - Form error containers use `role="alert"` and `aria-live="assertive"`, referenced by input groups via `aria-describedby`.
   - Real-time error clearing upon input interaction.
3. **Keyboard & Focus States**:
   - Replace semi-transparent focus outlines with a solid, high-contrast outline (`3px solid var(--gold)` with offset) complying with WCAG 2.2 focus appearance guidelines.
   - Full keyboard accessibility for multi-step planner, package CTAs, and FAQ accordions (`<details>` / `<summary>`).
4. **Motion & Media**:
   - Full `@media (prefers-reduced-motion: reduce)` support disabling animations, transitions, and transforms.
   - Decorative SVGs explicitly tagged with `aria-hidden="true"`.
   - Image elements feature explicit dimensions (`width="42"` `height="42"`) and proper alt text to eliminate Cumulative Layout Shift (CLS).

---

## 4. Planner and User Experience

1. **Preserving Selections Across Navigation**:
   - Navigating Back from Step 2 to Step 1 and back forward to Step 3 preserves the user's previously selected size option if the space has not changed.
   - Re-rendering size choices only occurs if the space type changes.
2. **Clear Feedback & Statuses**:
   - Pre-WhatsApp enquiry summary presented in an accessible `<pre>` container.
   - Clear feedback status messages for clipboard copy actions and Web Share fallback.
3. **Mandatory Pricing & Site Condition Disclaimer**:
   - Clearly placed under the recommendation card and the package comparison section:
     _“Final recommendation and pricing depend on site survey, equipment selection, cable length, installation conditions, and customer requirements.”_

---

## 5. SEO, Metadata & Structured Data

1. **Meta & Social Tags**:
   - Descriptive title and meta description.
   - Canonical URL tag with owner placeholder instructions.
   - Open Graph tags (`og:title`, `og:description`, `og:type`, `og:image`, `og:url`, `og:site_name`, `og:locale`).
   - Twitter / X card tags (`twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`).
   - Meta robots directive (`index, follow`).
2. **Structured Data (JSON-LD)**:
   - `ProfessionalService` schema containing verified business details (name, telephone, email, physical address, service areas in Mumbai MMR, and placeholder for operating hours).
3. **Crawling Assets**:
   - `robots.txt` and `sitemap.xml` generated with clear owner instructions for final domain substitution.

---

## 6. Performance Optimisations

1. **Asset & Font Loading**:
   - Preconnect hints for Google Fonts (`Manrope`).
   - High-priority header logo with `fetchpriority="high"`.
   - Lazy loading and asynchronous decoding for below-the-fold assets (`loading="lazy"` and `decoding="async"` on footer logo).
2. **Zero Runtime Overhead**:
   - No external JavaScript libraries, heavy frameworks, or analytics bundles blocking the main thread.
   - Smooth 60fps performance on budget mobile devices and slow networks.

---

## 7. Testing Strategy

1. **Unit Tests (Node.js Built-in Runner)**:
   - Expanded tests in `tests/recommendation.test.mjs` verifying:
     - Input validation (missing space, empty needs, invalid size, unknown need IDs).
     - Bundle complexity calculation across all tiers (`Secure Start`, `Connected Control`, `Smart Site 360`).
     - Stable enquiry text generation.
     - Safe WhatsApp URL formatting and parameter encoding.
2. **End-to-End Tests (Playwright)**:
   - Lightweight browser tests in `tests/e2e/planner.spec.mjs` covering:
     - Happy path planner completion.
     - Form validation blocking next step when selections are missing.
     - Backward navigation preserving selected state.
     - Reset button functionality.
     - WhatsApp URL attribute verification.
     - Keyboard accessibility and screen reader attribute presence.

---

## 8. Cross-Platform Tooling & CI/CD

1. **Build System**:
   - `scripts/build.mjs`: Native Node.js script using `node:fs` to clean `dist/` and copy static production assets across Windows, macOS, and Linux without Unix shell dependencies.
2. **Code Style & Linting**:
   - `.editorconfig`, `.prettierrc`, and `eslint.config.js` for clean formatting and linting.
3. **Continuous Integration**:
   - `.github/workflows/ci.yml`: Automated GitHub Actions pipeline executing formatting checks, ESLint, Node.js unit tests, production build, and Playwright E2E tests on pull requests and pushes to `main`.
   - `.github/dependabot.yml`: Automated dependency updates for npm and GitHub Actions.
