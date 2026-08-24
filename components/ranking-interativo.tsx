"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { BookOpen, BrainCircuit, CloudOff, Crown, Gamepad2, Medal, ShieldCheck, Sparkles, Trophy } from "lucide-react"
import { AreaHeader } from "@/components/area-header"
import { ModeradorMenu, MembroMenu } from "@/components/area-menu"
import { CaminhoDaLuzEntry } from "@/components/caminho-da-luz-entry"
import { QuizCountdown } from "@/components/quiz-countdown"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { carregarCacheRanking, salvarCacheRanking } from "@/lib/offline-data"

type QuizPublico = {
  id: string
  titulo: string
  descricao: string
  respondido?: boolean
  perguntas: { id: string; enunciado: string; opcoes: string[]; pontos: number }[]
}

type QuizAuto = {
  token: string
  titulo: string
  descricao: string
  expiraEm: number
  duracaoSegundos: number
  perguntas: { id: string; enunciado: string; opcoes: string[]; pontos: number }[]
}

type RankingLinha = {
  posicao: number
  usuarioId: string
  nome: string
  funcao?: string | null
  foto?: string | null
  pontos: number
  quizzesRespondidos: number
  acertos: number
  aproveitamento: number
}

type DadosRanking = {
  eu: { id: string; nome: string; tipo: "moderador" | "membro" }
  ranking: RankingLinha[]
  [key: string]: unknown
}

