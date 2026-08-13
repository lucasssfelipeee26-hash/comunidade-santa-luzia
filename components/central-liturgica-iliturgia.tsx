"use client"

import { useEffect, useMemo, useState } from "react"
import { BookOpenText, ChevronLeft, Church, Clock3, Menu, MoonStar, MoreHorizontal, ScrollText, Sun, Sunrise, Sunset } from "lucide-react"
import { AcervoLiturgicoOffline } from "@/components/acervo-liturgico-offline"
import { LiturgiaDiaria } from "@/components/liturgia-diaria"
import { documentoHoraSanto, documentoHoraTemporal, type HoraLiturgica } from "@/lib/iliturgia-calendario"
import { celebracaoDoDiaBrasil as celebracaoDoDia, imagemCelebracao } from "@/lib/iliturgia-sanctoral-brasil"
import { documentoRosarioDoDia, misterioRosarioDoDia } from "@/lib/iliturgia-rosario"
import { prefaciosProprios, prefaciosTempo } from "@/lib/iliturgia-prefacios"
import { documentoCatequeseDoDia, documentoEvangelhoDaReferencia, documentoLecionarioDasLeituras } from "@/lib/iliturgia-conteudo-dia"
import { documentoMissalProprio } from "@/lib/iliturgia-missal-proprio"
import { comentariosILiturgia, indiceGeralILiturgia, invitatorioILiturgia, oracoesILiturgia, vigiliaILiturgia } from "@/lib/iliturgia-menus"
import { documentoLeituraBienal, tituloLeituraBienal } from "@/lib/iliturgia-bienal"

type Modulo="hoje"|"oficio"|"liturgia"|"missal"|"mais"
type Tela={id:string;titulo:string;categoria?:string;busca?:string;documento?:string;tipo?:"liturgia"|"acervo";mostrarCategorias?:boolean}
type SantoHoje={nome:string;resumo?:string;imagem?:string|null}|null
type Leitura={titulo?:string;referencia?:string;texto?:string}
type LiturgiaHoje={data?:string;liturgia?:string;tempoLiturgicoAtual?:string;santoDoDia?:SantoHoje;fonte?:{arquivoOrigem?:string};leituras?:{primeiraLeitura?:Leitura[];salmo?:Leitura[];segundaLeitura?:Leitura[];evangelho?:Leitura[]}}
type Submenu="ordinario"|"eucaristicas"|"prefacios"|"prefacios-proprios"|"prefacios-tempo"|"catequeses"|"comentarios"|"oracoes"|"vigilia"|null

