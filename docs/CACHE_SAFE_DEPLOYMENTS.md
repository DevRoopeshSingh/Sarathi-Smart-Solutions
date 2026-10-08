# Cache-safe static deployments

The Cloudflare deployment in `wrangler.jsonc` serves the static `dist/` build. The local React/Next.js operations app is a separate serving path; its imported CSS already uses Next.js build filenames. Do not replace the project build with a generic Vite configuration.

## What changed

The previous `_headers` allowed unchanged CSS/JavaScript URLs to remain fresh for one day and stale for another week. That can pair new HTML with old styling. A hard refresh recovering the layout is consistent with stale resources, but does not identify HTML versus CSS or prove a particular Cloudflare dashboard rule.

`npm run build` now writes content-fingerprinted runtime assets to `dist/assets/build/` and rewrites every public HTML page to those URLs. For example, `styles.css` becomes `/assets/build/styles.<content-hash>.css`. The app module imports the matching fingerprinted recommendation module; a dependency change also changes the app module's URL. Local development and synchronized operations source URLs remain unchanged.

HTML, including `/` and extensionless service/policy paths, and legacy unversioned runtime assets require revalidation (`public, max-age=0, must-revalidate`). The fingerprinted assets use the existing `/assets/*` immutable policy. Cache-Control rules do not overlap for the new runtime assets, because Cloudflare joins duplicate header values rather than treating the last rule as an override.

## Publishing and checking

1. Run `npm run sync:seo` when editing shared homepage assets, then `SITE_URL=https://sarathismartsolutions.in npm run build`.
2. Publish the complete `dist/` directory, including `_headers` and `assets/build/`, through the existing Cloudflare Pages or Worker assets deployment. Never publish only the new HTML or only the stylesheet. Do not upload the unresolved source directory.
3. Fetch the deployed `/` normally and inspect the stylesheet and script URLs: they should include content hashes. Confirm each URL returns the expected content type and a successful response.
4. Check headers on `/`, `/index.html`, `/digital-seva-kendra`, a legacy `/styles.css` URL and the new hashed stylesheet. HTML/legacy URLs must revalidate; hashed assets may be cached immutably. For example: `curl -I https://sarathismartsolutions.in/`.
5. Compare before/after HTML across a CSS change. The stylesheet URL must change without requiring a hard refresh. An unchanged stylesheet retains its URL.

If a custom Cloudflare Cache Rule or Page Rule forces an HTML Edge TTL or Browser TTL, remove that override or bypass HTML caching as appropriate. The repository cannot inspect or change dashboard rules. Purge affected edge URLs once when correcting an existing override. Purging the CDN does not clear already-fresh browser caches; the versioned asset URLs prevent new HTML from reusing those old CSS/JS entries. Already-open tabs and previously cached HTML may still need a reload during the first migration.

The build keeps legacy files available for existing links, but does not retain every previous fingerprinted build. Very old tabs attempting a lazy import after another deployment may need a reload; this site currently has no lazy local module imports. Do not promise that headers can retroactively expire an already-cached response.

## Verification

`tests/versioned-assets.test.mjs` covers changed versus unchanged asset identity, dependency invalidation, every public HTML page, literal dynamic imports, invalid dependencies/cycles and nonconflicting cache policies. It uses real runtime sources, with no network or browser cache assumptions.

Cloudflare documentation: [Pages serving and default caching](https://developers.cloudflare.com/pages/configuration/serving-pages/), [Pages custom headers and duplicate handling](https://developers.cloudflare.com/pages/configuration/headers/), [Worker static asset headers](https://developers.cloudflare.com/workers/static-assets/headers/). Custom `_headers` apply to static asset responses, not application-generated SSR/Function responses.
