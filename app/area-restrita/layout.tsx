import type { ReactNode } from "react"
import { StoreProvider } from "@/lib/store"

export default function AreaRestritaLayout({ children }: { children: ReactNode }) {
  return (
    <StoreProvider>
      <div className="area-restrita-shell min-h-screen bg-background text-foreground">{children}</div>
    </StoreProvider>
  )
}
