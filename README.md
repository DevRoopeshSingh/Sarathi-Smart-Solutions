# Sarathi Smart Solutions — Official Website

> **Security • Connectivity • Automation**  
> _Smart Technology for Homes & Businesses across Mira-Bhayandar, Thane & Mumbai MMR._

The official production-ready website source code for **Sarathi Smart Solutions**, a local security and connectivity business specializing in CCTV installation, Wi‑Fi networking, smart locks, access control and CCTV AMC. Electrical work, cooling, IT, TV mounting and EV charging remain available as additional technical services.

This repository is built as a **high-performance, secure, static-first web application** using modern semantic HTML5, vanilla CSS, and standard ES modules with zero client-side framework overhead.

---

## Key Features

- **Interactive Solution Planner**: A multi-step guided tool that evaluates space requirements (Home or Business), desired technology needs, and setup size to calculate tailored equipment starting recommendations.
- **Direct WhatsApp & Share Dispatch**: Prospect enquiries can be shared directly via WhatsApp with auto-generated, URL-encoded enquiry summaries, copied to clipboard, or shared via native mobile share sheets.
- **Accessible by Design (WCAG 2.2 AA Target)**: Semantic HTML landmarks, full keyboard navigability, solid high-contrast focus rings, `role="progressbar"`, live screen reader error announcements (`role="alert"`), and `prefers-reduced-motion` compliance.
- **Hardened Security**: 100% safe DOM manipulation with zero `innerHTML` dynamic rendering, parameter sanitisation, and zero server-side storage of customer data.
- **SEO & Social Ready**: Canonical URL link, Open Graph protocol metadata, Twitter / X card tags, `robots.txt`, XML sitemap, and `HomeAndConstructionBusiness` (LocalBusiness subtype), Service and visible FAQ JSON-LD schema.
- **Cross-Platform Tooling**: Zero-dependency Node.js build and preview scripts that run natively on Windows, macOS, and Linux.
- **Automated Verification**: Node.js built-in unit tests, Playwright browser end-to-end testing, ESLint, Prettier, and GitHub Actions CI workflow.

---

## Technology Stack

- **Markup**: HTML5 (Semantic landmarks, microdata, SVG graphics)
- **Styling**: Vanilla CSS (CSS custom properties, flexbox, CSS grid, media queries)
- **Logic**: Vanilla JavaScript (ES modules, safe DOM manipulation)
- **Build System**: Cross-platform Node.js script (`scripts/build.mjs`)
- **Testing**:
  - Unit Tests: Node.js Built-in Test Runner (`node:test`, `node:assert/strict`)
  - End-to-End Tests: Playwright (`@playwright/test`)
- **Code Quality**: ESLint (Flat Config) & Prettier
- **CI/CD**: GitHub Actions & Dependabot

---

## Project Structure

```text
Sarathi-Smart-Solutions/
├── .github/
│   ├── dependabot.yml           # Automated dependency maintenance
│   └── workflows/
│       └── ci.yml               # GitHub Actions CI pipeline
├── scripts/
│   ├── build.mjs                # Cross-platform production build script
│   └── serve.mjs                # Local static development preview server
├── tests/
│   ├── e2e/
│   │   └── planner.spec.mjs     # Playwright browser end-to-end test suite
│   └── recommendation.test.mjs  # Node.js unit test suite for business rules
├── 01_icon_primary.png          # Primary brand logo & favicon
├── app.js                       # UI controller, form validation & events
├── CHANGELOG.md                 # Release changelog
├── CONTRIBUTING.md              # Contribution and coding standards
├── eslint.config.js             # ESLint flat configuration
├── IMPLEMENTATION_PLAN.md       # Technical architectural specifications
├── index.html                   # Main landing page markup & structured data
├── package.json                 # Scripts and minimal devDependencies
├── recommendation.mjs           # Business rules, pricing & recommendation engine
├── robots.txt                   # Search engine crawl directives
├── SECURITY.md                  # Responsible disclosure security policy
├── sitemap.xml                  # Search engine XML sitemap
└── styles.css                   # Custom responsive styling and theme tokens
```

---

## Local Development Setup

### Prerequisites

- **Node.js**: v20.x or higher (LTS recommended)
- **npm**: v10.x or higher

### 1. Clone & Install

