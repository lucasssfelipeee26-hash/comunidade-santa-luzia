"use client"

import { useEffect, useState } from "react"
import { CaminhoDaLuzGame } from "@/components/caminho-da-luz-game"

export function CaminhoDaLuzLoader({ tipoUsuario }: { tipoUsuario: "moderador" | "membro" }) {
  const [montado, setMontado] = useState(false)
  useEffect(() => setMontado(true), [])
  if (!montado) return <div className="min-h-screen p-8 text-center text-muted-foreground">Preparando o Caminho da Luz…</div>
  return <CaminhoDaLuzGame tipoUsuario={tipoUsuario} />
}
