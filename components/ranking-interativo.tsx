"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { BookOpen, BrainCircuit, Clock3, Crown, Medal, Send, ShieldCheck, Sparkles, Trophy } from "lucide-react"
import { AreaHeader } from "@/components/area-header"
import { ModeradorMenu, MembroMenu } from "@/components/area-menu"
import { QuizCountdown } from "@/components/quiz-countdown"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const emojis = ["⏰", "😅", "🙏", "✝️", "💛"]

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

function letra(i: number) { return String.fromCharCode(65 + i) }
function tempo(segundos: number) { return `${String(Math.floor(segundos / 60)).padStart(2, "0")}:${String(segundos % 60).padStart(2, "0")}` }
function hojeCuiaba() { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Cuiaba" }).format(new Date()) }
function chaveLeituraHoje() { return `santa-luzia:liturgia-lida:${hojeCuiaba()}` }

function Posicao({ valor }: { valor: number }) {
  return (
    <span className={`flex h-11 min-w-11 items-center justify-center gap-1 rounded-xl px-2 font-bold ${valor <= 3 ? "bg-primary text-white" : "bg-secondary text-primary"}`}>
      {valor === 1 ? <Crown className="size-4" /> : valor <= 3 ? <Medal className="size-4" /> : null}
      <span>{valor}º</span>
    </span>
  )
}

export function RankingInterativo() {
  const [dados, setDados] = useState<any>(null)
  const [quizzes, setQuizzes] = useState<QuizPublico[]>([])
  const [quizAuto, setQuizAuto] = useState<QuizAuto | null>(null)
  const [autoConcluido, setAutoConcluido] = useState<any>(null)
  const [respostasAuto, setRespostasAuto] = useState<number[]>([])
  const [restante, setRestante] = useState(0)
  const [quizManual, setQuizManual] = useState<QuizPublico | null>(null)
  const [respostasManual, setRespostasManual] = useState<number[]>([])
  const [erro, setErro] = useState("")
  const [mensagem, setMensagem] = useState("")
  const [atrasoAlvo, setAtrasoAlvo] = useState("")
  const [dataMissa, setDataMissa] = useState("")
  const [horarioMissa, setHorarioMissa] = useState("18:00")
  const [leituraLiberada, setLeituraLiberada] = useState<boolean | null>(null)
  const tentativaAtiva = useRef(false)

  async function carregarDados() {
    try {
      const [r1, r2] = await Promise.all([
        fetch("/api/ranking", { cache: "no-store" }),
        fetch("/api/quizzes", { cache: "no-store" }),
      ])
      const j1 = await r1.json(), j2 = await r2.json()
      if (!r1.ok) throw new Error(j1.erro || "Erro ao carregar competição.")
      setDados(j1)
      setQuizzes(j2.quizzes || [])
      if (!atrasoAlvo && j1.membros?.length) setAtrasoAlvo(j1.membros[0].id)
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar.")
    }
  }

  async function carregarQuizAutomatico(aviso?: string) {
    tentativaAtiva.current = false
    setQuizAuto(null)
    setRespostasAuto([])
    setErro("")
    try {
      const r = await fetch("/api/quizzes/liturgia", { cache: "no-store" })
      const j = await r.json()
      if (!r.ok) throw new Error(j.erro || "Não foi possível gerar o quiz de hoje.")
      if (j.respondido) {
        setAutoConcluido(j.resultado)
        if (aviso) setMensagem(aviso)
        return
      }
      setAutoConcluido(null)
      setQuizAuto(j.quiz)
      setRespostasAuto(Array(j.quiz.perguntas.length).fill(-1))
      setRestante(j.quiz.duracaoSegundos)
      tentativaAtiva.current = true
      if (aviso) setMensagem(aviso)
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível gerar o quiz.")
    }
  }

  useEffect(() => {
    void carregarDados()
    try { setLeituraLiberada(localStorage.getItem(chaveLeituraHoje()) === "1") }
    catch { setLeituraLiberada(false) }
  }, [])

  useEffect(() => {
    if (leituraLiberada === true) void carregarQuizAutomatico()
  }, [leituraLiberada])

  useEffect(() => {
    if (!quizAuto) return
    const id = window.setInterval(() => {
      const segundos = Math.max(0, Math.ceil((quizAuto.expiraEm - Date.now()) / 1000))
      setRestante(segundos)
      if (segundos <= 0) {
        window.clearInterval(id)
        void carregarQuizAutomatico("O tempo terminou. Um novo quiz foi gerado automaticamente.")
      }
    }, 500)
    return () => window.clearInterval(id)
  }, [quizAuto?.token])

  useEffect(() => {
    const visibilidade = () => {
      if (leituraLiberada !== true) return
      if (document.visibilityState === "hidden" && tentativaAtiva.current) {
        tentativaAtiva.current = false
        setQuizAuto(null)
        setRespostasAuto([])
      } else if (document.visibilityState === "visible" && !tentativaAtiva.current && !autoConcluido) {
        void carregarQuizAutomatico("Você saiu do aplicativo durante a tentativa. Um novo quiz foi gerado.")
      }
    }
    document.addEventListener("visibilitychange", visibilidade)
    return () => document.removeEventListener("visibilitychange", visibilidade)
  }, [autoConcluido, leituraLiberada])

  async function responderAuto() {
    if (!quizAuto || respostasAuto.some((x) => x < 0)) return
    const r = await fetch("/api/quizzes/liturgia/responder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: quizAuto.token, respostas: respostasAuto }),
    })
    const j = await r.json()
    if (!r.ok) {
      setErro(j.erro || "Não foi possível enviar.")
      await carregarQuizAutomatico()
      return
    }
    tentativaAtiva.current = false
    setQuizAuto(null)
    setAutoConcluido(j.resultado)
    setMensagem(`Quiz concluído: ${j.resultado.acertos} acerto(s) e ${j.resultado.pontos} ponto(s).`)
    await carregarDados()
  }

  async function responderManual() {
    if (!quizManual || respostasManual.some((x) => x < 0)) return
    const r = await fetch(`/api/quizzes/${quizManual.id}/responder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ respostas: respostasManual }),
    })
    const j = await r.json()
    if (!r.ok) { setErro(j.erro || "Não foi possível enviar o quiz."); return }
    setMensagem(`Quiz avulso concluído: ${j.resultado.acertos}/${quizManual.perguntas.length} acertos.`)
    setQuizManual(null)
    await carregarDados()
  }

  async function acao(payload: Record<string, unknown>) {
    const r = await fetch("/api/ranking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const j = await r.json()
    if (!r.ok) { setErro(j.erro || "Não foi possível concluir."); return }
    setMensagem(j.mensagem || "Atualizado.")
    await carregarDados()
  }

  const ocorrencias = useMemo(() => (dados?.ocorrencias || []).filter((o: any) => o.status === "confirmado"), [dados])
  if (!dados) return <div className="min-h-screen p-8 text-center text-muted-foreground">Carregando competição…</div>
  const isMod = dados.eu.tipo === "moderador"

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#fff8e5_0%,#fff_42%,#faf7f1_100%)]">
      <AreaHeader titulo="Quiz Litúrgico" subtitulo="Leia a Liturgia e depois participe da competição" voltarHref={isMod ? "/area-restrita/moderador" : "/area-restrita/membro"} menu={isMod ? <ModeradorMenu /> : <MembroMenu />} />
      <main className="mx-auto max-w-6xl px-3 py-4 pb-24 sm:px-4 sm:py-8">
        <section className="mb-5 overflow-hidden rounded-3xl border border-white/70 bg-white/70 p-5 shadow-[0_18px_50px_rgba(82,49,25,.10)] backdrop-blur-2xl">
          <div className="flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-white shadow-lg"><BrainCircuit className="size-6" /></span>
            <div><h1 className="font-serif text-2xl font-semibold text-primary">Competição do Quiz</h1><p className="text-sm text-muted-foreground">O quiz diário usa a mesma Liturgia apresentada no aplicativo. A classificação mostra 1º, 2º, 3º e todas as demais posições.</p></div>
          </div>
        </section>

        {erro && <div className="mb-4 rounded-2xl border border-destructive/25 bg-white/80 p-3 text-sm text-destructive backdrop-blur-xl">{erro}</div>}
        {mensagem && <div className="mb-4 rounded-2xl border border-accent/40 bg-white/80 p-3 text-sm backdrop-blur-xl">{mensagem}</div>}

        <Tabs defaultValue="hoje">
          <TabsList className="grid w-full grid-cols-4 gap-1 rounded-2xl bg-white/70 p-1 shadow-sm backdrop-blur-2xl">
            <TabsTrigger value="hoje" className="min-h-12 flex-col text-[10px] sm:text-xs"><Sparkles className="size-4" />Hoje</TabsTrigger>
            <TabsTrigger value="competicao" className="min-h-12 flex-col text-[10px] sm:text-xs"><Trophy className="size-4" />Classificação</TabsTrigger>
            <TabsTrigger value="avulsos" className="min-h-12 flex-col text-[10px] sm:text-xs"><BrainCircuit className="size-4" />Avulsos</TabsTrigger>
            <TabsTrigger value="pontualidade" className="min-h-12 flex-col text-[10px] sm:text-xs"><Clock3 className="size-4" />Atrasos</TabsTrigger>
          </TabsList>

          <TabsContent value="hoje" className="mt-4">
            <section className="rounded-3xl border border-white/70 bg-white/75 p-4 shadow-xl backdrop-blur-2xl sm:p-6">
              {leituraLiberada === null ? (
                <div className="py-8 text-center text-muted-foreground">Verificando a leitura da Liturgia de hoje…</div>
              ) : leituraLiberada === false ? (
                <div className="py-8 text-center">
                  <BookOpen className="mx-auto size-12 text-primary" />
                  <h2 className="mt-3 font-serif text-2xl font-semibold text-primary">Primeiro, leia a Liturgia de hoje</h2>
                  <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">O quiz não aparece automaticamente no login. Leia as leituras e o Evangelho e, no final da Liturgia, toque em “Concluir leitura e ir ao Quiz”.</p>
                  <Button asChild className="mt-4"><Link href="/visitante#liturgia">Abrir Liturgia Diária</Link></Button>
                </div>
              ) : autoConcluido ? (
                <div className="py-8 text-center"><ShieldCheck className="mx-auto size-12 text-primary" /><h2 className="mt-3 font-serif text-2xl text-primary">Quiz de hoje concluído</h2><p className="mt-2 text-muted-foreground">Você marcou {autoConcluido.pontos} ponto(s) e {autoConcluido.acertos} acerto(s). Sua posição já foi atualizada na classificação.</p></div>
              ) : quizAuto ? (
                <>
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <div><h2 className="font-serif text-xl font-semibold text-primary">{quizAuto.titulo}</h2><p className="text-sm text-muted-foreground">{quizAuto.descricao}</p></div>
                    <QuizCountdown restante={restante} duracao={quizAuto.duracaoSegundos} texto={tempo(restante)} />
                  </div>
                  <div className="space-y-5">
                    {quizAuto.perguntas.map((p, i) => (
                      <fieldset key={p.id}>
                        <legend className="mb-2 font-semibold text-foreground">{i + 1}. {p.enunciado}</legend>
                        <div className="grid gap-2">
                          {p.opcoes.map((op, j) => (
                            <button type="button" key={j} onClick={() => setRespostasAuto((old) => old.map((v, k) => k === i ? j : v))} className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${respostasAuto[i] === j ? "border-primary bg-primary/10 ring-2 ring-primary/15" : "border-border bg-white/80 hover:border-primary/35"}`}>
                              <span className={`flex size-8 shrink-0 items-center justify-center rounded-xl font-bold ${respostasAuto[i] === j ? "bg-primary text-white" : "bg-secondary text-primary"}`}>{letra(j)}</span><span className="text-sm">{op}</span>
                            </button>
                          ))}
                        </div>
                      </fieldset>
                    ))}
                  </div>
                  <Button className="mt-5 w-full sm:w-auto" disabled={respostasAuto.some((x) => x < 0)} onClick={responderAuto}>Enviar respostas</Button>
                  <p className="mt-3 text-xs text-muted-foreground">Se você sair do aplicativo, trocar de aplicativo ou ocultar a tela durante a tentativa, esta rodada é descartada e novas perguntas são geradas.</p>
                </>
              ) : <div className="py-8 text-center text-muted-foreground">Gerando perguntas e respostas da Liturgia de hoje…</div>}
            </section>
          </TabsContent>

          <TabsContent value="competicao" className="mt-4 space-y-2">
            {(dados.ranking || []).length === 0 && <div className="rounded-2xl bg-white/75 p-5 text-muted-foreground">A classificação aparecerá assim que os participantes responderem o Quiz da Liturgia.</div>}
            {(dados.ranking || []).map((l: any) => (
              <div key={l.usuarioId} className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/75 p-3 shadow-sm backdrop-blur-xl">
                <Posicao valor={l.posicao} />
                <div className="min-w-0 flex-1"><p className="truncate font-semibold">{l.nome}</p><p className="text-xs text-muted-foreground">{l.funcao || "Participante"} · {l.quizzesRespondidos} quiz(es) · {l.acertos} acerto(s) · {l.aproveitamento}%</p></div>
                <strong className="text-lg text-primary">{l.pontos} pts</strong>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="avulsos" className="mt-4 space-y-3">
            {isMod && <Link href="/area-restrita/moderador/ranking" className="block rounded-2xl border border-accent/40 bg-white/75 p-4 font-semibold text-primary shadow-sm backdrop-blur-xl">Gerenciar quizzes avulsos →</Link>}
            {quizzes.length === 0 && <div className="rounded-2xl bg-white/75 p-5 text-muted-foreground backdrop-blur-xl">Nenhum quiz avulso publicado.</div>}
            {quizzes.map((q) => <div key={q.id} className="rounded-2xl border border-white/70 bg-white/75 p-4 shadow-sm backdrop-blur-xl"><h3 className="font-serif text-lg font-semibold text-primary">{q.titulo}</h3><p className="mt-1 text-sm text-muted-foreground">{q.descricao}</p><Button className="mt-3" disabled={q.respondido} onClick={() => { setQuizManual(q); setRespostasManual(Array(q.perguntas.length).fill(-1)) }}>{q.respondido ? "Já respondido" : "Responder"}</Button></div>)}
            {quizManual && <section className="rounded-3xl border border-accent/40 bg-white/90 p-4 shadow-xl backdrop-blur-2xl"><h3 className="font-serif text-xl font-semibold text-primary">{quizManual.titulo}</h3><div className="mt-4 space-y-5">{quizManual.perguntas.map((p, i) => <fieldset key={p.id}><legend className="mb-2 font-semibold">{i + 1}. {p.enunciado}</legend><div className="grid gap-2">{p.opcoes.map((op, j) => <button type="button" key={j} onClick={() => setRespostasManual((old) => old.map((v, k) => k === i ? j : v))} className={`flex items-center gap-3 rounded-xl border p-3 text-left ${respostasManual[i] === j ? "border-primary bg-primary/5" : "border-border"}`}><b>{letra(j)}</b>{op}</button>)}</div></fieldset>)}</div><div className="mt-4 flex gap-2"><Button disabled={respostasManual.some((x) => x < 0)} onClick={responderManual}>Enviar</Button><Button variant="outline" onClick={() => setQuizManual(null)}>Fechar</Button></div></section>}
          </TabsContent>

          <TabsContent value="pontualidade" className="mt-4 space-y-4">
            {!isMod && <section className="rounded-3xl border border-white/70 bg-white/75 p-4 shadow-sm backdrop-blur-xl"><h2 className="font-serif text-xl font-semibold text-primary">Reportar atraso</h2><p className="mt-1 text-sm text-muted-foreground">O relato só aparece para o grupo depois da confirmação de um moderador.</p><div className="mt-3 grid gap-2 sm:grid-cols-3"><select value={atrasoAlvo} onChange={(e) => setAtrasoAlvo(e.target.value)} className="h-11 rounded-xl border border-border bg-white px-3"><option value="">Perfil</option>{dados.membros.map((m: any) => <option key={m.id} value={m.id}>{m.nome}</option>)}</select><input type="date" value={dataMissa} onChange={(e) => setDataMissa(e.target.value)} className="h-11 rounded-xl border border-border px-3" /><input type="time" value={horarioMissa} onChange={(e) => setHorarioMissa(e.target.value)} className="h-11 rounded-xl border border-border px-3" /></div><Button className="mt-3 gap-2" disabled={!atrasoAlvo || !dataMissa} onClick={() => acao({ action: "reportar_atraso", usuarioId: atrasoAlvo, dataMissa, horarioMissa })}><Send className="size-4" />Enviar para moderação</Button></section>}
            {ocorrencias.map((o: any) => { const rs = (dados.reacoes || []).filter((r: any) => r.ocorrencia_id === o.id); return <div key={o.id} className="rounded-2xl border border-amber-200/70 bg-white/75 p-4 backdrop-blur-xl"><p className="font-medium"><span className="text-primary">{o.usuario_nome}</span> teve um atraso confirmado em {String(o.data_missa).split("-").reverse().join("/")}.</p><div className="mt-2 flex flex-wrap gap-1.5">{emojis.map((e) => <button key={e} onClick={() => acao({ action: "reagir", ocorrenciaId: o.id, emoji: e })} className="rounded-full border bg-white px-2.5 py-1">{e} {rs.filter((r: any) => r.emoji === e).length || ""}</button>)}</div></div> })}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
