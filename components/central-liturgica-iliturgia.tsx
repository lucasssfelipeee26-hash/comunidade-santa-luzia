"use client"

import { useEffect, useMemo, useState } from "react"
import { BookOpenText, ChevronLeft, Church, Clock3, Menu, MoonStar, MoreHorizontal, ScrollText, Sun, Sunrise, Sunset } from "lucide-react"
import { AcervoLiturgicoOffline } from "@/components/acervo-liturgico-offline"
import { LiturgiaDiaria } from "@/components/liturgia-diaria"

type Modulo="hoje"|"oficio"|"liturgia"|"missal"|"mais"
type Tela={id:string;titulo:string;categoria?:string;busca?:string;documento?:string;tipo?:"liturgia"|"acervo"}
type SantoHoje={nome:string;resumo?:string;imagem?:string|null}|null
type LiturgiaHoje={data?:string;liturgia?:string;tempoLiturgicoAtual?:string;santoDoDia?:SantoHoje}

const horas:Tela[]=[
 {id:"invitatorio",titulo:"Invitatório",categoria:"oficio",documento:"oficio/invitatorio.html"},
 {id:"oficio-leituras",titulo:"Ofício das Leituras",categoria:"oficio",busca:"Ofício das Leituras"},
 {id:"laudes",titulo:"Laudes",categoria:"oficio",busca:"Laudes"},
 {id:"terca",titulo:"Hora Terça",categoria:"oficio",busca:"Terça"},
 {id:"sexta",titulo:"Hora Sexta",categoria:"oficio",busca:"Sexta"},
 {id:"nona",titulo:"Hora Nona",categoria:"oficio",busca:"Nona"},
 {id:"vesperas",titulo:"Vésperas",categoria:"oficio",busca:"Vésperas"},
 {id:"completas",titulo:"Completas",categoria:"oficio",busca:"Completas"},
 {id:"vigilia",titulo:"Vigília",categoria:"oficio",busca:"Vigília"},
]

const ordinario:Tela[]=[
 {id:"ritos-iniciais",titulo:"Ritos Iniciais",categoria:"missal",documento:"missal/ordinario/ritosiniciais.htm"},
 {id:"liturgia-palavra",titulo:"Liturgia da Palavra",categoria:"missal",documento:"missal/ordinario/liturgiapalavra.htm"},
 {id:"oracao-fieis",titulo:"Oração dos Fiéis",categoria:"missal",documento:"missal/ordinario/oracaodosfieis.htm"},
 {id:"liturgia-eucaristica",titulo:"Liturgia Eucarística",categoria:"missal",documento:"missal/ordinario/liturgiaeucaristica.htm"},
 {id:"rito-comunhao",titulo:"Rito da Comunhão",categoria:"missal",documento:"missal/ordinario/ritocomunhao.htm"},
 {id:"ritos-finais",titulo:"Ritos Finais",categoria:"missal",documento:"missal/ordinario/ritosfinais.htm"},
]

const eucaristicas:Tela[]=[
 "I","II","III","IV","V","VI-A","VI-B","VI-C","VI-D","VII","VIII","IX","X","XI",
].map(n=>({id:`oe-${n}`,titulo:`Oração Eucarística ${n}`,categoria:"missal",documento:`missal/oracaoeucaristica/oracaoeucaristica${n}.htm`}))

const missal:Tela[]=[
 {id:"ordinario",titulo:"Ordinário da Missa"},
 {id:"prefacios",titulo:"Prefácios",categoria:"missal",busca:"prefacio/"},
 {id:"eucaristicas",titulo:"Orações Eucarísticas"},
 {id:"proprio",titulo:"Próprio",categoria:"missal",busca:"missal/proprio/"},
]

const mais:Tela[]=[
 {id:"evangelho",titulo:"Evangelho e Lectio Divina",categoria:"evangelho",busca:""},
 {id:"lecionario",titulo:"Lecionário",categoria:"lecionario",busca:""},
 {id:"rosario",titulo:"Santo Rosário",categoria:"rosario",busca:"misterios_"},
 {id:"salterio",titulo:"Saltério",categoria:"salterio",busca:""},
 {id:"catequeses",titulo:"Catequeses",categoria:"catequeses",busca:""},
 {id:"comentarios",titulo:"Comentários",categoria:"comentarios",busca:""},
 {id:"oracoes",titulo:"Orações",categoria:"geral",busca:"oração"},
 {id:"indice",titulo:"Índice Geral",categoria:"oficio",busca:""},
]

