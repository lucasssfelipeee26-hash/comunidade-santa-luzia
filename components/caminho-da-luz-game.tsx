"use client"

import { useEffect, useMemo, useState } from "react"
import { CloudOff, RotateCcw, Sparkles, Trophy, Volume2, VolumeX, Vibrate } from "lucide-react"
import { AreaHeader } from "@/components/area-header"
import { ModeradorMenu, MembroMenu } from "@/components/area-menu"
import { Button } from "@/components/ui/button"

const TAMANHO = 8
const NOMES = ["Cálice", "Ramo", "Âmbula", "Galhetas", "Patena", "Missal", "Castiçal", "Vela", "Carrilhão", "Turíbulo"] as const
const FASES = [
  { nome: "Entrada", chamada: "Prepare o coração", icone: "✝️", bonus: 2 },
  { nome: "Palavra", chamada: "Escute e anuncie", icone: "📖", bonus: 3 },
  { nome: "Ofertório", chamada: "Entregue seus dons", icone: "🌿", bonus: 4 },
  { nome: "Eucaristia", chamada: "Permaneça na presença", icone: "✝️", bonus: 5 },
  { nome: "Envio", chamada: "Leve a luz adiante", icone: "🕊️", bonus: 6 },
] as const

type Peca = { id: string; tipo: number }
type Celula = Peca | null
type Pendente = { score: number; level: number; completedPhase: number; mode: string; salvoEm: number }
type Particula = { id: string; left: number; top: number; delay: number }

const CHAVE_ESTADO = "santa-luzia:caminho-da-luz:estado:v3"
const CHAVE_SOM = "santa-luzia:caminho-da-luz:som"
const CHAVE_VIBRAR = "santa-luzia:caminho-da-luz:vibrar"
const CHAVE_PENDENTE = "santa-luzia:caminho-da-luz:resultado-pendente:v3"
const CHAVE_RECORDE = "santa-luzia:caminho-da-luz:recorde"

function id() { return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }
function tiposDaFase(nivel: number) {
  const inicio = Math.max(0, (nivel - 1) % NOMES.length)
  return Array.from({ length: 8 }, (_, i) => (inicio + i) % NOMES.length)
}
function novaPeca(nivel: number) {
  const tipos = tiposDaFase(nivel)
  return { id: id(), tipo: tipos[Math.floor(Math.random() * tipos.length)] }
}
function vizinhas(a: number, b: number) {
  const ar = Math.floor(a / TAMANHO), ac = a % TAMANHO, br = Math.floor(b / TAMANHO), bc = b % TAMANHO
  return Math.abs(ar - br) + Math.abs(ac - bc) === 1
}
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

function cair(tab: Celula[], nivel: number) {
  const n = [...tab]
  for (let c = 0; c < TAMANHO; c++) {
    const coluna: Peca[] = []
    for (let r = TAMANHO - 1; r >= 0; r--) { const p = n[r * TAMANHO + c]; if (p) coluna.push(p) }
    for (let r = TAMANHO - 1; r >= 0; r--) n[r * TAMANHO + c] = coluna[TAMANHO - 1 - r] || novaPeca(nivel)
  }
  return n
}

function tabuleiroInicial(nivel = 1) {
  let tab: Celula[] = Array.from({ length: TAMANHO * TAMANHO }, () => novaPeca(nivel))
  let tentativas = 0
  while (encontrarMatches(tab).length && tentativas++ < 50) tab = tab.map(() => novaPeca(nivel))
  return tab
}

function metaDaFase(nivel: number) { return 650 + Math.max(0, nivel - 1) * 240 }
function movimentosDaFase(nivel: number) { return Math.max(18, 28 - Math.floor((nivel - 1) / 2)) }
function descricaoFase(nivel: number) {
  if (nivel <= FASES.length) return FASES[nivel - 1]
  return { nome: `Jornada ${nivel}`, chamada: "Continue servindo e avançando", icone: "⭐", bonus: 2 }
}
function modoDaFase(nivel: number) { return nivel <= 5 ? `Fase ${nivel} de 5 · ${FASES[nivel - 1].nome}` : `Jornada infinita · Nível ${nivel}` }
function bonusAcumulado(faseConcluida: number) {
  const base = [0, 2, 5, 9, 14, 20]
  if (faseConcluida <= 0) return 0
  if (faseConcluida <= 5) return base[faseConcluida]
  return Math.min(30, 20 + (faseConcluida - 5) * 2)
}

