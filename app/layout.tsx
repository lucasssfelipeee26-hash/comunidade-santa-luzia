import type { Metadata, Viewport } from "next"
import { Suspense } from "react"
import { Cormorant_Garamond, Inter } from "next/font/google"
import "./globals.css"
import "./mobile-fixes.css"
import "./windows-beta.css"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"
import { AppRuntime } from "@/components/app-runtime"
import { OfflineLiturgiaRuntime } from "@/components/offline-liturgia-runtime"
import { NavigationProgress } from "@/components/navigation-progress"
import { lerTemaSite } from "@/lib/site-theme"

export const dynamic = "force-dynamic"

const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-cormorant" })
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Comunidade Santa Luzia · Acólitos e Coroinhas São Padre Pio",
  description: "Comunidade Santa Luzia · Acólitos e Coroinhas São Padre Pio, Paróquia Nossa Senhora das Graças, Várzea Grande - MT.",
  applicationName: "Santa Luzia",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Santa Luzia", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/icon-light-32x32.png", media: "(prefers-color-scheme: light)" },
      { url: "/icon-dark-32x32.png", media: "(prefers-color-scheme: dark)" },
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-icon.png",
  },
}

export const viewport: Viewport = { colorScheme: "light", themeColor: "#7b1326", width: "device-width", initialScale: 1, viewportFit: "cover" }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html suppressHydrationWarning lang="pt-BR" data-site-theme={lerTemaSite()} className={`${cormorant.variable} ${inter.variable} bg-background`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: 'try{const ua=navigator.userAgent;if(ua.includes("SantaLuziaAndroid")){document.documentElement.dataset.nativePlatform="android"}else if(ua.includes("SantaLuziaWindowsBeta/")){document.documentElement.dataset.nativePlatform="windows-beta"}}catch{}' }} />
      </head>
      <body suppressHydrationWarning className="app-mobile-shell font-sans antialiased">
        <AppRuntime>
          <Suspense fallback={null}><NavigationProgress /></Suspense>
          <OfflineLiturgiaRuntime />
          {children}
          <MobileBottomNav />
        </AppRuntime>
      </body>
    </html>
  )
}
