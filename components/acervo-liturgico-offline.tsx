"use client"

import { useEffect, useMemo, useState } from "react"
import { BookOpenText, Library, Loader2, Search, X } from "lucide-react"
import { documentoHoraTemporal, type HoraLiturgica } from "@/lib/iliturgia-calendario"
import { celebracaoDoDiaBrasil as celebracaoDoDia } from "@/lib/iliturgia-sanctoral-brasil"
import { comumDaCelebracao, documentoComum } from "@/lib/iliturgia-comuns"

type Categoria={id:string;nome:string;total:number;arquivos:string[]}
type Manifesto={version:number;offline:boolean;embedded?:boolean;preservaHtmlLiturgico?:boolean;imagensImportadas:boolean;total:number;origem:string;categorias:Categoria[]}
type Documento={id:string;path:string;title:string;text?:string;html?:string}
type Pacote={category:string;documents:Documento[]}
type Props={categoriaInicial?:string;buscaInicial?:string;embutido?:boolean;titulo?:string;documentoInicial?:string}

const BASE="/offline/iliturgia"
const MANIFESTO=`${BASE}/manifest.json`
const pacoteUrl=(nome:string)=>`${BASE}/${encodeURIComponent(nome)}`

const COM_IVESPERAS=new Set([
  "nsaparecida","anunciacao","apresentacao","ascensaodosenhor","assuncao","corpuschristi","cristoreidouniverso","epifania","exaltacao","fieisdefuntos","imaculada","natal","pascoa","pedroepaulo","pentecostes","ramos","sagradafamilia","santamaria","santissimatrindade","saojoao","saojose","scj","todosossantos","transfiguracao",
])

async function abrir(res:Response):Promise<Pacote>{
  if(!res.ok)throw new Error("Pacote litúrgico interno não encontrado.")
  if(!("DecompressionStream" in window))throw new Error("Este aparelho não suporta a leitura do acervo compactado.")
  const s=res.body?.pipeThrough(new DecompressionStream("gzip"))
  if(!s)throw new Error("Não foi possível abrir o conteúdo.")
  return JSON.parse(await new Response(s).text())
}

async function carregarCategoria(m:Manifesto,categoria:string){
  const c=m.categorias.find(x=>x.id===categoria)
  if(!c)throw new Error("Categoria litúrgica não encontrada.")
  const pacotes=await Promise.all(c.arquivos.map(async a=>abrir(await fetch(pacoteUrl(a),{cache:"force-cache"}))))
  return pacotes.flatMap(x=>x.documents)
}

