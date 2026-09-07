import type { ReactNode } from "react"
import { ProtectedAreaGate } from "@/components/protected-area-gate"

export default function AreaRestritaLayout({ children }: { children: ReactNode }) {
  return <ProtectedAreaGate>{children}</ProtectedAreaGate>
}
