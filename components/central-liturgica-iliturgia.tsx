"use client"

import { useEffect, useMemo, useState } from "react"
import { BookOpenText, ChevronLeft, Church, Clock3, Menu, MoonStar, MoreHorizontal, ScrollText, Sun, Sunrise, Sunset } from "lucide-react"
import { AcervoLiturgicoOffline } from "@/components/acervo-liturgico-offline"
import { LiturgiaDiaria } from "@/components/liturgia-diaria"
import { documentoHoraSanto, documentoHoraTemporal, type HoraLiturgica } from "@/lib/iliturgia-calendario"
import { celebracaoDoDia, imagemCelebracao } from "@/lib/iliturgia-sanctoral"
import { documentoRosarioDoDia, misterioRosarioDoDia } from "@/lib/iliturgia-rosario"
import { prefaciosProprios, prefaciosTempo } from "@/lib/iliturgia-prefacios"
import { documentoCatequeseDoDia, documentoEvangelhoDaReferencia } from "@/lib/iliturgia-conteudo-dia"

type Modulo="hoje"|"oficio"|"liturgia"|"missal"|"mais"
type Tela={id:string;titulo:string;categoria?:string;busca?:string;documento?:string;tipo?:"liturgia"|"acervo"}
type SantoHoje={nome:string;resumo?:string;imagem?:string|null}|null
type Leitura={titulo?:string;referencia?:string;texto?:string}
type LiturgiaHoje={
 data?:string;liturgia?:string;tempoLiturgicoAtual?:string;santoDoDia?:SantoHoje;
 fonte?:{arquivoOrigem?:string};
 leituras?:{primeiraLeitura?:Leitura[];salmo?:Leitura[];segundaLeitura?:Leitura[];evangelho?:Leitura[]}
}
type Submenu="ordinario"|"eucaristicas"|"prefacios"|"prefacios-proprios"|"prefacios-tempo"|"catequeses"|null

const horasBase:{id:HoraLiturgica;titulo:string}[]=[
 {id:"leituras",titulo:"Ofício das Leituras"},{id:"laudes",titulo:"Laudes"},{id:"terca",titulo:"Hora Terça"},{id:"sexta",titulo:"Hora Sexta"},{id:"nona",titulo:"Hora Nona"},{id:"vesperas",titulo:"Vésperas"},{id:"completas",titulo:"Completas"},{id:"vigilia",titulo:"Vigília"},
]
const ordinario:Tela[]=[
 {id:"ritos-iniciais",titulo:"Ritos Iniciais",categoria:"missal",documento:"missal/ordinario/ritosiniciais.htm"},
 {id:"liturgia-palavra",titulo:"Liturgia da Palavra",categoria:"missal",documento:"missal/ordinario/liturgiapalavra.htm"},
 {id:"oracao-fieis",titulo:"Oração dos Fiéis",categoria:"missal",documento:"missal/ordinario/oracaodosfieis.htm"},
 {id:"liturgia-eucaristica",titulo:"Liturgia Eucarística",categoria:"missal",documento:"missal/ordinario/liturgiaeucaristica.htm"},
 {id:"rito-comunhao",titulo:"Rito da Comunhão",categoria:"missal",documento:"missal/ordinario/ritocomunhao.htm"},
 {id:"ritos-finais",titulo:"Ritos Finais",categoria:"missal",documento:"missal/ordinario/ritosfinais.htm"},
]
const eucaristicas:Tela[]=["I","II","III","IV","V","VI-A","VI-B","VI-C","VI-D","VII","VIII","IX","X","XI"].map(n=>({id:`oe-${n}`,titulo:`Oração Eucarística ${n}`,categoria:"missal",documento:`missal/oracaoeucaristica/oracaoeucaristica${n}.htm`}))
const prefaciosMenu:Tela[]=[{id:"prefacios-proprios",titulo:"Prefácios Próprios"},{id:"prefacios-tempo",titulo:"Prefácios dos Tempos e Comuns"}]
const prefaciosPropriosTelas:Tela[]=prefaciosProprios.map(x=>({...x,categoria:"missal"}))
const prefaciosTempoTelas:Tela[]=prefaciosTempo.map(x=>({...x,categoria:"missal"}))
const missal:Tela[]=[{id:"ordinario",titulo:"Ordinário da Missa"},{id:"prefacios",titulo:"Prefácios"},{id:"eucaristicas",titulo:"Orações Eucarísticas"},{id:"proprio",titulo:"Próprio do Missal",categoria:"missal",busca:"missal/proprio/"}]

