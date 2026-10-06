# SEO implementation — 5 October 2026

## Implemented and ready to publish

- Homepage title includes CCTV installation, Mira-Bhayandar, and Sarathi Smart Solutions. The description focuses on cameras, AMC, mobile viewing, and the local survey.
- The hero retains the conversion improvements while naming CCTV and Mira-Bhayandar explicitly.
- Three dedicated service pages explain distinct needs: installation/packages, repair/AMC, and housing society coverage. Each has its own title, description, canonical URL, social metadata, Service schema, BreadcrumbList schema, and a WhatsApp enquiry action.
- The homepage, footer, and service pages have ordinary crawlable links to these pages.
- The sitemap contains ten URLs including the three new service pages. Source modification dates are explicit, rather than changing on every build.
- Business structured data uses the same RNP Park address as the visible contact block and links the existing Google profile.
- The public customer-feedback placeholder is replaced with a Google-profile link and neutral explanatory text. No fictional testimonials, ratings, hours, or installation stories were published.
- Six gallery images have responsive WebP versions at 480, 960, and 1200 pixels. Combined full-size files decreased from 2,732,225 bytes to 360,382 bytes (86.8%). This is an image-size measurement, not a Google performance score.
- The operations runtime defaults to the real production domain. Native robots/sitemap routes replace public placeholder files. Native service routes render the same static templates with the configured production origin.

## Validation

- 39 unit tests passed.
- ESLint passed.
- Static production build passed, with production URLs substituted in all public SEO templates.
- 23 browser tests passed against a fresh static preview, including existing forms and planner behavior, viewport widths from 320 to 1440px, no-JavaScript service pages, metadata, internal links, and responsive image delivery.
- Native type checking passed. Native production build passed using Next.js's supported Webpack builder. Turbopack could not bind its internal CSS worker port in this environment.
- Four additional browser checks passed against the built native runtime for service routes, sitemap inclusion, metadata, links, and WebP delivery.
- Desktop and mobile screenshots were inspected for the homepage and service-page layouts.

## Remaining external work

### Publish the verified bundle

On 6 October, the production bundle was rebuilt successfully. An initial upload reached a workers.dev preview in a different account, but production domain attachment failed because that account could not resolve the domain zone. A subsequent live fetch confirmed the production homepage still had its previous title. Device authorization later completed, but the read-only deployment check reported that the existing `sarathi-smart-solutions` Worker does not exist in that authorized account. No replacement Worker was created there. Production publishing remains unconfirmed; verify the account containing the existing Worker before any CLI deployment.

Sign into the existing business account; do not create a temporary account or a replacement site. Verify the authenticated account before deploying:

```sh
npx --cache /private/tmp/sarathi-seo-npm-cache --yes --package wrangler wrangler login --browser false --scopes account:read user:read workers_scripts:write workers_routes:write zone:read
npx --cache /private/tmp/sarathi-seo-npm-cache --yes --package wrangler wrangler whoami
npx --cache /private/tmp/sarathi-seo-npm-cache --yes --package wrangler wrangler deployments list
```

Complete Cloudflare's authorization screen yourself, then deploy the existing project:

```sh
SITE_URL=https://sarathismartsolutions.in npm run build
npx --cache /private/tmp/sarathi-seo-npm-cache --yes --package wrangler wrangler deploy
```

The temporary cache avoids a permissions error in the machine's existing npm cache. No global cache ownership or permissions were changed. The reduced OAuth scopes exclude certificate management and unrelated Cloudflare products; Wrangler automatically adds its OAuth refresh scope. Deployment must use the existing `sarathi-smart-solutions` Worker in the account hosting `sarathismartsolutions.in` and the domains in `wrangler.jsonc`. A Git push is separate from a verified production release; confirm the connected Cloudflare build and its result if publishing through Git integration. Verify the live homepage, three clean service URLs, sitemap, canonical addresses, image responses, and redirects after publishing. No production-domain deployment has been completed yet.

### Search Console

A Chrome tab for the HTTPS URL-prefix property is open. Browser tooling could see the tab address but could not read the dashboard content, so verification, indexing status, and sitemap submissions remain unconfirmed.

After deployment:

1. Open the existing Search Console property for `https://sarathismartsolutions.in/`.
2. Submit `sitemap.xml` under Sitemaps if it has not been submitted; otherwise check the existing submission's result.
3. Inspect the homepage and the three new service URLs. Run Test Live URL, check the selected canonical, and request indexing for newly published or updated pages.
4. Check Page Indexing, Security Issues, and Manual Actions. Record queries, impressions, clicks, and enquiry conversions as a baseline.

An existing verified URL-prefix property is sufficient for these steps. A DNS-verified Domain property can consolidate domain variants, but do not duplicate setup unnecessarily. Indexing and rankings remain Google's decisions.

### Google Business Profile and genuine customer evidence

Confirm access and verification for the existing profile linked by the website. Check the category, public contact information, service area, and website URL. Add actual opening hours only after the owner confirms them. Request honest customer reviews and approved project stories; do not use the fictional testimonial drafts as customer evidence. No invitations or customer messages were sent.

## Maintaining the changes

Edit `scripts/generate-cctv-pages.mjs` for the new service copy, then run `npm run generate:cctv`. Update real sitemap modification dates when substantive content changes. Run `npm run sync:seo` after editing the homepage, shared CSS, sitemap, or image assets and before building the operations app. `npm run build` produces the static deployment bundle.