function letra(i: number) { return String.fromCharCode(65 + i) }
function tempo(segundos: number) { return `${String(Math.floor(segundos / 60)).padStart(2, "0")}:${String(segundos % 60).padStart(2, "0")}` }
function hojeCuiaba() { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Cuiaba" }).format(new Date()) }
function chaveLeituraHoje() { return `santa-luzia:liturgia-lida:${hojeCuiaba()}` }
function iniciais(nome: string) { return nome.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() }

function Posicao({ valor }: { valor: number }) {
  return <span className={`flex h-9 min-w-9 items-center justify-center gap-1 rounded-xl px-2 text-xs font-bold ${valor <= 3 ? "bg-primary/10 text-primary" : "bg-secondary text-primary"}`}>{valor === 1 ? <Crown className="size-3.5" /> : valor <= 3 ? <Medal className="size-3.5" /> : null}<span>{valor}º</span></span>
}

function Podio({ linha, destaque }: { linha: RankingLinha; destaque?: boolean }) {
  return (
    <div className={`relative min-w-0 rounded-[22px] border bg-white p-3 text-center shadow-sm ${destaque ? "border-[#c8ad69]/60 sm:-translate-y-2" : "border-border"}`}>
      <span className={`absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full px-2 py-0.5 text-[9px] font-black ${linha.posicao === 1 ? "bg-[#bfa66a] text-[#342b20]" : "bg-primary/10 text-primary"}`}>{linha.posicao}º</span>
      <Avatar className={`${destaque ? "size-16" : "size-13"} mx-auto mt-1 border-2 border-white shadow-md`}><AvatarImage src={linha.foto || undefined} /><AvatarFallback className="bg-primary/8 text-xs font-bold text-primary">{iniciais(linha.nome)}</AvatarFallback></Avatar>
      <p className="mt-2 truncate font-serif text-sm font-semibold text-foreground">{linha.nome}</p>
      <p className="truncate text-[9px] text-muted-foreground">{linha.funcao || "Participante"}</p>
      <p className="mt-1 text-lg font-black text-primary">{linha.pontos}</p><p className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground">pontos</p>
    </div>
  )
}

export function RankingInterativo({ usuarioInicial }: { usuarioInicial: DadosRanking["eu"] }) {
  const [dados, setDados] = useState<DadosRanking>({ eu: usuarioInicial, ranking: [] })
  const [quizzes, setQuizzes] = useState<QuizPublico[]>([])
  const [quizAuto, setQuizAuto] = useState<QuizAuto | null>(null)
  const [autoConcluido, setAutoConcluido] = useState<any>(null)
  const [respostasAuto, setRespostasAuto] = useState<number[]>([])
  const [restante, setRestante] = useState(0)
  const [quizManual, setQuizManual] = useState<QuizPublico | null>(null)
  const [respostasManual, setRespostasManual] = useState<number[]>([])
  const [erro, setErro] = useState("")
  const [mensagem, setMensagem] = useState("")
  const [leituraLiberada, setLeituraLiberada] = useState<boolean | null>(null)
  const [dadosOffline, setDadosOffline] = useState(false)
  const [abaAtiva, setAbaAtiva] = useState("hoje")
  const tentativaAtiva = useRef(false)

  async function carregarDados() {
    setErro("")
    try {
      const r1 = await fetch("/api/ranking", { cache: "no-store", signal: AbortSignal.timeout(8_000) })
      const j1 = await r1.json()
      if (!r1.ok) throw new Error(j1.erro || "Erro ao carregar a Jornada Litúrgica.")
      setDados(j1); salvarCacheRanking(j1); setDadosOffline(false)
    } catch (e) {
      const cache = carregarCacheRanking<DadosRanking>()
      if (cache?.dados?.eu) { setDados(cache.dados); setDadosOffline(true) }
      else {
        try {
          const auth = await fetch("/api/auth/me", { cache: "no-store", signal: AbortSignal.timeout(5_000) }).then((response) => response.json())
          const usuario = auth?.sessao?.usuario
          if (usuario?.id) { setDados({ eu: { id: usuario.id, nome: usuario.nome, tipo: auth.sessao.tipo }, ranking: [] }); setErro("A classificação está sendo sincronizada, mas o Quiz continua disponível.") }
          else setErro(e instanceof Error ? e.message : "Erro ao carregar.")
        } catch { setErro(e instanceof Error ? e.message : "Erro ao carregar.") }
      }
    }
    try {
      const r2 = await fetch("/api/quizzes", { cache: "no-store", signal: AbortSignal.timeout(8_000) })
      const j2 = await r2.json()
      if (r2.ok) setQuizzes(j2.quizzes || [])
    } catch {}
  }

  async function carregarQuizAutomatico(aviso?: string) {
    tentativaAtiva.current = false; setQuizAuto(null); setRespostasAuto([]); setErro("")
    try {
      const r = await fetch("/api/quizzes/liturgia", { cache: "no-store", signal: AbortSignal.timeout(8_000) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.erro || "Não foi possível gerar o quiz de hoje.")
      if (j.respondido) { setAutoConcluido(j.resultado); if (aviso) setMensagem(aviso); return }
      setAutoConcluido(null); setQuizAuto(j.quiz); setRespostasAuto(Array(j.quiz.perguntas.length).fill(-1)); setRestante(j.quiz.duracaoSegundos); tentativaAtiva.current = true; if (aviso) setMensagem(aviso)
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível gerar o quiz.") }
  }

  useEffect(() => {
    void carregarDados()
    try {
      setLeituraLiberada(localStorage.getItem(chaveLeituraHoje()) === "1")
      const aba = new URLSearchParams(window.location.search).get("aba")
      if (aba === "missao" || aba === "classificacao" || aba === "avulsos" || aba === "hoje") setAbaAtiva(aba)
    } catch { setLeituraLiberada(false) }
  }, [])

  useEffect(() => { const atualizar = () => void carregarDados(); window.addEventListener("santa-luzia:server-sync", atualizar); return () => window.removeEventListener("santa-luzia:server-sync", atualizar) }, [])
  useEffect(() => { if (leituraLiberada === true) void carregarQuizAutomatico() }, [leituraLiberada])

  useEffect(() => {
    if (!quizAuto) return
    const timer = window.setInterval(() => {
      const segundos = Math.max(0, Math.ceil((quizAuto.expiraEm - Date.now()) / 1000)); setRestante(segundos)
      if (segundos <= 0) { window.clearInterval(timer); void carregarQuizAutomatico("O tempo terminou. Um novo quiz foi gerado automaticamente.") }
    }, 500)
    return () => window.clearInterval(timer)
  }, [quizAuto?.token])

  useEffect(() => {
    const visibilidade = () => {
      if (leituraLiberada !== true) return
      if (document.visibilityState === "hidden" && tentativaAtiva.current) { tentativaAtiva.current = false; setQuizAuto(null); setRespostasAuto([]) }
      else if (document.visibilityState === "visible" && !tentativaAtiva.current && !autoConcluido) void carregarQuizAutomatico("Você saiu do aplicativo durante a tentativa. Um novo quiz foi gerado.")
    }
    document.addEventListener("visibilitychange", visibilidade)
    return () => document.removeEventListener("visibilitychange", visibilidade)
  }, [autoConcluido, leituraLiberada])

  async function responderAuto() {
    if (!quizAuto || respostasAuto.some((x) => x < 0)) return
    const r = await fetch("/api/quizzes/liturgia/responder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: quizAuto.token, respostas: respostasAuto }) })
    const j = await r.json()
    if (!r.ok) { setErro(j.erro || "Não foi possível enviar."); await carregarQuizAutomatico(); return }
    tentativaAtiva.current = false; setQuizAuto(null); setAutoConcluido(j.resultado); setMensagem(`Quiz concluído: ${j.resultado.acertos} acerto(s) e ${j.resultado.pontos} ponto(s).`); await carregarDados()
  }

  async function responderManual() {
    if (!quizManual || respostasManual.some((x) => x < 0)) return
    const r = await fetch(`/api/quizzes/${quizManual.id}/responder`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ respostas: respostasManual }) })
    const j = await r.json()
    if (!r.ok) { setErro(j.erro || "Não foi possível enviar o quiz."); return }
    if (j.queued || j.resultado?.offline_pendente) {
      const quizId = quizManual.id
      setMensagem("Respostas salvas no aparelho. O resultado será calculado quando a internet voltar.")
      setQuizzes((atuais) => atuais.map((q) => q.id === quizId ? { ...q, respondido: true } : q))
      setQuizManual(null)
      return
    }
    setMensagem(`Quiz avulso concluído: ${j.resultado.acertos}/${quizManual.perguntas.length} acertos.`); setQuizManual(null); await carregarDados()
  }

  const isMod = dados.eu.tipo === "moderador"
  const ranking = dados.ranking || []
  const euRanking = ranking.find((l) => l.usuarioId === dados.eu.id)
  const top3 = ranking.slice(0, 3)
  const restantes = ranking.slice(3)

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#faf7f5_0%,#f6f2ef_100%)]">
      <AreaHeader titulo="Jornada Litúrgica" subtitulo="Quiz, Joias da Luz e classificação" voltarHref={isMod ? "/area-restrita/moderador" : "/area-restrita/membro"} menu={isMod ? <ModeradorMenu /> : <MembroMenu />} />
      <main className="mx-auto max-w-6xl px-3 py-4 pb-24 sm:px-4 sm:py-6">
        <section className="mb-3 rounded-[24px] border border-border bg-white/80 p-4 shadow-[0_12px_32px_rgba(79,36,49,.07)]"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-primary text-white"><Sparkles className="size-5" /></span><div className="min-w-0"><h1 className="font-serif text-xl font-semibold text-primary">Jornada Litúrgica</h1><p className="truncate text-[11px] text-muted-foreground">Aprenda, jogue e acompanhe sua evolução com a equipe.</p></div></div></section>

        {erro && <div className="mb-3 rounded-xl border border-destructive/20 bg-white p-2.5 text-xs text-destructive">{erro}</div>}
        {mensagem && <div className="mb-3 rounded-xl border border-primary/10 bg-white p-2.5 text-xs text-foreground">{mensagem}</div>}
        {dadosOffline && <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-950"><CloudOff className="size-4 shrink-0" />Mostrando os últimos dados salvos neste aparelho.</div>}

        <Tabs value={abaAtiva} onValueChange={setAbaAtiva}>
          <TabsList className="grid h-auto w-full grid-cols-4 gap-1 rounded-2xl bg-white/80 p-1 shadow-sm">
            <TabsTrigger value="hoje" className="min-h-11 flex-col gap-0.5 text-[8px] sm:text-[11px]"><BrainCircuit className="size-4" />Quiz</TabsTrigger>
            <TabsTrigger value="missao" className="min-h-11 flex-col gap-0.5 text-[8px] sm:text-[11px]"><Gamepad2 className="size-4" />Joias</TabsTrigger>
            <TabsTrigger value="classificacao" className="min-h-11 flex-col gap-0.5 text-[8px] sm:text-[11px]"><Trophy className="size-4" />Ranking</TabsTrigger>
            <TabsTrigger value="avulsos" className="min-h-11 flex-col gap-0.5 text-[8px] sm:text-[11px]"><Sparkles className="size-4" />Avulsos</TabsTrigger>
          </TabsList>

          <TabsContent value="hoje" className="mt-3">
            <section className="rounded-[24px] border border-border bg-white/85 p-4 shadow-sm sm:p-5">
              {leituraLiberada === null ? <div className="py-8 text-center text-sm text-muted-foreground">Verificando a leitura da Liturgia…</div> : leituraLiberada === false ? <div className="py-7 text-center"><BookOpen className="mx-auto size-10 text-primary" /><h2 className="mt-2 font-serif text-xl font-semibold text-primary">Leia a Liturgia de hoje</h2><p className="mx-auto mt-2 max-w-xl text-xs leading-5 text-muted-foreground">Ao concluir a leitura, o Quiz Litúrgico é liberado.</p><Button asChild size="sm" className="mt-3"><Link href="/visitante#liturgia">Abrir Liturgia Diária</Link></Button></div> : autoConcluido ? <div className="py-7 text-center"><ShieldCheck className="mx-auto size-10 text-primary" /><h2 className="mt-2 font-serif text-xl text-primary">Quiz de hoje concluído</h2><p className="mt-2 text-xs text-muted-foreground">{autoConcluido.pontos} ponto(s) · {autoConcluido.acertos} acerto(s). A classificação já foi atualizada.</p></div> : quizAuto ? <><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="font-serif text-lg font-semibold text-primary">{quizAuto.titulo}</h2><p className="text-xs text-muted-foreground">{quizAuto.descricao}</p></div><QuizCountdown restante={restante} duracao={quizAuto.duracaoSegundos} texto={tempo(restante)} /></div><div className="space-y-4">{quizAuto.perguntas.map((p, i) => <fieldset key={p.id}><legend className="mb-2 text-sm font-semibold text-foreground">{i + 1}. {p.enunciado}</legend><div className="grid gap-1.5">{p.opcoes.map((op, j) => <button type="button" key={j} onClick={() => setRespostasAuto((old) => old.map((v, k) => k === i ? j : v))} className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition ${respostasAuto[i] === j ? "border-primary/35 bg-primary/[.045]" : "border-border bg-white"}`}><span className={`flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${respostasAuto[i] === j ? "bg-primary text-white" : "bg-secondary text-primary"}`}>{letra(j)}</span><span className="text-xs">{op}</span></button>)}</div></fieldset>)}</div><Button size="sm" className="mt-4" disabled={respostasAuto.some((x) => x < 0)} onClick={responderAuto}>Enviar respostas</Button><p className="mt-2 text-[10px] text-muted-foreground">Se a tentativa for ocultada ou o aplicativo for trocado, um novo quiz será gerado.</p></> : <div className="py-8 text-center text-sm text-muted-foreground">Gerando perguntas da Liturgia…</div>}
            </section>
          </TabsContent>

          <TabsContent value="missao" className="mt-3"><CaminhoDaLuzEntry tipoUsuario={dados.eu.tipo} embedded /></TabsContent>

          <TabsContent value="classificacao" className="mt-3">
            {euRanking && <div className="mb-3 flex items-center gap-3 rounded-[20px] border border-primary/15 bg-primary/[.035] p-3"><Posicao valor={euRanking.posicao} /><div className="min-w-0 flex-1"><p className="text-[9px] font-bold uppercase tracking-[.12em] text-primary">Sua posição</p><p className="truncate text-sm font-semibold text-foreground">{euRanking.nome}</p></div><div className="text-right"><strong className="text-lg text-primary">{euRanking.pontos}</strong><p className="text-[8px] uppercase text-muted-foreground">pontos</p></div></div>}

            {ranking.length === 0 ? <div className="rounded-2xl bg-white p-5 text-sm text-muted-foreground">A classificação aparecerá quando os participantes começarem a pontuar.</div> : <>
              <section className="rounded-[24px] border border-border bg-white/70 p-3 shadow-sm"><div className="mb-4 flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-[.16em] text-primary">Destaques</p><h2 className="font-serif text-xl font-semibold text-foreground">Pódio da equipe</h2></div><Trophy className="size-5 text-[#9c8452]" /></div><div className="grid grid-cols-3 items-end gap-2">{top3.map((linha) => <Podio key={linha.usuarioId} linha={linha} destaque={linha.posicao === 1} />)}</div></section>
              <div className="mt-3 space-y-1.5">{restantes.map((l) => <div key={l.usuarioId} className={`flex items-center gap-2.5 rounded-2xl border p-2.5 shadow-sm ${l.usuarioId === dados.eu.id ? "border-primary/25 bg-primary/[.03]" : "border-border bg-white/85"}`}><Posicao valor={l.posicao} /><Avatar className="size-9 shrink-0"><AvatarImage src={l.foto || undefined} /><AvatarFallback className="bg-primary/8 text-[9px] font-bold text-primary">{iniciais(l.nome)}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{l.nome}</p><p className="truncate text-[9px] text-muted-foreground">{l.funcao || "Participante"} · {l.quizzesRespondidos} quiz(es) · {l.aproveitamento}%</p></div><div className="shrink-0 text-right"><strong className="text-base text-primary">{l.pontos}</strong><p className="text-[8px] text-muted-foreground">pts</p></div></div>)}</div>
              <p className="mt-3 rounded-xl bg-white/70 p-2.5 text-[10px] leading-4 text-muted-foreground">A classificação soma Quiz Litúrgico, atividades válidas e o melhor bônus diário conquistado em Joias da Luz.</p>
            </>}
          </TabsContent>

          <TabsContent value="avulsos" className="mt-3 space-y-2">
            {isMod && <Link href="/area-restrita/moderador/ranking" className="block rounded-xl border border-primary/15 bg-white p-3 text-xs font-semibold text-primary">Gerenciar quizzes avulsos →</Link>}
            {quizzes.length === 0 && <div className="rounded-xl bg-white p-4 text-xs text-muted-foreground">Nenhum quiz avulso publicado.</div>}
            {quizzes.map((q) => <div key={q.id} className="rounded-2xl border border-border bg-white p-3 shadow-sm"><h3 className="font-serif text-base font-semibold text-primary">{q.titulo}</h3><p className="mt-1 text-xs text-muted-foreground">{q.descricao}</p><Button size="sm" className="mt-2" disabled={q.respondido} onClick={() => { setQuizManual(q); setRespostasManual(Array(q.perguntas.length).fill(-1)) }}>{q.respondido ? "Já respondido" : "Responder"}</Button></div>)}
            {quizManual && <section className="rounded-2xl border border-primary/20 bg-white p-4 shadow-lg"><h3 className="font-serif text-lg font-semibold text-primary">{quizManual.titulo}</h3><div className="mt-3 space-y-4">{quizManual.perguntas.map((p, i) => <fieldset key={p.id}><legend className="mb-2 text-sm font-semibold">{i + 1}. {p.enunciado}</legend><div className="grid gap-1.5">{p.opcoes.map((op, j) => <button type="button" key={j} onClick={() => setRespostasManual((old) => old.map((v, k) => k === i ? j : v))} className={`flex items-center gap-2 rounded-xl border p-2.5 text-left text-xs ${respostasManual[i] === j ? "border-primary/35 bg-primary/[.04]" : "border-border"}`}><b>{letra(j)}</b>{op}</button>)}</div></fieldset>)}</div><div className="mt-3 flex gap-2"><Button size="sm" disabled={respostasManual.some((x) => x < 0)} onClick={responderManual}>Enviar</Button><Button size="sm" variant="outline" onClick={() => setQuizManual(null)}>Fechar</Button></div></section>}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
