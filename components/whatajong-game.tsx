"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Clock3, Coins, Gem, Lightbulb, RotateCcw, Shuffle, Sparkles, Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"

type Dificuldade = "facil" | "medio" | "dificil"
type Etapa = "intro" | "jogo" | "vitoria" | "derrota" | "fim"
type Poderes = { dica: number; embaralhar: number; tempo: number }
type Posicao = { row: number; col: number; layer: number }
type Grupo = "bambu" | "circulo" | "numero" | "honra" | "especial"
type Peca = Posicao & { id: string; face: string; nome: string; grupo: Grupo; removida: boolean }
type Movimento = [string, string]
type EstadoSalvo = {
  data: string
  dificuldade: Dificuldade
  rodada: number
  pontosTotais: number
  moedas: number
  poderes: Poderes
}
type Pendente = { score: number; completedRound: number; difficulty: Dificuldade; salvoEm: number }

type Simbolo = { face: string; nome: string; grupo: Grupo }

const CHAVE_ESTADO = "santa-luzia:whatajong:estado:v2"
const CHAVE_PENDENTE = "santa-luzia:whatajong:resultado-pendente:v2"
const TOTAL_RODADAS = 24

const SIMBOLOS: Simbolo[] = [
  { face: "一", nome: "Um", grupo: "numero" }, { face: "二", nome: "Dois", grupo: "numero" },
  { face: "三", nome: "Três", grupo: "numero" }, { face: "四", nome: "Quatro", grupo: "numero" },
  { face: "五", nome: "Cinco", grupo: "numero" }, { face: "六", nome: "Seis", grupo: "numero" },
  { face: "●", nome: "Círculo", grupo: "circulo" }, { face: "◎", nome: "Duplo círculo", grupo: "circulo" },
  { face: "竹", nome: "Bambu", grupo: "bambu" }, { face: "林", nome: "Bosque", grupo: "bambu" },
  { face: "東", nome: "Vento Leste", grupo: "honra" }, { face: "南", nome: "Vento Sul", grupo: "honra" },
  { face: "西", nome: "Vento Oeste", grupo: "honra" }, { face: "北", nome: "Vento Norte", grupo: "honra" },
  { face: "中", nome: "Dragão Vermelho", grupo: "honra" }, { face: "發", nome: "Dragão Verde", grupo: "honra" },
  { face: "白", nome: "Dragão Branco", grupo: "honra" }, { face: "✦", nome: "Estrela", grupo: "especial" },
  { face: "✿", nome: "Flor", grupo: "especial" }, { face: "◆", nome: "Gema", grupo: "especial" },
  { face: "☯", nome: "Taijitu", grupo: "especial" }, { face: "♛", nome: "Coroa", grupo: "especial" },
]

function hojeCuiaba() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Cuiaba" }).format(new Date())
}

function embaralhar<T>(entrada: T[]) {
  const lista = [...entrada]
  for (let i = lista.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[lista[i], lista[j]] = [lista[j]!, lista[i]!]
  }
  return lista
}

function posicoesTabuleiro(rodada: number): Posicao[] {
  const posicoes: Posicao[] = []
  for (let row = 0; row < 5; row++) for (let col = 0; col < 6; col++) posicoes.push({ row, col, layer: 0 })
  for (let row = 1; row <= 3; row++) for (let col = 1; col <= 4; col++) posicoes.push({ row, col, layer: 1 })
  posicoes.push({ row: 2, col: 2, layer: 2 }, { row: 2, col: 3, layer: 2 })
  const quantidade = rodada <= 2 ? 28 : rodada <= 5 ? 36 : 44
  return posicoes.slice(0, quantidade)
}

function gerarPecas(rodada: number): Peca[] {
  const posicoes = posicoesTabuleiro(rodada)
  const totalPares = posicoes.length / 2
  const parGarantido = SIMBOLOS[rodada % SIMBOLOS.length]!
  const outrosPares = Array.from({ length: totalPares - 1 }, (_, i) => SIMBOLOS[(i + rodada + 1) % SIMBOLOS.length]!)
  const restantes = embaralhar(outrosPares.flatMap((simbolo) => [simbolo, simbolo]))
  let cursor = 0
  return posicoes.map((pos, indice) => {
    const simbolo = indice === 0 || indice === 5 ? parGarantido : restantes[cursor++]!
    return {
      ...pos,
      id: `r${rodada}-${indice}-${Math.random().toString(36).slice(2, 8)}`,
      face: simbolo.face,
      nome: simbolo.nome,
      grupo: simbolo.grupo,
      removida: false,
    }
  })
}

