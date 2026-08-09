import type { MetadataRoute } from "next"

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "")
  const agora = new Date()
  return [
    { url: `${base}/`, lastModified: agora, changeFrequency: "daily", priority: 1 },
    { url: `${base}/escala`, lastModified: agora, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/biblioteca`, lastModified: agora, changeFrequency: "weekly", priority: 0.7 },
  ]
}
