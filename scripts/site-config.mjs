/** Shared URL configuration for the local server and production build. */
export const PUBLIC_FILES = Object.freeze([
  "_headers",
  "_redirects",
  "index.html",
  "styles.css",
  "app.js",
  "recommendation.mjs",
  "01_icon_primary.png",
  "assets/brand/sarathi-cctv-logo-pack/sarathi-logo-dark.svg",
  "assets/brand/sarathi-cctv-logo-pack/sarathi-logo-light-2048.png",
  "assets/brand/sarathi-cctv-logo-pack/favicon/favicon-light.svg",
  "assets/brand/sarathi-cctv-logo-pack/favicon/favicon-dark.svg",
  "assets/brand/sarathi-cctv-logo-pack/favicon/favicon-light-32.png",
  "assets/brand/sarathi-cctv-logo-pack/favicon/favicon-light-256.png",

  "robots.txt",
  "sitemap.xml",
  "privacy.html",
  "terms.html",
  "warranty-policy.html",
  "amc-policy.html",
  "cancellation-refund.html",
  "404.html",
  "assets/images/camera-mounting.jpg",
  "assets/images/dvr-nvr-rack.jpg",
  "assets/images/cable-casing-finish.jpg",
  "assets/images/wifi-ap-installation.jpg",
  "assets/images/cable-management-before.jpg",
  "assets/images/cable-management-after.jpg"
]);

export const DEFAULT_PRODUCTION_URL = "https://sarathismartsolutions.in";

export function getSiteUrl({ production = false, env = process.env } = {}) {
  let configured = env.SITE_URL?.trim();
  if (!configured && production) {
    configured = DEFAULT_PRODUCTION_URL;
  }
  const url = new URL(configured || "http://127.0.0.1:8080");
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  ) {
    throw new Error(
      "SITE_URL must be an HTTP(S) origin without a path, credentials, query or fragment."
    );
  }
  if (
    production &&
    (url.protocol !== "https:" ||
      url.hostname === "localhost" ||
      url.hostname.endsWith(".localhost") ||
      url.hostname === "[::1]" ||
      url.hostname.startsWith("127.") ||
      url.hostname === "0.0.0.0")
  ) {
    throw new Error("Production SITE_URL must use HTTPS and a public hostname, not localhost.");
  }
  return url.origin;
}

export function renderPublicText(source, siteUrl) {
  return source.replaceAll("__SITE_URL__", siteUrl);
}