function chaveDeImagem(imagem?:string|null){if(!imagem)return "";const nome=imagem.split("/").pop()||"";return nome.replace(/\.(jpg|jpeg|png|webp|gif)$/i,"")}
function normalizarNome(nome:string){return nome.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\b(sao|santo|santa)\b/g,"").replace(/[^a-z0-9]/g,"")}
function chaveSanto(s:SantoHoje){return s?(chaveDeImagem(s.imagem)||normalizarNome(s.nome)):""}
function imagemPublica(imagem?:string|null){if(!imagem)return "";const nome=imagem.split("/").pop()||imagem;return nome.startsWith("/")?nome:`/${nome}`}
function documentoLecionario(arquivo?:string){return arquivo?.replace(/^assets\/Resources\//,"")||""}
function IconeHora({id}:{id:string}){if(id==="laudes")return <Sunrise className="size-5"/>;if(["terca","sexta","nona"].includes(id))return <Sun className="size-5"/>;if(id==="vesperas")return <Sunset className="size-5"/>;if(id==="completas")return <MoonStar className="size-5"/>;return <BookOpenText className="size-5"/>}
function ListaModulo({itens,abrir}:{itens:Tela[];abrir:(t:Tela)=>void}){return <div className="overflow-hidden rounded-xl border border-[#6f5a43]/30 bg-[#f7edcf]">{itens.map((item,i)=><button key={item.id} onClick={()=>abrir(item)} className={`flex w-full items-center gap-4 px-4 py-3.5 text-left transition hover:bg-[#eadbb4] ${i?"border-t border-[#806b50]/20":""}`}><span className="flex size-8 shrink-0 items-center justify-center text-[#6e4d31]"><IconeHora id={item.id}/></span><span className="font-serif text-xl font-semibold italic text-[#5b3d29]">{item.titulo}</span></button>)}</div>}

export function CentralLiturgicaILiturgia(){
 const[modulo,setModulo]=useState<Modulo>("hoje"),[tela,setTela]=useState<Tela|null>(null),[submenu,setSubmenu]=useState<Submenu>(null),[hoje,setHoje]=useState<LiturgiaHoje|null>(null)
 useEffect(()=>{let vivo=true;fetch("/api/liturgia-local",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(j=>{if(vivo)setHoje(j)}).catch(()=>{});return()=>{vivo=false}},[])
 const agora=useMemo(()=>new Date(),[])
 const dataCompleta=useMemo(()=>new Intl.DateTimeFormat("pt-BR",{weekday:"long",day:"2-digit",month:"long",year:"numeric"}).format(agora),[agora])
 const celebracao=useMemo(()=>celebracaoDoDia(agora),[agora])
 const santo:SantoHoje=hoje?.santoDoDia||(celebracao?{nome:celebracao.nome,imagem:imagemCelebracao(celebracao)}:null)
 const chave=hoje?.santoDoDia?chaveSanto(hoje.santoDoDia):(celebracao?.chave||"")
 const documentoSanto=chave?`oficio/proprio/oficiodasleituras/${chave}.htm`:""
 const horas=useMemo<Tela[]>(()=>horasBase.map(h=>{const proprio=documentoHoraSanto(chave,h.id);const temporal=documentoHoraTemporal(agora,h.id);return{id:h.id,titulo:h.titulo,categoria:"oficio",documento:proprio||temporal}}),[agora,chave])
 const evangelho=hoje?.leituras?.evangelho?.[0]
 const documentoEvangelho=documentoEvangelhoDaReferencia(evangelho?.referencia,evangelho?.titulo)
 const lecionario=documentoLecionario(hoje?.fonte?.arquivoOrigem)
 const catequeses:Tela[]=[
  {id:"catequese-laudes",titulo:"Catequese de Laudes",categoria:"catequeses",documento:documentoCatequeseDoDia(agora,"laudes")},
  {id:"catequese-vesperas",titulo:"Catequese de Vésperas",categoria:"catequeses",documento:documentoCatequeseDoDia(agora,"vesperas")},
 ]
 const mais=useMemo<Tela[]>(()=>[
  {id:"evangelho",titulo:"Evangelho e Lectio Divina",categoria:"evangelho",documento:documentoEvangelho},
  {id:"lecionario",titulo:"Lecionário do dia",categoria:"lecionario",documento:lecionario},
  {id:"rosario",titulo:`Santo Rosário · ${misterioRosarioDoDia(agora)}`,categoria:"rosario",documento:documentoRosarioDoDia(agora)},
  {id:"salterio",titulo:"Saltério",categoria:"salterio",documento:"salterio/salterio.htm"},
  {id:"catequeses",titulo:"Catequeses"},
  {id:"comentarios",titulo:"Comentários",categoria:"comentarios",busca:""},
  {id:"oracoes",titulo:"Orações",categoria:"geral",busca:"oração"},
  {id:"indice",titulo:"Índice Geral",categoria:"oficio",busca:""},
 ],[agora,documentoEvangelho,lecionario])
 function abrir(t:Tela){
  if(t.id==="ordinario"){setSubmenu("ordinario");return}
  if(t.id==="eucaristicas"){setSubmenu("eucaristicas");return}
  if(t.id==="prefacios"){setSubmenu("prefacios");return}
  if(t.id==="prefacios-proprios"){setSubmenu("prefacios-proprios");return}
  if(t.id==="prefacios-tempo"){setSubmenu("prefacios-tempo");return}
  if(t.id==="catequeses"){setSubmenu("catequeses");return}
  setTela(t)
 }
 function voltar(){if(submenu==="prefacios-proprios"||submenu==="prefacios-tempo")setSubmenu("prefacios");else setSubmenu(null)}
 if(tela)return <section className="min-h-[78vh] bg-[#f2e6c6] pb-24"><div className="sticky top-0 z-20 flex items-center gap-3 border-b border-[#715b40]/30 bg-[#62412d] px-3 py-3 text-[#fff4d7] shadow-sm"><button onClick={()=>setTela(null)} className="flex size-9 items-center justify-center rounded-full hover:bg-white/10" aria-label="Voltar"><ChevronLeft className="size-6"/></button><h1 className="font-serif text-xl font-semibold">{tela.titulo}</h1></div><div className="mx-auto max-w-4xl p-3 sm:p-5">{tela.tipo==="liturgia"?<LiturgiaDiaria/>:<AcervoLiturgicoOffline categoriaInicial={tela.categoria} buscaInicial={tela.busca} documentoInicial={tela.documento} embutido titulo={tela.titulo}/>}</div></section>
 return <section className="relative min-h-[82vh] overflow-hidden rounded-2xl border border-[#745a3d]/30 bg-[#efe2bf] pb-20 shadow-sm">
  <header className="bg-[#62412d] px-4 py-4 text-[#fff5dc] shadow-sm"><div className="mx-auto flex max-w-4xl items-center justify-between gap-3"><div className="flex items-center gap-3"><Menu className="size-6"/><div><h1 className="font-serif text-2xl font-bold">Central Litúrgica</h1><p className="text-[11px] capitalize text-[#e9d6ad]">{hoje?.data||dataCompleta}</p>{(hoje?.liturgia||celebracao?.nome)&&<p className="mt-0.5 text-[11px] text-[#f1dfb8]">{hoje?.liturgia||celebracao?.nome}</p>}</div></div><Church className="size-7 text-[#f1d28a]"/></div></header>
  <div className="mx-auto max-w-4xl p-3 sm:p-5">
   {modulo==="hoje"&&<div className="space-y-5">
    {santo&&<section className="overflow-hidden rounded-2xl border border-[#80694d]/35 bg-[#f8edcf] shadow-sm"><div className="grid grid-cols-[110px_1fr] sm:grid-cols-[150px_1fr]"><div className="relative min-h-[155px] bg-[#d8c49a]">{santo.imagem&&<img src={imagemPublica(santo.imagem)} alt={santo.nome} className="absolute inset-0 size-full object-cover" onError={e=>{e.currentTarget.style.display="none"}}/>}</div><div className="flex flex-col justify-center p-4"><p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#997026]">Celebração do dia</p><h2 className="mt-1 font-serif text-2xl font-bold text-[#583b28] sm:text-3xl">{santo.nome}</h2>{celebracao?.grau&&<p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[#96722b]">{celebracao.grau.replace("-"," ")}</p>}{santo.resumo&&<p className="mt-2 text-sm leading-6 text-[#705c47]">{santo.resumo}</p>}</div></div>{documentoSanto&&<div className="border-t border-[#80694d]/25 bg-[#fffaf0] p-3 sm:p-4"><AcervoLiturgicoOffline categoriaInicial="oficio" documentoInicial={documentoSanto} embutido titulo={santo.nome}/></div>}</section>}
    <section><div className="mb-2 px-1"><p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#997026]">Liturgia do dia</p><h2 className="font-serif text-2xl font-bold text-[#583b28]">{hoje?.liturgia||celebracao?.nome||"Leituras e Evangelho"}</h2>{hoje?.tempoLiturgicoAtual&&<p className="mt-1 text-sm text-[#705c47]">{hoje.tempoLiturgicoAtual}</p>}</div><LiturgiaDiaria/></section>
   </div>}
   {modulo==="oficio"&&<ListaModulo itens={horas} abrir={abrir}/>} 
   {modulo==="liturgia"&&<LiturgiaDiaria/>}
   {modulo==="missal"&&<div className="space-y-3">{submenu&&<button onClick={voltar} className="inline-flex items-center gap-2 rounded-full border border-[#80694d]/35 bg-[#fff7df] px-3 py-2 text-sm font-semibold text-[#5b3d29]"><ChevronLeft className="size-4"/>{submenu==="prefacios-proprios"||submenu==="prefacios-tempo"?"Prefácios":"Missal"}</button>}{submenu==="ordinario"?<ListaModulo itens={ordinario} abrir={abrir}/>:submenu==="eucaristicas"?<ListaModulo itens={eucaristicas} abrir={abrir}/>:submenu==="prefacios"?<ListaModulo itens={prefaciosMenu} abrir={abrir}/>:submenu==="prefacios-proprios"?<ListaModulo itens={prefaciosPropriosTelas} abrir={abrir}/>:submenu==="prefacios-tempo"?<ListaModulo itens={prefaciosTempoTelas} abrir={abrir}/>:<ListaModulo itens={missal} abrir={abrir}/>}</div>} 
   {modulo==="mais"&&<div className="space-y-3">{submenu==="catequeses"&&<button onClick={()=>setSubmenu(null)} className="inline-flex items-center gap-2 rounded-full border border-[#80694d]/35 bg-[#fff7df] px-3 py-2 text-sm font-semibold text-[#5b3d29]"><ChevronLeft className="size-4"/>Mais</button>}{submenu==="catequeses"?<ListaModulo itens={catequeses} abrir={abrir}/>:<ListaModulo itens={mais} abrir={abrir}/>}</div>} 
  </div>
  <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto grid max-w-[920px] grid-cols-5 border-t border-[#5b412d]/30 bg-[#62412d] text-[#e8d7b3] shadow-[0_-4px_12px_rgba(0,0,0,.12)] sm:rounded-t-2xl">{([['hoje','Hoje',Church],['oficio','Ofício',Clock3],['liturgia','Liturgia',BookOpenText],['missal','Missal',ScrollText],['mais','Mais',MoreHorizontal]] as const).map(([id,label,I])=><button key={id} onClick={()=>{setModulo(id);setSubmenu(null)}} className={`flex flex-col items-center gap-1 px-1 py-2.5 text-[10px] font-semibold ${modulo===id?"bg-[#765239] text-[#fff1c9]":""}`}><I className="size-5"/><span>{label}</span></button>)}</nav>
 </section>
}
