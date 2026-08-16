"use client"

import { useEffect, useState } from "react"
import { Capacitor, registerPlugin } from "@capacitor/core"
import { CloudOff, Gem, Smartphone, Sparkles, Trophy, Volume2 } from "lucide-react"
import { Button } from "@/components/ui/button"

type Dificuldade = "facil" | "medio" | "dificil"
type ResultadoNativo = { cancelled: boolean; score?: number; completedRound?: number; difficulty?: Dificuldade }
type PluginWhatajong = { open: () => Promise<ResultadoNativo> }
type Pendente = { score: number; completedRound: number; difficulty: Dificuldade; salvoEm: number }

const WhatajongNativo = registerPlugin<PluginWhatajong>("Whatajong")
const CHAVE_PENDENTE = "santa-luzia:whatajong:nativo:resultado-pendente:v2"

export function WhatajongEntry({ tipoUsuario }: { tipoUsuario: "moderador" | "membro" }) {
  const [modo, setModo] = useState<"carregando" | "nativo" | "atualizacao-necessaria">("carregando")
  const [abrindo, setAbrindo] = useState(false)
  const [offline, setOffline] = useState(false)
  const [mensagem, setMensagem] = useState("")

  useEffect(() => {
    const android = Capacitor.getPlatform() === "android"
    setModo(android && Capacitor.isPluginAvailable("Whatajong") ? "nativo" : "atualizacao-necessaria")
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
      setModo("atualizacao-necessaria")
    } finally {
      setAbrindo(false)
    }
  }

  if (modo === "carregando") return <div className="rounded-2xl border border-border bg-white/75 p-6 text-center text-xs text-muted-foreground">Preparando Whatajong completo…</div>

  if (modo === "atualizacao-necessaria") {
    return <section className="rounded-[28px] border border-primary/15 bg-card p-5 text-center shadow-sm">
      <span className="mx-auto flex size-14 items-center justify-center rounded-[20px] bg-primary text-primary-foreground"><Smartphone className="size-7" /></span>
      <p className="mt-3 text-[9px] font-black uppercase tracking-[.18em] text-primary">Requer atualização Android</p>
      <h2 className="mt-1 font-serif text-2xl font-semibold text-foreground">Whatajong completo</h2>
      <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-muted-foreground">A versão simplificada foi removida. O Whatajong completo, com sons, peças ilustradas, animações, loja, recompensas e execução offline, fica dentro do novo APK.</p>
    </section>
  }

  return <div className="space-y-3">
    <section className="overflow-hidden rounded-[28px] border border-[#d4af37]/40 bg-[radial-gradient(circle_at_top,#7b1326_0%,#5a0b18_48%,#3b0710_100%)] p-5 text-center text-[#fff8ee] shadow-[0_18px_45px_rgba(59,7,16,.28)]">
      <span className="mx-auto flex size-16 items-center justify-center rounded-[22px] border border-[#f2cf62]/35 bg-white/10 shadow-lg"><Gem className="size-8 text-[#f2cf62]" /></span>
      <p className="mt-3 text-[9px] font-black uppercase tracking-[.2em] text-[#f2cf62]">Whatajong original adaptado · jogo local</p>
      <h2 className="mt-1 font-serif text-3xl font-semibold">Whatajong</h2>
      <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-white/80">O mesmo jogo apresentado como base: 24 rodadas, peças ilustradas, efeitos, músicas, sons, moedas, loja, recompensas e poderes. Agora em português e no tema rubi, vinho, dourado e marfim da Santa Luzia.</p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[9px] text-white/75">
        <span className="flex items-center justify-center gap-1 rounded-xl bg-white/10 p-2"><Volume2 className="size-3.5 text-[#f2cf62]" />Som e música locais</span>
        <span className="flex items-center justify-center gap-1 rounded-xl bg-white/10 p-2"><CloudOff className="size-3.5 text-[#f2cf62]" />Funciona sem internet</span>
      </div>
      <Button size="lg" className="mt-4 min-h-12 w-full rounded-2xl bg-[#f2cf62] font-bold text-[#4b0c16] hover:bg-[#f2cf62]/90" onClick={() => void abrirJogo()} disabled={abrindo}><Sparkles className="size-4" />{abrindo ? "Abrindo Whatajong…" : "Jogar Whatajong"}</Button>
      <p className="mt-2 text-[8px] text-white/45">{tipoUsuario === "moderador" ? "Modo moderador" : "Jornada Litúrgica"} · licença MIT preservada</p>
    </section>
    {offline && <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-950"><CloudOff className="size-4 shrink-0" />O jogo continua funcionando offline. Só a pontuação do ranking aguarda a internet voltar.</div>}
    {mensagem && <div className="flex items-center gap-2 rounded-xl border border-primary/15 bg-white/85 p-2.5 text-xs text-primary"><Trophy className="size-4 shrink-0" />{mensagem}</div>}
  </div>
}