function PecaLiturgica({ tipo }: { tipo: number }) {
  const comum = { stroke: "#6e1730", strokeWidth: 3, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }
  const ouro = "#d8a548", ouroClaro = "#f7d983", vinho = "#7b1733", creme = "#fff8e8", prata = "#d7d9df"
  return (
    <svg viewBox="0 0 64 64" className="h-[88%] w-[88%] drop-shadow-[0_4px_4px_rgba(82,17,35,.18)]" aria-hidden="true">
      <circle cx="32" cy="32" r="29" fill={creme} opacity=".78" />
      {tipo === 0 && <>{/* Cálice */}<path d="M18 13h28l-2 13c-1.2 7.3-6.4 12-12 12s-10.8-4.7-12-12L18 13Z" fill={ouroClaro} {...comum}/><path d="M25 18h14" {...comum}/><path d="M32 38v11M23 52h18" {...comum}/><ellipse cx="32" cy="52" rx="13" ry="4" fill={ouro} {...comum}/><path d="M28 24h8" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity=".8"/></>}
      {tipo === 1 && <>{/* Ramo */}<path d="M17 50c9-13 18-23 31-35" {...comum} fill="none"/><path d="M23 42c-7 0-9-4-9-8 7 0 10 3 9 8ZM30 35c-7-1-8-5-7-9 7 1 9 4 7 9ZM37 28c-6-2-7-6-5-10 6 2 8 5 5 10ZM29 39c1-6 5-9 10-8-1 6-4 9-10 8ZM37 31c2-6 6-8 11-6-2 6-6 8-11 6ZM44 23c2-5 6-7 10-5-2 5-5 7-10 5Z" fill="#6c9b48" stroke="#476c30" strokeWidth="2"/></>}
      {tipo === 2 && <>{/* Âmbula */}<path d="M25 18h14l3 6v17c0 6-4 10-10 10s-10-4-10-10V24l3-6Z" fill={ouroClaro} {...comum}/><path d="M22 25h20M28 18v-4h8v4M32 9v5M29 11h6" {...comum}/><path d="M27 32h10" stroke="#fff" strokeWidth="2.3" opacity=".8"/></>}
      {tipo === 3 && <>{/* Galhetas */}<path d="M14 27h14v19c0 5-3 8-7 8s-7-3-7-8V27Z" fill="#dcefff" {...comum}/><path d="M17 20h8v7h-8z" fill={prata} {...comum}/><path d="M36 27h14v19c0 5-3 8-7 8s-7-3-7-8V27Z" fill="#fff0e3" {...comum}/><path d="M39 20h8v7h-8z" fill={prata} {...comum}/><path d="M17 40h8M39 40h8" stroke={vinho} strokeWidth="2.3"/><text x="21" y="38" textAnchor="middle" fontSize="8" fontWeight="800" fill={vinho}>A</text><text x="43" y="38" textAnchor="middle" fontSize="8" fontWeight="800" fill={vinho}>V</text></>}
      {tipo === 4 && <>{/* Patena */}<ellipse cx="32" cy="38" rx="20" ry="11" fill={ouro} {...comum}/><ellipse cx="32" cy="35" rx="15" ry="7" fill={ouroClaro} stroke="#8e6323" strokeWidth="2"/><circle cx="32" cy="29" r="9" fill="#fffdf4" stroke="#d5c8a4" strokeWidth="2"/><path d="M32 24v10M28 29h8" stroke={ouro} strokeWidth="2"/></>}
      {tipo === 5 && <>{/* Missal */}<path d="M16 15h29c3 0 5 2 5 5v31H21c-3 0-5-2-5-5V15Z" fill={vinho} {...comum}/><path d="M21 15v36" stroke="#a96476" strokeWidth="2"/><path d="M32 24v16M26 32h12" stroke={ouroClaro} strokeWidth="3"/><path d="M45 20h5" stroke="#fff" strokeWidth="2" opacity=".55"/></>}
      {tipo === 6 && <>{/* Castiçal */}<path d="M29 14h6v24h-6z" fill={ouroClaro} {...comum}/><path d="M22 42h20M26 48h12M32 38v10" {...comum}/><path d="M27 15c0-5 5-8 5-8s5 3 5 8c0 3-2 5-5 5s-5-2-5-5Z" fill="#ffb332" stroke="#a85a1b" strokeWidth="2"/><ellipse cx="32" cy="51" rx="12" ry="3.5" fill={ouro} {...comum}/></>}
      {tipo === 7 && <>{/* Vela */}<path d="M24 25h16v27H24z" fill="#fff4cc" {...comum}/><path d="M29 22c0-6 3-10 3-10s5 5 4 10c0 3-2 5-4 5s-3-2-3-5Z" fill="#ffae2f" stroke="#a85a1b" strokeWidth="2"/><path d="M28 34h8" stroke="#fff" strokeWidth="2.5" opacity=".8"/></>}
      {tipo === 8 && <>{/* Carrilhão */}<path d="M15 18h34M20 18v10M29 18v7M38 18v7M47 18v10" {...comum}/><path d="M15 29h10l-1 10H16l-1-10Zm9-3h10l-1 12h-8l-1-12Zm9 0h10l-1 12h-8l-1-12Zm9 3h10l-1 10h-8l-1-10Z" fill={ouroClaro} {...comum}/><circle cx="20" cy="41" r="2" fill={vinho}/><circle cx="29" cy="40" r="2" fill={vinho}/><circle cx="38" cy="40" r="2" fill={vinho}/><circle cx="47" cy="41" r="2" fill={vinho}/></>}
      {tipo === 9 && <>{/* Turíbulo */}<path d="M24 12 18 31M40 12l6 19M32 12v16" {...comum}/><path d="M19 30h26l-4 18H23l-4-18Z" fill={ouroClaro} {...comum}/><path d="M25 37h14M28 42h8" stroke="#9d6d24" strokeWidth="2"/><path d="M26 10c-4-4 2-7 0-11M34 11c4-5-2-7 1-11M41 15c3-4-1-7 2-10" stroke="#c6b7b5" strokeWidth="2.2" fill="none" strokeLinecap="round"/></>}
    </svg>
  )
}

