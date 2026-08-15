"use client"

import { useEffect, useMemo, useState } from "react"
import { CloudOff, RotateCcw, Sparkles, Trophy, Volume2, VolumeX, Vibrate } from "lucide-react"
import { AreaHeader } from "@/components/area-header"
import { ModeradorMenu, MembroMenu } from "@/components/area-menu"
import { Button } from "@/components/ui/button"

const TAMANHO = 8
const SIMBOLOS = ["✝️", "🕯️", "🏆", "📖", "🌿", "🕊️", "🔥", "⭐"] as const
const NOMES = ["Cruz", "Vela", "Cálice", "Missal", "Naveta", "Paz", "Turíbulo", "Alfaia"]
type Peca = { id: string; tipo: number }
type Celula = Peca | null

type Pendente = { score: number; level: number; mode: string; salvoEm: number }

const CHAVE_ESTADO = "santa-luzia:caminho-da-luz:estado:v1"
const CHAVE_SOM = "santa-luzia:caminho-da-luz:som"
const CHAVE_VIBRAR = "santa-luzia:caminho-da-luz:vibrar"
const CHAVE_PENDENTE = "santa-luzia:caminho-da-luz:resultado-pendente"

function id() { return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }
function novaPeca() { return { id: id(), tipo: Math.floor(Math.random() * SIMBOLOS.length) } }
function vizinhas(a: number, b: number) { const ar = Math.floor(a / TAMANHO), ac = a % TAMANHO, br = Math.floor(b / TAMANHO), bc = b % TAMANHO; return Math.abs(ar - br) + Math.abs(ac - bc) === 1 }
function trocar(tab: Celula[], a: number, b: number) { const n = [...tab]; [n[a], n[b]] = [n[b], n[a]]; return n }

function encontrarMatches(tab: Celula[]) {
  const achados = new Set<number>()
  for (let r = 0; r < TAMANHO; r++) {
    let inicio = 0
    while (inicio < TAMANHO) {
      const idx = r * TAMANHO + inicio
      const tipo = tab[idx]?.tipo
      let fim = inicio + 1
      while (tipo != null && fim < TAMANHO && tab[r * TAMANHO + fim]?.tipo === tipo) fim++
      if (tipo != null && fim - inicio >= 3) for (let c = inicio; c < fim; c++) achados.add(r * TAMANHO + c)
      inicio = fim
    }
  }
  for (let c = 0; c < TAMANHO; c++) {
    let inicio = 0
    while (inicio < TAMANHO) {
      const idx = inicio * TAMANHO + c
      const tipo = tab[idx]?.tipo
      let fim = inicio + 1
      while (tipo != null && fim < TAMANHO && tab[fim * TAMANHO + c]?.tipo === tipo) fim++
      if (tipo != null && fim - inicio >= 3) for (let r = inicio; r < fim; r++) achados.add(r * TAMANHO + c)
      inicio = fim
    }
  }
  return [...achados]
}

function cair(tab: Celula[]) {
  const n = [...tab]
  for (let c = 0; c < TAMANHO; c++) {
    const coluna: Peca[] = []
    for (let r = TAMANHO - 1; r >= 0; r--) { const p = n[r * TAMANHO + c]; if (p) coluna.push(p) }
    for (let r = TAMANHO - 1; r >= 0; r--) n[r * TAMANHO + c] = coluna[TAMANHO - 1 - r] || novaPeca()
  }
  return n
}

function tabuleiroInicial() {
  let tab: Celula[] = Array.from({ length: TAMANHO * TAMANHO }, () => novaPeca())
  let tentativas = 0
  while (encontrarMatches(tab).length && tentativas++ < 30) tab = tab.map(() => novaPeca())
  return tab
}

function metaDaFase(nivel: number) { return 650 + Math.max(0, nivel - 1) * 240 }
function movimentosDaFase(nivel: number) { return Math.max(18, 28 - Math.floor((nivel - 1) / 2)) }