function estaLivre(peca: Peca, pecas: Peca[]) {
  if (peca.removida) return false
  const ativas = pecas.filter((p) => !p.removida)
  const coberta = ativas.some((p) => p.layer > peca.layer && p.row === peca.row && p.col === peca.col)
  if (coberta) return false
  const esquerda = ativas.some((p) => p.layer === peca.layer && p.row === peca.row && p.col === peca.col - 1)
  const direita = ativas.some((p) => p.layer === peca.layer && p.row === peca.row && p.col === peca.col + 1)
  return !esquerda || !direita
}

function movimentosDisponiveis(pecas: Peca[]): Movimento[] {
  const livres = pecas.filter((p) => estaLivre(p, pecas))
  const movimentos: Movimento[] = []
  for (let i = 0; i < livres.length; i++) {
    for (let j = i + 1; j < livres.length; j++) {
      if (livres[i]!.face === livres[j]!.face) movimentos.push([livres[i]!.id, livres[j]!.id])
    }
  }
  return movimentos
}

function metaRodada(rodada: number, dificuldade: Dificuldade) {
  const multiplicador = dificuldade === "facil" ? 1 : dificuldade === "medio" ? 1.12 : 1.24
  return Math.round((180 + rodada * 12) * multiplicador)
}

function tempoRodada(rodada: number, dificuldade: Dificuldade) {
  const base = dificuldade === "facil" ? 150 : dificuldade === "medio" ? 125 : 105
  return Math.max(65, base - Math.floor(rodada * 1.5))
}

function nomeDificuldade(dificuldade: Dificuldade) {
  if (dificuldade === "facil") return "Passeio tranquilo"
  if (dificuldade === "medio") return "Águas agitadas"
  return "Contra o redemoinho"
}

function classeGrupo(grupo: Grupo) {
  if (grupo === "bambu") return "text-emerald-700"
  if (grupo === "circulo") return "text-sky-700"
  if (grupo === "honra") return "text-rose-700"
  if (grupo === "especial") return "text-amber-700"
  return "text-slate-800"
}

