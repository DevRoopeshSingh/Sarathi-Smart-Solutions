# Digital Seva Kendra: database-free delivery

## Architecture and hosting

The current `wrangler.jsonc` configures the `sarathi-smart-solutions` Cloudflare Worker to serve static assets from `dist/`, with custom domains for the apex and `www`. The older Pages runbook describes an alternative static deployment. For the configured Worker, `npm run build` produces the static `dist/` directory, including the Seva page, browser script, styles, images, redirects and headers. The page needs no database, Worker application code, form API, or additional hosting service. Set `SITE_URL` to the public HTTPS origin when building for that deployment. Hosting-account settings were not changed as part of this work.

The separate `operations/` Next.js application serves the local website at port 3000 and has its own existing authenticated PostgreSQL workspace. Seva does not use that database or introduce an operations module. Its `/digital-seva-kendra` route serves the same standalone generated document, resolves URL templates using `PUBLIC_SITE_URL`, then `SITE_URL`, then the configured production-domain fallback, and avoids the CCTV page layout/structured data. Next redirects `/digital-seva-kendra.html` to the clean URL.

## Customer flow

- A visitor selects one of 153 services, supplies a name and valid Indian mobile number, selects walk-in or online assistance, and optionally adds notes.
- **Prepare WhatsApp Enquiry** validates the inputs and prepares the service, price type, fees, contact details, mode and notes in an encoded WhatsApp message.
- The visitor must open WhatsApp and press Send. The page explicitly says that the enquiry is not a booking confirmation; staff confirm availability, total charges and next steps.
- Details stay in the current page's memory. No customer record, request ID or application status is created. The obsolete browser-local request record is removed on load, and disabled storage does not prevent use.
- For an existing application, the visitor enters the reference supplied by staff or an official receipt and prepares a status question to send to the desk. No simulated lookup, demo status, document-verification claim, or progress stepper remains.
- Edit and Start New actions allow another enquiry. Direct phone/WhatsApp links remain usable without JavaScript; the inactive form cannot pretend to submit.

Reliable online request IDs, cross-device tracking, status updates, appointments, and staff assignments require a future persistent backend. They are intentionally not represented as working features in this static release.

## Content and interaction corrections

Responsive section navigation replaces the overflowing header at narrower widths. Search, catalogue filters, pagination, default sort restoration, document checklists, FAQs and the mobile dock are retained. Hero shortcuts reset incompatible directory filters. The uninformative Same Day filter is replaced with Printing & Photo, and generic timing claims now ask visitors to confirm timing after review.

The Sunday opening calculation is corrected. Service counts derive from the Seva subset of the master catalogue: 153 services and 12 packages, excluding Smart Solutions entries. Card and modal fee wording use the same catalogue field, with a clear overall exclusion notice. Unsupported review ratings and named testimonials are replaced by a customer-feedback invitation. Malformed WhatsApp icons are replaced, and empty clear buttons respect their hidden state.

## Editing and generation

The Python generator owns the page markup; `docs/extracted_services.json` and `docs/extracted_packages.json` supply the catalogue. To update the page, edit the generator/data and run:

```sh
npm run generate:seva
```

This requires Python 3 and the installed Node development dependencies. It formats generated HTML and synchronizes the page, browser JavaScript and shared CSS into `operations/public/`. Generated assets are checked in, so the Cloudflare static-asset build still requires Node only. A unit test prevents the two serving paths from silently drifting apart.

## Regression coverage

`tests/e2e/digital-seva-kendra.spec.mjs` covers console errors, metadata, catalogue/contact/fee consistency, search/filter/sort/pagination, checklist and FAQ controls, invalid phone numbers, both assistance modes, complete WhatsApp messages, no submission or customer storage, blocked storage, unknown references, no-JavaScript fallback, IST opening boundaries, and responsive navigation at 320, 390, 768, 920, 1024, 1280 and 1440 pixels.

`operations/tests/digital-seva-page.test.ts` verifies HTML metadata rendering without the database or CCTV schema, and rejects invalid configured origins. The existing homepage browser suite checks shared-style regressions.

No test sends an enquiry, email or phone call to the business. No deployment is performed by these changes.

## Verification completed — 2 October 2026

| Check                                        | Result                                 |
| -------------------------------------------- | -------------------------------------- |
| Root unit tests                              | 39 passed                              |
| Full static-site browser suite               | 49 passed, including 18 Seva tests     |
| Seva browser suite against Next at port 3000 | 18 passed                              |
| Operations unit tests                        | 20 passed                              |
| ESLint and Prettier                          | Passed                                 |
| Operations typecheck                         | Passed                                 |
| Static production build                      | Passed                                 |
| Next production build with `--webpack`       | Passed                                 |
| Next `.html` alias                           | 308 redirect to `/digital-seva-kendra` |
| Working-tree whitespace check                | Passed                                 |

The default Next Turbopack build could not finish in this execution environment because its CSS worker's internal port binding was denied (`Operation not permitted`). The supported `npm --prefix operations run build -- --webpack` check succeeded without changing the project's configured build command. This restriction does not affect the Cloudflare static build. Browser checks reported no page or console errors after the SVG fix.

## Commit preparation — 3 October 2026

Confirmed `wrangler.jsonc` uses Worker static assets from `dist/`; no hosting configuration change is needed. Corrected the homepage cross-links to advertise the same 153-service catalogue as the Seva page. Cloudflare supports the existing relative 200 proxy rule in `_redirects` ([official reference](https://developers.cloudflare.com/workers/static-assets/redirects/#proxying)).
