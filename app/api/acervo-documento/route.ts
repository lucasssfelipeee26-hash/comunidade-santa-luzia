import { NextRequest, NextResponse } from "next/server"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { gunzipSync } from "node:zlib"
import { documentoHoraTemporal, type HoraLiturgica } from "@/lib/iliturgia-calendario"

type Documento={id:string;path:string;title:string;text?:string;html?:string}
type Pacote={category:string;documents:Documento[]}

const PACOTES:Record<string,string[]>={
 catequeses:["catequeses.html.json.gz"],comentarios:["comentarios.html.json.gz"],evangelho:["evangelhos.html.json.gz"],geral:["gerais.html.json.gz"],
 lecionario:["lecionario.html.json.gz"],missal:["missal.html.json.gz"],rosario:["rosario.html.json.gz"],salterio:["salterio.html.json.gz"],
 oficio:Array.from({length:10},(_,i)=>`oficio-${String(i+1).padStart(2,"0")}.html.json.gz`),
}

export const dynamic="force-dynamic"

const cache=new Map<string,Pacote>()
function norm(v:string){return v.replace(/^\/+/,"").replace(/\\/g,"/").toLowerCase()}
function base(v:string){return norm(v).split("/").pop()||norm(v)}
function loose(v:string){return base(v).replace(/\.html?$/i,"").replace(/[^a-z0-9]/g,"")}
async function pacote(nome:string){const salvo=cache.get(nome);if(salvo)return salvo;const bin=await readFile(path.join(process.cwd(),nome));const p=JSON.parse(gunzipSync(bin).toString("utf8")) as Pacote;cache.set(nome,p);return p}
function resposta(doc:Documento){return NextResponse.json(doc,{headers:{"Cache-Control":"public, max-age=86400"}})}
function procurar(docs:Documento[],documento:string){
 const alvo=norm(documento)
 const exato=docs.find(d=>norm(d.path)===alvo||norm(d.id)===alvo);if(exato)return exato
 const alvoBase=base(alvo),porBase=docs.filter(d=>base(d.path)===alvoBase||base(d.id)===alvoBase);if(porBase.length===1)return porBase[0]
 const alvoLoose=loose(alvo),porLoose=docs.filter(d=>loose(d.path)===alvoLoose||loose(d.id)===alvoLoose);if(porLoose.length===1)return porLoose[0]
 return null
}
function dataLocal(v:string|null){
 if(!v||!/^\d{4}-\d{2}-\d{2}$/.test(v))return new Date()
 const [a,m,d]=v.split("-").map(Number);return new Date(a,m-1,d,12,0,0)
}
function horaDoProprio(documento:string):HoraLiturgica|null{
 const p=norm(documento)
 if(p.includes("/proprio/oficiodasleituras/"))return "leituras"
 const m=p.match(/_(laudes|terca|sexta|nona|vesperas|completas)\.html?$/i)
 return (m?.[1] as HoraLiturgica|undefined)||null
}

export async function GET(req:NextRequest){
 const categoria=req.nextUrl.searchParams.get("categoria")||""
 const bruto=req.nextUrl.searchParams.get("documento")||""
 const alternativas=bruto.split("||").map(norm).filter(Boolean)
 const arquivos=PACOTES[categoria]
 if(!arquivos||!alternativas.length)return NextResponse.json({error:"Parâmetros inválidos"},{status:400})
 try{
  const docs=(await Promise.all(arquivos.map(pacote))).flatMap(p=>p.documents)
  for(const alternativa of alternativas){const encontrado=procurar(docs,alternativa);if(encontrado)return resposta(encontrado)}

  // No iLiturgia nem toda memória possui todas as Horas próprias. Se o Próprio
  // pedido não existir, usa automaticamente o Temporal calculado para a data.
  if(categoria==="oficio"){
   const hora=horaDoProprio(alternativas[0])
   if(hora){
    const temporal=documentoHoraTemporal(dataLocal(req.nextUrl.searchParams.get("data")),hora)
    const encontrado=procurar(docs,temporal)
    if(encontrado)return resposta(encontrado)
   }
  }

  return NextResponse.json({error:"Documento não localizado no acervo interno",documento:alternativas[0],alternativas},{status:404})
 }catch{
  return NextResponse.json({error:"Falha ao consultar o acervo interno"},{status:500})
 }
}
