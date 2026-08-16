"use client"

import { useEffect, useRef, useState } from "react"
import { CloudOff, Gem, RotateCcw, Sparkles, Trophy, Volume2, VolumeX, Vibrate } from "lucide-react"
import { AreaHeader } from "@/components/area-header"
import { ModeradorMenu, MembroMenu } from "@/components/area-menu"
import { Button } from "@/components/ui/button"

const TAMANHO = 8
const LIMITE_RANKING = 35
const JOIAS = [
  { nome: "Diamante", cor: "#dff8ff", clara: "#ffffff", escura: "#8bbdcc" },
  { nome: "Rubi", cor: "#d93b62", clara: "#ff9ab0", escura: "#7d1731" },
  { nome: "Safira", cor: "#3b69d9", clara: "#8fb1ff", escura: "#18377f" },
  { nome: "Esmeralda", cor: "#37a978", clara: "#91e1bc", escura: "#176043" },
  { nome: "Ametista", cor: "#8d56bd", clara: "#c9a2eb", escura: "#4b276c" },
  { nome: "Topázio", cor: "#e49a3b", clara: "#ffd28a", escura: "#8a4f16" },
  { nome: "Água-marinha", cor: "#3db6ba", clara: "#9ee9e9", escura: "#1b6f73" },
] as const
const FASES = [
  { nome: "Cristal", chamada: "Comece a lapidação", bonus: 3 },
  { nome: "Safira", chamada: "Ganhe ritmo e precisão", bonus: 4 },
  { nome: "Rubi", chamada: "Construa combos maiores", bonus: 5 },
  { nome: "Esmeralda", chamada: "Domine as cascatas", bonus: 6 },
  { nome: "Diamante", chamada: "Complete a coleção rara", bonus: 7 },
] as const

type Peca = { id: string; tipo: number }
type Celula = Peca | null
type Pendente = { score: number; level: number; completedPhase: number; mode: string; salvoEm: number }

const CHAVE_ESTADO = "santa-luzia:joias-da-luz:web:estado:v4"
const CHAVE_SOM = "santa-luzia:joias-da-luz:web:som"
const CHAVE_VIBRAR = "santa-luzia:joias-da-luz:web:vibrar"
const CHAVE_PENDENTE = "santa-luzia:joias-da-luz:web:pendente:v4"
const CHAVE_RECORDE = "santa-luzia:joias-da-luz:web:recorde"