function chaveDeImagem(imagem?:string|null){
 if(!imagem)return ""
 const nome=imagem.split("/").pop()||""
 return nome.replace(/\.(jpg|jpeg|png|webp|gif)$/i,"")
}
function normalizarNome(nome:string){return nome.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\b(sao|santo|santa)\b/g,"").replace(/[^a-z0-9]/g,"")}
function documentoDoSanto(s:SantoHoje){
 if(!s)return ""
 const chave=chaveDeImagem(s.imagem)||normalizarNome(s.nome)
 return `oficio/proprio/oficiodasleituras/${chave}.htm`
}
function imagemPublica(imagem?:string|null){
 if(!imagem)return ""
 const nome=imagem.split("/").pop()||imagem
 return nome.startsWith("/")?nome:`/${nome}`
}
function IconeHora({id}:{id:string}){if(id==="laudes")return <Sunrise className="size-5"/>;if(["terca","sexta","nona"].includes(id))return <Sun className="size-5"/>;if(id==="vesperas")return <Sunset className="size-5"/>;if(id==="completas")return <MoonStar className="size-5"/>;if(id==="invitatorio")return <Church className="size-5"/>;return <BookOpenText className="size-5"/>}
function ListaModulo({itens,abrir}:{itens:Tela[];abrir:(t:Tela)=>void}){return <div className="overflow-hidden rounded-xl border border-[#6f5a43]/30 bg-[#f7edcf]">{itens.map((item,i)=><button key={item.id} onClick={()=>abrir(item)} className={`flex w-full items-center gap-4 px-4 py-3.5 text-left transition hover:bg-[#eadbb4] ${i?"border-t border-[#806b50]/20":""}`}><span className="flex size-8 shrink-0 items-center justify-center text-[#6e4d31]"><IconeHora id={item.id}/></span><span className="font-serif text-xl font-semibold italic text-[#5b3d29]">{item.titulo}</span></button>)}</div>}

