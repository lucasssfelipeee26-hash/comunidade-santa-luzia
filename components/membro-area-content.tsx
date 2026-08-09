"use client"

import { Loader2 } from "lucide-react"
import { MembroDashboard } from "@/components/membro-dashboard"
import { useStore } from "@/lib/store"

export function MembroAreaContent() {
  const { membroAtual } = useStore()

  if (!membroAtual) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary/30 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    )
  }

  return <MembroDashboard membro={membroAtual} />
}
