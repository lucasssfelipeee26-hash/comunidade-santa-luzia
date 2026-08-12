"use client"

import { useEffect, useMemo, useState } from "react"
import { Check, CirclePlus, Clock3, Pencil, Save, Trash2, X } from "lucide-react"
import { AreaHeader } from "@/components/area-header"
import { ModeradorMenu } from "@/components/area-menu"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type PerguntaEdit={id:string;enunciado:string;opcoes:string[];correta:number;pontos:number;explicacao:string}
const novaPergunta=():PerguntaEdit=>({id:`p-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,enunciado:"",opcoes:["","",""],correta:0,pontos:10,explicacao:""})
const letras=["A","B","C"]

export function GerenciadorRanking(){
 const[dados,setDados]=useState<any>(null);const[quizzes,setQuizzes]=useState<any[]>([]);const[erro,setErro]=useState("");const[msg,setMsg]=useState("")
 const[quizId,setQuizId]=useState("");const[titulo,setTitulo]=useState("");const[descricao,setDescricao]=useState("");const[ativo,setAtivo]=useState(true);const[perguntas,setPerguntas]=useState<PerguntaEdit[]>([novaPergunta()])
 async function carregar(){const[r1,r2]=await Promise.all([fetch("/api/ranking",{cache:"no-store"}),fetch("/api/quizzes?admin=1",{cache:"no-store"})]);const j1=await r1.json(),j2=await r2.json();if(!r1.ok){setErro(j1.erro||"Erro ao carregar.");return}setDados(j1);setQuizzes(j2.quizzes||[])}
 useEffect(()=>{void carregar()},[])
 function limpar(){setQuizId("");setTitulo("");setDescricao("");setAtivo(true);setPerguntas([novaPergunta()])}
 function editar(q:any){setQuizId(q.id);setTitulo(q.titulo);setDescricao(q.descricao||"");setAtivo(q.ativo!==false);setPerguntas((q.perguntas||[]).map((p:any)=>({...p,opcoes:[...(p.opcoes||[])].slice(0,3).concat(Array(Math.max(0,3-(p.opcoes||[]).length)).fill("")),pontos:10,explicacao:p.explicacao||""})))}
 async function salvar(){setErro("");setMsg("");const r=await fetch("/api/quizzes",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:quizId||undefined,titulo,descricao,origem:"manual",ativo,perguntas})});const j=await r.json();if(!r.ok){setErro(j.erro||"Erro ao salvar quiz.");return}setMsg(quizId?"Quiz alterado com sucesso.":"Quiz publicado com sucesso.");limpar();await carregar()}
 async function excluir(id:string){if(!confirm("Excluir este quiz e as respostas dele?"))return;const r=await fetch("/api/quizzes",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"excluir",id})});if(!r.ok){setErro("Não foi possível excluir.");return}setMsg("Quiz excluído.");await carregar()}
 async function moderar(id:string,status:"confirmado"|"rejeitado"){const r=await fetch("/api/ranking",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"moderar_atraso",ocorrenciaId:id,status})});if(!r.ok){setErro("Não foi possível moderar o atraso.");return}await carregar()}
 const pendentes=useMemo(()=>(dados?.ocorrencias||[]).filter((o:any)=>o.status==="pendente"),[dados])
 if(!dados)return <div className="min-h-screen p-8 text-center">Carregando…</div>
 return <div className="min-h-screen bg-[radial-gradient(circle_at_top,#fff8e6,#fff_48%,#faf7f2)]">
  <AreaHeader titulo="Gerenciar Quiz" subtitulo="Crie perguntas simples de múltipla escolha e modere atrasos" voltarHref="/area-restrita/moderador" menu={<ModeradorMenu/>}/>
  <main className="mx-auto max-w-6xl px-3 py-4 pb-24 sm:px-4 sm:py-8">
   {erro&&<div className="mb-4 rounded-2xl border border-destructive/25 bg-white/80 p-3 text-sm text-destructive backdrop-blur-xl">{erro}</div>}{msg&&<div className="mb-4 rounded-2xl border border-accent/40 bg-white/80 p-3 text-sm backdrop-blur-xl">{msg}</div>}
   <Tabs defaultValue="quiz"><TabsList className="grid w-full grid-cols-2 rounded-2xl bg-white/70 p-1 backdrop-blur-2xl"><TabsTrigger value="quiz" className="min-h-12 gap-2"><CirclePlus className="size-4"/>Quizzes avulsos</TabsTrigger><TabsTrigger value="atrasos" className="min-h-12 gap-2"><Clock3 className="size-4"/>Atrasos</TabsTrigger></TabsList>
    <TabsContent value="quiz" className="mt-4 space-y-4">
     <section className="rounded-3xl border border-white/70 bg-white/75 p-4 shadow-xl backdrop-blur-2xl sm:p-6">
      <div className="flex items-center justify-between gap-3"><div><h2 className="font-serif text-2xl font-semibold text-primary">{quizId?"Alterar quiz":"Novo quiz avulso"}</h2><p className="mt-1 text-sm text-muted-foreground">Digite a pergunta, preencha A, B e C e toque na alternativa correta.</p></div>{quizId&&<Button variant="outline" onClick={limpar}>Cancelar</Button>}</div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2"><input value={titulo} onChange={e=>setTitulo(e.target.value)} placeholder="Título do quiz" className="h-11 rounded-xl border border-border bg-white px-3"/><label className="flex items-center gap-2 rounded-xl border border-border bg-white px-3"><input type="checkbox" checked={ativo} onChange={e=>setAtivo(e.target.checked)}/> Publicado / ativo</label></div>
      <textarea value={descricao} onChange={e=>setDescricao(e.target.value)} placeholder="Descrição curta (opcional)" className="mt-3 min-h-20 w-full rounded-xl border border-border bg-white p-3"/>
      <div className="mt-5 space-y-4">{perguntas.map((p,i)=><div key={p.id} className="rounded-2xl border border-accent/35 bg-white/85 p-4 shadow-sm"><div className="flex items-center"><strong className="text-primary">Pergunta {i+1}</strong><button type="button" className="ml-auto text-destructive" disabled={perguntas.length===1} onClick={()=>setPerguntas(old=>old.filter((_,k)=>k!==i))}><Trash2 className="size-4"/></button></div><input value={p.enunciado} onChange={e=>setPerguntas(old=>old.map((x,k)=>k===i?{...x,enunciado:e.target.value}:x))} placeholder="Escreva a pergunta aqui" className="mt-3 h-11 w-full rounded-xl border border-border px-3"/><p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Alternativas — toque no círculo para marcar a correta</p><div className="mt-2 grid gap-2">{p.opcoes.map((op,j)=><label key={j} className={`flex items-center gap-3 rounded-xl border p-2.5 ${p.correta===j?"border-primary bg-primary/5":"border-border bg-white"}`}><input type="radio" name={`correta-${p.id}`} checked={p.correta===j} onChange={()=>setPerguntas(old=>old.map((x,k)=>k===i?{...x,correta:j}:x))}/><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary font-bold text-primary">{letras[j]}</span><input value={op} onChange={e=>setPerguntas(old=>old.map((x,k)=>k===i?{...x,opcoes:x.opcoes.map((o,z)=>z===j?e.target.value:o)}:x))} placeholder={`Alternativa ${letras[j]}`} className="h-9 min-w-0 flex-1 rounded-lg border border-border px-2"/></label>)}</div></div>)}</div>
      <div className="mt-4 flex flex-wrap gap-2"><Button variant="outline" onClick={()=>setPerguntas(old=>[...old,novaPergunta()])} className="gap-2"><CirclePlus className="size-4"/>Adicionar pergunta</Button><Button onClick={salvar} className="gap-2"><Save className="size-4"/>{quizId?"Salvar alterações":"Publicar quiz"}</Button></div>
     </section>
     <section className="space-y-2"><h3 className="font-serif text-xl font-semibold text-primary">Quizzes publicados</h3>{quizzes.length===0&&<p className="rounded-2xl bg-white/75 p-4 text-muted-foreground">Nenhum quiz avulso.</p>}{quizzes.map(q=><div key={q.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/70 bg-white/75 p-3 backdrop-blur-xl"><div className="min-w-0 flex-1"><p className="font-semibold">{q.titulo}</p><p className="text-xs text-muted-foreground">{q.perguntas?.length||0} pergunta(s) · {q.ativo?"ativo":"inativo"}</p></div><Button size="sm" variant="outline" onClick={()=>editar(q)} className="gap-1"><Pencil className="size-4"/>Alterar</Button><Button size="sm" variant="destructive" onClick={()=>excluir(q.id)} className="gap-1"><Trash2 className="size-4"/>Excluir</Button></div>)}</section>
    </TabsContent>
    <TabsContent value="atrasos" className="mt-4 space-y-3">{pendentes.length===0&&<div className="rounded-2xl bg-white/75 p-5 text-muted-foreground backdrop-blur-xl">Nenhum atraso aguardando confirmação.</div>}{pendentes.map((o:any)=><div key={o.id} className="rounded-2xl border border-amber-200 bg-white/80 p-4 backdrop-blur-xl"><p className="font-semibold">{o.usuario_nome}</p><p className="mt-1 text-sm text-muted-foreground">Celebração em {String(o.data_missa).split("-").reverse().join("/")} às {o.horario_missa} · limite {o.limite_chegada}</p><div className="mt-3 flex gap-2"><Button onClick={()=>moderar(o.id,"confirmado")} className="gap-1"><Check className="size-4"/>Confirmar</Button><Button variant="outline" onClick={()=>moderar(o.id,"rejeitado")} className="gap-1"><X className="size-4"/>Rejeitar</Button></div></div>)}</TabsContent>
   </Tabs>
  </main>
 </div>
}
