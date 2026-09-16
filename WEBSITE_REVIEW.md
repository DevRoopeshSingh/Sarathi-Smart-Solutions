# Website review and implementation

## Outcome

The homepage now prioritizes CCTV, Wi‑Fi, smart locks, access control and AMC, with WhatsApp as the main action. The existing navy, cyan and gold identity, four package prices, business contact details, policy URLs and planner functionality are preserved. Pre-existing staged work was retained; this work is left unstaged for review.

### Major improvements

- Benefit-led hero and explicit trust points. Fixed initial planner focus that scrolled a new visitor away from the hero. Kept a separate quick survey form so it no longer stretches the hero column.
- Call, WhatsApp and Free Survey shortcuts fit narrow screens and account for the device safe area. Improved tablet navigation, heading wrapping, field sizes and visible focus.
- Additional services use more compact cards. Added CCTV AMC to the shared catalogue, planner and both enquiry forms.
- Preserved ₹13,900 / ₹15,900 / ₹17,900 / ₹30,900 prices and package equipment. Added suggested layouts and conditional timing, corrected the popular card's CSS class, and clarified exclusions including UPS and GST.
- Added the five-step installation process, photo and testimonial placeholders, illustrative itemized quotation, warranty/AMC explanations and local service coverage.
- All 15 FAQs already had answers. Aligned survey geography, AMC inclusions and payment milestones with existing policies, and synchronized every FAQ schema answer with its accordion content.
- Both forms have property type, optional details, explicit consent, field-specific errors, Indian phone validation, busy state, honeypot and duplicate protection. They retain customer input and provide a retry link if a popup is blocked.
- Forms accurately report that a WhatsApp message is prepared. Customers must press Send in WhatsApp, and the business must confirm the appointment. There is no website booking backend.
- Removed persistent browser lead storage and remove legacy `sarathi_leads` records on the device when the updated page loads. Prepared customer URLs are excluded from analytics events. Disabled form submission without JavaScript to prevent accidental GET-query disclosure.
- Added one `SITE_URL` configuration for canonical/social URLs, JSON-LD identity/URLs, sitemap and robots. The local server resolves templates and is marked noindex; production builds require a public HTTPS origin and reject localhost. The server exposes only public assets and handles query-string home URLs correctly.

## Files changed in this review

| Files                                                         | Purpose                                                                            |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `index.html`                                                  | Hero, forms, packages, trust sections, FAQs and URL templates                      |
| `styles.css`                                                  | Responsive hierarchy, compact services, trust sections and accessible form styles  |
| `app.js`                                                      | Initial focus, form validation, privacy, duplicate protection and WhatsApp handoff |
| `recommendation.mjs`                                          | Core AMC service and consistent Wi‑Fi labels                                       |
| `privacy.html`                                                | Accurate explanation of the website form's WhatsApp handoff                        |
| `scripts/site-config.mjs`, `.env.example`                     | Single public URL setting and documentation                                        |
| `scripts/build.mjs`, `scripts/serve.mjs`                      | Template rendering, production validation and safe preview serving                 |
| `robots.txt`, `sitemap.xml`                                   | Configured domain templates                                                        |
| `.github/workflows/ci.yml`                                    | Reserved test origin for CI build verification; no deployment                      |
| `tests/e2e/conversion.spec.mjs`, `tests/site-config.test.mjs` | Conversion, privacy, keyboard, responsive and URL regressions                      |
| `README.md`, `WEBSITE_REVIEW.md`                              | Configuration instructions and review/testing handoff                              |

## Business content still needed

- The final production domain. Set `SITE_URL` in the hosting build environment and rebuild before publishing. The generated test build uses `https://sarathi.example`, a reserved test hostname, and must not be deployed as the final site.
- Three genuine, approved photos: an installation, a before cable-management photo, and the matching after photo. The page explicitly labels each placeholder.
- Genuine customer feedback and permission to publish it. No customer names, ratings or review counts were created.
- Actual item rates for an approved sample quotation, if desired. The sample uses existing package inclusions and the starting package price; it does not invent individual rates.
- A confirmed precise shop address, map pin and opening hours before adding those richer schema fields. The visible locality remains Bhayander East, Mira-Bhayandar, Thane – 401105.

## Verification and remaining limits

- Final full run: **28/28 browser tests and 15/15 unit tests passed**, including all original 17 browser regressions. ESLint, Prettier and `git diff --check` passed. The production build succeeded with the reserved test origin, and generated public files contain no localhost or unresolved URL placeholders.
- New checks cover both enquiry forms, popup/storage failure, duplicate prevention, all FAQ/schema pairs, local links, unchanged package prices/WhatsApp URLs, no-JavaScript fallback and responsive screenshots at 320, 375, 768, 1024 and 1440 pixels.
- No console/page errors were found in the browser error check. The development server is running at `http://127.0.0.1:8080/`.
- The final local unthrottled Chromium snapshot recorded largest contentful paint at approximately **300 ms**, cumulative layout shift **0.0029**, and DOM content loaded at approximately **224 ms** (1280 × 720 viewport). These development measurements are not production Core Web Vitals or a mobile-network benchmark. Cross-origin resources may report zero transfer size.
- The original Google profile URL is retained. The browsing tool could not verify its redirect, so its destination still needs a manual check. No real enquiry, phone call or review was sent during testing.
- WhatsApp delivery and device dialer behaviour require a real-device check. Automated tests validate the links and prepared payloads without contacting the business.
- Schema describes readable page content and excludes invented reviews, consistent with [Google's structured-data guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies). Search placement is not verified by local testing.

## Manual checklist

### Desktop

- [ ] Open `http://127.0.0.1:8080/` using `npm run serve`; confirm the page starts at the hero.
- [ ] Review all four package prices, coverage guidance, inclusions, exclusions and the highlighted 4-camera option.
- [ ] Open each package WhatsApp link and verify the matching package/price in the draft message.
- [ ] Complete both forms with a valid Indian number (with and without +91), locality, property and service; review the WhatsApp message before sending any real enquiry.
- [ ] Try invalid phone input, empty required fields, unchecked consent and repeated clicks. Confirm useful errors and the prepared-message retry link.
- [ ] Use Tab, Shift+Tab, Enter and Space for forms and planner. Use Enter/Space and arrow keys for FAQ buttons.
- [ ] Complete the planner for core, AMC and additional services; check back, reset, copy, share and WhatsApp results.
- [ ] Open all policy pages and the original Google profile link.

### Mobile and tablet

- [ ] Check 320, 375, 768 and 1024 pixel layouts; confirm no horizontal page scrolling.
- [ ] Check sticky Call, WhatsApp and Free Survey actions with the keyboard open and closed, including a device with a bottom safe area.
- [ ] Test select menus, checkbox consent, phone keypad, visible errors and popup retry on an actual iPhone/Android device.
- [ ] Check the quotation table, long package cards and footer links without clipped text or hidden controls.
- [ ] Enable reduced motion and confirm navigation remains usable.

### Before publishing

- [ ] Set the final `SITE_URL` and run `npm run build`; publish only `dist/`.
- [ ] Inspect generated canonical, Open Graph, Twitter, JSON-LD, sitemap and robots URLs; none should contain localhost, `__SITE_URL__` or the reserved test domain.
- [ ] Add approved project photos and reviews, and recheck image sizing/alt text.
- [ ] Confirm the written business policies and commercial details with the owner, then test on the actual production host and mobile network.
