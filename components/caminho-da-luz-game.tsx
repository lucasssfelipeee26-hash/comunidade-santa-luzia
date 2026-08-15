"use client"

import { useEffect, useState } from "react"
import { CloudOff, RotateCcw, Sparkles, Trophy, Volume2, VolumeX, Vibrate } from "lucide-react"
import { AreaHeader } from "@/components/area-header"
import { ModeradorMenu, MembroMenu } from "@/components/area-menu"
import { Button } from "@/components/ui/button"

const TAMANHO = 8
const SIMBOLOS = ["✝️", "🕯️", "🏆", "📖", "🌿", "🕊️", "🔥", "⭐"] as const
const NOMES = ["Cruz", "Vela", "Cálice", "Missal", "Naveta", "Paz", "Turíbulo", "Alfaia"]
const FASES = [
  { nome: "Entrada", chamada: "Prepare o coração", icone: "✝️" },
  { nome: "Palavra", chamada: "Escute e anuncie", icone: "📖" },
  { nome: "Ofertório", chamada: "Entregue seus dons", icone: "🌿" },
  { nome: "Eucaristia", chamada: "Permaneça na presença", icone: "🏆" },
  { nome: "Envio", chamada: "Leve a luz adiante", icone: "🕊️" },
] as const

type Peca = { id: string; tipo: number }
type Celula = Peca | null
type Pendente = { score: number; level: number; mode: string; salvoEm: number }

const CHAVE_ESTADO = "santa-luzia:caminho-da-luz:estado:v2"
const CHAVE_SOM = "santa-luzia:caminho-da-luz:som"
const CHAVE_VIBRAR = "santa-luzia:caminho-da-luz:vibrar"
const CHAVE_PENDENTE = "santa-luzia:caminho-da-luz:resultado-pendente"
const CHAVE_RECORDE = "santa-luzia:caminho-da-luz:recorde"

function id() { return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }
function novaPeca() { return { id: id(), tipo: Math.floor(Math.random() * SIMBOLOS.length) } }
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
  while (encontrarMatches(tab).length && tentativas++ < 40) tab = tab.map(() => novaPeca())
  return tab
}

function metaDaFase(nivel: number) { return 650 + Math.max(0, nivel - 1) * 240 }
function movimentosDaFase(nivel: number) { return Math.max(18, 28 - Math.floor((nivel - 1) / 2)) }
function descricaoFase(nivel: number) {
  if (nivel <= FASES.length) return FASES[nivel - 1]
  return { nome: `Jornada ${nivel}`, chamada: "Continue servindo e avançando", icone: "⭐" }
}
function modoDaFase(nivel: number) { return nivel <= 5 ? `Fase ${nivel} de 5 · ${FASES[nivel - 1].nome}` : `Jornada infinita · Nível ${nivel}` }

function tocarSom(tipo: "match" | "combo" | "erro" | "fase", ativo: boolean) {
  if (!ativo || typeof window === "undefined") return
  try {
    const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const notas = tipo === "erro" ? [150, 110] : tipo === "fase" ? [520, 660, 820] : tipo === "combo" ? [440, 560, 700] : [420, 560]
    notas.forEach((freq, i) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      const inicio = ctx.currentTime + i * 0.055
      osc.frequency.setValueAtTime(freq, inicio)
      gain.gain.setValueAtTime(tipo === "fase" ? 0.055 : 0.04, inicio)
      gain.gain.exponentialRampToValueAtTime(0.001, inicio + 0.12)
      osc.start(inicio); osc.stop(inicio + 0.13)
    })
    setTimeout(() => void ctx.close(), 500)
  } catch {}
}

