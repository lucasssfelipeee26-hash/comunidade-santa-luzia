"use client"

import { useEffect, useMemo, useState } from "react"
import { Check, CirclePlus, Clock3, ListChecks, Pencil, Save, Settings2, ShieldCheck, SlidersHorizontal, Trash2, X } from "lucide-react"
import { AreaHeader } from "@/components/area-header"
import { ModeradorMenu } from "@/components/area-menu"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { emitAppFeedback } from "@/lib/sound-preferences"

type PerguntaEdit = { id: string; enunciado: string; opcoes: string[]; correta: number; pontos: number; explicacao: string }
const novaPergunta = (): PerguntaEdit => ({ id: `p-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, enunciado: "", opcoes: ["", "", "", ""], correta: 0, pontos: 10, explicacao: "" })

export function GerenciadorRanking() {
  const [dados, setDados] = useState<any>(null)
  const [quizzes, setQuizzes] = useState<any[]>([])
  const [erro, setErro] = useState("")
  const [msg, setMsg] = useState("")
  const [quizId, setQuizId] = useState("")
  const [titulo, setTitulo] = useState("")
  const [descricao, setDescricao] = useState("")
  const [origem, setOrigem] = useState("formacao")
  const [dataRef, setDataRef] = useState("")
  const [ativo, setAtivo] = useState(true)
  const [perguntas, setPerguntas] = useState<PerguntaEdit[]>([novaPergunta()])
  const [ajusteUsuario, setAjusteUsuario] = useState("")
  const [ajustePontos, setAjustePontos] = useState("5")
  const [ajusteMotivo, setAjusteMotivo] = useState("")

  async function carregar() {
    const [r1, r2] = await Promise.all([fetch("/api/ranking", { cache: "no-store" }), fetch("/api/quizzes", { cache: "no-store" })])
    const j1 = await r1.json(), j2 = await r2.json()
    if (!r1.ok) { setErro(j1.erro || "Erro ao carregar."); return }
    setDados(j1); setQuizzes(j2.quizzes || []); if (!ajusteUsuario && j1.membros?.length) setAjusteUsuario(j1.membros[0].id)
  }
  useEffect(() => {
    void carregar()
    const aoSincronizar = () => void carregar()
    window.addEventListener("santa-luzia:server-sync", aoSincronizar)
    return () => window.removeEventListener("santa-luzia:server-sync", aoSincronizar)
  }, [])

  async function rankingAction(payload: Record<string,unknown>) {
    setErro(""); setMsg("")
    const r=await fetch("/api/ranking",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)})
    const j=await r.json(); if(!r.ok){emitAppFeedback("error");setErro(j.erro||"Erro.");return false} emitAppFeedback("success"); setMsg("Alteração salva."); await carregar(); return true
  }

  async function salvarQuiz() {
    setErro(""); setMsg("")
    const r=await fetch("/api/quizzes",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:quizId||undefined,titulo,descricao,origem,data_referencia:dataRef||null,ativo,perguntas})})
    const j=await r.json(); if(!r.ok){emitAppFeedback("error");setErro(j.erro||"Erro ao salvar quiz.");return} emitAppFeedback("success"); setMsg("Quiz salvo."); limparQuiz(); await carregar()
  }
  async function excluir(id:string){if(!confirm("Excluir este quiz e as respostas dele?"))return;await fetch("/api/quizzes",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"excluir",id})});await carregar()}
  function editar(q:any){setQuizId(q.id);setTitulo(q.titulo);setDescricao(q.descricao||"");setOrigem(q.origem);setDataRef(q.data_referencia||"");setAtivo(q.ativo!==false);setPerguntas((q.perguntas||[]).map((p:any)=>({...p,explicacao:p.explicacao||""})))}
  function limparQuiz(){setQuizId("");setTitulo("");setDescricao("");setOrigem("formacao");setDataRef("");setAtivo(true);setPerguntas([novaPergunta()])}

  const pendentes=useMemo(()=>(dados?.ocorrencias||[]).filter((o:any)=>o.status==="pendente"),[dados])
  if(!dados)return <div className="min-h-screen bg-background p-8 text-center">Carregando…</div>
  const c=dados.config

  return <div className="min-h-screen bg-background">
    <AreaHeader titulo="Gerenciar Ranking" subtitulo="Quizzes, pontualidade, pesos e ajustes" voltarHref="/area-restrita/moderador" menu={<ModeradorMenu/>}/>
    <main className="mx-auto max-w-6xl px-3 py-4 pb-24 sm:px-4 sm:py-8">
      {erro&&<div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{erro}</div>}
      {msg&&<div className="mb-4 rounded-xl border border-accent/40 bg-accent/10 p-3 text-sm">{msg}</div>}
      <Tabs defaultValue="quiz">
        <TabsList className="grid w-full grid-cols-2 gap-1 bg-white p-1 sm:grid-cols-4"><TabsTrigger value="quiz" className="min-h-12 w-full flex-col gap-0.5 text-[10px] sm:text-xs"><ListChecks className="size-4"/>Quizzes</TabsTrigger><TabsTrigger value="atrasos" className="min-h-12 w-full flex-col gap-0.5 text-[10px] sm:text-xs"><Clock3 className="size-4"/>Atrasos</TabsTrigger><TabsTrigger value="pesos" className="min-h-12 w-full flex-col gap-0.5 text-[10px] sm:text-xs"><SlidersHorizontal className="size-4"/>Pesos</TabsTrigger><TabsTrigger value="ajustes" className="min-h-12 w-full flex-col gap-0.5 text-[10px] sm:text-xs"><Settings2 className="size-4"/>Ajustes</TabsTrigger></TabsList>

        <TabsContent value="quiz" className="mt-4 space-y-4">
          <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between"><h2 className="font-serif text-xl font-semibold text-primary">{quizId?"Editar quiz":"Novo quiz"}</h2>{quizId&&<Button variant="outline" onClick={limparQuiz}>Cancelar edição</Button>}</div>
            <div className="grid gap-3 sm:grid-cols-2"><input value={titulo} onChange={e=>setTitulo(e.target.value)} placeholder="Título do quiz" className="h-11 rounded-lg border border-border px-3"/><select value={origem} onChange={e=>setOrigem(e.target.value)} className="h-11 rounded-lg border border-border px-3"><option value="formacao">Formação</option><option value="liturgia">Liturgia diária</option><option value="manual">Desafio especial</option></select><input type="date" value={dataRef} onChange={e=>setDataRef(e.target.value)} className="h-11 rounded-lg border border-border px-3"/><label className="flex items-center gap-2 rounded-lg border border-border px-3"><input type="checkbox" checked={ativo} onChange={e=>setAtivo(e.target.checked)}/>Quiz ativo</label></div>
            <textarea value={descricao} onChange={e=>setDescricao(e.target.value)} placeholder="Descrição / tema" className="mt-3 min-h-20 w-full rounded-lg border border-border p-3"/>
            <div className="mt-4 space-y-4">{perguntas.map((p,i)=><div key={p.id} className="rounded-xl border border-accent/35 bg-[#fffaf2] p-3"><div className="flex items-center gap-2"><strong className="text-primary">Pergunta {i+1}</strong><button onClick={()=>setPerguntas(old=>old.filter((_,k)=>k!==i))} className="ml-auto text-destructive" disabled={perguntas.length===1}><Trash2 className="size-4"/></button></div><input value={p.enunciado} onChange={e=>setPerguntas(old=>old.map((x,k)=>k===i?{...x,enunciado:e.target.value}:x))} placeholder="Enunciado" className="mt-2 h-10 w-full rounded-lg border border-border bg-white px-3"/><div className="mt-2 grid gap-2 sm:grid-cols-2">{p.opcoes.map((op,j)=><div key={j} className="flex items-center gap-2"><input type="radio" name={`correta-${p.id}`} checked={p.correta===j} onChange={()=>setPerguntas(old=>old.map((x,k)=>k===i?{...x,correta:j}:x))}/><input value={op} onChange={e=>setPerguntas(old=>old.map((x,k)=>k===i?{...x,opcoes:x.opcoes.map((o,z)=>z===j?e.target.value:o)}:x))} placeholder={`Opção ${j+1}`} className="h-9 min-w-0 flex-1 rounded-md border border-border bg-white px-2 text-sm"/></div>)}</div><div className="mt-2 grid gap-2 sm:grid-cols-[120px_1fr]"><input type="number" min="1" max="100" value={p.pontos} onChange={e=>setPerguntas(old=>old.map((x,k)=>k===i?{...x,pontos:Number(e.target.value)}:x))} className="h-9 rounded-md border border-border bg-white px-2"/><input value={p.explicacao} onChange={e=>setPerguntas(old=>old.map((x,k)=>k===i?{...x,explicacao:e.target.value}:x))} placeholder="Explicação após resposta (opcional)" className="h-9 rounded-md border border-border bg-white px-2"/></div></div>)}</div>
            <div className="mt-4 flex flex-wrap gap-2"><Button variant="outline" onClick={()=>setPerguntas(old=>[...old,novaPergunta()])} className="gap-2"><CirclePlus className="size-4"/>Adicionar pergunta</Button><Button onClick={salvarQuiz} className="gap-2"><Save className="size-4"/>Salvar quiz</Button></div>
          </section>
          <section className="space-y-2">{quizzes.map(q=><div key={q.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-white p-3"><div className="min-w-0 flex-1"><p className="font-medium text-foreground">{q.titulo}</p><p className="text-xs text-muted-foreground">{q.origem} · {q.perguntas?.length||0} pergunta(s) · {q.ativo?"ativo":"inativo"}</p></div><Button size="sm" variant="outline" onClick={()=>editar(q)}><Pencil className="size-4"/>Editar</Button><Button size="sm" variant="destructive" onClick={()=>excluir(q.id)}><Trash2 className="size-4"/>Excluir</Button></div>)}</section>
        </TabsContent>

        <TabsContent value="atrasos" className="mt-4 space-y-3">
          {pendentes.length===0&&<div className="rounded-xl border border-border bg-white p-5 text-muted-foreground">Nenhum relato de atraso aguardando moderação.</div>}
          {pendentes.map((o:any)=><div key={o.id} className="rounded-xl border border-accent/45 bg-white p-4 shadow-sm"><p className="font-medium text-foreground">{o.usuario_nome}</p><p className="mt-1 text-sm text-muted-foreground">Missa {o.data_missa} às {o.horario_missa} · deveria chegar até {o.limite_chegada}</p>{o.observacao&&<p className="mt-2 text-sm">{o.observacao}</p>}<div className="mt-3 flex gap-2"><Button onClick={()=>rankingAction({action:"moderar_atraso",ocorrenciaId:o.id,status:"confirmado"})} className="gap-1"><Check className="size-4"/>Confirmar</Button><Button variant="outline" onClick={()=>rankingAction({action:"moderar_atraso",ocorrenciaId:o.id,status:"rejeitado"})} className="gap-1"><X className="size-4"/>Rejeitar</Button></div></div>)}
        </TabsContent>

        <TabsContent value="pesos" className="mt-4"><ConfigForm config={c} onSave={rankingAction}/></TabsContent>

        <TabsContent value="ajustes" className="mt-4"><div className="rounded-2xl border border-border bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><ShieldCheck className="size-5 text-primary"/><h2 className="font-serif text-xl font-semibold text-primary">Ajuste manual com justificativa</h2></div><p className="mt-2 text-sm text-muted-foreground">Use apenas para correções administrativas. O ajuste é somado ao ranking do ano.</p><div className="mt-4 grid gap-3 sm:grid-cols-3"><select value={ajusteUsuario} onChange={e=>setAjusteUsuario(e.target.value)} className="h-11 rounded-lg border border-border px-3">{dados.membros.map((m:any)=><option key={m.id} value={m.id}>{m.nome}</option>)}</select><input type="number" value={ajustePontos} onChange={e=>setAjustePontos(e.target.value)} className="h-11 rounded-lg border border-border px-3" placeholder="Pontos (+ ou -)"/><input value={ajusteMotivo} onChange={e=>setAjusteMotivo(e.target.value)} className="h-11 rounded-lg border border-border px-3" placeholder="Motivo"/></div><Button className="mt-3 gap-2" onClick={async()=>{if(await rankingAction({action:"ajustar_pontos",usuarioId:ajusteUsuario,pontos:Number(ajustePontos),motivo:ajusteMotivo,ano:dados.ano}))setAjusteMotivo("")}}><Save className="size-4"/>Aplicar ajuste</Button></div></TabsContent>
      </Tabs>
    </main>
  </div>
}

function ConfigForm({config,onSave}:{config:any;onSave:(p:Record<string,unknown>)=>Promise<boolean>}){
 const [v,setV]=useState({...config}); const total=Number(v.peso_formacao)+Number(v.peso_liturgia)+Number(v.peso_pontualidade)+Number(v.peso_reconhecimento)
 return <div className="rounded-2xl border border-border bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><Settings2 className="size-5 text-primary"/><h2 className="font-serif text-xl font-semibold text-primary">Regras do ranking</h2></div><p className="mt-2 text-sm text-muted-foreground">Os quatro pesos devem totalizar 100.</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{[["peso_formacao","Quiz de Formação"],["peso_liturgia","Quiz de Liturgia"],["peso_pontualidade","Pontualidade"],["peso_reconhecimento","Reconhecimentos"]].map(([k,l])=><label key={k} className="text-sm"><span className="mb-1 block font-medium">{l}</span><input type="number" min="0" max="100" value={v[k]} onChange={e=>setV((o:any)=>({...o,[k]:Number(e.target.value)}))} className="h-10 w-full rounded-lg border border-border px-3"/></label>)}</div><label className="mt-3 block text-sm"><span className="mb-1 block font-medium">Antecedência para chegada à igreja (minutos)</span><input type="number" min="10" max="120" value={v.minutos_antecedencia} onChange={e=>setV((o:any)=>({...o,minutos_antecedencia:Number(e.target.value)}))} className="h-10 w-full rounded-lg border border-border px-3"/></label><p className={`mt-3 text-sm font-semibold ${total===100?"text-[oklch(0.45_0.08_160)]":"text-destructive"}`}>Total dos pesos: {total}</p><Button className="mt-3 gap-2" disabled={total!==100} onClick={()=>onSave({action:"salvar_config",ano:v.ano,peso_formacao:v.peso_formacao,peso_liturgia:v.peso_liturgia,peso_pontualidade:v.peso_pontualidade,peso_reconhecimento:v.peso_reconhecimento,minutos_antecedencia:v.minutos_antecedencia})}><Save className="size-4"/>Salvar regras</Button></div>
}
