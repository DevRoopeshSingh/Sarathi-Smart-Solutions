# Google Maps Locator Plus

The homepage's Find Us section adapts the supplied Google Locator Plus example
using Extended Component Library 0.6.15. The original Apache-2.0 notice is retained
in `locator.js`. The map uses the supplied RNP Park coordinates and Place ID.

## Activate the interactive map

1. In Google Cloud, configure a Maps Platform project with billing and a browser
   API key. Enable Maps JavaScript API. This single-location locator uses the
   basic feature set: address search, autocomplete and distance calculations are
   disabled, so it does not require the legacy Distance Matrix API. Customers can
   use the external Google Maps link for directions.
2. Apply website/referrer restrictions to the key for the actual serving hosts:
   `https://sarathismartsolutions.in/*`,
   `https://www.sarathismartsolutions.in/*`, and, if used for testing,
   `https://sarathi-smart-solutions.sarathidigitalsevakendra.workers.dev/*`.
   Restrict API access to the APIs used by this component. Use a separate key for
   local testing. Browser keys are intentionally public, not server secrets.
3. Set `GOOGLE_MAPS_API_KEY` in the Cloudflare Worker's **build** environment and
   rebuild with `npm run build`. A runtime-only Worker binding does not configure
   static HTML. For local builds and previews, set the key in ignored `.env.local`;
   `npm run build` and `npm run serve` load it automatically. Existing environment
   variables take precedence. `.env.example` remains a blank template.
4. The build writes the key into the homepage's `google-maps-api-key` meta tag.
   With no key, the address, phone and Google Maps link work; no Google locator
   script is loaded and the interactive-map button is hidden.
5. On the deployed site, click **Load interactive map**. Confirm the marker,
   mobile layout and browser-key restrictions. Replace
   `DEMO_MAP_ID` in `locator.js` with your own JavaScript Map ID if required for
   production customization; map IDs are separate from API keys.

The map loads only after a click. The location and contact links remain usable
if the CDN, SDK or authorization fails. No device geolocation is requested.
Live map validation requires a configured Google project; mocked browser
tests cover integration and failure handling without making billed API calls.

References:

- https://github.com/googlemaps/extended-component-library/blob/main/src/store_locator/README.md
- https://developers.google.com/maps/api-security-best-practices
