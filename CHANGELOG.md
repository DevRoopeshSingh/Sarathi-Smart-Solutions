# Changelog

All notable changes to the Sarathi Smart Solutions website project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [1.0.0] - 2026-09-12

### Added

- **Production Architecture**: Strict separation of concerns between business recommendation logic (`recommendation.mjs`) and UI controller (`app.js`).
- **Zero-Dependency Cross-Platform Build**: `scripts/build.mjs` using native Node.js `fs` APIs, working seamlessly across Windows, macOS, and Linux.
- **Local Preview Server**: Lightweight `scripts/serve.mjs` static server for local development and headless E2E testing.
- **Comprehensive Unit Testing**: Expanded Node.js test suite with 10 unit tests in `tests/recommendation.test.mjs` verifying input validation, tier calculation, enquiry message formatting, and WhatsApp URL generation.
- **Browser End-to-End Testing**: Playwright suite in `tests/e2e/planner.spec.mjs` testing full 3-step navigation, form validation errors, selection persistence during backward navigation, reset behavior, and accessibility.
- **SEO & Social Metadata**: Canonical URL link, Open Graph tags, Twitter / X card tags, `robots.txt`, and `sitemap.xml`.
- **Structured Data**: `ProfessionalService` JSON-LD schema with verified company contact details, address in Mira-Bhayandar, and Mumbai MMR service regions.
- **CI/CD Automation**: GitHub Actions workflow (`.github/workflows/ci.yml`) and Dependabot updates (`.github/dependabot.yml`).
- **Documentation & Governance**: `IMPLEMENTATION_PLAN.md`, `CONTRIBUTING.md`, `SECURITY.md`, and complete `README.md` revamp.

### Security

- **Eliminated `innerHTML`**: Completely replaced all dynamic `innerHTML` rendering with safe DOM APIs (`document.createElement()`, `textContent`, `setAttribute()`, and `replaceChildren()`) to eliminate Cross-Site Scripting (XSS) risks.
- **URL Sanitisation**: Extracted pure `buildWhatsAppUrl()` with strict telephone normalization and URI component encoding.
- **Repository Hygiene**: Added `.env*`, coverage, logs, test reports, and OS files to `.gitignore`.

### Accessibility

- **WCAG 2.2 AA Compliance**: Semantic landmarks, fieldsets, and legends with `tabindex="-1"` for clean programmatic focus.
- **Accessible Progress Tracking**: Progress bar configured with `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, and `aria-valuetext`.
- **Accessible Error Announcements**: Error containers linked via `aria-describedby` with `role="alert"` and `aria-live="assertive"`.
- **High-Contrast Focus Rings**: Upgraded focus outlines to solid `3px solid var(--gold)` with offset.
- **Target Sizes**: Maintained minimum touch target sizes (≥44px) across mobile navigation and CTAs.
- **Reduced Motion**: Full support for `@media (prefers-reduced-motion: reduce)` disabling non-essential transitions and keyframe animations.
