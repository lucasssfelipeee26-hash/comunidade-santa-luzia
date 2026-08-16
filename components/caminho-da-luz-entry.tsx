"use client"

import { useEffect, useState } from "react"
import { Capacitor, registerPlugin } from "@capacitor/core"
import { CloudOff, Gamepad2, Gem, Sparkles, Trophy } from "lucide-react"
import { AreaHeader } from "@/components/area-header"
import { ModeradorMenu, MembroMenu } from "@/components/area-menu"
import { CaminhoDaLuzGame } from "@/components/caminho-da-luz-game"
import { WhatajongEntry } from "@/components/whatajong-entry"
import { Button } from "@/components/ui/button"

type ResultadoNativo = { cancelled: boolean; score?: number; level?: number; mode?: string }
type PluginJogo = { open: () => Promise<ResultadoNativo> }
type Pendente = { score: number; level: number; mode: string; salvoEm: number }

const CaminhoDaLuzNativo = registerPlugin<PluginJogo>("CaminhoDaLuz")
const CHAVE_PENDENTE = "santa-luzia:joias-da-luz:nativo:resultado-pendente:v4"

export function CaminhoDaLuzEntry({ tipoUsuario, embedded = false }: { tipoUsuario: "moderador" | "membro"; embedded?: boolean }) {
  const [plataforma, setPlataforma] = useState<"carregando" | "android-nativo" | "compatibilidade">("carregando")
  const [jogo, setJogo] = useState<"joias" | "whatajong">("joias")
  const [abrindo, setAbrindo] = useState(false)
  const [offline, setOffline] = useState(false)
  const [mensagem, setMensagem] = useState("")
  const [erro, setErro] = useState("")

  useEffect(() => {
    const android = Capacitor.getPlatform() === "android"
    const nativoDisponivel = android && Capacitor.isPluginAvailable("CaminhoDaLuz")
    setPlataforma(nativoDisponivel ? "android-nativo" : "compatibilidade")
    if (!android) return
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
      const r = await fetch("/api/jogo/caminho-da-luz/resultado", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(resultado) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.erro || "Não foi possível atualizar a classificação.")
      localStorage.removeItem(CHAVE_PENDENTE)
      if (j.jaContabilizado) setMensagem(`Seu melhor bônus de hoje continua em ${j.pontosTotalDia}/${j.limiteDiario || 35} pontos do jogo.`)
      else if (j.melhorado) setMensagem(`Novo recorde do dia: +${j.pontosAdicionados ?? j.pontosRanking}. Total do jogo: ${j.pontosTotalDia}/${j.limiteDiario || 35}.`)
      else setMensagem(`Resultado sincronizado: +${j.pontosAdicionados ?? j.pontosRanking} na classificação.`)
      return true
    } catch { setMensagem("Resultado guardado no aplicativo. Ele será sincronizado quando a internet voltar."); return false }
  }

  async function sincronizarPendente() {
    if (!navigator.onLine) return
    try { const pendente = JSON.parse(localStorage.getItem(CHAVE_PENDENTE) || "null") as Pendente | null; if (pendente) await enviarResultado(pendente) } catch {}
  }

  async function abrirJogo() {
    setAbrindo(true); setErro(""); setMensagem("")
    try {
      const resultado = await CaminhoDaLuzNativo.open()
      if (resultado.cancelled) return
      const pendente: Pendente = { score: Math.max(0, Math.trunc(Number(resultado.score) || 0)), level: Math.max(1, Math.trunc(Number(resultado.level) || 1)), mode: String(resultado.mode || "Joias da Luz").slice(0, 80), salvoEm: Date.now() }
      localStorage.setItem(CHAVE_PENDENTE, JSON.stringify(pendente))
      if (navigator.onLine) await enviarResultado(pendente)
      else setMensagem("Resultado guardado no aplicativo. Ele será sincronizado quando a internet voltar.")
    } catch {
      setPlataforma("compatibilidade")
      setErro("")
    } finally { setAbrindo(false) }
  }

  const seletorJogos = embedded ? (
    <section className="rounded-[24px] border border-border bg-white/85 p-3 shadow-sm">
      <div className="mb-3 flex items-center gap-2"><span className="flex size-9 items-center justify-center rounded-xl bg-primary text-white"><Gamepad2 className="size-4" /></span><div><p className="text-[9px] font-black uppercase tracking-[.15em] text-primary">Jogos</p><h2 className="font-serif text-lg font-semibold text-foreground">Escolha o que quer jogar</h2></div></div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setJogo("joias")} className={`rounded-2xl border p-3 text-left transition active:scale-[.98] ${jogo === "joias" ? "border-primary/35 bg-primary/[.05] ring-1 ring-primary/10" : "border-border bg-white"}`}><span className={`mb-2 flex size-9 items-center justify-center rounded-xl ${jogo === "joias" ? "bg-primary text-white" : "bg-secondary text-primary"}`}><Gem className="size-4" /></span><strong className="block text-xs text-foreground">Joias da Luz</strong><span className="mt-1 block text-[9px] leading-4 text-muted-foreground">Match-3 com joias e cascatas.</span></button>
        <button type="button" onClick={() => setJogo("whatajong")} className={`rounded-2xl border p-3 text-left transition active:scale-[.98] ${jogo === "whatajong" ? "border-[#b7984f]/45 bg-[#f7f0dc] ring-1 ring-[#b7984f]/15" : "border-border bg-white"}`}><span className={`mb-2 flex size-9 items-center justify-center rounded-xl ${jogo === "whatajong" ? "bg-[#20483f] text-[#f3d57d]" : "bg-secondary text-primary"}`}><Sparkles className="size-4" /></span><strong className="block text-xs text-foreground">Whatajong</strong><span className="mt-1 block text-[9px] leading-4 text-muted-foreground">Mahjong com combos, moedas e 24 rodadas.</span></button>
      </div>
    </section>
  ) : null

  if (embedded && jogo === "whatajong") return <div className="space-y-3">{seletorJogos}<WhatajongEntry tipoUsuario={tipoUsuario} /></div>

  if (plataforma === "carregando") return <div className="space-y-3">{seletorJogos}<div className="rounded-2xl border border-border bg-white/75 p-6 text-center text-sm text-muted-foreground">Preparando Joias da Luz…</div></div>

  if (plataforma === "compatibilidade") {
    return <div className="space-y-3">{seletorJogos}<CaminhoDaLuzGame tipoUsuario={tipoUsuario} embedded={embedded} />{Capacitor.getPlatform() === "android" && offline && <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-center text-[10px] text-amber-950">Esta instalação antiga está usando o modo compatível. A atualização Android mantém o jogo completo dentro do aparelho.</div>}</div>
  }

  const isMod = tipoUsuario === "moderador"
  const conteudo = (
    <div className={embedded ? "" : "mx-auto max-w-xl px-3 py-5 pb-24 sm:px-4"}>
      <section className="rounded-[24px] border border-border bg-white/85 p-4 text-center shadow-[0_14px_36px_rgba(79,36,49,.08)]">
        <span className="mx-auto flex size-16 items-center justify-center rounded-[22px] bg-primary text-white shadow-lg"><Gem className="size-8" /></span>
        <p className="mt-4 text-[9px] font-bold uppercase tracking-[.16em] text-primary">Jornada Litúrgica · jogo nativo</p>
        <h2 className="mt-1 font-serif text-3xl font-semibold text-primary">Joias da Luz</h2>
        <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-muted-foreground">Diamantes e joias raras em um match-3 instalado no Android. Arraste, combine, crie cascatas e avance na classificação.</p>
        <Button size="lg" className="mt-4 min-h-12 w-full rounded-2xl text-sm" onClick={() => void abrirJogo()} disabled={abrindo}><Sparkles className="size-4" />{abrindo ? "Abrindo jogo…" : "Jogar Joias da Luz"}</Button>
      </section>
      {offline && <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-950"><CloudOff className="size-4 shrink-0" />Você pode jogar offline; o resultado sincroniza depois.</div>}
      {mensagem && <div className="mt-3 flex items-center gap-2 rounded-xl border border-primary/15 bg-white/80 p-2.5 text-xs text-primary"><Trophy className="size-4 shrink-0" />{mensagem}</div>}
      {erro && <div className="mt-3 rounded-xl border border-destructive/25 bg-white/80 p-2.5 text-xs text-destructive">{erro}</div>}
    </div>
  )

  if (embedded) return <div className="space-y-3">{seletorJogos}{conteudo}</div>
  return <div className="min-h-screen bg-[#f5f1ef]"><AreaHeader titulo="Joias da Luz" subtitulo="Jogo da Jornada Litúrgica" voltarHref={isMod ? "/area-restrita/moderador" : "/area-restrita/membro"} menu={isMod ? <ModeradorMenu /> : <MembroMenu />} /><main>{conteudo}</main></div>
}