export function CentralLiturgicaILiturgia(){
 const[modulo,setModulo]=useState<Modulo>("hoje"),[tela,setTela]=useState<Tela|null>(null),[submenu,setSubmenu]=useState<"ordinario"|"eucaristicas"|null>(null),[hoje,setHoje]=useState<LiturgiaHoje|null>(null)
 useEffect(()=>{let vivo=true;fetch("/api/liturgia-local",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(j=>{if(vivo)setHoje(j)}).catch(()=>{});return()=>{vivo=false}},[])
 const dataCompleta=useMemo(()=>new Intl.DateTimeFormat("pt-BR",{weekday:"long",day:"2-digit",month:"long",year:"numeric"}).format(new Date()),[])
 const santo=hoje?.santoDoDia||null
 const documentoSanto=documentoDoSanto(santo)

 function abrir(t:Tela){
  if(t.id==="ordinario"){setSubmenu("ordinario");return}
  if(t.id==="eucaristicas"){setSubmenu("eucaristicas");return}
  setTela(t)
 }
 if(tela)return <section className="min-h-[78vh] bg-[#f2e6c6] pb-24"><div className="sticky top-0 z-20 flex items-center gap-3 border-b border-[#715b40]/30 bg-[#62412d] px-3 py-3 text-[#fff4d7] shadow-sm"><button onClick={()=>setTela(null)} className="flex size-9 items-center justify-center rounded-full hover:bg-white/10" aria-label="Voltar"><ChevronLeft className="size-6"/></button><h1 className="font-serif text-xl font-semibold">{tela.titulo}</h1></div><div className="mx-auto max-w-4xl p-3 sm:p-5">{tela.tipo==="liturgia"?<LiturgiaDiaria/>:<AcervoLiturgicoOffline categoriaInicial={tela.categoria} buscaInicial={tela.busca} documentoInicial={tela.documento} embutido titulo={tela.titulo}/>}</div></section>

 return <section className="relative min-h-[82vh] overflow-hidden rounded-2xl border border-[#745a3d]/30 bg-[#efe2bf] pb-20 shadow-sm">
  <header className="bg-[#62412d] px-4 py-4 text-[#fff5dc] shadow-sm"><div className="mx-auto flex max-w-4xl items-center justify-between gap-3"><div className="flex items-center gap-3"><Menu className="size-6"/><div><h1 className="font-serif text-2xl font-bold">Central Litúrgica</h1><p className="text-[11px] capitalize text-[#e9d6ad]">{hoje?.data||dataCompleta}</p>{hoje?.liturgia&&<p className="mt-0.5 text-[11px] text-[#f1dfb8]">{hoje.liturgia}</p>}</div></div><Church className="size-7 text-[#f1d28a]"/></div></header>
  <div className="mx-auto max-w-4xl p-3 sm:p-5">
   {modulo==="hoje"&&<div className="space-y-5">
    {santo&&<section className="overflow-hidden rounded-2xl border border-[#80694d]/35 bg-[#f8edcf] shadow-sm"><div className="grid grid-cols-[110px_1fr] sm:grid-cols-[150px_1fr]"><div className="relative min-h-[155px] bg-[#d8c49a]">{santo.imagem&&<img src={imagemPublica(santo.imagem)} alt={santo.nome} className="absolute inset-0 size-full object-cover" onError={e=>{e.currentTarget.style.display="none"}}/>}</div><div className="flex flex-col justify-center p-4"><p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#997026]">Santo do dia</p><h2 className="mt-1 font-serif text-2xl font-bold text-[#583b28] sm:text-3xl">{santo.nome}</h2>{santo.resumo&&<p className="mt-2 text-sm leading-6 text-[#705c47]">{santo.resumo}</p>}</div></div>{documentoSanto&&<div className="border-t border-[#80694d]/25 bg-[#fffaf0] p-3 sm:p-4"><AcervoLiturgicoOffline categoriaInicial="oficio" documentoInicial={documentoSanto} embutido titulo={santo.nome}/></div>}</section>}
    <section><div className="mb-2 px-1"><p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#997026]">Liturgia do dia</p><h2 className="font-serif text-2xl font-bold text-[#583b28]">{hoje?.liturgia||"Leituras e Evangelho"}</h2>{hoje?.tempoLiturgicoAtual&&<p className="mt-1 text-sm text-[#705c47]">{hoje.tempoLiturgicoAtual}</p>}</div><LiturgiaDiaria/></section>
   </div>}
   {modulo==="oficio"&&<ListaModulo itens={horas} abrir={abrir}/>} 
   {modulo==="liturgia"&&<LiturgiaDiaria/>}
   {modulo==="missal"&&<div className="space-y-3">{submenu&&<button onClick={()=>setSubmenu(null)} className="inline-flex items-center gap-2 rounded-full border border-[#80694d]/35 bg-[#fff7df] px-3 py-2 text-sm font-semibold text-[#5b3d29]"><ChevronLeft className="size-4"/>Missal</button>}{submenu==="ordinario"?<ListaModulo itens={ordinario} abrir={abrir}/>:submenu==="eucaristicas"?<ListaModulo itens={eucaristicas} abrir={abrir}/>:<ListaModulo itens={missal} abrir={abrir}/>}</div>} 
   {modulo==="mais"&&<ListaModulo itens={mais} abrir={abrir}/>} 
  </div>
  <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto grid max-w-[920px] grid-cols-5 border-t border-[#5b412d]/30 bg-[#62412d] text-[#e8d7b3] shadow-[0_-4px_12px_rgba(0,0,0,.12)] sm:rounded-t-2xl">{([['hoje','Hoje',Church],['oficio','Ofício',Clock3],['liturgia','Liturgia',BookOpenText],['missal','Missal',ScrollText],['mais','Mais',MoreHorizontal]] as const).map(([id,label,I])=><button key={id} onClick={()=>{setModulo(id);setSubmenu(null)}} className={`flex flex-col items-center gap-1 px-1 py-2.5 text-[10px] font-semibold ${modulo===id?"bg-[#765239] text-[#fff1c9]":""}`}><I className="size-5"/><span>{label}</span></button>)}</nav>
 </section>
}
