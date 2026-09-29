/*
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Adapted from the supplied Locator Plus snippet: local map center, deferred
 * loading, build-time API key configuration, and accessible fallback links.
 */

const button = document.getElementById("load-location-map");
const container = document.getElementById("location-map");
const status = document.getElementById("location-map-status");
const apiKey = document.querySelector('meta[name="google-maps-api-key"]')?.content || "";

const configuration = {
  locations: [
    {
      title: "Sarathi Smart Solutions",
      address1: "RNP Park Bhayander East",
      address2: "Thane, Maharashtra, India",
      coords: { lat: 19.3152633, lng: 72.8586247 },
      placeId: "ChIJ4Ydlu3av5zsRPe9y8mQmG0Y"
    }
  ],
  mapOptions: {
    center: { lat: 19.3152633, lng: 72.8586247 },
    fullscreenControl: true,
    mapTypeControl: false,
    streetViewControl: false,
    zoom: 15,
    zoomControl: true,
    maxZoom: 17,
    gestureHandling: "cooperative"
  },
  mapsApiKey: apiKey,
  capabilities: {
    input: false,
    autocomplete: false,
    directions: false,
    distanceMatrix: false,
    details: false,
    actions: false
  }
};

if (button && container && status && /^AIza[A-Za-z0-9_-]+$/.test(apiKey)) {
  button.hidden = false;
  document.getElementById("location-map-note").hidden = false;
  button.addEventListener(
    "click",
    async () => {
      button.disabled = true;
      container.setAttribute("aria-busy", "true");
      status.textContent = "Loading the interactive map…";
      let timer;
      let failed = false;
      const showFallback = () => {
        failed = true;
        container.hidden = true;
        container.removeAttribute("aria-busy");
        status.textContent =
          "The interactive map is unavailable. Use Open in Google Maps or call us.";
        button.textContent = "Map unavailable";
      };
      // Maps reports browser-key authorization errors through this documented hook.
      window.gm_authFailure = showFallback;
      try {
        const load = async () => {
          const { APILoader } =
            await import("https://ajax.googleapis.com/ajax/libs/@googlemaps/extended-component-library/0.6.15/index.min.js");
          if (failed) return;
          const loader = document.createElement("gmpx-api-loader");
          loader.setAttribute("key", apiKey);
          loader.setAttribute("region", "IN");
          loader.setAttribute("version", "weekly");
          loader.setAttribute("solution-channel", "GMP_QB_locatorplus_v11_cABD");
          document.body.append(loader);
          await APILoader.importLibrary("maps");
          await customElements.whenDefined("gmpx-store-locator");
          if (failed) return;
          const locator = document.createElement("gmpx-store-locator");
          locator.setAttribute("map-id", "DEMO_MAP_ID");
          locator.configureFromQuickBuilder(configuration);
          container.replaceChildren(locator);
          container.hidden = false;
        };
        await Promise.race([
          load(),
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error("Map loading timed out")), 15000);
          })
        ]);
        if (!failed) {
          container.removeAttribute("aria-busy");
          status.textContent = "Use the map below to find our Bhayander East location.";
          button.hidden = true;
          container.focus({ preventScroll: true });
        }
      } catch {
        showFallback();
      } finally {
        clearTimeout(timer);
      }
    },
    { once: true }
  );
}