const horasBase:{id:HoraLiturgica;titulo:string}[]=[
 {id:"leituras",titulo:"Ofício das Leituras"},{id:"laudes",titulo:"Laudes"},{id:"terca",titulo:"Hora Terça"},{id:"sexta",titulo:"Hora Sexta"},{id:"nona",titulo:"Hora Nona"},{id:"vesperas",titulo:"Vésperas"},{id:"completas",titulo:"Completas"},
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
const comentariosTelas:Tela[]=comentariosILiturgia.map(x=>({...x,categoria:"comentarios"}))
const oracoesTelas:Tela[]=oracoesILiturgia.map(x=>({...x,categoria:"oficio"}))

function chaveDeImagem(imagem?:string|null){if(!imagem)return "";const nome=imagem.split("/").pop()||"";return nome.replace(/\.(jpg|jpeg|png|webp|gif)$/i,"")}
function imagemPublica(imagem?:string|null){if(!imagem)return "";const nome=imagem.split("/").pop()||imagem;return nome.startsWith("/")?nome:`/${nome}`}
function documentoLecionario(arquivo?:string){return arquivo?.replace(/^assets\/Resources\//,"")||""}
function IconeHora({id}:{id:string}){if(id==="laudes")return <Sunrise className="size-5"/>;if(["terca","sexta","nona"].includes(id))return <Sun className="size-5"/>;if(id==="vesperas")return <Sunset className="size-5"/>;if(id==="completas")return <MoonStar className="size-5"/>;return <BookOpenText className="size-5"/>}
function ListaModulo({itens,abrir}:{itens:Tela[];abrir:(t:Tela)=>void}){return <div className="overflow-hidden rounded-xl border border-[#6f5a43]/30 bg-[#f7edcf]">{itens.map((item,i)=><button key={item.id} onClick={()=>abrir(item)} className={`flex w-full items-center gap-4 px-4 py-3.5 text-left transition hover:bg-[#eadbb4] ${i?"border-t border-[#806b50]/20":""}`}><span className="flex size-8 shrink-0 items-center justify-center text-[#6e4d31]"><IconeHora id={item.id}/></span><span className="font-serif text-xl font-semibold italic text-[#5b3d29]">{item.titulo}</span></button>)}</div>}

export function CentralLiturgicaILiturgia(){
 const[modulo,setModulo]=useState<Modulo>("hoje"),[tela,setTela]=useState<Tela|null>(null),[submenu,setSubmenu]=useState<Submenu>(null),[hoje,setHoje]=useState<LiturgiaHoje|null>(null),[menuAberto,setMenuAberto]=useState(false),[imagemComErro,setImagemComErro]=useState<string|null>(null)
 useEffect(()=>{let vivo=true;fetch("/api/liturgia-local",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(j=>{if(vivo)setHoje(j)}).catch(()=>{});return()=>{vivo=false}},[])
 const agora=useMemo(()=>new Date(),[])
 const dataCompleta=useMemo(()=>new Intl.DateTimeFormat("pt-BR",{weekday:"long",day:"2-digit",month:"long",year:"numeric"}).format(agora),[agora])
 const celebracao=useMemo(()=>celebracaoDoDia(agora),[agora])
 const santo:SantoHoje=hoje?.santoDoDia||(celebracao?{nome:celebracao.nome,imagem:imagemCelebracao(celebracao)}:null)
 const mostrarImagem=Boolean(santo?.imagem&&santo.imagem!==imagemComErro)
 // Só usa uma chave litúrgica real. Criar a chave a partir do nome de uma
 // celebração sem arquivo próprio fazia o sistema carregar o Ofício temporal
 // de quinta-feira como se fosse o Ofício da santa.
 const chave=celebracao?.chave||chaveDeImagem(hoje?.santoDoDia?.imagem)||""
 const documentoBienal=documentoLeituraBienal(agora)
 const horas=useMemo<Tela[]>(()=>[
  {...invitatorioILiturgia,categoria:"oficio"},
  ...horasBase.flatMap(h=>h.id==="leituras"?[
    {id:h.id,titulo:h.titulo,categoria:"oficio",documento:documentoHoraSanto(chave,h.id)||documentoHoraTemporal(agora,h.id)},
    ...(documentoBienal?[{id:"leituras-bienais",titulo:tituloLeituraBienal(agora),categoria:"oficio",documento:documentoBienal}]:[]),
  ]:[{id:h.id,titulo:h.titulo,categoria:"oficio",documento:documentoHoraSanto(chave,h.id)||documentoHoraTemporal(agora,h.id)}]),
  {id:"vigilia",titulo:"Vigília"},
 ],[agora,chave,documentoBienal])
 const vigilia=useMemo<Tela[]>(()=>vigiliaILiturgia(agora).map(x=>({...x,categoria:"oficio"})),[agora])
 const evangelho=hoje?.leituras?.evangelho?.[0]
 const documentoEvangelho=documentoEvangelhoDaReferencia(evangelho?.referencia,evangelho?.titulo)
 const lecionario=documentoLecionario(hoje?.fonte?.arquivoOrigem)||documentoLecionarioDasLeituras(hoje?.leituras?.primeiraLeitura,hoje?.leituras?.segundaLeitura,hoje?.leituras?.evangelho)
 const proprioMissal=documentoMissalProprio(agora,celebracao?.chave||chave)
 const outrosOficio:Tela[]=[
  {id:"salterio",titulo:"Saltério",categoria:"salterio",documento:"salterio/salterio.htm"},
  {...indiceGeralILiturgia,categoria:"geral"},
  {id:"oficio-completo",titulo:"Acervo completo da Liturgia das Horas",categoria:"oficio"},
 ]
 const outrosLiturgia:Tela[]=[
  ...(documentoEvangelho?[{id:"evangelho-dia",titulo:"Evangelho e Lectio Divina do dia",categoria:"evangelho",documento:documentoEvangelho}]:[]),
  ...(lecionario?[{id:"lecionario-dia",titulo:"Lecionário do dia",categoria:"lecionario",documento:lecionario}]:[]),
  {id:"evangelhos-completos",titulo:"Evangelhos e Lectio Divina",categoria:"evangelho"},
  {id:"lecionario-completo",titulo:"Lecionário completo",categoria:"lecionario"},
 ]
 const catequeses:Tela[]=[
  {id:"catequese-laudes",titulo:"Catequese de Laudes do dia",categoria:"catequeses",documento:documentoCatequeseDoDia(agora,"laudes")},
  {id:"catequese-vesperas",titulo:"Catequese de Vésperas do dia",categoria:"catequeses",documento:documentoCatequeseDoDia(agora,"vesperas")},
  {id:"catequeses-completas",titulo:"Todas as catequeses",categoria:"catequeses"},
 ]
 const missal:Tela[]=[{id:"ordinario",titulo:"Ordinário da Missa"},{id:"prefacios",titulo:"Prefácios"},{id:"eucaristicas",titulo:"Orações Eucarísticas"},...(proprioMissal?[{id:"proprio",titulo:"Próprio do Missal do dia",categoria:"missal",documento:proprioMissal}]:[]),{id:"missal-completo",titulo:"Missal e ritos completos",categoria:"missal"}]
 const mais:Tela[]=[
  {id:"rosario",titulo:`Santo Rosário · ${misterioRosarioDoDia(agora)}`,categoria:"rosario",documento:documentoRosarioDoDia(agora)},
  {id:"rosario-completo",titulo:"Todos os mistérios do Santo Rosário",categoria:"rosario"},
  {id:"catequeses",titulo:"Catequeses"},{id:"comentarios",titulo:"Comentários litúrgicos"},{id:"oracoes",titulo:"Orações"},
  {id:"documentos-gerais",titulo:"Outros documentos do iLiturgia",categoria:"geral"},
  {id:"acervo-completo",titulo:"Todo o acervo do iLiturgia",mostrarCategorias:true},
 ]
 function abrir(t:Tela){
  if(t.id==="ordinario"||t.id==="eucaristicas"||t.id==="prefacios"||t.id==="prefacios-proprios"||t.id==="prefacios-tempo"||t.id==="catequeses"||t.id==="comentarios"||t.id==="oracoes"||t.id==="vigilia"){setSubmenu(t.id as Submenu);return}
  setTela(t)
 }
 function voltar(){if(submenu==="prefacios-proprios"||submenu==="prefacios-tempo")setSubmenu("prefacios");else setSubmenu(null)}
 function selecionarModulo(id:Modulo){setModulo(id);setSubmenu(null);setMenuAberto(false)}
 if(tela)return <section className="min-h-[78vh] bg-[#f2e6c6] pb-24"><div className="sticky top-0 z-20 flex items-center gap-3 border-b border-[#715b40]/30 bg-[#62412d] px-3 py-3 text-[#fff4d7] shadow-sm"><button onClick={()=>setTela(null)} className="flex size-9 items-center justify-center rounded-full hover:bg-white/10" aria-label="Voltar"><ChevronLeft className="size-6"/></button><h1 className="font-serif text-xl font-semibold">{tela.titulo}</h1></div><div className="mx-auto max-w-4xl p-3 sm:p-5"><AcervoLiturgicoOffline categoriaInicial={tela.categoria} buscaInicial={tela.busca} documentoInicial={tela.documento} embutido={!tela.mostrarCategorias} titulo={tela.titulo}/></div></section>
 return <section className="relative min-h-[82vh] overflow-hidden rounded-2xl border border-[#745a3d]/30 bg-[#efe2bf] pb-24 shadow-sm">
  <header className="relative z-40 bg-[#62412d] px-4 py-4 text-[#fff5dc] shadow-sm"><div className="mx-auto flex max-w-4xl items-center justify-between gap-3"><div className="flex items-center gap-3"><button type="button" onClick={()=>setMenuAberto(v=>!v)} aria-expanded={menuAberto} aria-controls="menu-central-liturgica" aria-label={menuAberto?"Fechar menu da Central Litúrgica":"Abrir menu da Central Litúrgica"} className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#f0d9a6]/30 bg-white/5 transition hover:bg-white/10"><Menu className="size-6"/></button><div><h1 className="font-serif text-2xl font-bold">Central Litúrgica</h1><p className="text-[11px] capitalize text-[#e9d6ad]">{hoje?.data||dataCompleta}</p>{(hoje?.liturgia||celebracao?.nome)&&<p className="mt-0.5 text-[11px] text-[#f1dfb8]">{hoje?.liturgia||celebracao?.nome}</p>}</div></div><Church className="size-7 text-[#f1d28a]"/></div>{menuAberto&&<nav id="menu-central-liturgica" aria-label="Seções da Central Litúrgica" className="absolute left-3 right-3 top-full mt-2 overflow-hidden rounded-2xl border border-[#80694d]/35 bg-[#fff9e9] p-2 text-[#5b3d29] shadow-xl sm:right-auto sm:w-80">{([['hoje','Hoje',Church],['oficio','Ofício',Clock3],['liturgia','Liturgia',BookOpenText],['missal','Missal',ScrollText],['mais','Mais',MoreHorizontal]] as const).map(([id,label,I])=><button key={id} type="button" onClick={()=>selecionarModulo(id)} aria-current={modulo===id?"page":undefined} className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left font-semibold transition last:mb-0 ${modulo===id?"bg-[#765239] text-[#fff1c9]":"hover:bg-[#efe0bd]"}`}><I className="size-5"/><span>{label}</span></button>)}</nav>}</header>
  <div className="mx-auto max-w-4xl p-3 sm:p-5">
   {modulo==="hoje"&&<div className="space-y-5">{santo&&<section className="overflow-hidden rounded-2xl border border-[#80694d]/35 bg-[#f8edcf] shadow-sm"><div className={mostrarImagem?"grid grid-cols-[110px_1fr] sm:grid-cols-[150px_1fr]":""}>{mostrarImagem&&<div className="relative min-h-[155px] bg-[#d8c49a]"><img src={imagemPublica(santo.imagem)} alt={santo.nome} className="absolute inset-0 size-full object-cover" onError={()=>setImagemComErro(santo.imagem||null)}/></div>}<div className="flex flex-col justify-center p-4"><p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#997026]">Celebração do dia</p><h2 className="mt-1 font-serif text-2xl font-bold text-[#583b28] sm:text-3xl">{santo.nome}</h2>{celebracao?.grau&&<p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[#96722b]">{celebracao.grau.replace("-"," ")}</p>}{santo.resumo&&<p className="mt-2 text-sm leading-6 text-[#705c47]">{santo.resumo}</p>}</div></div></section>}<section><div className="mb-2 px-1"><p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#997026]">Liturgia do dia</p><h2 className="font-serif text-2xl font-bold text-[#583b28]">{hoje?.liturgia||celebracao?.nome||"Leituras e Evangelho"}</h2>{hoje?.tempoLiturgicoAtual&&<p className="mt-1 text-sm text-[#705c47]">{hoje.tempoLiturgicoAtual}</p>}</div><LiturgiaDiaria/></section></div>}
   {modulo==="oficio"&&<div className="space-y-4">{submenu==="vigilia"&&<button onClick={()=>setSubmenu(null)} className="inline-flex items-center gap-2 rounded-full border border-[#80694d]/35 bg-[#fff7df] px-3 py-2 text-sm font-semibold text-[#5b3d29]"><ChevronLeft className="size-4"/>Ofício</button>}{submenu==="vigilia"?<ListaModulo itens={vigilia} abrir={abrir}/>:<><div><p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[.18em] text-[#997026]">Ofício do dia</p><ListaModulo itens={horas} abrir={abrir}/></div><div><p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[.18em] text-[#997026]">Outros conteúdos do Ofício</p><ListaModulo itens={outrosOficio} abrir={abrir}/></div></>}</div>}
   {modulo==="liturgia"&&<div className="space-y-5"><LiturgiaDiaria/><section><p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[.18em] text-[#997026]">Outros conteúdos da Liturgia</p><ListaModulo itens={outrosLiturgia} abrir={abrir}/></section></div>}
   {modulo==="missal"&&<div className="space-y-3">{submenu&&<button onClick={voltar} className="inline-flex items-center gap-2 rounded-full border border-[#80694d]/35 bg-[#fff7df] px-3 py-2 text-sm font-semibold text-[#5b3d29]"><ChevronLeft className="size-4"/>{submenu==="prefacios-proprios"||submenu==="prefacios-tempo"?"Prefácios":"Missal"}</button>}{submenu==="ordinario"?<ListaModulo itens={ordinario} abrir={abrir}/>:submenu==="eucaristicas"?<ListaModulo itens={eucaristicas} abrir={abrir}/>:submenu==="prefacios"?<ListaModulo itens={prefaciosMenu} abrir={abrir}/>:submenu==="prefacios-proprios"?<ListaModulo itens={prefaciosPropriosTelas} abrir={abrir}/>:submenu==="prefacios-tempo"?<ListaModulo itens={prefaciosTempoTelas} abrir={abrir}/>:<ListaModulo itens={missal} abrir={abrir}/>}</div>}
   {modulo==="mais"&&<div className="space-y-3">{submenu&&<button onClick={voltar} className="inline-flex items-center gap-2 rounded-full border border-[#80694d]/35 bg-[#fff7df] px-3 py-2 text-sm font-semibold text-[#5b3d29]"><ChevronLeft className="size-4"/>Mais</button>}{submenu==="catequeses"?<ListaModulo itens={catequeses} abrir={abrir}/>:submenu==="comentarios"?<ListaModulo itens={comentariosTelas} abrir={abrir}/>:submenu==="oracoes"?<ListaModulo itens={oracoesTelas} abrir={abrir}/>:<ListaModulo itens={mais} abrir={abrir}/>}</div>}
  </div>
 </section>
}
