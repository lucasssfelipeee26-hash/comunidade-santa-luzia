"use client"

import { use, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { PerfilModerador } from "@/components/perfil-moderador"
import { useStore } from "@/lib/store"

export default function PerfilPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { ready, sessao, membros } = useStore()

  const membro = membros.find((m) => m.id === id)

  useEffect(() => {
    if (!ready) return
    // Apenas o moderador pode gerenciar perfis de terceiros.
    if (!sessao || sessao.tipo !== "moderador") {
      router.replace("/area-restrita")
    }
  }, [ready, sessao, router])

  if (!ready || !sessao || sessao.tipo !== "moderador") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary/30 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    )
  }

  if (!membro) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-secondary/30 px-4 text-center">
        <p className="text-muted-foreground">Perfil não encontrado.</p>
        <button
          type="button"
          onClick={() => router.replace("/area-restrita")}
          className="text-sm font-medium text-primary hover:underline"
        >
          Voltar aos perfis
        </button>
      </div>
    )
  }

  return <PerfilModerador membro={membro} />
}