```bash
# Clone the repository
git clone https://github.com/DevRoopeshSingh/Sarathi-Smart-Solutions.git
cd Sarathi-Smart-Solutions

# Install development dependencies (ESLint, Prettier, Playwright)
npm install
```

### 2. Start Local Preview Server

```bash
npm run serve
```

Open [http://127.0.0.1:8080/](http://127.0.0.1:8080/) in your browser.

Use the included Node preview server: it resolves the public URL templates and provides development-only noindex headers. A generic static server pointed at the source directory will leave SEO URL placeholders unresolved.

> [!NOTE]
> Do not open `index.html` directly via the `file://` protocol. Modern browsers require HTTP/HTTPS serving for ES module imports (`import ... from "./recommendation.mjs"`).

---

## Available Commands

| Command                | Purpose                                                          |
| :--------------------- | :--------------------------------------------------------------- |
| `npm run serve`        | Starts the zero-dependency local preview server on port 8080     |
| `npm test`             | Runs the Node.js unit test suite for recommendation engine rules |
| `npm run test:e2e`     | Runs headless Playwright browser end-to-end tests                |
| `npm run lint`         | Lints the codebase with ESLint                                   |
| `npm run format:check` | Verifies code formatting with Prettier                           |
| `npm run format`       | Auto-formats code with Prettier                                  |
| `npm run build`        | Cleans `dist/` and copies static production assets               |

---

## Editing Business Content & Rules

### 1. Contact Details & Business Configuration

All official contact details are centralised in [`recommendation.mjs`](file:///Users/rupeshsingh/Documents/WorkSpace/Sarathi_Smart_Solutions/recommendation.mjs):

```javascript
export const CONTACT_CONFIG = Object.freeze({
  phone: "+918369704457",
  phoneDisplay: "+91 83697 04457",
  whatsappNumber: "918369704457",
  email: "sarathismartsolutions@gmail.com",
  address: "Bhayander East, Mira-Bhayandar, Thane - 401105",
  serviceAreas: "Mira Road, Bhayandar, Thane, Dahisar, Borivali & Mumbai MMR",
  disclaimer:
    "Final recommendation and pricing depend on site survey, equipment selection, cable length, installation conditions, and customer requirements."
});
```

### 2. Service Definitions & Recommendations

- Edit `SERVICE_CATALOGUE` in [`recommendation.mjs`](recommendation.mjs) to add or update a service. Each stable service ID defines its label, description, SVG icon path, recommendations for three sizes, and optional enquiry fields. `NEED_LABELS` is derived automatically.
- `app.js` renders the service cards, planner checkboxes and enquiry fields from that catalogue. Do not maintain separate service lists in HTML. Metadata and the no-JavaScript contact summary in `index.html` should reflect the overall business scope.
- Enquiry fields support `select`, `number` and bounded `text` values. They appear in step 3 only for selected services, remain optional, and are included in recommendations and WhatsApp/copy/share summaries. Answers survive back navigation and reselection; deselected answers are excluded, and Start again clears everything.
- The `appliance` ID retains AC and refrigerator support. Additional service IDs are `electrical`, `it`, `tv` and `ev`; the six original security/networking/automation IDs remain supported.
- Enquiries use WhatsApp, clipboard and native sharing. Lead forms prepare a message and require the customer to press Send in WhatsApp. They do not save customer details in browser storage or book a survey on a server.
- Duplicate form preparation is suppressed in memory for 60 seconds; an explicit handoff link supports retrying blocked popups. Old `sarathi_leads` browser records are cleared when the updated site loads. Analytics events omit customer details and prepared WhatsApp URLs.
- AMC is a core catalogue entry; both lead forms also offer CCTV AMC enquiries.
- See [WEBSITE_REVIEW.md](WEBSITE_REVIEW.md) for changes, pending content and the manual testing checklist.
- To update setup sizes, modify `SIZE_OPTIONS` in [`recommendation.mjs`](file:///Users/rupeshsingh/Documents/WorkSpace/Sarathi_Smart_Solutions/recommendation.mjs).
- To adjust package card pricing and features, update the corresponding `<article class="package-card">` in [`index.html`](file:///Users/rupeshsingh/Documents/WorkSpace/Sarathi_Smart_Solutions/index.html).

---

## Security Checklist

- [x] **No dynamic `innerHTML`**: Dynamic content is created safely using `document.createElement()` and `textContent`.
- [x] **Safe URL Encoding**: All WhatsApp and share links sanitise input numbers and encode text using `encodeURIComponent()`.
- [x] **Reverse Tabnabbing Protection**: External links open with `rel="noopener noreferrer"`.
- [x] **No Hardcoded Secrets**: No API keys, private credentials, or access tokens are committed.
- [x] **Strict `.gitignore`**: Blocks accidental commit of `.env`, logs, and temporary build outputs.
- [x] **Responsible Disclosure Policy**: Detailed instructions in [`SECURITY.md`](file:///Users/rupeshsingh/Documents/WorkSpace/Sarathi_Smart_Solutions/SECURITY.md).

---

## Accessibility Notes (WCAG 2.2 AA)

- **Keyboard Traversal**: The entire site—including the 3-step planner, package CTAs, and FAQ accordions—is 100% operable via keyboard alone (`Tab`, `Shift+Tab`, `Space`, `Enter`, Arrow keys).
- **Visible Focus Indicator**: Focusable elements feature a solid high-contrast outline (`3px solid var(--gold)` with offset) meeting WCAG 2.2 focus appearance requirements.
- **Screen Reader Announcements**:
  - The planner step indicator uses standard ARIA progress attributes (`role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-valuetext`).
  - Validation errors use `role="alert"` and `aria-live="assertive"`.
  - When switching steps, focus is moved to `<legend tabindex="-1">` so the question is read immediately.
- **Reduced Motion**: Respects user OS preference for reduced motion via `@media (prefers-reduced-motion: reduce)`, pausing or disabling animations and transforms.

---

## Performance Guidance

- **Minimal Asset Footprint**: No bloated multi-megabyte UI frameworks or runtime script bundles.
- **CLS Prevention**: All image tags specify explicit `width` and `height` dimensions.
- **Resource Prioritisation**: The header brand logo uses `fetchpriority="high"`, while below-the-fold assets use `loading="lazy"` and `decoding="async"`.
- **Preconnected Fonts**: Google Fonts uses preconnect hints to speed up DNS lookup and TLS negotiation.
- **Low-End Mobile Friendly**: Fully optimized for budget Android devices on slower 3G/4G connections.

---

## Production Deployment & Domain Configuration Checklist

When preparing to publish this website to production:

1. **Production Domain Configuration**:
   - Set `SITE_URL` to the final HTTPS origin in your hosting platform's build environment, for example `https://www.yourdomain.com`. The production domain is not yet finalized.
   - [`.env.example`](.env.example) documents the variable. This project reads `process.env`; copying this file to `.env` does not automatically load it.
   - [`scripts/site-config.mjs`](scripts/site-config.mjs) is the single configuration source. The server and build replace `__SITE_URL__` in canonical, Open Graph, Twitter, business/service JSON-LD, sitemap and robots text.
   - `npm run serve` uses `http://127.0.0.1:8080` as a development fallback and sends `noindex` headers. Use this server for local development instead of serving the unresolved source templates directly.
   - `npm run build` requires `SITE_URL` and rejects localhost or non-HTTPS production URLs before changing `dist/`. Publish only the built `dist/` directory.
   - CI may use the reserved `https://sarathi.example` hostname to verify rendering. This is a test value, not the production domain. Build again with the real origin before publishing.

2. **Google Business Profile & Analytics**:
   - Ensure the business phone (`+91 83697 04457`) matches your verified Google Business Profile.
   - If adding privacy-friendly analytics (e.g. Google Analytics or Cloudflare Web Analytics), paste the tracking snippet directly before `</head>` in `index.html`.

3. **Deploying the Static Site**:
   - Build the distribution bundle:
     ```bash
     npm run build
     ```
   - Deploy the contents of the `dist/` directory to your chosen static host:
     - **Cloudflare Pages / Vercel / Netlify**: Point root directory to `dist` and build command to `npm run build`.
     - **GitHub Pages**: Deploy from the `dist` folder or configure GitHub Actions.
     - **Firebase Hosting / AWS S3**: Deploy `dist/` as the public directory.

---

## License Notice

**Licensing must be selected and configured by the business owner.**  
All original content, branding, trademarks, and graphics are the proprietary property of Sarathi Smart Solutions. For open-source or commercial terms, please consult the repository owner.
