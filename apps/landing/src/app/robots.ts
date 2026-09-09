import type { MetadataRoute } from "next";
import { envConfig } from "@/shared/config/env";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = envConfig.siteUrl;

  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