function norm(v:string){return v.replace(/^\/+/,"").replace(/\\/g,"/").toLowerCase()}
function base(v:string){return norm(v).split("/").pop()||norm(v)}
function loose(v:string){return base(v).replace(/\.html?$/i,"").replace(/[^a-z0-9]/g,"")}
function procurar(docs:Documento[],documento:string){
  const alvo=norm(documento)
  const exato=docs.find(d=>norm(d.path)===alvo||norm(d.id)===alvo);if(exato)return exato
  const alvoBase=base(alvo),porBase=docs.filter(d=>base(d.path)===alvoBase||base(d.id)===alvoBase);if(porBase.length===1)return porBase[0]
  const alvoLoose=loose(alvo),porLoose=docs.filter(d=>loose(d.path)===alvoLoose||loose(d.id)===alvoLoose);if(porLoose.length===1)return porLoose[0]
  return null
}
function horaDoProprio(documento:string):HoraLiturgica|null{
  const p=norm(documento)
  if(p.includes("/proprio/oficiodasleituras/"))return "leituras"
  const m=p.match(/_(laudes|terca|sexta|nona|vesperas|completas)\.html?$/i)
  return (m?.[1] as HoraLiturgica|undefined)||null
}
function chaveDoProprio(documento:string){
  const p=norm(documento)
  const leituras=p.match(/\/proprio\/oficiodasleituras\/([^/]+)\.html?$/i)
  if(leituras?.[1])return leituras[1]
  const horas=p.match(/\/proprio\/horas\/([^/]+?)_(?:laudes|terca|sexta|nona|vesperas|completas|ivesperas)\.html?$/i)
  return horas?.[1]||""
}
function amanha(data:Date){const d=new Date(data);d.setDate(d.getDate()+1);return d}
function excecoesProprio(chave:string,hora:HoraLiturgica|null){
  const itens:string[]=[]
  if(chave==="catedra"&&hora&&["terca","sexta","nona"].includes(hora))itens.push(`oficio/proprio/horas/catedra_comum_${hora}.htm`)
  return itens
}
function resolverDocumento(docs:Documento[],categoria:string,bruto:string,data:Date){
  const alternativas=bruto.split("||").map(norm).filter(Boolean)
  if(!alternativas.length)return null
  const hora=horaDoProprio(alternativas[0])
  const chave=chaveDoProprio(alternativas[0])

  if(categoria==="oficio"&&hora==="vesperas"){
    const prox=celebracaoDoDia(amanha(data))
    const proxChave=prox?.chave?.toLowerCase()||""
    if(proxChave&&COM_IVESPERAS.has(proxChave)){
      const primeira=`oficio/proprio/horas/${prox!.chave}_Ivesperas.htm`
      const docPrimeira=procurar(docs,primeira)
      if(docPrimeira)return docPrimeira
      const comumProx=comumDaCelebracao(prox!.chave)
      if(comumProx){
        const comumPrimeira=documentoComum(comumProx,"vesperas",true)
        const docComumPrimeira=procurar(docs,comumPrimeira)
        if(docComumPrimeira)return docComumPrimeira
      }
    }
  }

  for(const alternativa of alternativas){const encontrado=procurar(docs,alternativa);if(encontrado)return encontrado}

  if(categoria==="oficio"&&chave){
    for(const caminho of excecoesProprio(chave,hora)){const encontrado=procurar(docs,caminho);if(encontrado)return encontrado}
  }

  if(categoria==="oficio"&&hora&&hora!=="completas"&&hora!=="vigilia"&&chave){
    const comum=comumDaCelebracao(chave)
    if(comum){
      const caminho=documentoComum(comum,hora)
      const encontrado=procurar(docs,caminho)
      if(encontrado)return encontrado
    }
  }

  if(categoria==="oficio"&&hora){
    const temporal=documentoHoraTemporal(data,hora)
    const encontrado=procurar(docs,temporal)
    if(encontrado)return encontrado
  }
  return null
}

const imagensRosario:Record<string,string[]>={
  "misterios_alegria.htm":["anunciacao.gif","visitacao.gif","natividade.gif","apresentacao.gif","entredoutores.gif"],
  "misterios_luz.htm":["batismo.gif","bodas.gif","pregacao.gif","transfiguracao.gif","eucaristia.gif"],
  "misterios_dor.htm":["agonianohorto.gif","flagelacao.gif","espinhos.gif","cruzcarregada.gif","crucificacao.gif"],
  "misterios_gloria.htm":["ressureicao.gif","ascencao.gif","pentecostes.gif","assuncao.gif","coroacao.gif"],
}

