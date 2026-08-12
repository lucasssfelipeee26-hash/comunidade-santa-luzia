"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { BrainCircuit, Clock3, Medal, Send, ShieldCheck, Sparkles, TimerReset, Trophy } from "lucide-react"
import { AreaHeader } from "@/components/area-header"
import { ModeradorMenu, MembroMenu } from "@/components/area-menu"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const emojis = ["⏰", "😅", "🙏", "✝️", "💛"]
type QuizPublico = { id:string; titulo:string; descricao:string; respondido?:boolean; perguntas:{id:string;enunciado:string;opcoes:string[];pontos:number}[] }
type QuizAuto = { token:string; titulo:string; descricao:string; expiraEm:number; duracaoSegundos:number; perguntas:{id:string;enunciado:string;opcoes:string[];pontos:number}[] }

function letras(i:number){ return String.fromCharCode(65+i) }
function tempo(segundos:number){ return `${String(Math.floor(segundos/60)).padStart(2,"0")}:${String(segundos%60).padStart(2,"0")}` }

export function RankingInterativo() {
  const [dados,setDados]=useState<any>(null)
  const [quizzes,setQuizzes]=useState<QuizPublico[]>([])
  const [quizAuto,setQuizAuto]=useState<QuizAuto|null>(null)
  const [autoConcluido,setAutoConcluido]=useState<any>(null)
  const [respostasAuto,setRespostasAuto]=useState<number[]>([])
  const [restante,setRestante]=useState(0)
  const [quizManual,setQuizManual]=useState<QuizPublico|null>(null)
  const [respostasManual,setRespostasManual]=useState<number[]>([])
  const [erro,setErro]=useState("")
  const [mensagem,setMensagem]=useState("")
  const [atrasoAlvo,setAtrasoAlvo]=useState("")
  const [dataMissa,setDataMissa]=useState("")
  const [horarioMissa,setHorarioMissa]=useState("18:00")
  const tentativaAtiva=useRef(false)

  async function carregarDados(){
    try{
      const [r1,r2]=await Promise.all([fetch("/api/ranking",{cache:"no-store"}),fetch("/api/quizzes",{cache:"no-store"})])
      const j1=await r1.json(),j2=await r2.json()
      if(!r1.ok) throw new Error(j1.erro||"Erro ao carregar competição.")
      setDados(j1);setQuizzes(j2.quizzes||[])
      if(!atrasoAlvo&&j1.membros?.length)setAtrasoAlvo(j1.membros[0].id)
    }catch(e:any){setErro(e.message||"Erro ao carregar.")}
  }

  async function carregarQuizAutomatico(aviso?:string){
    tentativaAtiva.current=false;setQuizAuto(null);setRespostasAuto([])
    try{
      const r=await fetch("/api/quizzes/liturgia",{cache:"no-store"});const j=await r.json()
      if(!r.ok)throw new Error(j.erro||"Não foi possível gerar o quiz de hoje.")
      if(j.respondido){setAutoConcluido(j.resultado);if(aviso)setMensagem(aviso);return}
      setAutoConcluido(null);setQuizAuto(j.quiz);setRespostasAuto(Array(j.quiz.perguntas.length).fill(-1));setRestante(j.quiz.duracaoSegundos);tentativaAtiva.current=true
      if(aviso)setMensagem(aviso)
    }catch(e:any){setErro(e.message||"Não foi possível gerar o quiz.")}
  }

  useEffect(()=>{void carregarDados();void carregarQuizAutomatico()},[])
  useEffect(()=>{
    if(!quizAuto)return
    const id=window.setInterval(()=>{
      const s=Math.max(0,Math.ceil((quizAuto.expiraEm-Date.now())/1000));setRestante(s)
      if(s<=0){window.clearInterval(id);void carregarQuizAutomatico("O tempo terminou. Um novo quiz foi gerado automaticamente.")}
    },500)
    return()=>window.clearInterval(id)
  },[quizAuto?.token])
  useEffect(()=>{
    const vis=()=>{
      if(document.visibilityState==="hidden"&&tentativaAtiva.current){tentativaAtiva.current=false;setQuizAuto(null);setRespostasAuto([])}
      else if(document.visibilityState==="visible"&&!tentativaAtiva.current&&!autoConcluido){void carregarQuizAutomatico("O aplicativo saiu de foco. Por segurança, um novo quiz foi gerado.")}
    }
    document.addEventListener("visibilitychange",vis);return()=>document.removeEventListener("visibilitychange",vis)
  },[autoConcluido])

  async function responderAuto(){
    if(!quizAuto||respostasAuto.some(x=>x<0))return
    const r=await fetch("/api/quizzes/liturgia/responder",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:quizAuto.token,respostas:respostasAuto})});const j=await r.json()
    if(!r.ok){setErro(j.erro||"Não foi possível enviar.");await carregarQuizAutomatico();return}
    tentativaAtiva.current=false;setQuizAuto(null);setAutoConcluido(j.resultado);setMensagem(`Quiz concluído: ${j.resultado.acertos} acerto(s), ${j.resultado.pontos} pontos.`);await carregarDados()
  }

  async function responderManual(){
    if(!quizManual||respostasManual.some(x=>x<0))return
    const r=await fetch(`/api/quizzes/${quizManual.id}/responder`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({respostas:respostasManual})});const j=await r.json()
    if(!r.ok){setErro(j.erro||"Não foi possível enviar o quiz.");return}
    setMensagem(`Quiz avulso concluído: ${j.resultado.acertos}/${quizManual.perguntas.length} acertos.`);setQuizManual(null);await carregarDados()
  }

  async function acao(payload:Record<string,unknown>){
    const r=await fetch("/api/ranking",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const j=await r.json()
    if(!r.ok){setErro(j.erro||"Não foi possível concluir.");return}
    setMensagem(j.mensagem||"Atualizado.");await carregarDados()
  }

  const ocorrencias=useMemo(()=>(dados?.ocorrencias||[]).filter((o:any)=>o.status==="confirmado"),[dados])
  if(!dados)return <div className="min-h-screen p-8 text-center text-muted-foreground">Carregando competição…</div>
  const isMod=dados.eu.tipo==="moderador"

  return <div className="min-h-screen bg-[radial-gradient(circle_at_top,#fff8e5_0%,#fff_42%,#faf7f1_100%)]">
    <AreaHeader titulo="Quiz Litúrgico" subtitulo="Competição diária de perguntas e respostas" voltarHref={isMod?"/area-restrita/moderador":"/area-restrita/membro"} menu={isMod?<ModeradorMenu/>:<MembroMenu/>}/>
    <main className="mx-auto max-w-6xl px-3 py-4 pb-24 sm:px-4 sm:py-8">
      <section className="mb-5 overflow-hidden rounded-3xl border border-white/70 bg-white/70 p-5 shadow-[0_18px_50px_rgba(82,49,25,.10)] backdrop-blur-2xl">
        <div className="flex items-center gap-3"><span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-white shadow-lg"><BrainCircuit className="size-6"/></span><div><h1 className="font-serif text-2xl font-semibold text-primary">Competição do Quiz</h1><p className="text-sm text-muted-foreground">A classificação considera somente o quiz automático da Liturgia Diária. Moderadores também participam.</p></div></div>
      </section>
      {erro&&<div className="mb-4 rounded-2xl border border-destructive/25 bg-white/80 p-3 text-sm text-destructive backdrop-blur-xl">{erro}</div>}
      {mensagem&&<div className="mb-4 rounded-2xl border border-accent/40 bg-white/80 p-3 text-sm backdrop-blur-xl">{mensagem}</div>}

      <Tabs defaultValue="hoje">
        <TabsList className="grid w-full grid-cols-4 gap-1 rounded-2xl bg-white/70 p-1 shadow-sm backdrop-blur-2xl">
          <TabsTrigger value="hoje" className="min-h-12 flex-col text-[10px] sm:text-xs"><Sparkles className="size-4"/>Hoje</TabsTrigger>
          <TabsTrigger value="competicao" className="min-h-12 flex-col text-[10px] sm:text-xs"><Trophy className="size-4"/>Competição</TabsTrigger>
          <TabsTrigger value="avulsos" className="min-h-12 flex-col text-[10px] sm:text-xs"><BrainCircuit className="size-4"/>Avulsos</TabsTrigger>
          <TabsTrigger value="pontualidade" className="min-h-12 flex-col text-[10px] sm:text-xs"><Clock3 className="size-4"/>Atrasos</TabsTrigger>
        </TabsList>

        <TabsContent value="hoje" className="mt-4">
          <section className="rounded-3xl border border-white/70 bg-white/75 p-4 shadow-xl backdrop-blur-2xl sm:p-6">
            {autoConcluido?<div className="py-8 text-center"><ShieldCheck className="mx-auto size-12 text-primary"/><h2 className="mt-3 font-serif text-2xl text-primary">Quiz de hoje concluído</h2><p className="mt-2 text-muted-foreground">Você marcou {autoConcluido.pontos} ponto(s) e {autoConcluido.acertos} acerto(s). Amanhã haverá um novo desafio.</p></div>:quizAuto?<><div className="mb-5 flex items-center justify-between gap-3"><div><h2 className="font-serif text-xl font-semibold text-primary">{quizAuto.titulo}</h2><p className="text-sm text-muted-foreground">{quizAuto.descricao}</p></div><span className={`flex items-center gap-1 rounded-full px-3 py-1.5 font-mono text-sm font-bold ${restante<=20?"bg-destructive/10 text-destructive":"bg-primary/10 text-primary"}`}><TimerReset className="size-4"/>{tempo(restante)}</span></div><div className="space-y-5">{quizAuto.perguntas.map((p,i)=><fieldset key={p.id}><legend className="mb-2 font-semibold text-foreground">{i+1}. {p.enunciado}</legend><div className="grid gap-2">{p.opcoes.map((op,j)=><button type="button" key={j} onClick={()=>setRespostasAuto(old=>old.map((v,k)=>k===i?j:v))} className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${respostasAuto[i]===j?"border-primary bg-primary/8 ring-2 ring-primary/15":"border-border bg-white/80 hover:border-primary/35"}`}><span className={`flex size-8 shrink-0 items-center justify-center rounded-xl font-bold ${respostasAuto[i]===j?"bg-primary text-white":"bg-secondary text-primary"}`}>{letras(j)}</span><span className="text-sm">{op}</span></button>)}</div></fieldset>)}</div><Button className="mt-5 w-full sm:w-auto" disabled={respostasAuto.some(x=>x<0)} onClick={responderAuto}>Enviar respostas</Button><p className="mt-3 text-xs text-muted-foreground">Ao sair do aplicativo ou trocar de tela durante a tentativa, esta rodada é encerrada e um novo conjunto de perguntas é gerado.</p></>:<div className="py-8 text-center text-muted-foreground">Gerando quiz da Liturgia de hoje…</div>}
          </section>
        </TabsContent>

        <TabsContent value="competicao" className="mt-4 space-y-2">
          {(dados.ranking||[]).map((l:any)=><div key={l.usuarioId} className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/75 p-3 shadow-sm backdrop-blur-xl"><span className="flex size-9 items-center justify-center rounded-xl bg-secondary font-bold text-primary">{l.posicao<=3?<Medal className="size-5"/>:l.posicao}</span><div className="min-w-0 flex-1"><p className="truncate font-semibold">{l.nome}</p><p className="text-xs text-muted-foreground">{l.funcao||"Participante"} · {l.quizzesRespondidos} quiz(es) · {l.aproveitamento}% de aproveitamento</p></div><strong className="text-lg text-primary">{l.pontos} pts</strong></div>)}
        </TabsContent>

        <TabsContent value="avulsos" className="mt-4 space-y-3">
          {isMod&&<a href="/area-restrita/moderador/ranking" className="block rounded-2xl border border-accent/40 bg-white/75 p-4 font-semibold text-primary shadow-sm backdrop-blur-xl">Gerenciar quizzes avulsos →</a>}
          {quizzes.length===0&&<div className="rounded-2xl bg-white/75 p-5 text-muted-foreground backdrop-blur-xl">Nenhum quiz avulso publicado.</div>}
          {quizzes.map(q=><div key={q.id} className="rounded-2xl border border-white/70 bg-white/75 p-4 shadow-sm backdrop-blur-xl"><h3 className="font-serif text-lg font-semibold text-primary">{q.titulo}</h3><p className="mt-1 text-sm text-muted-foreground">{q.descricao}</p><Button className="mt-3" disabled={q.respondido} onClick={()=>{setQuizManual(q);setRespostasManual(Array(q.perguntas.length).fill(-1))}}>{q.respondido?"Já respondido":"Responder"}</Button></div>)}
          {quizManual&&<section className="rounded-3xl border border-accent/40 bg-white/90 p-4 shadow-xl backdrop-blur-2xl"><h3 className="font-serif text-xl font-semibold text-primary">{quizManual.titulo}</h3><div className="mt-4 space-y-5">{quizManual.perguntas.map((p,i)=><fieldset key={p.id}><legend className="mb-2 font-semibold">{i+1}. {p.enunciado}</legend><div className="grid gap-2">{p.opcoes.map((op,j)=><button type="button" key={j} onClick={()=>setRespostasManual(old=>old.map((v,k)=>k===i?j:v))} className={`flex items-center gap-3 rounded-xl border p-3 text-left ${respostasManual[i]===j?"border-primary bg-primary/5":"border-border"}`}><b>{letras(j)}</b>{op}</button>)}</div></fieldset>)}</div><div className="mt-4 flex gap-2"><Button disabled={respostasManual.some(x=>x<0)} onClick={responderManual}>Enviar</Button><Button variant="outline" onClick={()=>setQuizManual(null)}>Fechar</Button></div></section>}
        </TabsContent>

        <TabsContent value="pontualidade" className="mt-4 space-y-4">
          {!isMod&&<section className="rounded-3xl border border-white/70 bg-white/75 p-4 shadow-sm backdrop-blur-xl"><h2 className="font-serif text-xl font-semibold text-primary">Reportar atraso</h2><p className="mt-1 text-sm text-muted-foreground">O relato só aparece para o grupo depois da confirmação de um moderador.</p><div className="mt-3 grid gap-2 sm:grid-cols-3"><select value={atrasoAlvo} onChange={e=>setAtrasoAlvo(e.target.value)} className="h-11 rounded-xl border border-border bg-white px-3"><option value="">Perfil</option>{dados.membros.map((m:any)=><option key={m.id} value={m.id}>{m.nome}</option>)}</select><input type="date" value={dataMissa} onChange={e=>setDataMissa(e.target.value)} className="h-11 rounded-xl border border-border px-3"/><input type="time" value={horarioMissa} onChange={e=>setHorarioMissa(e.target.value)} className="h-11 rounded-xl border border-border px-3"/></div><Button className="mt-3 gap-2" disabled={!atrasoAlvo||!dataMissa} onClick={()=>acao({action:"reportar_atraso",usuarioId:atrasoAlvo,dataMissa,horarioMissa})}><Send className="size-4"/>Enviar para moderação</Button></section>}
          {ocorrencias.map((o:any)=>{const rs=(dados.reacoes||[]).filter((r:any)=>r.ocorrencia_id===o.id);return <div key={o.id} className="rounded-2xl border border-amber-200/70 bg-white/75 p-4 backdrop-blur-xl"><p className="font-medium"><span className="text-primary">{o.usuario_nome}</span> teve um atraso confirmado em {String(o.data_missa).split("-").reverse().join("/")}.</p><div className="mt-2 flex gap-1.5">{emojis.map(e=><button key={e} onClick={()=>acao({action:"reagir",ocorrenciaId:o.id,emoji:e})} className="rounded-full border bg-white px-2.5 py-1">{e} {rs.filter((r:any)=>r.emoji===e).length||""}</button>)}</div></div>})}
        </TabsContent>
      </Tabs>
    </main>
  </div>
}
