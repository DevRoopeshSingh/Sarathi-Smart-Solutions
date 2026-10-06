/** Production origin shared by native metadata and static service responses. */
export function publicSiteUrl(): string {
  const url = new URL(process.env.PUBLIC_SITE_URL || "https://sarathismartsolutions.in");
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error("PUBLIC_SITE_URL must be a public HTTPS origin without a path or credentials.");
  }
  return url.origin;
}
