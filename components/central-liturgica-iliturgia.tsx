"use client"

import { useMemo, useState } from "react"
import { BookOpenText, ChevronLeft, Church, ListTree, MoonStar, Search, Sun, Sunrise, Sunset } from "lucide-react"
import { AcervoLiturgicoOffline } from "@/components/acervo-liturgico-offline"
import { LiturgiaDiaria } from "@/components/liturgia-diaria"
import { santoDoDia } from "@/lib/santo-do-dia"

type Secao={id:string;titulo:string;categoria?:string;busca?:string;tipo?:"liturgia"|"acervo"}

const secoes:Secao[]=[
 {id:"oficio",titulo:"Ofício das Leituras",categoria:"oficio",busca:"Ofício das Leituras"},
 {id:"laudes",titulo:"Laudes",categoria:"oficio",busca:"Laudes"},
 {id:"terca",titulo:"Terça",categoria:"oficio",busca:"Terça"},
 {id:"sexta",titulo:"Sexta",categoria:"oficio",busca:"Sexta"},
 {id:"nona",titulo:"Nona",categoria:"oficio",busca:"Nona"},
 {id:"vesperas",titulo:"Vésperas",categoria:"oficio",busca:"Vésperas"},
 {id:"completas",titulo:"Completas",categoria:"oficio",busca:"Completas"},
 {id:"liturgia",titulo:"Liturgia diária",tipo:"liturgia"},
 {id:"oracoes",titulo:"Orações",categoria:"geral",busca:"oração"},
 {id:"indice",titulo:"Índice geral",categoria:"oficio",busca:""},
 {id:"missal",titulo:"Missal e Ritos",categoria:"missal",busca:""},
 {id:"prefacios",titulo:"Prefácios",categoria:"missal",busca:"Prefácio"},
 {id:"eucaristicas",titulo:"Orações Eucarísticas",categoria:"missal",busca:"Oração Eucarística"},
 {id:"proprios",titulo:"Próprios e Comuns",categoria:"oficio",busca:"Próprio Comum"},
 {id:"santos",titulo:"Santos, Memórias e Festas",categoria:"oficio",busca:"santo"},
 {id:"lecionario",titulo:"Lecionário",categoria:"lecionario",busca:""},
 {id:"lectio",titulo:"Evangelhos e Lectio Divina",categoria:"evangelho",busca:""},
 {id:"rosario",titulo:"Santo Rosário",categoria:"rosario",busca:""},
 {id:"salterio",titulo:"Saltério",categoria:"salterio",busca:""},
 {id:"catequeses",titulo:"Catequeses",categoria:"catequeses",busca:""},
 {id:"comentarios",titulo:"Comentários",categoria:"comentarios",busca:""},
]

function Icone({id}:{id:string}){
 if(id==="laudes")return <Sunrise className="size-5"/>
 if(["terca","sexta","nona"].includes(id))return <Sun className="size-5"/>
 if(id==="vesperas")return <Sunset className="size-5"/>
 if(id==="completas")return <MoonStar className="size-5"/>
 if(id==="indice")return <ListTree className="size-5"/>
 if(id==="liturgia")return <Church className="size-5"/>
 return <BookOpenText className="size-5"/>
}

export function CentralLiturgicaILiturgia(){
 const [secao,setSecao]=useState<Secao|null>(null)
 const santo=useMemo(()=>santoDoDia(new Date()),[])
 const dataHoje=useMemo(()=>new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"long"}).format(new Date()),[])

 if(secao){
   return <section className="min-h-[75vh] rounded-[28px] border border-[#d8c79f] bg-[#f8efd8] p-3 shadow-sm sm:p-5">
     <div className="mb-4 flex items-center justify-between gap-3 border-b border-[#c9b68a] pb-3">
       <button onClick={()=>setSecao(null)} className="inline-flex items-center gap-2 rounded-full border border-[#8b6c3f]/40 bg-[#fff8e8] px-3 py-2 text-sm font-bold text-[#5a4027]"><ChevronLeft className="size-4"/>Central Litúrgica</button>
       <h1 className="text-right font-serif text-xl font-bold text-[#5c3d27] sm:text-2xl">{secao.titulo}</h1>
     </div>
     {secao.tipo==="liturgia"?<LiturgiaDiaria/>:<AcervoLiturgicoOffline categoriaInicial={secao.categoria} buscaInicial={secao.busca} embutido titulo={secao.titulo}/>} 
   </section>
 }

 return <section className="relative min-h-[78vh] overflow-hidden rounded-[28px] border border-[#d8c79f] bg-[linear-gradient(180deg,#fbf2d8,#eadfb8)] shadow-sm">
   <div className="absolute inset-0 opacity-[.09] [background-image:radial-gradient(circle_at_20%_20%,#6d4b2a_0,transparent_28%),radial-gradient(circle_at_75%_55%,#6d4b2a_0,transparent_25%)]"/>
   <div className="relative p-5 sm:p-8">
     <div className="mb-5 flex items-center justify-between gap-4 border-b border-[#9b7a4c]/25 pb-4">
       <div><p className="text-xs font-bold uppercase tracking-[.22em] text-[#9a762d]">Comunidade Santa Luzia</p><h1 className="mt-1 font-serif text-3xl font-bold text-[#583b28] sm:text-4xl">Central Litúrgica</h1></div>
       <span className="hidden size-14 items-center justify-center rounded-full border-2 border-[#9a762d] text-[#6a4a2a] sm:flex"><Church className="size-7"/></span>
     </div>

     {santo&&<button type="button" onClick={()=>setSecao({id:"santo-hoje",titulo:santo.nome,categoria:"oficio",busca:santo.chave})} className="mb-7 grid w-full max-w-3xl grid-cols-[92px_1fr] overflow-hidden rounded-2xl border border-[#bda36f] bg-[#fff8e8]/90 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:grid-cols-[120px_1fr]">
       <div className="relative min-h-[120px] bg-[#d8c79f]"><img src={santo.imagem} alt={santo.nome} className="absolute inset-0 size-full object-cover" onError={(e)=>{e.currentTarget.style.display="none"}}/></div>
       <div className="flex flex-col justify-center p-4 sm:p-5">
         <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#9a762d]">Santo do dia · {dataHoje}</p>
         <h2 className="mt-1 font-serif text-2xl font-bold text-[#5a3c28] sm:text-3xl">{santo.nome}</h2>
         {santo.subtitulo&&<p className="mt-1 text-sm italic text-[#6f5b46]">{santo.subtitulo}</p>}
         <p className="mt-3 text-xs font-semibold text-[#7c5b31]">Toque para abrir os textos próprios do dia</p>
       </div>
     </button>}

     <div className="max-w-3xl space-y-1">
       {secoes.map((s,i)=><div key={s.id}>{i===7||i===10?<div className="my-4 h-px bg-[#8e6e43]/30"/>:null}<button onClick={()=>setSecao(s)} className="group flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-white/35"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg text-[#6c472b] transition group-hover:bg-[#6c472b] group-hover:text-[#fff4d6]"><Icone id={s.id}/></span><span className="font-serif text-[1.35rem] font-semibold italic text-[#5a3c28] sm:text-[1.55rem]">{s.titulo}</span></button></div>)}
     </div>
     <div className="mt-8 flex items-center gap-2 rounded-xl border border-[#9b7a4c]/30 bg-white/25 px-3 py-2 text-sm text-[#67513c]"><Search className="size-4"/><span>Use “Índice geral” para pesquisar em cada área da Central Litúrgica.</span></div>
   </div>
 </section>
}
