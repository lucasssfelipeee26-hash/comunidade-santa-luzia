"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { MembroDashboard } from "@/components/membro-dashboard"
import { carregarSessaoOffline } from "@/lib/offline-data"
import { useStore, type Membro } from "@/lib/store"

const MEMBRO_OFFLINE_KEY = "santa-luzia:offline:v1:membro-dashboard"

type SessaoOffline = {
  sessao: null | {
    tipo: "moderador" | "membro"
    usuario: {
      id: string
      nome: string
      usuario?: string
      email: string
      funcao: string | null
      desde: string | null
      status: "pendente" | "aprovado" | "recusado"
    }
  }
}

function membroDaSessaoOffline(): Membro | null {
  const cache = carregarSessaoOffline<SessaoOffline>()
  const sessao = cache?.dados?.sessao
  if (!sessao || sessao.tipo !== "membro") return null
  const usuario = sessao.usuario
  if (usuario.funcao !== "Acólito" && usuario.funcao !== "Coroinha") return null
  return {
    id: usuario.id,
    nome: usuario.nome,
    usuario: usuario.usuario || "",
    funcao: usuario.funcao,
    email: usuario.email,
    desde: usuario.desde || "",
    status: usuario.status,
    advertencias: [],
    justificativas: [],
    faltas: [],
    observacoes: [],
  }
}

function carregarMembroOffline(): Membro | null {
  if (typeof window === "undefined") return null
  try {
    const salvo = JSON.parse(localStorage.getItem(MEMBRO_OFFLINE_KEY) || "null")
    if (salvo?.id && salvo?.nome && (salvo.funcao === "Acólito" || salvo.funcao === "Coroinha")) return salvo as Membro
  } catch {}
  return membroDaSessaoOffline()
}

export function MembroAreaContent() {
  const { membroAtual } = useStore()
  const [membroOffline, setMembroOffline] = useState<Membro | null>(null)

  useEffect(() => {
    if (membroAtual) {
      setMembroOffline(membroAtual)
      try { localStorage.setItem(MEMBRO_OFFLINE_KEY, JSON.stringify(membroAtual)) } catch {}
      return
    }
    const salvo = carregarMembroOffline()
    if (salvo) setMembroOffline(salvo)
  }, [membroAtual])

  const membro = membroAtual || membroOffline
  if (!membro) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto w-full max-w-6xl px-3 py-6 sm:px-4">
          <div className="flex min-h-40 items-center justify-center rounded-2xl border bg-white/80 text-muted-foreground">
            <Loader2 className="mr-2 size-5 animate-spin" /> Preparando seu painel…
          </div>
        </div>
      </div>
    )
  }

  return <MembroDashboard membro={membro} />
}