function textoHtml(h:string){const d=new DOMParser().parseFromString(h,"text/html");return d.body.textContent||""}
function sanitizar(h:string,documentPath=""){
  const d=new DOMParser().parseFromString(h,"text/html")
  const arquivo=(documentPath.split("/").pop()||"").toLowerCase()
  const imgsRosario=imagensRosario[arquivo]
  if(imgsRosario){
    for(let i=1;i<=5;i++){
      const img=d.body.querySelector(`#figura${i}`) as HTMLImageElement|null
      if(img){img.setAttribute("src",`/${imgsRosario[i-1]}`);img.setAttribute("alt",`Mistério ${i}`);img.setAttribute("loading","lazy")}
    }
  }
  for(const img of Array.from(d.body.querySelectorAll("img"))){
    const src=(img.getAttribute("src")||"").trim()
    if(src&&!src.startsWith("/")&&!src.startsWith("data:")){
      const nome=src.replace(/\\/g,"/").split("/").pop()||""
      if(nome)img.setAttribute("src",`/${nome}`)
    }
  }
  const ok=new Set(["DIV","P","BR","SPAN","FONT","B","STRONG","I","EM","U","SUP","SUB","H1","H2","H3","H4","H5","H6","CENTER","BLOCKQUOTE","HR","OL","UL","LI","TABLE","TBODY","THEAD","TFOOT","TR","TD","TH","IMG","A"])
  for(const el of Array.from(d.body.querySelectorAll("*"))){
    if(!ok.has(el.tagName)){if(["SCRIPT","STYLE","IFRAME","OBJECT","EMBED","LINK","META"].includes(el.tagName))el.remove();else el.replaceWith(...Array.from(el.childNodes));continue}
    for(const a of Array.from(el.attributes)){
      const n=a.name.toLowerCase(),v=a.value.trim()
      const imgPermitido=el.tagName==="IMG"&&["src","alt","width","height","align","id","loading"].includes(n)
      const linkPermitido=el.tagName==="A"&&["href","id","name","title"].includes(n)
      const permitido=imgPermitido||linkPermitido||(el.tagName==="FONT"&&["color","face","size"].includes(n))||(["DIV","P","CENTER","TD","TH"].includes(el.tagName)&&n==="align")||(["TD","TH"].includes(el.tagName)&&["colspan","rowspan"].includes(n))||n==="id"||n==="class"||n==="style"
      if(!permitido||n.startsWith("on")){el.removeAttribute(a.name);continue}
      if(el.tagName==="IMG"&&n==="src"&&!/^\/[a-z0-9_.-]+$/i.test(v)){el.removeAttribute("src");continue}
      if(el.tagName==="A"&&n==="href"&&!/^#[a-z0-9_.:-]+$/i.test(v)){el.removeAttribute("href");continue}
      if(n==="style"){const s=v.split(";").map(x=>x.trim()).filter(x=>/^(color|text-align|font-weight|font-style|text-decoration|vertical-align|float|margin|width|max-width|height)\s*:/i.test(x));s.length?el.setAttribute("style",s.join("; ")):el.removeAttribute("style")}
    }
  }
  return d.body.innerHTML
}

function normalizar(v:string){return v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/santa/g,"sta").replace(/santo/g,"sto").replace(/[^a-z0-9]/g,"")}
function candidatosImagem(d:Documento){const bases=[normalizar(d.title),normalizar((d.path.split("/").pop()||"").replace(/\.html?$/i,""))].filter(Boolean);return [...new Set(bases)].flatMap(b=>[`/${b}.jpg`,`/${b}.jpeg`,`/${b}.png`,`/${b}.webp`])}
function ImagemDocumento({doc}:{doc:Documento}){const urls=useMemo(()=>candidatosImagem(doc),[doc]);const[idx,setIdx]=useState(0);if(idx>=urls.length)return null;return <img src={urls[idx]} alt="" onError={()=>setIdx(v=>v+1)} className="mx-auto mt-4 max-h-[420px] w-auto max-w-full rounded-2xl border border-[#d4af37]/35 object-contain shadow-sm"/>}

