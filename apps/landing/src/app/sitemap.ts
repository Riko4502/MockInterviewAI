import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://mockinterviewai.com";

  return [
    {
      url: `${baseUrl}/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
      alternates: {
        languages: {
          ru: `${baseUrl}/`,
          en: `${baseUrl}/en/`,
        },
      },
    },
    {
      url: `${baseUrl}/en/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
      alternates: {
        languages: {
          ru: `${baseUrl}/`,
          en: `${baseUrl}/en/`,
        },
      },
    },
  ];
}