function tocarSom(tipo: "match" | "combo" | "erro" | "fase", ativo: boolean) {
  if (!ativo || typeof window === "undefined") return
  try {
    const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const notas = tipo === "erro" ? [150, 110] : tipo === "fase" ? [520, 660, 820, 980] : tipo === "combo" ? [440, 560, 700] : [420, 560]
    notas.forEach((freq, i) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      const inicio = ctx.currentTime + i * 0.055
      osc.frequency.setValueAtTime(freq, inicio)
      gain.gain.setValueAtTime(tipo === "fase" ? 0.055 : 0.04, inicio)
      gain.gain.exponentialRampToValueAtTime(0.001, inicio + 0.12)
      osc.start(inicio); osc.stop(inicio + 0.13)
    })
    setTimeout(() => void ctx.close(), 600)
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
  const [mensagem, setMensagem] = useState("Combine 3 ou mais peças litúrgicas para avançar na Missão do Altar.")
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
  const [celebrando, setCelebrando] = useState(false)
  const [particulas, setParticulas] = useState<Particula[]>([])

  const meta = metaDaFase(nivel)
  const fase = descricaoFase(nivel)
  const modo = modoDaFase(nivel)
  const progresso = Math.min(100, Math.round((pontosFase / meta) * 100))
  const bonusProxima = fase.bonus
  const tiposAtuais = useMemo(() => tiposDaFase(nivel), [nivel])

  useEffect(() => {
    try {
      setSom(localStorage.getItem(CHAVE_SOM) !== "0")
      setVibrar(localStorage.getItem(CHAVE_VIBRAR) !== "0")
      setRecorde(Number(localStorage.getItem(CHAVE_RECORDE) || 0))
      const salvo = JSON.parse(localStorage.getItem(CHAVE_ESTADO) || "null")
      if (salvo && Array.isArray(salvo.tabuleiro) && salvo.tabuleiro.length === TAMANHO * TAMANHO) {
        setTabuleiro(salvo.tabuleiro)
        setPontosFase(Number(salvo.pontosFase) || 0)
        setPontosTotais(Number(salvo.pontosTotais) || 0)
        setNivel(Math.max(1, Number(salvo.nivel) || 1))
        setMovimentos(Math.max(0, Number(salvo.movimentos) || movimentosDaFase(1)))
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
    if (fim) return
    try { localStorage.setItem(CHAVE_ESTADO, JSON.stringify({ tabuleiro, pontosFase, pontosTotais, nivel, movimentos })) } catch {}
  }, [tabuleiro, pontosFase, pontosTotais, nivel, movimentos, fim])

  async function sincronizarPendente() {
    let p: Pendente | null = null
    try { p = JSON.parse(localStorage.getItem(CHAVE_PENDENTE) || "null") } catch {}
    if (!p || !navigator.onLine) return
    const ok = await enviarResultado(p.score, p.level, p.mode, p.completedPhase)
    if (ok) try { localStorage.removeItem(CHAVE_PENDENTE) } catch {}
  }

  async function enviarResultado(finalScore: number, level: number, mode: string, completedPhase: number) {
    try {
      const r = await fetch("/api/jogo/caminho-da-luz/resultado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score: finalScore, level, mode, completedPhase }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.erro || "Não foi possível enviar a pontuação.")
      setPontosRankingHoje(Number(j.pontosTotalDia) || 0)
      setRankingMsg(j.jaContabilizado
        ? `Ranking atualizado: ${j.pontosTotalDia}/30 pontos da Missão hoje.`
        : `+${j.pontosAdicionados ?? j.pontosRanking} no ranking · total da Missão hoje: ${j.pontosTotalDia}/30.`)
      return true
    } catch {
      setRankingMsg("Pontuação guardada neste celular. Ela será enviada ao ranking quando a internet voltar.")
      return false
    }
  }

  function salvarPendente(score: number, level: number, completedPhase: number, mode: string) {
    try {
      const anterior = JSON.parse(localStorage.getItem(CHAVE_PENDENTE) || "null") as Pendente | null
      const melhor = !anterior || completedPhase >= anterior.completedPhase
        ? { score, level, completedPhase, mode, salvoEm: Date.now() }
        : anterior
      localStorage.setItem(CHAVE_PENDENTE, JSON.stringify(melhor))
    } catch {}
  }

  async function registrarFase(score: number, faseConcluida: number, proximoNivel: number) {
    const mode = `Missão do Altar · fase ${faseConcluida} concluída`
    if (navigator.onLine) {
      const ok = await enviarResultado(score, proximoNivel, mode, faseConcluida)
      if (!ok) salvarPendente(score, proximoNivel, faseConcluida, mode)
    } else {
      salvarPendente(score, proximoNivel, faseConcluida, mode)
      setPontosRankingHoje(bonusAcumulado(faseConcluida))
      setRankingMsg(`Fase concluída: bônus salvo (${bonusAcumulado(faseConcluida)}/30). Sincroniza quando a internet voltar.`)
    }
  }

  function vibracao(ms = 25) { if (vibrar && navigator.vibrate) navigator.vibrate(ms) }
  function criarParticulas(indices: number[], quantidade = 18) {
    const base = indices.length ? indices[Math.floor(indices.length / 2)] : 27
    const row = Math.floor(base / TAMANHO), col = base % TAMANHO
    setParticulas(Array.from({ length: quantidade }, (_, i) => ({
      id: `${Date.now()}-${i}`,
      left: Math.min(96, Math.max(4, ((col + .5) / TAMANHO) * 100 + (Math.random() - .5) * 18)),
      top: Math.min(96, Math.max(4, ((row + .5) / TAMANHO) * 100 + (Math.random() - .5) * 16)),
      delay: Math.random() * .12,
    })))
    window.setTimeout(() => setParticulas([]), 650)
  }

  async function resolverCascata(tab: Celula[]) {
    let atual = tab, rodada = 0, ganhoTotal = 0
    while (true) {
      const matches = encontrarMatches(atual)
      if (!matches.length) break
      rodada++
      ganhoTotal += matches.length * 20 * rodada
      setExplodindo(new Set(matches))
      criarParticulas(matches, Math.min(28, 12 + matches.length * 2))
      await new Promise((r) => setTimeout(r, 210))
      const removido = [...atual]
      matches.forEach((i) => { removido[i] = null })
      setTabuleiro(removido)
      setExplodindo(new Set())
      await new Promise((r) => setTimeout(r, 70))
      atual = cair(removido, nivel)
      setCaindo(true)
      setTabuleiro(atual)
      await new Promise((r) => setTimeout(r, 240))
      setCaindo(false)
    }
    setCombo(Math.max(0, rodada - 1))
    tocarSom(rodada > 1 ? "combo" : "match", som)
    vibracao(rodada > 1 ? 55 : 25)
    return { tabuleiro: atual, ganho: ganhoTotal, cascatas: rodada }
  }

  async function finalizarRodada(scoreFinal: number) {
    const novoRecorde = Math.max(recorde, scoreFinal)
    setRecorde(novoRecorde)
    try {
      localStorage.setItem(CHAVE_RECORDE, String(novoRecorde))
      localStorage.removeItem(CHAVE_ESTADO)
    } catch {}
    const faseConcluida = Math.max(0, nivel - 1)
    const mode = `Missão do Altar · ${modo}`
    if (navigator.onLine) {
      const ok = await enviarResultado(scoreFinal, nivel, mode, faseConcluida)
      if (!ok) salvarPendente(scoreFinal, nivel, faseConcluida, mode)
    } else {
      salvarPendente(scoreFinal, nivel, faseConcluida, mode)
      setRankingMsg("Resultado salvo neste celular. Ele será enviado para a classificação quando a internet voltar.")
    }
    setFim(true)
  }

  async function escolher(indice: number) {
    if (ocupado || movimentos <= 0 || fim) return
    if (selecionada == null) { setSelecionada(indice); vibracao(12); return }
    if (selecionada === indice) { setSelecionada(null); return }
    if (!vizinhas(selecionada, indice)) { setSelecionada(indice); return }

    setOcupado(true)
    const origem = selecionada
    setSelecionada(null)
    setTrocando(new Set([origem, indice]))
    const trocado = trocar(tabuleiro, origem, indice)
    setTabuleiro(trocado)
    await new Promise((r) => setTimeout(r, 150))
    setTrocando(new Set())
    if (!encontrarMatches(trocado).length) {
      tocarSom("erro", som); vibracao(70)
      setTrocando(new Set([origem, indice]))
      setTabuleiro(tabuleiro)
      await new Promise((r) => setTimeout(r, 160))
      setTrocando(new Set())
      setMensagem("Essa troca não forma uma combinação. Tente fechar uma sequência de três peças.")
      setOcupado(false)
      return
    }

    const restantes = movimentos - 1
    setMovimentos(restantes)
    const resolvido = await resolverCascata(trocado)
    const novoFase = pontosFase + resolvido.ganho
    const novoTotal = pontosTotais + resolvido.ganho
    setPontosFase(novoFase)
    setPontosTotais(novoTotal)
    setMensagem(resolvido.cascatas > 1 ? `Combo x${resolvido.cascatas}! Cascata perfeita!` : "Boa combinação! Continue a missão.")

    if (novoFase >= meta) {
      tocarSom("fase", som); vibracao(100)
      const concluido = nivel
      const proximo = nivel + 1
      setCelebrando(true)
      criarParticulas([27, 28, 35, 36], 38)
      await registrarFase(novoTotal, concluido, proximo)
      setMensagem(concluido < 5
        ? `${FASES[concluido - 1].nome} concluída! +${FASES[concluido - 1].bonus} pontos de ranking. Próxima: ${FASES[concluido].nome}.`
        : concluido === 5
          ? `Envio concluído! +6 no ranking. A Jornada Infinita começou.`
          : `Nível ${concluido} concluído! +2 pontos de ranking.`)
      await new Promise((r) => setTimeout(r, 780))
      setCelebrando(false)
      setNivel(proximo)
      setPontosFase(0)
      setMovimentos(movimentosDaFase(proximo))
      setCaindo(true)
      setTabuleiro(tabuleiroInicial(proximo))
      setCombo(0)
      await new Promise((r) => setTimeout(r, 260))
      setCaindo(false)
      setOcupado(false)
      return
    }

    if (restantes <= 0) {
      setMensagem("Fim da rodada. Sua missão foi registrada.")
      await finalizarRodada(novoTotal)
    }
    setOcupado(false)
  }

  function reiniciar() {
    setTabuleiro(tabuleiroInicial(1))
    setSelecionada(null)
    setPontosFase(0)
    setPontosTotais(0)
    setNivel(1)
    setMovimentos(movimentosDaFase(1))
    setCombo(0)
    setMensagem("Nova missão iniciada. Combine 3 ou mais peças litúrgicas.")
    setRankingMsg("")
    setFim(false)
    setOcupado(false)
    setExplodindo(new Set())
    setTrocando(new Set())
    setParticulas([])
    try { localStorage.removeItem(CHAVE_ESTADO) } catch {}
  }

  const isMod = tipoUsuario === "moderador"
  const conteudo = (
    <div className={embedded ? "mx-auto max-w-xl" : "mx-auto max-w-xl px-3 py-4 pb-24 sm:px-4"}>
      <style>{`
        @keyframes altar-pop{0%{transform:scale(1);filter:brightness(1)}45%{transform:scale(1.32) rotate(5deg);filter:brightness(1.45)}100%{transform:scale(.15) rotate(-10deg);opacity:0}}
        @keyframes altar-swap{0%{transform:scale(1)}45%{transform:scale(.86) rotate(-3deg)}100%{transform:scale(1) rotate(0)}}
        @keyframes altar-drop{0%{transform:translateY(-28px) scale(.88);opacity:.35}70%{transform:translateY(4px) scale(1.04);opacity:1}100%{transform:translateY(0) scale(1)}}
        @keyframes altar-select{0%,100%{transform:scale(1.08)}50%{transform:scale(1.16)}}
        @keyframes altar-spark{0%{transform:translate(-50%,-50%) scale(.2) rotate(0);opacity:1}70%{opacity:1}100%{transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(1.15) rotate(190deg);opacity:0}}
        @keyframes altar-celebrate{0%{transform:scale(.95);box-shadow:0 0 0 rgba(216,165,72,0)}45%{transform:scale(1.018);box-shadow:0 0 55px rgba(216,165,72,.48)}100%{transform:scale(1);box-shadow:0 0 0 rgba(216,165,72,0)}}
        @keyframes altar-glow{0%,100%{opacity:.2;transform:scale(.85)}50%{opacity:.7;transform:scale(1.2)}}
      `}</style>
      <section className={`relative overflow-hidden rounded-[30px] border border-primary/15 bg-white/90 p-4 shadow-[0_24px_70px_rgba(82,17,35,.16)] backdrop-blur-2xl ${celebrando ? "[animation:altar-celebrate_.8s_ease-out]" : ""}`}>
        <div className="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full bg-primary/5 blur-2xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-primary">Missão do Altar · {modo}</p>
            <h2 className="mt-1 font-serif text-3xl font-semibold text-primary">{fase.nome}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{fase.chamada}</p>
          </div>
          <span className="flex size-14 shrink-0 items-center justify-center rounded-[20px] border border-primary/10 bg-primary text-2xl text-white shadow-lg">{fase.icone}</span>
        </div>

        <div className="relative mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl border border-primary/10 bg-secondary/65 p-2.5"><p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Pontos jogo</p><p className="mt-0.5 text-lg font-black text-primary">{pontosTotais}</p></div>
          <div className="rounded-2xl border border-primary/10 bg-secondary/65 p-2.5"><p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Movimentos</p><p className="mt-0.5 text-lg font-black text-primary">{movimentos}</p></div>
          <div className="rounded-2xl border border-primary/10 bg-secondary/65 p-2.5"><p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Combo</p><p className="mt-0.5 text-lg font-black text-primary">x{Math.max(1, combo + 1)}</p></div>
        </div>

        <div className="relative mt-4">
          <div className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground"><span>Progresso da etapa</span><span>{pontosFase}/{meta}</span></div>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-gradient-to-r from-primary via-amber-500 to-yellow-300 transition-all duration-500" style={{ width: `${progresso}%` }} /></div>
          <div className="mt-3 grid grid-cols-5 gap-1.5">
            {FASES.map((item, i) => {
              const etapa = i + 1
              const ativa = nivel === etapa
              const concluida = nivel > etapa
              return <div key={item.nome} title={`${item.nome}: +${item.bonus} no ranking`} className={`h-1.5 rounded-full transition ${concluida ? "bg-amber-500" : ativa ? "bg-primary" : "bg-secondary"}`} />
            })}
          </div>
          <div className="mt-3 flex items-center justify-between rounded-xl border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-[11px] font-bold text-amber-950">
            <span>Próxima fase: +{bonusProxima} ranking</span><span>{pontosRankingHoje}/30 hoje</span>
          </div>
        </div>
      </section>

      {offline && <div className="mt-3 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50/95 p-3 text-xs text-amber-950"><CloudOff className="size-4 shrink-0"/>A missão continua sem internet. Os bônus de fase ficam guardados e sincronizam depois.</div>}
      {rankingMsg && <div className="mt-3 rounded-2xl border border-primary/15 bg-white/90 p-3 text-sm font-medium text-primary shadow-sm">{rankingMsg}</div>}

      <section className="relative mt-3 overflow-hidden rounded-[32px] border border-primary/10 bg-[linear-gradient(145deg,rgba(82,17,35,.12),rgba(216,165,72,.15))] p-2.5 shadow-[0_22px_55px_rgba(82,17,35,.16)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,.9),transparent_42%)] opacity-55" />
        <div className="relative grid grid-cols-8 gap-1.5 rounded-[25px] border border-white/90 bg-white/70 p-2 shadow-inner" aria-label="Tabuleiro da Missão do Altar">
          {tabuleiro.map((p, i) => (
            <button
              key={p?.id || i}
              type="button"
              disabled={!p || ocupado || movimentos <= 0 || fim}
              onClick={() => void escolher(i)}
              aria-label={p ? `${NOMES[p.tipo]}, posição ${i + 1}` : "Espaço vazio"}
              className={`relative aspect-square overflow-hidden rounded-[13px] border shadow-[0_5px_12px_rgba(82,17,35,.12)] transition active:scale-90 ${selecionada === i ? "z-10 border-amber-400 bg-amber-50 ring-2 ring-amber-300 [animation:altar-select_.8s_ease-in-out_infinite]" : "border-white/95 bg-gradient-to-br from-white to-[#fff8eb] hover:border-primary/20"}`}
              style={{ animation: explodindo.has(i) ? "altar-pop .22s ease-out forwards" : trocando.has(i) ? "altar-swap .16s ease-in-out" : caindo ? `altar-drop .24s cubic-bezier(.2,.8,.2,1) ${(i % 8) * .012}s both` : undefined }}
            >
              {p ? <PecaLiturgica tipo={p.tipo} /> : null}
              {selecionada === i && <span className="pointer-events-none absolute inset-1 rounded-lg border border-white/90" />}
            </button>
          ))}
        </div>
        {particulas.map((p, idx) => (
          <span key={p.id} className="pointer-events-none absolute z-30 block size-2.5 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(255,193,67,.95)]" style={{ left: `${p.left}%`, top: `${p.top}%`, animation: `altar-spark .58s ease-out ${p.delay}s forwards`, ["--dx" as string]: `${(idx % 2 ? 1 : -1) * (18 + (idx % 5) * 7)}px`, ["--dy" as string]: `${-18 - (idx % 7) * 7}px` }} />
        ))}
        {celebrando && <div className="pointer-events-none absolute inset-0 z-20 bg-[radial-gradient(circle,rgba(255,226,139,.55),transparent_62%)] [animation:altar-glow_.75s_ease-in-out]" />}
      </section>

      <div className="mt-2 flex flex-wrap justify-center gap-1.5">
        {tiposAtuais.map((tipo) => <span key={tipo} className="flex items-center gap-1 rounded-full border border-primary/10 bg-white/75 px-2 py-1 text-[9px] font-semibold text-muted-foreground"><span className="size-4"><PecaLiturgica tipo={tipo}/></span>{NOMES[tipo]}</span>)}
      </div>

      <div className="mt-3 rounded-2xl border border-white/70 bg-white/80 p-3 text-center text-sm leading-5 text-muted-foreground shadow-sm backdrop-blur-xl">{mensagem}</div>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <Button variant="outline" onClick={reiniciar}><RotateCcw className="size-4"/>Reiniciar</Button>
        <Button variant="outline" onClick={() => { const n = !som; setSom(n); localStorage.setItem(CHAVE_SOM, n ? "1" : "0") }}>{som ? <Volume2 className="size-4"/> : <VolumeX className="size-4"/>}{som ? "Som" : "Sem som"}</Button>
        <Button variant="outline" onClick={() => { const n = !vibrar; setVibrar(n); localStorage.setItem(CHAVE_VIBRAR, n ? "1" : "0") }}><Vibrate className="size-4"/>Vibração {vibrar ? "on" : "off"}</Button>
      </div>
      <div className="mt-4 flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground"><Trophy className="size-4"/>Recorde local: {recorde} <Sparkles className="size-4"/></div>

      {fim && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-[#271018]/75 p-4 backdrop-blur-md">
          <section className="w-full max-w-sm rounded-[32px] border border-white/60 bg-[#fffaf0] p-6 text-center shadow-2xl [animation:altar-celebrate_.7s_ease-out]">
            <span className="mx-auto flex size-16 items-center justify-center rounded-[22px] bg-primary text-3xl text-white shadow-lg">✝️</span>
            <p className="mt-4 text-[10px] font-black uppercase tracking-[.18em] text-primary">Missão registrada</p>
            <h2 className="mt-1 font-serif text-3xl font-semibold text-primary">Rodada concluída</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">Você alcançou o nível {nivel} com <strong className="text-primary">{pontosTotais} pontos de jogo</strong>. Na classificação, vale o bônus pelas fases concluídas, até 30 pontos por dia.</p>
            {rankingMsg && <p className="mt-3 rounded-2xl bg-white p-3 text-xs font-medium text-primary">{rankingMsg}</p>}
            <Button className="mt-5 w-full" onClick={reiniciar}><Sparkles className="size-4"/>Jogar novamente</Button>
          </section>
        </div>
      )}
    </div>
  )

  if (embedded) return conteudo

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#fff4d7_0%,#fffaf0_34%,#f7eee5_100%)]">
      <AreaHeader titulo="Missão do Altar" subtitulo="Jogo da Jornada Litúrgica" voltarHref={isMod ? "/area-restrita/moderador" : "/area-restrita/membro"} menu={isMod ? <ModeradorMenu /> : <MembroMenu />} />
      <main>{conteudo}</main>
    </div>
  )
}