export function CaminhoDaLuzGame({ tipoUsuario, embedded = false }: { tipoUsuario: "moderador" | "membro"; embedded?: boolean }) {
  const [tabuleiro, setTabuleiro] = useState<Celula[]>(() => tabuleiroInicial())
  const [selecionada, setSelecionada] = useState<number | null>(null)
  const [pontosFase, setPontosFase] = useState(0)
  const [pontosTotais, setPontosTotais] = useState(0)
  const [nivel, setNivel] = useState(1)
  const [movimentos, setMovimentos] = useState(movimentosDaFase(1))
  const [combo, setCombo] = useState(0)
  const [mensagem, setMensagem] = useState("Combine 3 ou mais símbolos litúrgicos para avançar na Missão do Altar.")
  const [som, setSom] = useState(true)
  const [vibrar, setVibrar] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [offline, setOffline] = useState(false)
  const [rankingMsg, setRankingMsg] = useState("")
  const [recorde, setRecorde] = useState(0)
  const [fim, setFim] = useState(false)

  const meta = metaDaFase(nivel)
  const fase = descricaoFase(nivel)
  const modo = modoDaFase(nivel)
  const progresso = Math.min(100, Math.round((pontosFase / meta) * 100))

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
    const ok = await enviarResultado(p.score, p.level, p.mode)
    if (ok) try { localStorage.removeItem(CHAVE_PENDENTE) } catch {}
  }

  async function enviarResultado(finalScore: number, level: number, mode: string) {
    try {
      const r = await fetch("/api/jogo/caminho-da-luz/resultado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score: finalScore, level, mode }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.erro || "Não foi possível enviar a pontuação.")
      setRankingMsg(j.jaContabilizado ? `Seu melhor bônus de hoje continua em ${j.pontosRanking} ponto(s) na classificação.` : `+${j.pontosRanking} ponto(s) enviados para a classificação.`)
      return true
    } catch {
      setRankingMsg("Resultado salvo neste celular. Ele será enviado para a classificação quando a internet voltar.")
      return false
    }
  }

  function vibracao(ms = 25) { if (vibrar && navigator.vibrate) navigator.vibrate(ms) }

  async function resolverCascata(tab: Celula[]) {
    let atual = tab, rodada = 0, ganhoTotal = 0
    while (true) {
      const matches = encontrarMatches(atual)
      if (!matches.length) break
      rodada++
      ganhoTotal += matches.length * 20 * rodada
      const removido = [...atual]
      matches.forEach((i) => { removido[i] = null })
      setTabuleiro(removido)
      await new Promise((r) => setTimeout(r, 110))
      atual = cair(removido)
      setTabuleiro(atual)
      await new Promise((r) => setTimeout(r, 135))
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

    const pendente = { score: scoreFinal, level: nivel, mode: `Missão do Altar · ${modo}`, salvoEm: Date.now() }
    if (navigator.onLine) {
      const ok = await enviarResultado(scoreFinal, nivel, pendente.mode)
      if (!ok) try { localStorage.setItem(CHAVE_PENDENTE, JSON.stringify(pendente)) } catch {}
    } else {
      try { localStorage.setItem(CHAVE_PENDENTE, JSON.stringify(pendente)) } catch {}
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
    const trocado = trocar(tabuleiro, origem, indice)
    setTabuleiro(trocado)
    if (!encontrarMatches(trocado).length) {
      tocarSom("erro", som); vibracao(70)
      await new Promise((r) => setTimeout(r, 130))
      setTabuleiro(tabuleiro)
      setMensagem("Essa troca não forma uma combinação. Procure símbolos vizinhos que fechem uma sequência.")
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
    setMensagem(resolvido.cascatas > 1 ? `Combo x${resolvido.cascatas}! Continue avançando na missão.` : "Boa combinação! Continue a missão.")

    if (novoFase >= meta) {
      tocarSom("fase", som); vibracao(100)
      const concluido = nivel
      const proximo = nivel + 1
      setMensagem(concluido < 5 ? `${FASES[concluido - 1].nome} concluída. Próxima etapa: ${FASES[concluido].nome}.` : concluido === 5 ? "As cinco etapas foram concluídas. A Jornada Infinita começou!" : `Nível ${concluido} concluído!`)
      await new Promise((r) => setTimeout(r, 650))
      setNivel(proximo)
      setPontosFase(0)
      setMovimentos(movimentosDaFase(proximo))
      setTabuleiro(tabuleiroInicial())
      setCombo(0)
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
    setTabuleiro(tabuleiroInicial())
    setSelecionada(null)
    setPontosFase(0)
    setPontosTotais(0)
    setNivel(1)
    setMovimentos(movimentosDaFase(1))
    setCombo(0)
    setMensagem("Nova missão iniciada. Combine 3 ou mais símbolos litúrgicos.")
    setRankingMsg("")
    setFim(false)
    setOcupado(false)
    try { localStorage.removeItem(CHAVE_ESTADO) } catch {}
  }

  const isMod = tipoUsuario === "moderador"
  const conteudo = (
    <div className={embedded ? "mx-auto max-w-xl" : "mx-auto max-w-xl px-3 py-4 pb-24 sm:px-4"}>
      <section className="relative overflow-hidden rounded-[30px] border border-primary/15 bg-white/85 p-4 shadow-[0_24px_70px_rgba(82,17,35,.14)] backdrop-blur-2xl">
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
          <div className="rounded-2xl border border-primary/10 bg-secondary/65 p-2.5"><p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Pontos</p><p className="mt-0.5 text-lg font-black text-primary">{pontosTotais}</p></div>
          <div className="rounded-2xl border border-primary/10 bg-secondary/65 p-2.5"><p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Movimentos</p><p className="mt-0.5 text-lg font-black text-primary">{movimentos}</p></div>
          <div className="rounded-2xl border border-primary/10 bg-secondary/65 p-2.5"><p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Combo</p><p className="mt-0.5 text-lg font-black text-primary">x{Math.max(1, combo + 1)}</p></div>
        </div>

        <div className="relative mt-4">
          <div className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground"><span>Progresso da etapa</span><span>{pontosFase}/{meta}</span></div>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-gradient-to-r from-primary to-amber-500 transition-all duration-300" style={{ width: `${progresso}%` }} /></div>
          <div className="mt-3 grid grid-cols-5 gap-1.5">
            {FASES.map((item, i) => {
              const etapa = i + 1
              const ativa = nivel === etapa
              const concluida = nivel > etapa
              return <div key={item.nome} title={item.nome} className={`h-1.5 rounded-full transition ${concluida ? "bg-amber-500" : ativa ? "bg-primary" : "bg-secondary"}`} />
            })}
          </div>
        </div>
      </section>

      {offline && <div className="mt-3 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50/95 p-3 text-xs text-amber-950"><CloudOff className="size-4 shrink-0"/>A missão continua funcionando sem internet. O resultado será sincronizado depois.</div>}
      {rankingMsg && <div className="mt-3 rounded-2xl border border-primary/15 bg-white/85 p-3 text-sm text-primary shadow-sm">{rankingMsg}</div>}

      <section className="mt-3 rounded-[30px] border border-primary/10 bg-[linear-gradient(145deg,rgba(82,17,35,.09),rgba(185,138,57,.08))] p-2.5 shadow-[0_22px_55px_rgba(82,17,35,.13)]">
        <div className="grid grid-cols-8 gap-1.5 rounded-[24px] border border-white/80 bg-white/70 p-2 shadow-inner" aria-label="Tabuleiro da Missão do Altar">
          {tabuleiro.map((p, i) => (
            <button
              key={p?.id || i}
              type="button"
              disabled={!p || ocupado || movimentos <= 0 || fim}
              onClick={() => void escolher(i)}
              aria-label={p ? `${NOMES[p.tipo]}, posição ${i + 1}` : "Espaço vazio"}
              className={`aspect-square rounded-xl border text-[clamp(1rem,5.2vw,1.75rem)] shadow-[0_4px_10px_rgba(82,17,35,.08)] transition duration-150 active:scale-90 ${selecionada === i ? "z-10 scale-110 border-primary bg-primary/10 ring-2 ring-primary/25" : "border-white/90 bg-white/95 hover:border-primary/20"}`}
            >
              {p ? SIMBOLOS[p.tipo] : ""}
            </button>
          ))}
        </div>
      </section>

      <div className="mt-3 rounded-2xl border border-white/70 bg-white/75 p-3 text-center text-sm leading-5 text-muted-foreground shadow-sm backdrop-blur-xl">{mensagem}</div>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <Button variant="outline" onClick={reiniciar}><RotateCcw className="size-4"/>Reiniciar</Button>
        <Button variant="outline" onClick={() => { const n = !som; setSom(n); localStorage.setItem(CHAVE_SOM, n ? "1" : "0") }}>{som ? <Volume2 className="size-4"/> : <VolumeX className="size-4"/>}{som ? "Som" : "Sem som"}</Button>
        <Button variant="outline" onClick={() => { const n = !vibrar; setVibrar(n); localStorage.setItem(CHAVE_VIBRAR, n ? "1" : "0") }}><Vibrate className="size-4"/>Vibração {vibrar ? "on" : "off"}</Button>
      </div>
      <div className="mt-4 flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground"><Trophy className="size-4"/>Recorde local: {recorde} <Sparkles className="size-4"/></div>

      {fim && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-[#271018]/75 p-4 backdrop-blur-md">
          <section className="w-full max-w-sm rounded-[32px] border border-white/60 bg-[#fffaf0] p-6 text-center shadow-2xl">
            <span className="mx-auto flex size-16 items-center justify-center rounded-[22px] bg-primary text-3xl text-white shadow-lg">✝️</span>
            <p className="mt-4 text-[10px] font-black uppercase tracking-[.18em] text-primary">Missão registrada</p>
            <h2 className="mt-1 font-serif text-3xl font-semibold text-primary">Rodada concluída</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">Você alcançou o nível {nivel} com <strong className="text-primary">{pontosTotais} pontos</strong>. Seu melhor resultado do dia será considerado na classificação.</p>
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
