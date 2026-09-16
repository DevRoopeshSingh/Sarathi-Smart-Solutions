/** Shared URL configuration for the local server and production build. */
export const PUBLIC_FILES = Object.freeze([
  "index.html",
  "styles.css",
  "app.js",
  "recommendation.mjs",
  "01_icon_primary.png",
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

export function getSiteUrl({ production = false, env = process.env } = {}) {
  const configured = env.SITE_URL?.trim();
  if (!configured && production) {
    throw new Error(
      "SITE_URL is required for production builds. Set the final HTTPS public origin in your hosting environment; see .env.example."
    );
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
