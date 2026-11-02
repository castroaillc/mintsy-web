import type { MetadataRoute } from "next";
import { HELP_CENTER_URL, PRIVACY_URL, SITE_URL } from "@/lib/config";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${SITE_URL}/` }, { url: PRIVACY_URL }, { url: HELP_CENTER_URL }];
}
