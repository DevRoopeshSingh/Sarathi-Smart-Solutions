import type { MetadataRoute } from "next";
import entries from "@/lib/seo-sitemap.json";
import { publicSiteUrl } from "@/lib/public-site";

export default function sitemap(): MetadataRoute.Sitemap {
  return entries.map((entry) => ({
    url: `${publicSiteUrl()}${entry.path}`,
    lastModified: entry.lastModified
  }));
}
