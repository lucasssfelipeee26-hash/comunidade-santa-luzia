"use client"

import { useEffect, useMemo, useState } from "react"
import { Award, BellRing, CheckCircle2, Clock3, Crown, HeartHandshake, Medal, Send, Sparkles, Trophy } from "lucide-react"
import { AreaHeader } from "@/components/area-header"
import { ModeradorMenu, MembroMenu } from "@/components/area-menu"
import { AndroidNotificationSettings } from "@/components/android-notification-settings"
import { emitAppFeedback } from "@/lib/sound-preferences"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const categorias = [
  ["companheirismo", "Companheirismo"],
  ["acolhimento", "Acolhimento e simpatia"],
  ["espirito_servico", "Espírito de serviço"],
  ["disponibilidade", "Disponibilidade"],
] as const
const emojis = ["⏰", "😅", "🙏", "✝️", "💛"]

type RankingData = any

type QuizPublico = {
  id: string; titulo: string; descricao: string; origem: string; data_referencia?: string | null; respondido?: boolean
  perguntas: { id: string; enunciado: string; opcoes: string[]; pontos: number }[]
}

function medalha(pos: number) {
  if (pos === 1) return <Crown className="size-5 text-[#b98b22]" />
  if (pos <= 3) return <Medal className="size-5 text-primary" />
  return <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-bold">{pos}</span>
}

