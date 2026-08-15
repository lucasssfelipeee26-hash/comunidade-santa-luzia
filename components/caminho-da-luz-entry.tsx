"use client"

import { useEffect, useState } from "react"
import { Capacitor, registerPlugin } from "@capacitor/core"
import { CloudOff, Gamepad2, Sparkles, Trophy } from "lucide-react"
import { AreaHeader } from "@/components/area-header"
import { ModeradorMenu, MembroMenu } from "@/components/area-menu"
import { CaminhoDaLuzGame } from "@/components/caminho-da-luz-game"
import { Button } from "@/components/ui/button"

type ResultadoNativo = { cancelled: boolean; score?: number; level?: number; mode?: string }
type PluginJogo = { open: () => Promise<ResultadoNativo> }
type Pendente = { score: number; level: number; mode: string; salvoEm: number }

const CaminhoDaLuzNativo = registerPlugin<PluginJogo>("CaminhoDaLuz")
const CHAVE_PENDENTE = "santa-luzia:caminho-da-luz:nativo:resultado-pendente"

export function CaminhoDaLuzEntry({ tipoUsuario }: { tipoUsuario: "moderador" | "membro" }) {
  const [plataforma, setPlataforma] = useState<"carregando" | "android" | "web">("carregando")
  const [abrindo, setAbrindo] = useState(false)
  const [offline, setOffline] = useState(false)
  const [mensagem, setMensagem] = useState("")
  const [erro, setErro] = useState("")

  useEffect(() => {
    const android = Capacitor.getPlatform() === "android"
    setPlataforma(android ? "android" : "web")
    if (!android) return

    const atualizarRede = () => setOffline(!navigator.onLine)
    const online = () => { atualizarRede(); void sincronizarPendente() }
    atualizarRede()
    window.addEventListener("online", online)
    window.addEventListener("offline", atualizarRede)
    void sincronizarPendente()
    return () => {
      window.removeEventListener("online", online)
      window.removeEventListener("offline", atualizarRede)
    }
  }, [])

  async function enviarResultado(resultado: Pendente) {
    try {
      const r = await fetch("/api/jogo/caminho-da-luz/resultado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(resultado),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.erro || "Não foi possível atualizar o ranking.")
      localStorage.removeItem(CHAVE_PENDENTE)
      if (j.jaContabilizado) {
        setMensagem(`Seu melhor bônus de hoje continua em ${j.pontosRanking} ponto(s) no ranking.`)
      } else if (j.melhorado) {
        setMensagem(`Novo recorde do dia: +${j.pontosRanking} ponto(s) acrescentado(s). Total diário: ${j.pontosTotalDia}.`)
      } else {
        setMensagem(`Resultado sincronizado: +${j.pontosRanking} ponto(s) no ranking.`)
      }
      return true
    } catch {
      setMensagem("Resultado guardado no aplicativo. Ele será sincronizado quando a internet voltar.")
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
    setErro("")
    setMensagem("")
    try {
      const resultado = await CaminhoDaLuzNativo.open()
      if (resultado.cancelled) return
      const pendente: Pendente = {
        score: Math.max(0, Math.trunc(Number(resultado.score) || 0)),
        level: Math.max(1, Math.trunc(Number(resultado.level) || 1)),
        mode: String(resultado.mode || "Caminho da Luz").slice(0, 80),
        salvoEm: Date.now(),
      }
      localStorage.setItem(CHAVE_PENDENTE, JSON.stringify(pendente))
      if (navigator.onLine) await enviarResultado(pendente)
      else setMensagem("Resultado guardado no aplicativo. Ele será sincronizado quando a internet voltar.")
    } catch {
      setErro("O módulo local do Caminho da Luz ainda não está instalado nesta versão do aplicativo. Atualize o APK para jogar pelo celular.")
    } finally {
      setAbrindo(false)
    }
  }

  if (plataforma === "carregando") {
    return <div className="min-h-screen p-8 text-center text-muted-foreground">Preparando o Caminho da Luz…</div>
  }
  if (plataforma === "web") return <CaminhoDaLuzGame tipoUsuario={tipoUsuario} />

  const isMod = tipoUsuario === "moderador"
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#fff8e5_0%,#fff_42%,#faf7f1_100%)]">
      <AreaHeader titulo="Caminho da Luz" subtitulo="Jogo litúrgico instalado no aplicativo" voltarHref={isMod ? "/area-restrita/moderador" : "/area-restrita/membro"} menu={isMod ? <ModeradorMenu /> : <MembroMenu />} />
      <main className="mx-auto max-w-xl px-3 py-6 pb-24 sm:px-4">
        <section className="rounded-3xl border border-white/70 bg-white/80 p-6 text-center shadow-2xl backdrop-blur-2xl">
          <span className="mx-auto flex size-20 items-center justify-center rounded-[28px] bg-primary text-white shadow-xl"><Gamepad2 className="size-9" /></span>
          <p className="mt-5 text-xs font-bold uppercase tracking-[.15em] text-primary">Kis · Caminho da Luz</p>
          <h1 className="mt-1 font-serif text-3xl font-semibold text-primary">Jogue direto no celular</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">O tabuleiro, os sons, a vibração e as fases ficam dentro do APK. A internet só é usada depois da rodada para sincronizar o seu melhor bônus diário com o ranking.</p>
          <Button size="lg" className="mt-6 min-h-14 w-full rounded-2xl text-base" onClick={() => void abrirJogo()} disabled={abrindo}>
            <Sparkles className="size-5" />{abrindo ? "Abrindo jogo…" : "Abrir Caminho da Luz"}
          </Button>
        </section>

        {offline && <div className="mt-4 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><CloudOff className="size-4 shrink-0" />Sem internet: você pode jogar normalmente. O resultado fica guardado para sincronizar depois.</div>}
        {mensagem && <div className="mt-4 flex items-center gap-2 rounded-2xl border border-primary/15 bg-white/80 p-3 text-sm text-primary"><Trophy className="size-4 shrink-0" />{mensagem}</div>}
        {erro && <div className="mt-4 rounded-2xl border border-destructive/25 bg-white/80 p-3 text-sm text-destructive">{erro}</div>}
      </main>
    </div>
  )
}