function id() { return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}` }
function quantidadeTipos(nivel: number) { return nivel < 3 ? 6 : 7 }
function novaPeca(nivel: number): Peca { return { id: id(), tipo: Math.floor(Math.random() * quantidadeTipos(nivel)) } }
function metaDaFase(nivel: number) { return 780 + Math.max(0, nivel - 1) * 260 }
function movimentosDaFase(nivel: number) { return Math.max(20, 28 - Math.floor((nivel - 1) / 3)) }
function bonusAcumulado(fase: number) { if (fase <= 0) return 0; if (fase <= 5) return [0, 3, 7, 12, 18, 25][fase]; return Math.min(LIMITE_RANKING, 25 + (fase - 5) * 2) }
function descricaoFase(nivel: number) { return nivel <= 5 ? FASES[nivel - 1] : { nome: `Coleção ${nivel}`, chamada: "Continue lapidando combinações", bonus: 2 } }
function modoDaFase(nivel: number) { return nivel <= 5 ? `Joias da Luz · etapa ${nivel} de 5 · ${FASES[nivel - 1].nome}` : `Joias da Luz · coleção ${nivel}` }
function vizinhas(a: number, b: number) { const ar = Math.floor(a / TAMANHO), ac = a % TAMANHO, br = Math.floor(b / TAMANHO), bc = b % TAMANHO; return Math.abs(ar - br) + Math.abs(ac - bc) === 1 }
function trocar(tab: Celula[], a: number, b: number) { const n = [...tab]; [n[a], n[b]] = [n[b], n[a]]; return n }

function encontrarMatches(tab: Celula[]) {
  const achados = new Set<number>()
  for (let r = 0; r < TAMANHO; r++) {
    let inicio = 0
    while (inicio < TAMANHO) {
      const tipo = tab[r * TAMANHO + inicio]?.tipo
      let fim = inicio + 1
      while (tipo != null && fim < TAMANHO && tab[r * TAMANHO + fim]?.tipo === tipo) fim++
      if (tipo != null && fim - inicio >= 3) for (let c = inicio; c < fim; c++) achados.add(r * TAMANHO + c)
      inicio = fim
    }
  }
  for (let c = 0; c < TAMANHO; c++) {
    let inicio = 0
    while (inicio < TAMANHO) {
      const tipo = tab[inicio * TAMANHO + c]?.tipo
      let fim = inicio + 1
      while (tipo != null && fim < TAMANHO && tab[fim * TAMANHO + c]?.tipo === tipo) fim++
      if (tipo != null && fim - inicio >= 3) for (let r = inicio; r < fim; r++) achados.add(r * TAMANHO + c)
      inicio = fim
    }
  }
  return [...achados]
}

function temJogada(tab: Celula[]) {
  const n = [...tab]
  for (let i = 0; i < n.length; i++) {
    const r = Math.floor(i / TAMANHO), c = i % TAMANHO
    for (const j of [c < TAMANHO - 1 ? i + 1 : -1, r < TAMANHO - 1 ? i + TAMANHO : -1]) {
      if (j < 0) continue
      ;[n[i], n[j]] = [n[j], n[i]]
      const ok = encontrarMatches(n).length > 0
      ;[n[i], n[j]] = [n[j], n[i]]
      if (ok) return true
    }
  }
  return false
}

function tabuleiroInicial(nivel: number) {
  for (let tentativa = 0; tentativa < 80; tentativa++) {
    const tab: Celula[] = Array(TAMANHO * TAMANHO).fill(null)
    for (let i = 0; i < tab.length; i++) {
      const tipos = Array.from({ length: quantidadeTipos(nivel) }, (_, x) => x).sort(() => Math.random() - 0.5)
      const r = Math.floor(i / TAMANHO), c = i % TAMANHO
      const tipo = tipos.find((t) => !((c >= 2 && tab[i - 1]?.tipo === t && tab[i - 2]?.tipo === t) || (r >= 2 && tab[i - TAMANHO]?.tipo === t && tab[i - TAMANHO * 2]?.tipo === t))) ?? tipos[0]
      tab[i] = { id: id(), tipo }
    }
    if (!encontrarMatches(tab).length && temJogada(tab)) return tab
  }
  return Array.from({ length: TAMANHO * TAMANHO }, () => novaPeca(nivel))
}

function cair(tab: Celula[], nivel: number) {
  const novo: Celula[] = Array(TAMANHO * TAMANHO).fill(null)
  for (let c = 0; c < TAMANHO; c++) {
    const coluna: Peca[] = []
    for (let r = TAMANHO - 1; r >= 0; r--) { const p = tab[r * TAMANHO + c]; if (p) coluna.push(p) }
    let k = 0
    for (let r = TAMANHO - 1; r >= 0; r--) novo[r * TAMANHO + c] = k < coluna.length ? coluna[k++] : novaPeca(nivel)
  }
  return novo
}

function Joia({ tipo }: { tipo: number }) {
  const j = JOIAS[tipo]
  return <svg viewBox="0 0 64 64" className="h-[86%] w-[86%] drop-shadow-[0_4px_4px_rgba(0,0,0,.3)]" aria-hidden="true"><path d="M18 9h28l11 16-25 31L7 25 18 9Z" fill={j.escura}/><path d="M18 9h28l-7 16H25L18 9Z" fill={j.clara}/><path d="M7 25h18l7 31L7 25Z" fill={j.cor}/><path d="M57 25H39l-7 31 25-31Z" fill={j.cor}/><path d="M25 25h14l-7 31-7-31Z" fill={j.clara} opacity=".88"/><path d="M18 9 7 25h18L18 9Zm28 0 11 16H39L46 9Z" fill={j.cor}/><path d="M18 9h28l11 16-25 31L7 25 18 9Z" fill="none" stroke="#ffffff88" strokeWidth="1.4" strokeLinejoin="round"/><path d="M21 15h10" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" opacity=".75"/></svg>
}

function tocarSom(tipo: "match" | "combo" | "erro" | "fase", ativo: boolean) {
  if (!ativo || typeof window === "undefined") return
  try {
    const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const notas = tipo === "erro" ? [170, 125] : tipo === "fase" ? [480, 610, 760, 910] : tipo === "combo" ? [430, 540, 680] : [390, 510]
    notas.forEach((freq, i) => { const osc = ctx.createOscillator(), gain = ctx.createGain(), inicio = ctx.currentTime + i * .045; osc.connect(gain); gain.connect(ctx.destination); osc.frequency.setValueAtTime(freq, inicio); gain.gain.setValueAtTime(.035, inicio); gain.gain.exponentialRampToValueAtTime(.001, inicio + .1); osc.start(inicio); osc.stop(inicio + .11) })
    setTimeout(() => void ctx.close(), 500)
  } catch {}
}

export function CaminhoDaLuzGame({ tipoUsuario, embedded = false }: { tipoUsuario: "moderador" | "membro"; embedded?: boolean }) {
  const [tabuleiro, setTabuleiro] = useState<Celula[]>(() => tabuleiroInicial(1))
  const [selecionada, setSelecionada] = useState<number | null>(null)
  const [pontosFase, setPontosFase] = useState(0)
  const [pontosTotais, setPontosTotais] = useState(0)
  const [nivel, setNivel] = useState(1)
  const [movimentos, setMovimentos] = useState(movimentosDaFase(1))
  const [combo, setCombo] = useState(0)
  const [mensagem, setMensagem] = useState("Arraste uma joia para o lado ou toque em duas vizinhas. Combine 3 ou mais.")
  const [som, setSom] = useState(true)
  const [vibrar, setVibrar] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [offline, setOffline] = useState(false)
  const [rankingMsg, setRankingMsg] = useState("")
  const [pontosRankingHoje, setPontosRankingHoje] = useState(0)
  const [recorde, setRecorde] = useState(0)
  const [fim, setFim] = useState(false)
  const [explodindo, setExplodindo] = useState<Set<number>>(new Set())
  const [trocando, setTrocando] = useState<Set<number>>(new Set())
  const [caindo, setCaindo] = useState(false)
  const gesto = useRef<{ i: number; x: number; y: number } | null>(null)

  const meta = metaDaFase(nivel)
  const fase = descricaoFase(nivel)
  const progresso = Math.min(100, Math.round((pontosFase / meta) * 100))

  useEffect(() => {
    try {
      setSom(localStorage.getItem(CHAVE_SOM) !== "0")
      setVibrar(localStorage.getItem(CHAVE_VIBRAR) !== "0")
      setRecorde(Number(localStorage.getItem(CHAVE_RECORDE) || 0))
      const salvo = JSON.parse(localStorage.getItem(CHAVE_ESTADO) || "null")
      if (salvo && Array.isArray(salvo.tabuleiro) && salvo.tabuleiro.length === TAMANHO * TAMANHO && !encontrarMatches(salvo.tabuleiro).length && temJogada(salvo.tabuleiro)) {
        setTabuleiro(salvo.tabuleiro); setPontosFase(Number(salvo.pontosFase) || 0); setPontosTotais(Number(salvo.pontosTotais) || 0); setNivel(Math.max(1, Number(salvo.nivel) || 1)); setMovimentos(Math.max(0, Number(salvo.movimentos) || movimentosDaFase(1)))
      }
    } catch {}
    setOffline(!navigator.onLine)
    const online = () => { setOffline(false); void sincronizarPendente() }
    const off = () => setOffline(true)
    window.addEventListener("online", online); window.addEventListener("offline", off)
    void sincronizarPendente()
    void fetch("/api/jogo/caminho-da-luz/resultado", { cache: "no-store" }).then((r) => r.ok ? r.json() : null).then((j) => { if (j?.ok) setPontosRankingHoje(Number(j.pontosTotalDia) || 0) }).catch(() => undefined)
    return () => { window.removeEventListener("online", online); window.removeEventListener("offline", off) }
  }, [])

  useEffect(() => { if (!fim) try { localStorage.setItem(CHAVE_ESTADO, JSON.stringify({ tabuleiro, pontosFase, pontosTotais, nivel, movimentos })) } catch {} }, [tabuleiro, pontosFase, pontosTotais, nivel, movimentos, fim])

  async function sincronizarPendente() {
    let p: Pendente | null = null
    try { p = JSON.parse(localStorage.getItem(CHAVE_PENDENTE) || "null") } catch {}
    if (!p || !navigator.onLine) return
    const ok = await enviarResultado(p.score, p.level, p.mode, p.completedPhase)
    if (ok) try { localStorage.removeItem(CHAVE_PENDENTE) } catch {}
  }

  async function enviarResultado(finalScore: number, level: number, mode: string, completedPhase: number) {
    try {
      const r = await fetch("/api/jogo/caminho-da-luz/resultado", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ score: finalScore, level, mode, completedPhase }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.erro || "Não foi possível enviar a pontuação.")
      setPontosRankingHoje(Number(j.pontosTotalDia) || 0)
      setRankingMsg(j.jaContabilizado ? `Ranking do jogo hoje: ${j.pontosTotalDia}/${j.limiteDiario || LIMITE_RANKING}.` : `+${j.pontosAdicionados ?? j.pontosRanking} no ranking · total do jogo hoje: ${j.pontosTotalDia}/${j.limiteDiario || LIMITE_RANKING}.`)
      return true
    } catch { setRankingMsg("Pontuação guardada neste aparelho. Sincroniza quando a internet voltar."); return false }
  }

  function salvarPendente(score: number, level: number, completedPhase: number, mode: string) { try { localStorage.setItem(CHAVE_PENDENTE, JSON.stringify({ score, level, completedPhase, mode, salvoEm: Date.now() })) } catch {} }
  function vibracao(ms = 20) { if (vibrar && navigator.vibrate) navigator.vibrate(ms) }

  async function resolverCascata(tab: Celula[], nivelAtual: number) {
    let atual = tab, rodada = 0, ganhoTotal = 0
    while (rodada < 14) {
      const matches = encontrarMatches(atual)
      if (!matches.length) break
      rodada++
      ganhoTotal += matches.length * 30 * Math.min(rodada, 4) + Math.max(0, matches.length - 3) * 12
      setTabuleiro(atual); setExplodindo(new Set(matches)); await new Promise((r) => setTimeout(r, 180))
      const removido = [...atual]; matches.forEach((i) => { removido[i] = null }); setTabuleiro(removido); setExplodindo(new Set()); await new Promise((r) => setTimeout(r, 45))
      atual = cair(removido, nivelAtual); setCaindo(true); setTabuleiro(atual); await new Promise((r) => setTimeout(r, 185)); setCaindo(false)
    }
    setCombo(Math.max(0, rodada - 1)); tocarSom(rodada > 1 ? "combo" : "match", som); vibracao(rodada > 1 ? 45 : 20)
    return { tabuleiro: atual, ganho: ganhoTotal, cascatas: rodada }
  }

  async function finalizarRodada(scoreFinal: number, nivelFinal = nivel) {
    const novoRecorde = Math.max(recorde, scoreFinal); setRecorde(novoRecorde)
    try { localStorage.setItem(CHAVE_RECORDE, String(novoRecorde)); localStorage.removeItem(CHAVE_ESTADO) } catch {}
    const faseConcluida = Math.max(0, nivelFinal - 1); const mode = modoDaFase(nivelFinal)
    if (navigator.onLine) { const ok = await enviarResultado(scoreFinal, nivelFinal, mode, faseConcluida); if (!ok) salvarPendente(scoreFinal, nivelFinal, faseConcluida, mode) } else salvarPendente(scoreFinal, nivelFinal, faseConcluida, mode)
    setFim(true)
  }

  async function tentarTroca(origem: number, destino: number) {
    if (ocupado || movimentos <= 0 || fim || !vizinhas(origem, destino)) return
    setOcupado(true); setSelecionada(null); setTrocando(new Set([origem, destino]))
    const original = [...tabuleiro], trocado = trocar(tabuleiro, origem, destino)
    setTabuleiro(trocado); await new Promise((r) => setTimeout(r, 125)); setTrocando(new Set())
    if (!encontrarMatches(trocado).length) {
      tocarSom("erro", som); vibracao(55); setTrocando(new Set([origem, destino])); setTabuleiro(original); await new Promise((r) => setTimeout(r, 130)); setTrocando(new Set()); setMensagem("Essa troca não cria uma combinação. Alinhe 3 ou mais joias iguais."); setOcupado(false); return
    }
    const restantes = movimentos - 1; setMovimentos(restantes)
    const resolvido = await resolverCascata(trocado, nivel)
    let finalTab = resolvido.tabuleiro
    const novoFase = pontosFase + resolvido.ganho, novoTotal = pontosTotais + resolvido.ganho
    setPontosFase(novoFase); setPontosTotais(novoTotal); setMensagem(resolvido.cascatas > 1 ? `Combo x${resolvido.cascatas}! Cascata de joias.` : `Boa combinação! +${resolvido.ganho} pontos.`)

    if (novoFase >= meta) {
      tocarSom("fase", som); vibracao(85)
      const concluido = nivel, proximo = nivel + 1, bonus = bonusAcumulado(concluido)
      const mode = modoDaFase(proximo)
      if (navigator.onLine) { const ok = await enviarResultado(novoTotal, proximo, mode, concluido); if (!ok) salvarPendente(novoTotal, proximo, concluido, mode) } else { salvarPendente(novoTotal, proximo, concluido, mode); setPontosRankingHoje(bonus) }
      setMensagem(concluido <= 5 ? `${FASES[concluido - 1].nome} concluída. +${FASES[concluido - 1].bonus} no ranking.` : `Coleção ${concluido} concluída. +2 no ranking.`)
      await new Promise((r) => setTimeout(r, 480)); setNivel(proximo); setPontosFase(0); setMovimentos(movimentosDaFase(proximo)); setCombo(0); finalTab = tabuleiroInicial(proximo); setCaindo(true); setTabuleiro(finalTab); await new Promise((r) => setTimeout(r, 180)); setCaindo(false); setOcupado(false); return
    }

    if (restantes <= 0) { setMensagem("Fim da rodada. Seu resultado foi registrado."); await finalizarRodada(novoTotal); setOcupado(false); return }
    if (!temJogada(finalTab)) { finalTab = tabuleiroInicial(nivel); setTabuleiro(finalTab); setMensagem("Sem jogadas possíveis. Embaralhamos as joias sem gastar movimento.") }
    setOcupado(false)
  }

  function escolher(indice: number) {
    if (ocupado || movimentos <= 0 || fim) return
    if (selecionada == null) { setSelecionada(indice); vibracao(8); return }
    if (selecionada === indice) { setSelecionada(null); return }
    if (!vizinhas(selecionada, indice)) { setSelecionada(indice); return }
    const origem = selecionada; setSelecionada(null); void tentarTroca(origem, indice)
  }

  function pointerUp(indice: number, event: React.PointerEvent<HTMLButtonElement>) {
    const inicio = gesto.current; gesto.current = null
    if (!inicio || inicio.i !== indice) { escolher(indice); return }
    const dx = event.clientX - inicio.x, dy = event.clientY - inicio.y
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) { escolher(indice); return }
    const r = Math.floor(indice / TAMANHO), c = indice % TAMANHO
    let destino = -1
    if (Math.abs(dx) > Math.abs(dy)) destino = dx > 0 && c < TAMANHO - 1 ? indice + 1 : dx < 0 && c > 0 ? indice - 1 : -1
    else destino = dy > 0 && r < TAMANHO - 1 ? indice + TAMANHO : dy < 0 && r > 0 ? indice - TAMANHO : -1
    if (destino >= 0) void tentarTroca(indice, destino)
  }

  function reiniciar() {
    setTabuleiro(tabuleiroInicial(1)); setSelecionada(null); setPontosFase(0); setPontosTotais(0); setNivel(1); setMovimentos(movimentosDaFase(1)); setCombo(0); setMensagem("Arraste uma joia para o lado ou toque em duas vizinhas. Combine 3 ou mais."); setRankingMsg(""); setFim(false); setOcupado(false); setExplodindo(new Set()); setTrocando(new Set()); try { localStorage.removeItem(CHAVE_ESTADO) } catch {}
  }

  const isMod = tipoUsuario === "moderador"
  const conteudo = (
    <div className={embedded ? "mx-auto max-w-xl" : "mx-auto max-w-xl px-3 py-4 pb-24 sm:px-4"}>
      <section className="rounded-[24px] border border-border bg-white/90 p-3 shadow-[0_14px_36px_rgba(79,36,49,.08)]">
        <div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[.18em] text-primary">Joias da Luz · {nivel <= 5 ? `etapa ${nivel} de 5` : `coleção ${nivel}`}</p><h2 className="mt-0.5 font-serif text-2xl font-semibold text-primary">{fase.nome}</h2><p className="text-xs text-muted-foreground">{fase.chamada}</p></div><span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-white"><Gem className="size-6" /></span></div>
        <div className="mt-3 grid grid-cols-3 gap-1.5 text-center"><div className="rounded-xl bg-secondary/65 p-2"><p className="text-[8px] font-bold uppercase text-muted-foreground">Pontos</p><p className="text-base font-black text-primary">{pontosTotais}</p></div><div className="rounded-xl bg-secondary/65 p-2"><p className="text-[8px] font-bold uppercase text-muted-foreground">Movimentos</p><p className="text-base font-black text-primary">{movimentos}</p></div><div className="rounded-xl bg-secondary/65 p-2"><p className="text-[8px] font-bold uppercase text-muted-foreground">Combo</p><p className="text-base font-black text-primary">x{Math.max(1, combo + 1)}</p></div></div>
        <div className="mt-3 flex items-center justify-between text-[9px] text-muted-foreground"><span>Progresso</span><span>{pontosFase}/{meta}</span></div><div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-gradient-to-r from-primary via-[#8b6675] to-[#bfa66a] transition-all" style={{ width: `${progresso}%` }} /></div>
        <div className="mt-2 flex justify-between rounded-xl border border-border bg-[#faf7ef] px-2.5 py-1.5 text-[9px] font-bold text-[#675b4a]"><span>Etapa: +{fase.bonus} ranking</span><span>{pontosRankingHoje}/{LIMITE_RANKING} hoje</span></div>
      </section>

      {offline && <div className="mt-2 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2 text-[10px] text-amber-950"><CloudOff className="size-3.5" />Você pode jogar offline; o ranking sincroniza depois.</div>}
      {rankingMsg && <div className="mt-2 rounded-xl border border-primary/10 bg-white p-2 text-[10px] font-medium text-primary">{rankingMsg}</div>}

      <section className="mt-2 rounded-[24px] border border-[#1d1f28] bg-[linear-gradient(145deg,#20222c,#30323e)] p-2 shadow-[0_16px_36px_rgba(32,34,44,.2)]">
        <div className="grid touch-none grid-cols-8 gap-1" aria-label="Tabuleiro Joias da Luz">
          {tabuleiro.map((p, i) => <button key={p?.id || i} type="button" disabled={!p || ocupado || movimentos <= 0 || fim} onPointerDown={(event) => { gesto.current = { i, x: event.clientX, y: event.clientY } }} onPointerUp={(event) => pointerUp(i, event)} onPointerCancel={() => { gesto.current = null }} aria-label={p ? `${JOIAS[p.tipo].nome}, posição ${i + 1}` : "Espaço vazio"} className={`relative aspect-square overflow-hidden rounded-[10px] border border-white/10 bg-[linear-gradient(145deg,#393c49,#2e303b)] shadow-sm transition ${selecionada === i ? "z-10 border-[#d9c48e] ring-2 ring-[#d9c48e]/30" : ""} ${explodindo.has(i) ? "scale-50 opacity-0 duration-200" : ""} ${trocando.has(i) ? "scale-90" : ""} ${caindo ? "animate-in fade-in slide-in-from-top-2 duration-200" : ""}`}>{p && <Joia tipo={p.tipo} />}</button>)}
        </div>
      </section>

      <div className="mt-2 flex gap-1 overflow-x-auto pb-1">{Array.from({ length: quantidadeTipos(nivel) }, (_, tipo) => <span key={tipo} className="flex shrink-0 items-center gap-1 rounded-full border border-border bg-white px-2 py-1 text-[8px] text-muted-foreground"><span className="size-4"><Joia tipo={tipo} /></span>{JOIAS[tipo].nome}</span>)}</div>
      <div className="mt-2 rounded-xl border border-border bg-white p-2 text-center text-[10px] leading-4 text-muted-foreground">{mensagem}</div>
      <div className="mt-2 flex justify-center gap-1.5"><Button size="sm" variant="outline" className="h-9 text-[10px]" onClick={reiniciar}><RotateCcw className="size-3.5"/>Reiniciar</Button><Button size="sm" variant="outline" className="h-9 text-[10px]" onClick={() => { const n = !som; setSom(n); localStorage.setItem(CHAVE_SOM, n ? "1" : "0") }}>{som ? <Volume2 className="size-3.5"/> : <VolumeX className="size-3.5"/>}Som</Button><Button size="sm" variant="outline" className="h-9 text-[10px]" onClick={() => { const n = !vibrar; setVibrar(n); localStorage.setItem(CHAVE_VIBRAR, n ? "1" : "0") }}><Vibrate className="size-3.5"/>Vibração</Button></div>
      <div className="mt-3 flex items-center justify-center gap-2 text-[10px] text-muted-foreground"><Trophy className="size-3.5"/>Recorde local: {recorde}</div>

      {fim && <div className="fixed inset-0 z-[100] grid place-items-center bg-[#21181c]/75 p-4"><section className="w-full max-w-sm rounded-[28px] border border-white/60 bg-[#fffaf6] p-6 text-center shadow-2xl"><span className="mx-auto flex size-14 items-center justify-center rounded-[18px] bg-primary text-white"><Gem className="size-7" /></span><p className="mt-4 text-[9px] font-black uppercase tracking-[.16em] text-primary">Resultado salvo</p><h2 className="mt-1 font-serif text-3xl font-semibold text-primary">Rodada concluída</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">Você chegou à coleção {nivel} com <strong className="text-primary">{pontosTotais} pontos</strong>.</p>{rankingMsg && <p className="mt-3 rounded-xl bg-white p-3 text-xs font-medium text-primary">{rankingMsg}</p>}<Button className="mt-5 w-full" onClick={reiniciar}><Sparkles className="size-4"/>Jogar novamente</Button></section></div>}
    </div>
  )

  if (embedded) return conteudo
  return <div className="min-h-screen bg-[#f5f1ef]"><AreaHeader titulo="Joias da Luz" subtitulo="Jogo da Jornada Litúrgica" voltarHref={isMod ? "/area-restrita/moderador" : "/area-restrita/membro"} menu={isMod ? <ModeradorMenu /> : <MembroMenu />} /><main>{conteudo}</main></div>
}
