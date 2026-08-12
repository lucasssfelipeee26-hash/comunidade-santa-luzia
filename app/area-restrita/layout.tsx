import type { ReactNode } from "react"
import { StoreProvider } from "@/lib/store"
import { LateArrivalBanner } from "@/components/late-arrival-banner"

export default function AreaRestritaLayout({ children }: { children: ReactNode }) {
  return (
    <StoreProvider>
      <div className="area-restrita-shell min-h-screen bg-background text-foreground">
        <LateArrivalBanner />
        {children}
      </div>
    </StoreProvider>
  )
}