function tocarSom(tipo: "match" | "combo" | "erro" | "fase", ativo: boolean) {
  if (!ativo || typeof window === "undefined") return
  try {
    const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const osc = ctx.createOscillator(); const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    const freq = tipo === "erro" ? 150 : tipo === "fase" ? 720 : tipo === "combo" ? 560 : 420
    osc.frequency.setValueAtTime(freq, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(tipo === "erro" ? 110 : freq * 1.35, ctx.currentTime + 0.11)
    gain.gain.setValueAtTime(0.08, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14)
    osc.start(); osc.stop(ctx.currentTime + 0.15)
    setTimeout(() => void ctx.close(), 220)
  } catch {}
}

export function CaminhoDaLuzGame({ tipoUsuario }: { tipoUsuario: "moderador" | "membro" }) {
  const [tabuleiro, setTabuleiro] = useState<Celula[]>(() => tabuleiroInicial())
  const [selecionada, setSelecionada] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [nivel, setNivel] = useState(1)
  const [movimentos, setMovimentos] = useState(movimentosDaFase(1))
  const [combo, setCombo] = useState(0)
  const [mensagem, setMensagem] = useState("Combine 3 ou mais símbolos litúrgicos.")
  const [som, setSom] = useState(true)
  const [vibrar, setVibrar] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [offline, setOffline] = useState(false)
  const [rankingMsg, setRankingMsg] = useState("")

  const meta = metaDaFase(nivel)
  const modo = nivel <= 5 ? `Fase ${nivel} de 5` : `Jornada infinita · Nível ${nivel}`
  const progresso = Math.min(100, Math.round((score / meta) * 100))
  const melhor = useMemo(() => {
    try { return Number(localStorage.getItem("santa-luzia:caminho-da-luz:recorde") || 0) } catch { return 0 }
  }, [score])

  useEffect(() => {
    try {
      setSom(localStorage.getItem(CHAVE_SOM) !== "0")
      setVibrar(localStorage.getItem(CHAVE_VIBRAR) !== "0")
      const salvo = JSON.parse(localStorage.getItem(CHAVE_ESTADO) || "null")
      if (salvo && Array.isArray(salvo.tabuleiro) && salvo.tabuleiro.length === TAMANHO * TAMANHO) {
        setTabuleiro(salvo.tabuleiro); setScore(Number(salvo.score) || 0); setNivel(Number(salvo.nivel) || 1); setMovimentos(Number(salvo.movimentos) || movimentosDaFase(1))
      }
    } catch {}
    setOffline(!navigator.onLine)
    const online = () => { setOffline(false); void sincronizarPendente() }
    const off = () => setOffline(true)
    window.addEventListener("online", online); window.addEventListener("offline", off)
    void sincronizarPendente()
    return () => { window.removeEventListener("online", online); window.removeEventListener("offline", off) }
  }, [])

  useEffect(() => {
    try { localStorage.setItem(CHAVE_ESTADO, JSON.stringify({ tabuleiro, score, nivel, movimentos })) } catch {}
  }, [tabuleiro, score, nivel, movimentos])

  async function sincronizarPendente() {
    let p: Pendente | null = null
    try { p = JSON.parse(localStorage.getItem(CHAVE_PENDENTE) || "null") } catch {}
    if (!p || !navigator.onLine) return
    const ok = await enviarResultado(p.score, p.level, p.mode)
    if (ok) try { localStorage.removeItem(CHAVE_PENDENTE) } catch {}
  }

  async function enviarResultado(finalScore: number, level: number, mode: string) {
    try {
      const r = await fetch("/api/jogo/caminho-da-luz/resultado", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ score: finalScore, level, mode }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.erro || "Não foi possível enviar a pontuação.")
      setRankingMsg(j.jaContabilizado ? `Sua pontuação de hoje já foi contabilizada no ranking: ${j.pontosRanking} ponto(s).` : `+${j.pontosRanking} ponto(s) enviados para o ranking.`)
      return true
    } catch {
      setRankingMsg("Resultado salvo neste celular. Ele será enviado ao ranking quando a internet voltar.")
      return false
    }
  }

  function vibracao(ms = 25) { if (vibrar && navigator.vibrate) navigator.vibrate(ms) }

  async function resolverCascata(tab: Celula[], baseScore: number) {
    let atual = tab, rodada = 0, ganhoTotal = 0
    while (true) {
      const matches = encontrarMatches(atual)
      if (!matches.length) break
      rodada++
      const ganho = matches.length * 20 * rodada
      ganhoTotal += ganho
      const removido = [...atual]; matches.forEach((i) => { removido[i] = null })
      setTabuleiro(removido); await new Promise((r) => setTimeout(r, 120))
      atual = cair(removido); setTabuleiro(atual); await new Promise((r) => setTimeout(r, 150))
    }
    setCombo(Math.max(0, rodada - 1))
    setScore(baseScore + ganhoTotal)
    tocarSom(rodada > 1 ? "combo" : "match", som); vibracao(rodada > 1 ? 55 : 25)
    return { tabuleiro: atual, score: baseScore + ganhoTotal, cascatas: rodada }
  }

  async function escolher(indice: number) {
    if (ocupado || movimentos <= 0) return
    if (selecionada == null) { setSelecionada(indice); vibracao(12); return }
    if (selecionada === indice) { setSelecionada(null); return }
    if (!vizinhas(selecionada, indice)) { setSelecionada(indice); return }

    setOcupado(true); setSelecionada(null)
    const trocado = trocar(tabuleiro, selecionada, indice)
    setTabuleiro(trocado)
    if (!encontrarMatches(trocado).length) {
      tocarSom("erro", som); vibracao(70); await new Promise((r) => setTimeout(r, 130)); setTabuleiro(tabuleiro); setMensagem("Essa troca não forma uma combinação."); setOcupado(false); return
    }

    const restantes = movimentos - 1; setMovimentos(restantes)
    const resolvido = await resolverCascata(trocado, score)
    const novoScore = resolvido.score
    setMensagem(resolvido.cascatas > 1 ? `Combo x${resolvido.cascatas}! Continue assim.` : "Boa combinação!")

    if (novoScore >= meta) {
      tocarSom("fase", som); vibracao(100)
      const proximo = nivel + 1
      setMensagem(nivel < 5 ? `Fase ${nivel} concluída!` : nivel === 5 ? "As cinco fases foram concluídas. A Jornada Infinita começou!" : `Nível ${nivel} concluído!`)
      setTimeout(() => { setNivel(proximo); setScore(0); setMovimentos(movimentosDaFase(proximo)); setTabuleiro(tabuleiroInicial()); setCombo(0); setOcupado(false) }, 700)
      return
    }

    if (restantes <= 0) {
      const recordeAtual = Number(localStorage.getItem("santa-luzia:caminho-da-luz:recorde") || 0)
      if (novoScore > recordeAtual) localStorage.setItem("santa-luzia:caminho-da-luz:recorde", String(novoScore))
      const pendente = { score: novoScore, level: nivel, mode: modo, salvoEm: Date.now() }
      if (navigator.onLine) {
        const ok = await enviarResultado(novoScore, nivel, modo)
        if (!ok) localStorage.setItem(CHAVE_PENDENTE, JSON.stringify(pendente))
      } else localStorage.setItem(CHAVE_PENDENTE, JSON.stringify(pendente))
      setMensagem("Fim da rodada. Seu resultado foi salvo.")
    }
    setOcupado(false)
  }

  function reiniciar() {
    setTabuleiro(tabuleiroInicial()); setSelecionada(null); setScore(0); setMovimentos(movimentosDaFase(nivel)); setCombo(0); setMensagem("Nova rodada iniciada."); setRankingMsg("")
  }

  const isMod = tipoUsuario === "moderador"
  return <div className="min-h-screen bg-[radial-gradient(circle_at_top,#fff8e5_0%,#fff_42%,#faf7f1_100%)]">
    <AreaHeader titulo="Caminho da Luz" subtitulo="Jogo litúrgico do Kis" voltarHref={isMod ? "/area-restrita/moderador" : "/area-restrita/membro"} menu={isMod ? <ModeradorMenu /> : <MembroMenu />} />
    <main className="mx-auto max-w-xl px-3 py-4 pb-24 sm:px-4">
      <section className="mb-4 rounded-3xl border border-white/70 bg-white/75 p-4 shadow-xl backdrop-blur-2xl">
        <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-primary">{modo}</p><h1 className="font-serif text-2xl font-semibold text-primary">Caminho da Luz</h1><p className="mt-1 text-sm text-muted-foreground">Combine símbolos, crie combos e avance pela jornada.</p></div><span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-2xl text-white shadow-lg">✝️</span></div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center"><div className="rounded-2xl bg-secondary/70 p-2"><p className="text-[10px] uppercase text-muted-foreground">Pontos</p><p className="font-bold text-primary">{score}</p></div><div className="rounded-2xl bg-secondary/70 p-2"><p className="text-[10px] uppercase text-muted-foreground">Movimentos</p><p className="font-bold text-primary">{movimentos}</p></div><div className="rounded-2xl bg-secondary/70 p-2"><p className="text-[10px] uppercase text-muted-foreground">Combo</p><p className="font-bold text-primary">x{Math.max(1, combo + 1)}</p></div></div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progresso}%` }} /></div><div className="mt-1 flex justify-between text-[10px] text-muted-foreground"><span>Meta da fase</span><span>{score}/{meta}</span></div>
      </section>

      {offline && <div className="mb-3 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950"><CloudOff className="size-4"/>O jogo continua funcionando sem internet. O resultado será sincronizado depois.</div>}
      {rankingMsg && <div className="mb-3 rounded-2xl border border-primary/15 bg-white/80 p-3 text-sm text-primary">{rankingMsg}</div>}

      <section className="rounded-3xl border border-white/70 bg-white/80 p-3 shadow-2xl backdrop-blur-2xl">
        <div className="grid grid-cols-8 gap-1.5" aria-label="Tabuleiro do Caminho da Luz">{tabuleiro.map((p, i) => <button key={p?.id || i} type="button" disabled={!p || ocupado || movimentos <= 0} onClick={() => void escolher(i)} aria-label={p ? `${NOMES[p.tipo]}, posição ${i + 1}` : "Espaço vazio"} className={`aspect-square rounded-xl border text-[clamp(1rem,5.5vw,1.75rem)] shadow-sm transition active:scale-90 ${selecionada === i ? "scale-105 border-primary bg-primary/15 ring-2 ring-primary/25" : "border-white bg-white/90"}`}>{p ? SIMBOLOS[p.tipo] : ""}</button>)}</div>
      </section>

      <div className="mt-3 rounded-2xl bg-white/70 p-3 text-center text-sm text-muted-foreground shadow-sm">{mensagem}</div>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <Button variant="outline" onClick={reiniciar}><RotateCcw className="size-4"/>Reiniciar</Button>
        <Button variant="outline" onClick={() => { const n = !som; setSom(n); localStorage.setItem(CHAVE_SOM, n ? "1" : "0") }}>{som ? <Volume2 className="size-4"/> : <VolumeX className="size-4"/>}{som ? "Som" : "Sem som"}</Button>
        <Button variant="outline" onClick={() => { const n = !vibrar; setVibrar(n); localStorage.setItem(CHAVE_VIBRAR, n ? "1" : "0") }}><Vibrate className="size-4"/>Vibração {vibrar ? "on" : "off"}</Button>
      </div>
      <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground"><Trophy className="size-4"/>Recorde local: {melhor} <Sparkles className="size-4"/></div>
    </main>
  </div>
}