export function AcervoLiturgicoOffline({categoriaInicial="",buscaInicial="",embutido=false,titulo="Central Litúrgica",documentoInicial=""}:Props){
  const[m,setM]=useState<Manifesto|null>(null),[cat,setCat]=useState(categoriaInicial),[docs,setDocs]=useState<Documento[]>([]),[busca,setBusca]=useState(buscaInicial),[aberto,setAberto]=useState<Documento|null>(null),[loading,setLoading]=useState(false),[erro,setErro]=useState("")

  useEffect(()=>{fetch(MANIFESTO,{cache:"force-cache"}).then(async r=>{if(!r.ok)throw new Error("Conteúdo litúrgico interno indisponível.");const x=await r.json();setM(x);if(!cat)setCat(categoriaInicial||x.categorias[0]?.id||"")}).catch(e=>setErro(e.message))},[])
  useEffect(()=>{if(categoriaInicial)setCat(categoriaInicial);setBusca(buscaInicial);setAberto(null);setErro("")},[categoriaInicial,buscaInicial,documentoInicial])

  useEffect(()=>{
    if(!documentoInicial||!cat||!m)return
    let off=false;setLoading(true);setErro("")
    carregarCategoria(m,cat).then(lista=>{
      if(off)return
      const d=resolverDocumento(lista,cat,documentoInicial,new Date())
      if(!d)throw new Error("O conteúdo próprio desta celebração não foi localizado no acervo interno.")
      setAberto(d)
    }).catch(e=>{if(!off)setErro(e.message)}).finally(()=>{if(!off)setLoading(false)})
    return()=>{off=true}
  },[m,cat,documentoInicial])

  useEffect(()=>{
    if(documentoInicial||!m||!cat)return
    let off=false;setLoading(true);setErro("")
    carregarCategoria(m,cat).then(lista=>{if(!off)setDocs(lista)}).catch(e=>{if(!off)setErro(e.message)}).finally(()=>{if(!off)setLoading(false)})
    return()=>{off=true}
  },[m,cat,documentoInicial])

  const filtrados=useMemo(()=>{const q=busca.trim().toLocaleLowerCase("pt-BR");return docs.filter(d=>!q||`${d.title} ${d.path} ${d.text||textoHtml(d.html||"")}`.toLocaleLowerCase("pt-BR").includes(q)).slice(0,400)},[docs,busca])
  const html=useMemo(()=>aberto?.html?sanitizar(aberto.html,aberto.path):"",[aberto])

  if(documentoInicial&&!aberto){return <div className="flex min-h-[45vh] items-center justify-center rounded-2xl bg-[#fffaf0]/70"><div className="max-w-md px-5 text-center text-sm text-[#6b5137]">{loading?<span className="inline-flex items-center gap-2"><Loader2 className="size-5 animate-spin"/>Abrindo conteúdo offline…</span>:erro||"Conteúdo não localizado."}</div></div>}

  if(aberto)return <article className="rounded-3xl border border-[#d4af37]/35 bg-[#fffdf8] p-4 shadow-sm sm:p-6">
    {!documentoInicial&&<button onClick={()=>setAberto(null)} className="mb-4 inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-semibold"><X className="size-4"/>Voltar</button>}
    {!documentoInicial&&<p className="text-xs font-bold uppercase tracking-[.16em] text-[#9a731d]">{aberto.path}</p>}
    {aberto.title&&<h2 className="mt-2 font-serif text-2xl font-semibold text-[#8f182e] sm:text-3xl">{aberto.title}</h2>}
    {!aberto.path.toLowerCase().startsWith("rosario/")&&<ImagemDocumento doc={aberto}/>} 
    {html?<div className="liturgical-document mt-5 text-[1.04rem] leading-8 text-[#2f2924] [&_font[color=red]]:text-[#b42332] [&_b]:font-bold [&_strong]:font-bold [&_i]:italic [&_em]:italic [&_sup]:text-[#b42332] [&_a]:text-[#8f182e] [&_a]:underline [&_img]:mr-4 [&_img]:mb-3 [&_img]:max-w-[42%] [&_img]:rounded-lg sm:[&_img]:max-w-[220px]" dangerouslySetInnerHTML={{__html:html}}/>:<div className="mt-5 whitespace-pre-line text-[1.04rem] leading-8">{aberto.text}</div>}
  </article>

  return <div>
    {!embutido&&<div className="rounded-3xl border border-[#d4af37]/35 bg-white/85 p-4 sm:p-5"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#9a731d]">Conteúdo incorporado ao aplicativo</p><h2 className="mt-1 font-serif text-3xl font-semibold text-[#8f182e]">{titulo}</h2></div>}
    {erro&&<div className="mt-4 rounded-2xl border border-destructive/30 p-4 text-sm text-destructive">{erro}</div>}
    {m&&<div className={`mt-4 grid gap-4 ${embutido?"":"lg:grid-cols-[270px_1fr]"}`}>
      {!embutido&&<aside className="rounded-2xl border bg-white/80 p-2">{m.categorias.map(c=><button key={c.id} onClick={()=>{setCat(c.id);setBusca("");setAberto(null)}} className={`mb-1 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm ${cat===c.id?"bg-[#7b1326] text-white":"hover:bg-black/5"}`}><span className="flex items-center gap-2"><Library className="size-4"/>{c.nome}</span><b>{c.total}</b></button>)}</aside>}
      <section className="rounded-2xl border bg-white/80 p-3 sm:p-4">
        <label className="flex items-center gap-2 rounded-xl border bg-white px-3"><Search className="size-4"/><input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Pesquisar…" className="h-12 w-full bg-transparent text-sm outline-none"/></label>
        {loading?<div className="flex items-center justify-center gap-2 py-16"><Loader2 className="size-5 animate-spin"/>Abrindo seção offline…</div>:<div className="mt-3 grid gap-2">{filtrados.map(d=><button key={d.id} onClick={()=>setAberto(d)} className="rounded-xl border bg-white p-3 text-left hover:border-[#d4af37]"><div className="flex items-start gap-3"><BookOpenText className="mt-0.5 size-5 shrink-0 text-[#8f182e]"/><div className="min-w-0"><h3 className="font-semibold">{d.title||d.path.split("/").pop()?.replace(/\.html?$/i,"")}</h3><p className="mt-1 truncate text-xs text-muted-foreground">{d.path}</p></div></div></button>)}{!filtrados.length&&<div className="py-12 text-center text-sm text-muted-foreground">Nenhum documento encontrado.</div>}</div>}
      </section>
    </div>}
  </div>
}