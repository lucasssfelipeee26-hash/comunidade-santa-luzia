"use client"

import { useEffect, useState } from "react"
import { Capacitor, registerPlugin } from "@capacitor/core"
import { CloudOff, Gem, Sparkles, Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { WhatajongGame } from "@/components/whatajong-game"

type Dificuldade = "facil" | "medio" | "dificil"
type ResultadoNativo = { cancelled: boolean; score?: number; completedRound?: number; difficulty?: Dificuldade }
type PluginWhatajong = { open: () => Promise<ResultadoNativo> }
type Pendente = { score: number; completedRound: number; difficulty: Dificuldade; salvoEm: number }

const WhatajongNativo = registerPlugin<PluginWhatajong>("Whatajong")
const CHAVE_PENDENTE = "santa-luzia:whatajong:nativo:resultado-pendente:v1"

export function WhatajongEntry({ tipoUsuario }: { tipoUsuario: "moderador" | "membro" }) {
  const [modo, setModo] = useState<"carregando" | "nativo" | "web">("carregando")
  const [abrindo, setAbrindo] = useState(false)
  const [offline, setOffline] = useState(false)
  const [mensagem, setMensagem] = useState("")

  useEffect(() => {
    const android = Capacitor.getPlatform() === "android"
    setModo(android && Capacitor.isPluginAvailable("Whatajong") ? "nativo" : "web")
    const atualizarRede = () => setOffline(!navigator.onLine)
    const online = () => { atualizarRede(); void sincronizarPendente() }
    atualizarRede()
    window.addEventListener("online", online)
    window.addEventListener("offline", atualizarRede)
    void sincronizarPendente()
    return () => { window.removeEventListener("online", online); window.removeEventListener("offline", atualizarRede) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function enviarResultado(resultado: Pendente) {
    try {
      const r = await fetch("/api/jogo/whatajong/resultado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(resultado),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.erro || "Não foi possível atualizar a classificação.")
      localStorage.removeItem(CHAVE_PENDENTE)
      if (j.jaContabilizado) setMensagem(`Seu melhor bônus de hoje continua em ${j.pontosTotalDia}/${j.limiteDiario} pontos do Whatajong.`)
      else setMensagem(`Whatajong sincronizado: +${j.pontosAdicionados} ponto(s) na classificação.`)
      try { window.dispatchEvent(new Event("santa-luzia:server-sync")) } catch {}
      return true
    } catch {
      setMensagem("Resultado salvo no aparelho. Ele será sincronizado quando a internet voltar.")
      return false
    }
  }

  async function sincronizarPendente() {
    if (!navigator.onLine) return
    try {
      const pendente = JSON.parse(localStorage.getItem(CHAVE_PENDENTE) || "null") as Pendente | null
      if (pendente) await enviarResultado(pendente)
    } catch {}
  }

  async function abrirJogo() {
    setAbrindo(true)
    setMensagem("")
    try {
      const resultado = await WhatajongNativo.open()
      if (resultado.cancelled) return
      const dificuldade: Dificuldade = resultado.difficulty === "medio" || resultado.difficulty === "dificil" ? resultado.difficulty : "facil"
      const pendente: Pendente = {
        score: Math.max(0, Math.trunc(Number(resultado.score) || 0)),
        completedRound: Math.max(0, Math.min(24, Math.trunc(Number(resultado.completedRound) || 0))),
        difficulty: dificuldade,
        salvoEm: Date.now(),
      }
      if (pendente.completedRound <= 0) return
      localStorage.setItem(CHAVE_PENDENTE, JSON.stringify(pendente))
      if (navigator.onLine) await enviarResultado(pendente)
      else setMensagem("Resultado salvo no aparelho. Ele será sincronizado quando a internet voltar.")
    } catch {
      setModo("web")
    } finally {
      setAbrindo(false)
    }
  }

  if (modo === "carregando") return <div className="rounded-2xl border border-border bg-white/75 p-6 text-center text-xs text-muted-foreground">Preparando Whatajong…</div>
  if (modo === "web") return <WhatajongGame tipoUsuario={tipoUsuario} />

  return <div className="space-y-3">
    <section className="overflow-hidden rounded-[28px] border border-[#d8c68c]/35 bg-[radial-gradient(circle_at_top,#244e46_0%,#15372f_42%,#102922_100%)] p-5 text-center text-white shadow-[0_18px_45px_rgba(17,54,47,.24)]">
      <span className="mx-auto flex size-16 items-center justify-center rounded-[22px] border border-white/20 bg-white/10 shadow-lg"><Gem className="size-8 text-[#f5d77f]" /></span>
      <p className="mt-3 text-[9px] font-black uppercase tracking-[.2em] text-[#f5d77f]">Jogo instalado no aparelho</p>
      <h2 className="mt-1 font-serif text-3xl font-semibold">Whatajong</h2>
      <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-white/75">Mahjong Solitaire em português com 24 rodadas, combos, moedas, poderes e efeitos. O jogo abre localmente e funciona mesmo sem internet.</p>
      <Button size="lg" className="mt-4 min-h-12 w-full rounded-2xl bg-[#f1d27c] text-[#17372f] hover:bg-[#f1d27c]/90" onClick={() => void abrirJogo()} disabled={abrindo}><Sparkles className="size-4" />{abrindo ? "Abrindo Whatajong…" : "Jogar Whatajong"}</Button>
    </section>
    {offline && <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-950"><CloudOff className="size-4 shrink-0" />Whatajong funciona offline. A pontuação será enviada ao ranking quando a internet voltar.</div>}
    {mensagem && <div className="flex items-center gap-2 rounded-xl border border-primary/15 bg-white/85 p-2.5 text-xs text-primary"><Trophy className="size-4 shrink-0" />{mensagem}</div>}
  </div>
}