export function RankingInterativo() {
  const [dados, setDados] = useState<RankingData | null>(null)
  const [quizzes, setQuizzes] = useState<QuizPublico[]>([])
  const [erro, setErro] = useState("")
  const [mensagem, setMensagem] = useState("")
  const [alvo, setAlvo] = useState("")
  const [categoria, setCategoria] = useState("companheirismo")
  const [atrasoAlvo, setAtrasoAlvo] = useState("")
  const [dataMissa, setDataMissa] = useState("")
  const [horarioMissa, setHorarioMissa] = useState("18:00")
  const [quizAberto, setQuizAberto] = useState<QuizPublico | null>(null)
  const [respostas, setRespostas] = useState<number[]>([])
  const [resultadoQuiz, setResultadoQuiz] = useState<any>(null)

  async function carregar() {
    setErro("")
    try {
      const [r1, r2] = await Promise.all([fetch("/api/ranking", { cache: "no-store" }), fetch("/api/quizzes", { cache: "no-store" })])
      const j1 = await r1.json(), j2 = await r2.json()
      if (!r1.ok) throw new Error(j1.erro || "Erro ao carregar ranking.")
      setDados(j1); setQuizzes(j2.quizzes || [])
      if (!alvo && j1.membros?.length) setAlvo(j1.membros.find((m: any) => m.id !== j1.eu.id)?.id || "")
      if (!atrasoAlvo && j1.membros?.length) setAtrasoAlvo(j1.membros[0]?.id || "")
    } catch (e: any) { setErro(e.message || "Erro ao carregar.") }
  }

  useEffect(() => {
    void carregar()
    const aoSincronizar = () => void carregar()
    window.addEventListener("santa-luzia:server-sync", aoSincronizar)
    return () => window.removeEventListener("santa-luzia:server-sync", aoSincronizar)
  }, [])

  async function acao(payload: Record<string, unknown>) {
    setMensagem(""); setErro("")
    const r = await fetch("/api/ranking", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
    const j = await r.json()
    if (!r.ok) { emitAppFeedback("error"); setErro(j.erro || "Não foi possível concluir."); return false }
    emitAppFeedback("success"); setMensagem(j.mensagem || "Atualizado com sucesso."); await carregar(); return true
  }

  async function responderQuiz() {
    if (!quizAberto) return
    const r = await fetch(`/api/quizzes/${quizAberto.id}/responder`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ respostas }) })
    const j = await r.json()
    if (!r.ok) { emitAppFeedback("error"); setErro(j.erro || "Não foi possível enviar o quiz."); return }
    emitAppFeedback("success")
    setResultadoQuiz(j)
    setMensagem(`Quiz concluído: ${j.resultado.acertos}/${quizAberto.perguntas.length} acertos · ${j.resultado.pontos} pontos.`)
    await carregar()
  }

  const ocorrenciasConfirmadas = useMemo(() => (dados?.ocorrencias || []).filter((o: any) => o.status === "confirmado"), [dados])

  if (!dados) return <div className="min-h-screen bg-background p-8 text-center text-muted-foreground">Carregando Ranking…</div>
  const isMod = dados.eu.tipo === "moderador"

  return (
    <div className="min-h-screen bg-background">
      <AreaHeader titulo="Ranking e Desafios" subtitulo="Formação, Liturgia, pontualidade e espírito de serviço" voltarHref={isMod ? "/area-restrita/moderador" : "/area-restrita/membro"} menu={isMod ? <ModeradorMenu /> : <MembroMenu />} />
      <main className="mx-auto w-full max-w-6xl overflow-x-hidden px-3 py-4 pb-24 sm:px-4 sm:py-8">
        <section className="mb-5 rounded-2xl border border-accent/50 bg-[linear-gradient(135deg,#fffaf0,#fff_55%,#f9edc8)] p-5 shadow-sm">
          <div className="flex items-center gap-3"><Trophy className="size-8 text-[#b98b22]" /><div><h1 className="font-serif text-2xl font-semibold text-primary">Melhor Acólito/Coroinha do Ano</h1><p className="text-sm text-muted-foreground">Pontuação equilibrada: quizzes de Formação e Liturgia, pontualidade e reconhecimentos positivos da equipe.</p></div></div>
        </section>
        {erro && <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{erro}</div>}
        {mensagem && <div className="mb-4 rounded-xl border border-accent/45 bg-accent/10 p-3 text-sm text-foreground">{mensagem}</div>}

        <Tabs defaultValue="ranking">
          <TabsList className="grid w-full grid-cols-3 gap-1 bg-white p-1 shadow-sm sm:grid-cols-5">
            <TabsTrigger value="ranking" className="min-h-12 w-full flex-col gap-0.5 text-[10px] sm:text-xs"><Trophy className="size-4" />Ranking</TabsTrigger>
            <TabsTrigger value="quiz" className="min-h-12 w-full flex-col gap-0.5 text-[10px] sm:text-xs"><Sparkles className="size-4" />Quiz</TabsTrigger>
            <TabsTrigger value="reconhecer" className="min-h-12 w-full flex-col gap-0.5 text-[10px] sm:text-xs"><HeartHandshake className="size-4" />Reconhecer</TabsTrigger>
            <TabsTrigger value="pontualidade" className="min-h-12 w-full flex-col gap-0.5 text-[10px] sm:text-xs"><Clock3 className="size-4" />Pontualidade</TabsTrigger>
            <TabsTrigger value="avisos" className="min-h-12 w-full flex-col gap-0.5 text-[10px] sm:text-xs"><BellRing className="size-4" />Avisos</TabsTrigger>
          </TabsList>

          <TabsContent value="ranking" className="mt-4 space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              {(dados.ranking || []).slice(0,3).map((l: any) => <div key={l.usuarioId} className="rounded-2xl border border-accent/45 bg-white p-4 shadow-sm"><div className="flex items-center gap-3">{medalha(l.posicao)}<div><p className="font-serif text-lg font-semibold text-primary">{l.nome}</p><p className="text-xs text-muted-foreground">{l.funcao || "Membro"}</p></div><strong className="ml-auto text-xl text-[#9a731d]">{l.pontos}</strong></div></div>)}
            </div>
            <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
              {(dados.ranking || []).map((l: any) => <div key={l.usuarioId} className="flex items-center gap-3 border-b border-border/70 p-3 last:border-0">{medalha(l.posicao)}<div className="min-w-0 flex-1"><p className="truncate font-medium text-foreground">{l.nome}</p><p className="text-[11px] text-muted-foreground">Formação {l.formacao} · Liturgia {l.liturgia} · Pontualidade {l.pontualidade} · Reconhecimentos {l.reconhecimento}</p></div><span className="rounded-full bg-accent/20 px-3 py-1 text-sm font-bold text-primary">{l.pontos} pts</span></div>)}
            </div>
            <p className="text-xs leading-5 text-muted-foreground">Reconhecimentos têm peso limitado para que o ranking não vire concurso de popularidade. O moderador pode auditar atrasos e ajustar pontos com justificativa.</p>
          </TabsContent>

          <TabsContent value="quiz" className="mt-4 space-y-3">
            {isMod && <a href="/area-restrita/moderador/ranking" className="block rounded-xl border border-accent/50 bg-accent/10 p-4 font-semibold text-primary">Gerenciar quizzes e ranking →</a>}
            {quizzes.length === 0 && <div className="rounded-xl border border-border bg-white p-5 text-muted-foreground">Nenhum quiz publicado ainda.</div>}
            {quizzes.map((q) => <div key={q.id} className="rounded-2xl border border-border bg-white p-4 shadow-sm"><div className="flex items-start gap-3"><Sparkles className="mt-1 size-5 text-[#b98b22]"/><div className="min-w-0 flex-1"><p className="font-serif text-lg font-semibold text-primary">{q.titulo}</p><p className="text-xs uppercase tracking-wide text-[#9a731d]">{q.origem === "formacao" ? "Formação" : q.origem === "liturgia" ? "Liturgia diária" : "Desafio especial"}</p><p className="mt-2 text-sm text-muted-foreground">{q.descricao}</p></div></div>{!isMod && <Button className="mt-3" disabled={q.respondido} onClick={() => { setQuizAberto(q); setRespostas(Array(q.perguntas.length).fill(-1)); setResultadoQuiz(null) }}>{q.respondido ? "Já respondido" : "Responder quiz"}</Button>}</div>)}
            {quizAberto && !resultadoQuiz && <div className="rounded-2xl border border-accent/50 bg-white p-4 shadow-md"><h3 className="font-serif text-xl font-semibold text-primary">{quizAberto.titulo}</h3><div className="mt-4 space-y-5">{quizAberto.perguntas.map((p,i) => <fieldset key={p.id}><legend className="mb-2 text-sm font-semibold text-foreground">{i+1}. {p.enunciado}</legend><div className="space-y-2">{p.opcoes.map((op,j) => <label key={j} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-3 text-sm"><input type="radio" name={`q-${p.id}`} checked={respostas[i]===j} onChange={() => setRespostas((old)=>old.map((v,k)=>k===i?j:v))}/><span>{op}</span></label>)}</div></fieldset>)}</div><div className="mt-4 flex gap-2"><Button onClick={responderQuiz} disabled={respostas.some((x)=>x<0)}>Enviar respostas</Button><Button variant="outline" onClick={()=>setQuizAberto(null)}>Cancelar</Button></div></div>}
          </TabsContent>

          <TabsContent value="reconhecer" className="mt-4">
            <div className="rounded-2xl border border-border bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><HeartHandshake className="size-5 text-primary"/><h2 className="font-serif text-xl font-semibold text-primary">Reconhecimento entre a equipe</h2></div><p className="mt-2 text-sm leading-6 text-muted-foreground">Valorize atitudes positivas. Cada categoria pode ser concedida uma vez por mês por perfil, evitando favoritismo excessivo.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><select value={alvo} onChange={(e)=>setAlvo(e.target.value)} className="h-11 rounded-lg border border-border bg-white px-3 text-sm"><option value="">Escolha um perfil</option>{dados.membros.filter((m:any)=>m.id!==dados.eu.id).map((m:any)=><option key={m.id} value={m.id}>{m.nome} · {m.funcao}</option>)}</select><select value={categoria} onChange={(e)=>setCategoria(e.target.value)} className="h-11 rounded-lg border border-border bg-white px-3 text-sm">{categorias.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div><Button className="mt-3 gap-2" onClick={()=>acao({action:"reconhecer",paraId:alvo,categoria})} disabled={!alvo}><Award className="size-4"/>Enviar reconhecimento</Button></div>
          </TabsContent>

          <TabsContent value="pontualidade" className="mt-4 space-y-4">
            <div className="rounded-2xl border border-border bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><Clock3 className="size-5 text-primary"/><h2 className="font-serif text-xl font-semibold text-primary">Reportar atraso</h2></div><p className="mt-2 text-sm text-muted-foreground">O relato só entra no ranking e no painel interativo depois de ser confirmado por um moderador.</p><div className="mt-4 grid gap-3 sm:grid-cols-3"><select value={atrasoAlvo} onChange={(e)=>setAtrasoAlvo(e.target.value)} className="h-11 rounded-lg border border-border bg-white px-3 text-sm"><option value="">Perfil</option>{dados.membros.map((m:any)=><option key={m.id} value={m.id}>{m.nome}</option>)}</select><input type="date" value={dataMissa} onChange={(e)=>setDataMissa(e.target.value)} className="h-11 rounded-lg border border-border px-3 text-sm"/><input type="time" value={horarioMissa} onChange={(e)=>setHorarioMissa(e.target.value)} className="h-11 rounded-lg border border-border px-3 text-sm"/></div><Button className="mt-3 gap-2" disabled={!atrasoAlvo||!dataMissa} onClick={()=>acao({action:"reportar_atraso",usuarioId:atrasoAlvo,dataMissa,horarioMissa})}><Send className="size-4"/>Enviar para moderação</Button></div>
            {ocorrenciasConfirmadas.map((o:any) => { const rs=(dados.reacoes||[]).filter((r:any)=>r.ocorrencia_id===o.id); return <div key={o.id} className="rounded-2xl border border-accent/40 bg-white p-4 shadow-sm"><p className="font-medium text-foreground"><span className="text-primary">{o.usuario_nome}</span> teve uma ocorrência de pontualidade confirmada.</p><p className="mt-1 text-xs text-muted-foreground">Missa {o.data_missa} às {o.horario_missa} · horário de chegada: até {o.limite_chegada}</p><div className="mt-3 flex flex-wrap gap-2">{emojis.map((emoji)=><button key={emoji} type="button" onClick={()=>acao({action:"reagir",ocorrenciaId:o.id,emoji})} className="rounded-full border border-border bg-[#fffaf2] px-3 py-1.5 text-lg">{emoji} <span className="text-[10px] text-muted-foreground">{rs.filter((r:any)=>r.emoji===emoji).length}</span></button>)}</div></div> })}
          </TabsContent>

          <TabsContent value="avisos" className="mt-4 space-y-4"><AndroidNotificationSettings/><div className="rounded-xl border border-border bg-white p-4 text-sm leading-6 text-muted-foreground"><BellRing className="mr-2 inline size-4 text-primary"/>O horário padrão de chegada é calculado a partir da missa. Ex.: missa às 18:00 com 30 minutos de antecedência = chegada até 17:30. O moderador pode alterar a antecedência.</div></TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