export function WhatajongGame({ tipoUsuario }: { tipoUsuario: "moderador" | "membro" }) {
  const [etapa, setEtapa] = useState<Etapa>("intro")
  const [dificuldade, setDificuldade] = useState<Dificuldade>("facil")
  const [rodada, setRodada] = useState(1)
  const [pecas, setPecas] = useState<Peca[]>([])
  const [selecionada, setSelecionada] = useState<string | null>(null)
  const [sumindo, setSumindo] = useState<string[]>([])
  const [destaque, setDestaque] = useState<string[]>([])
  const [pontosRodada, setPontosRodada] = useState(0)
  const [pontosTotais, setPontosTotais] = useState(0)
  const [moedas, setMoedas] = useState(0)
  const [poderes, setPoderes] = useState<Poderes>({ dica: 1, embaralhar: 1, tempo: 1 })
  const [combo, setCombo] = useState(0)
  const [tempoRestante, setTempoRestante] = useState(0)
  const [mensagem, setMensagem] = useState("")
  const [sincronizacao, setSincronizacao] = useState("")
  const ultimoParEm = useRef(0)
  const bloqueio = useRef(false)

  const meta = useMemo(() => metaRodada(rodada, dificuldade), [rodada, dificuldade])
  const restantes = useMemo(() => pecas.filter((p) => !p.removida).length, [pecas])
  const movimentos = useMemo(() => movimentosDisponiveis(pecas), [pecas])

  function salvarEstado(novo?: Partial<EstadoSalvo>) {
    try {
      const estado: EstadoSalvo = { data: hojeCuiaba(), dificuldade, rodada, pontosTotais, moedas, poderes, ...novo }
      localStorage.setItem(CHAVE_ESTADO, JSON.stringify(estado))
    } catch {}
  }

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
      setSincronizacao(j.jaContabilizado
        ? `Melhor bônus de hoje: ${j.pontosTotalDia}/${j.limiteDiario} pontos.`
        : `Rodada sincronizada: +${j.pontosAdicionados} ponto(s) no ranking.`)
      try { window.dispatchEvent(new Event("santa-luzia:server-sync")) } catch {}
      return true
    } catch {
      setSincronizacao("Resultado salvo no aparelho. A sincronização será feita quando a internet voltar.")
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

  function prepararRodada(numero: number, dif = dificuldade) {
    setRodada(numero)
    setPecas(gerarPecas(numero))
    setSelecionada(null)
    setSumindo([])
    setDestaque([])
    setPontosRodada(0)
    setCombo(0)
    setTempoRestante(tempoRodada(numero, dif))
    setMensagem(`Rodada ${numero}: encontre pares livres e alcance ${metaRodada(numero, dif)} pontos.`)
    setEtapa("jogo")
  }

  function iniciarAventura(dif: Dificuldade) {
    setDificuldade(dif)
    setPontosTotais(0)
    setMoedas(0)
    setPoderes({ dica: 1, embaralhar: 1, tempo: 1 })
    try { localStorage.removeItem(CHAVE_ESTADO) } catch {}
    prepararRodada(1, dif)
  }

  useEffect(() => {
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE_ESTADO) || "null") as EstadoSalvo | null
      if (salvo?.data === hojeCuiaba() && salvo.rodada >= 1 && salvo.rodada <= TOTAL_RODADAS) {
        const poderesSalvos = salvo.poderes || { dica: 1, embaralhar: 1, tempo: 1 }
        setDificuldade(salvo.dificuldade)
        setRodada(salvo.rodada)
        setPontosTotais(salvo.pontosTotais || 0)
        setMoedas(salvo.moedas || 0)
        setPoderes(poderesSalvos)
        setPecas(gerarPecas(salvo.rodada))
        setPontosRodada(0)
        setCombo(0)
        setTempoRestante(tempoRodada(salvo.rodada, salvo.dificuldade))
        setMensagem(`Aventura retomada na rodada ${salvo.rodada}.`)
        setEtapa("jogo")
      }
    } catch {}
    const online = () => void sincronizarPendente()
    window.addEventListener("online", online)
    void sincronizarPendente()
    return () => window.removeEventListener("online", online)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (etapa !== "jogo") return
    const timer = window.setInterval(() => {
      setTempoRestante((atual) => {
        if (atual <= 1) {
          window.clearInterval(timer)
          setEtapa("derrota")
          setMensagem("O tempo terminou. Tente novamente esta rodada.")
          return 0
        }
        return atual - 1
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [etapa, rodada])

  useEffect(() => {
    if (etapa !== "jogo" || restantes === 0 || pecas.length === 0 || bloqueio.current || movimentos.length > 0) return
    const timer = window.setTimeout(() => {
      setMensagem("Não havia pares livres. O tabuleiro foi reorganizado automaticamente.")
      embaralharTabuleiro(false)
    }, 350)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movimentos.length, restantes, etapa])

  function embaralharTabuleiro(consumir = true) {
    if (consumir && poderes.embaralhar <= 0) {
      setMensagem("Você não tem Embaralhar. Compre outro na loja entre as rodadas.")
      return
    }
    const ativas = pecas.filter((p) => !p.removida)
    const rostos = embaralhar(ativas.map((p) => ({ face: p.face, nome: p.nome, grupo: p.grupo })))
    setPecas((atuais) => atuais.map((p) => {
      if (p.removida) return p
      const indice = ativas.findIndex((a) => a.id === p.id)
      return { ...p, ...rostos[indice]! }
    }))
    if (consumir) setPoderes((p) => ({ ...p, embaralhar: p.embaralhar - 1 }))
    setSelecionada(null)
    setCombo(0)
  }

  function usarDica() {
    if (poderes.dica <= 0) { setMensagem("Você não tem Dicas. Compre outra na loja."); return }
    const jogada = movimentos[0]
    if (!jogada) { setMensagem("Nenhum par livre encontrado. Use Embaralhar."); return }
    setPoderes((p) => ({ ...p, dica: p.dica - 1 }))
    setDestaque(jogada)
    setMensagem("Dica: estas duas peças formam um par livre.")
    window.setTimeout(() => setDestaque([]), 1400)
  }

  function usarTempo() {
    if (poderes.tempo <= 0) { setMensagem("Você não tem bônus de tempo. Compre outro na loja."); return }
    setPoderes((p) => ({ ...p, tempo: p.tempo - 1 }))
    setTempoRestante((t) => t + 25)
    setMensagem("+25 segundos adicionados ao relógio.")
  }

  function concluirRodada(scoreDaRodada: number, totalCalculado: number, moedasUltimoPar: number) {
    bloqueio.current = false
    if (scoreDaRodada < meta) {
      setEtapa("derrota")
      setMensagem(`Tabuleiro limpo, mas faltaram ${meta - scoreDaRodada} pontos para a meta.`)
      return
    }

    const renda = 4 + Math.floor(Math.sqrt(rodada))
    const novasMoedas = moedas + moedasUltimoPar + renda
    setMoedas(novasMoedas)
    setPontosTotais(totalCalculado)

    const pendente: Pendente = { score: totalCalculado, completedRound: rodada, difficulty: dificuldade, salvoEm: Date.now() }
    try { localStorage.setItem(CHAVE_PENDENTE, JSON.stringify(pendente)) } catch {}
    if (navigator.onLine) void enviarResultado(pendente)

    if (rodada >= TOTAL_RODADAS) {
      setEtapa("fim")
      try { localStorage.removeItem(CHAVE_ESTADO) } catch {}
      return
    }

    salvarEstado({ rodada: rodada + 1, pontosTotais: totalCalculado, moedas: novasMoedas })
    setEtapa("vitoria")
    setMensagem(`Vitória! Rodada ${rodada} concluída. Você recebeu ${renda} moedas.`)
  }

  function selecionarPeca(id: string) {
    if (bloqueio.current || etapa !== "jogo") return
    const peca = pecas.find((p) => p.id === id)
    if (!peca || peca.removida) return
    if (!estaLivre(peca, pecas)) { setMensagem("Essa peça está bloqueada. Libere um dos lados e a parte superior primeiro."); return }

    if (!selecionada) {
      setSelecionada(id)
      setMensagem(`${peca.nome} selecionado. Agora escolha uma peça igual.`)
      return
    }
    if (selecionada === id) { setSelecionada(null); return }

    const primeira = pecas.find((p) => p.id === selecionada)
    if (!primeira || primeira.face !== peca.face) {
      setSelecionada(id)
      setCombo(0)
      setMensagem("As peças não combinam. A nova peça ficou selecionada.")
      return
    }

    bloqueio.current = true
    const agora = Date.now()
    const novoCombo = agora - ultimoParEm.current <= 3200 ? combo + 1 : 1
    ultimoParEm.current = agora
    setCombo(novoCombo)
    const bonusCombo = Math.min(40, Math.max(0, novoCombo - 1) * 5)
    const bonusEspecial = primeira.grupo === "especial" ? 10 : 0
    const ganho = 20 + bonusCombo + bonusEspecial
    const ganhoMoedas = primeira.grupo === "honra" ? 2 : 1
    const proximoScore = pontosRodada + ganho
    const totalSeConcluir = pontosTotais + proximoScore
    setPontosRodada(proximoScore)
    setMoedas((m) => m + ganhoMoedas)
    setSumindo([primeira.id, peca.id])
    setSelecionada(null)
    setMensagem(novoCombo >= 2 ? `Combo x${novoCombo}! +${ganho} pontos.` : `Par perfeito! +${ganho} pontos.`)

    window.setTimeout(() => {
      const novaLista = pecas.map((p) => (p.id === primeira.id || p.id === peca.id ? { ...p, removida: true } : p))
      setPecas(novaLista)
      setSumindo([])
      if (!novaLista.some((p) => !p.removida)) concluirRodada(proximoScore, totalSeConcluir, ganhoMoedas)
      else bloqueio.current = false
    }, 260)
  }

  function comprar(tipo: keyof Poderes, preco: number) {
    if (moedas < preco) { setMensagem("Moedas insuficientes para esta compra."); return }
    setMoedas((m) => m - preco)
    setPoderes((p) => ({ ...p, [tipo]: p[tipo] + 1 }))
    setMensagem("Compra realizada.")
  }

  function proximaRodada() {
    const proxima = rodada + 1
    salvarEstado({ rodada: proxima })
    prepararRodada(proxima)
  }

  const seletorDificuldade = (
    <div className="grid gap-2 sm:grid-cols-3">
      {([
        ["facil", "Passeio tranquilo", "Mais tempo e metas suaves."],
        ["medio", "Águas agitadas", "Metas maiores e menos tempo."],
        ["dificil", "Contra o redemoinho", "Para quem quer desafio máximo."],
      ] as const).map(([valor, titulo, descricao]) => (
        <button key={valor} type="button" onClick={() => iniciarAventura(valor)} className="rounded-2xl border border-white/25 bg-white/10 p-3 text-left text-white shadow-sm backdrop-blur transition active:scale-[.98]">
          <strong className="block text-sm">{titulo}</strong><span className="mt-1 block text-[10px] leading-4 text-white/75">{descricao}</span>
        </button>
      ))}
    </div>
  )

  if (etapa === "intro") {
    return <section className="overflow-hidden rounded-[28px] border border-[#d8c68c]/35 bg-[radial-gradient(circle_at_top,#244e46_0%,#15372f_42%,#102922_100%)] p-4 text-white shadow-[0_18px_45px_rgba(17,54,47,.24)] sm:p-6">
      <div className="mx-auto max-w-2xl text-center"><span className="mx-auto flex size-16 items-center justify-center rounded-[22px] border border-white/20 bg-white/10 shadow-lg"><Gem className="size-8 text-[#f5d77f]" /></span><p className="mt-3 text-[9px] font-black uppercase tracking-[.2em] text-[#f5d77f]">Mahjong de aventura</p><h2 className="mt-1 font-serif text-3xl font-semibold">Whatajong</h2><p className="mx-auto mt-2 max-w-xl text-xs leading-5 text-white/75">Atravesse 24 rodadas de Mahjong Solitaire. Combine pares livres, faça combos, ganhe moedas, compre poderes e avance no ranking da Jornada Litúrgica.</p></div>
      <div className="mt-5">{seletorDificuldade}</div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[9px] text-white/70"><div className="rounded-xl bg-black/10 p-2"><Sparkles className="mx-auto mb-1 size-4 text-[#f5d77f]" />Combos e efeitos</div><div className="rounded-xl bg-black/10 p-2"><Coins className="mx-auto mb-1 size-4 text-[#f5d77f]" />Moedas e loja</div><div className="rounded-xl bg-black/10 p-2"><Trophy className="mx-auto mb-1 size-4 text-[#f5d77f]" />Pontos no ranking</div></div>
      <p className="mt-4 text-center text-[9px] text-white/45">Versão em português integrada ao Santa Luzia · Whatajong, licença MIT.</p>
    </section>
  }

  if (etapa === "vitoria") {
    return <section className="overflow-hidden rounded-[28px] border border-[#d8c68c]/35 bg-[linear-gradient(145deg,#173d35,#102b25)] p-4 text-white shadow-xl sm:p-6">
      <div className="text-center"><Trophy className="mx-auto size-12 text-[#f5d77f]" /><p className="mt-2 text-[9px] font-black uppercase tracking-[.18em] text-[#f5d77f]">Rodada concluída</p><h2 className="font-serif text-3xl">Vitória!</h2><p className="mt-2 text-xs text-white/70">{mensagem}</p></div>
      <div className="mt-4 grid grid-cols-3 gap-2"><div className="rounded-2xl bg-white/10 p-3 text-center"><p className="text-[9px] text-white/55">Pontos totais</p><strong className="text-xl">{pontosTotais}</strong></div><div className="rounded-2xl bg-white/10 p-3 text-center"><p className="text-[9px] text-white/55">Moedas</p><strong className="text-xl">{moedas}</strong></div><div className="rounded-2xl bg-white/10 p-3 text-center"><p className="text-[9px] text-white/55">Próxima</p><strong className="text-xl">{rodada + 1}</strong></div></div>
      <div className="mt-4 rounded-2xl border border-white/15 bg-black/10 p-3"><div className="mb-2 flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-[.15em] text-[#f5d77f]">Loja</p><h3 className="text-sm font-semibold">Prepare a próxima rodada</h3></div><Coins className="size-5 text-[#f5d77f]" /></div><div className="grid gap-2 sm:grid-cols-3"><button type="button" onClick={() => comprar("dica", 3)} className="rounded-xl bg-white/10 p-2.5 text-left text-xs"><b>Dica +1</b><span className="block text-[9px] text-white/60">3 moedas</span></button><button type="button" onClick={() => comprar("embaralhar", 4)} className="rounded-xl bg-white/10 p-2.5 text-left text-xs"><b>Embaralhar +1</b><span className="block text-[9px] text-white/60">4 moedas</span></button><button type="button" onClick={() => comprar("tempo", 4)} className="rounded-xl bg-white/10 p-2.5 text-left text-xs"><b>Tempo +1</b><span className="block text-[9px] text-white/60">4 moedas</span></button></div></div>
      {sincronizacao && <p className="mt-3 rounded-xl bg-white/10 p-2 text-center text-[10px] text-white/70">{sincronizacao}</p>}
      <Button className="mt-4 min-h-12 w-full rounded-2xl bg-[#f1d27c] text-[#17372f] hover:bg-[#f1d27c]/90" onClick={proximaRodada}>Jogar rodada {rodada + 1}</Button>
    </section>
  }

  if (etapa === "derrota") {
    return <section className="rounded-[28px] border border-rose-200 bg-white p-5 text-center shadow-lg"><RotateCcw className="mx-auto size-11 text-primary" /><p className="mt-2 text-[9px] font-black uppercase tracking-[.16em] text-primary">Rodada {rodada}</p><h2 className="font-serif text-2xl font-semibold text-foreground">Tente novamente</h2><p className="mx-auto mt-2 max-w-md text-xs leading-5 text-muted-foreground">{mensagem}</p><div className="mt-4 grid grid-cols-2 gap-2"><Button onClick={() => prepararRodada(rodada)}>Repetir rodada</Button><Button variant="outline" onClick={() => setEtapa("intro")}>Nova aventura</Button></div></section>
  }

  if (etapa === "fim") {
    return <section className="relative overflow-hidden rounded-[28px] border border-[#d8c68c]/40 bg-[radial-gradient(circle_at_top,#315f52,#15372f_60%)] p-6 text-center text-white shadow-xl"><div className="whatajong-confetti" aria-hidden="true">{Array.from({ length: 22 }, (_, i) => <span key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 7) * .09}s` }} />)}</div><Trophy className="mx-auto size-14 text-[#f5d77f]" /><p className="mt-3 text-[9px] font-black uppercase tracking-[.2em] text-[#f5d77f]">Aventura concluída</p><h2 className="font-serif text-3xl">Parabéns!</h2><p className="mt-2 text-xs text-white/70">Você completou as 24 rodadas de Whatajong.</p><p className="mt-4 text-4xl font-black text-[#f5d77f]">{pontosTotais}</p><p className="text-[9px] uppercase tracking-widest text-white/50">pontos totais</p>{sincronizacao && <p className="mt-3 text-[10px] text-white/65">{sincronizacao}</p>}<Button className="mt-5 bg-[#f1d27c] text-[#17372f]" onClick={() => setEtapa("intro")}>Nova aventura</Button></section>
  }

  return <section className="overflow-hidden rounded-[28px] border border-[#d8c68c]/35 bg-[linear-gradient(180deg,#173d35_0%,#102a24_100%)] text-white shadow-[0_18px_45px_rgba(17,54,47,.24)]">
    <style>{`@keyframes whatajong-pop{0%{transform:scale(1);opacity:1}60%{transform:scale(1.25) rotate(5deg);opacity:.75}100%{transform:scale(.2) rotate(14deg);opacity:0}}@keyframes whatajong-hint{0%,100%{filter:brightness(1)}50%{filter:brightness(1.5);transform:translateY(-4px)}}@keyframes whatajong-fall{0%{transform:translateY(-20px) rotate(0);opacity:0}15%{opacity:1}100%{transform:translateY(260px) rotate(360deg);opacity:0}}.whatajong-confetti{position:absolute;inset:0;pointer-events:none;overflow:hidden}.whatajong-confetti span{position:absolute;top:0;width:7px;height:12px;border-radius:2px;background:#f5d77f;animation:whatajong-fall 1.5s ease-in forwards}`}</style>
    <div className="border-b border-white/10 bg-black/10 p-3"><div className="flex items-center justify-between gap-2"><div><p className="text-[8px] font-black uppercase tracking-[.16em] text-[#f5d77f]">Whatajong · {nomeDificuldade(dificuldade)}</p><h2 className="font-serif text-xl">Rodada {rodada}/{TOTAL_RODADAS}</h2></div><div className="flex items-center gap-2 rounded-xl bg-white/10 px-2.5 py-1.5"><Coins className="size-4 text-[#f5d77f]" /><b className="text-sm">{moedas}</b></div></div><div className="mt-2 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-white/[.07] p-2"><p className="text-[8px] text-white/50">PONTOS</p><strong className="text-base">{pontosRodada}</strong><span className="text-[9px] text-white/50">/{meta}</span></div><div className="rounded-xl bg-white/[.07] p-2"><p className="text-[8px] text-white/50">TEMPO</p><strong className={tempoRestante <= 20 ? "text-base text-rose-300" : "text-base"}>{tempoRestante}s</strong></div><div className="rounded-xl bg-white/[.07] p-2"><p className="text-[8px] text-white/50">MOVIMENTOS</p><strong className="text-base">{movimentos.length}</strong></div></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/20"><div className="h-full rounded-full bg-[#f1d27c] transition-all duration-300" style={{ width: `${Math.min(100, (pontosRodada / meta) * 100)}%` }} /></div></div>

    <div className="relative mx-auto mt-3 aspect-[6/5.6] w-[min(100%,620px)] px-2">
      {pecas.map((peca) => {
        if (peca.removida) return null
        const livre = estaLivre(peca, pecas)
        const ativa = selecionada === peca.id
        const piscando = destaque.includes(peca.id)
        const removendo = sumindo.includes(peca.id)
        return <button key={peca.id} type="button" onClick={() => selecionarPeca(peca.id)} aria-label={`${peca.nome}${livre ? ", livre" : ", bloqueada"}`} className={`absolute aspect-[4/5] w-[13.8%] select-none rounded-[10px] border text-center shadow-[0_5px_0_#bcae8b,0_8px_14px_rgba(0,0,0,.22)] transition duration-150 ${livre ? "border-[#f4e8c4] bg-[linear-gradient(145deg,#fffdf4,#efe6cd)]" : "border-[#c9c0a8] bg-[linear-gradient(145deg,#ddd7c6,#bfb8a5)] opacity-70"} ${ativa ? "-translate-y-1 ring-4 ring-[#f5d77f]/70" : ""}`} style={{ left: `${2.5 + peca.col * 15.5 + peca.layer * .7}%`, top: `${3 + peca.row * 17 + peca.layer * 1.3}%`, zIndex: 10 + peca.layer * 10 + peca.row, animation: removendo ? "whatajong-pop .26s ease-out forwards" : piscando ? "whatajong-hint .7s ease-in-out 2" : undefined }}><span className={`block text-[clamp(15px,5vw,28px)] font-black leading-none ${classeGrupo(peca.grupo)}`}>{peca.face}</span><span className="mt-1 block truncate px-1 text-[5px] font-bold uppercase tracking-tight text-slate-500 sm:text-[7px]">{peca.grupo}</span></button>
      })}
      {combo >= 2 && <div className="pointer-events-none absolute left-1/2 top-1 z-[80] -translate-x-1/2 rounded-full border border-[#f5d77f]/40 bg-[#102922]/90 px-3 py-1 text-xs font-black text-[#f5d77f] shadow-lg">COMBO x{combo}</div>}
    </div>

    <div className="border-t border-white/10 bg-black/10 p-3"><p className="min-h-5 text-center text-[10px] text-white/65">{mensagem}</p><div className="mt-2 grid grid-cols-3 gap-2"><button type="button" onClick={usarDica} className="flex min-h-12 flex-col items-center justify-center rounded-xl bg-white/10 text-[9px] font-bold active:scale-95"><Lightbulb className="mb-0.5 size-4 text-[#f5d77f]" />Dica · {poderes.dica}</button><button type="button" onClick={() => embaralharTabuleiro(true)} className="flex min-h-12 flex-col items-center justify-center rounded-xl bg-white/10 text-[9px] font-bold active:scale-95"><Shuffle className="mb-0.5 size-4 text-[#f5d77f]" />Embaralhar · {poderes.embaralhar}</button><button type="button" onClick={usarTempo} className="flex min-h-12 flex-col items-center justify-center rounded-xl bg-white/10 text-[9px] font-bold active:scale-95"><Clock3 className="mb-0.5 size-4 text-[#f5d77f]" />+25 s · {poderes.tempo}</button></div><div className="mt-2 flex items-center justify-between text-[8px] text-white/35"><span>{tipoUsuario === "moderador" ? "Modo moderador" : "Jornada Litúrgica"}</span><span>Pares livres: sem peça no topo + um lado aberto</span></div></div>
  </section>
}
