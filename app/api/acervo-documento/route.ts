import { NextRequest, NextResponse } from "next/server"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { gunzipSync } from "node:zlib"

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
async function pacote(nome:string){
 const salvo=cache.get(nome);if(salvo)return salvo
 const bin=await readFile(path.join(process.cwd(),nome))
 const p=JSON.parse(gunzipSync(bin).toString("utf8")) as Pacote
 cache.set(nome,p);return p
}
function resposta(doc:Documento){return NextResponse.json(doc,{headers:{"Cache-Control":"public, max-age=86400"}})}

export async function GET(req:NextRequest){
 const categoria=req.nextUrl.searchParams.get("categoria")||""
 const documento=norm(req.nextUrl.searchParams.get("documento")||"")
 const arquivos=PACOTES[categoria]
 if(!arquivos||!documento)return NextResponse.json({error:"Parâmetros inválidos"},{status:400})
 try{
  const pacotes=await Promise.all(arquivos.map(pacote))
  const docs=pacotes.flatMap(p=>p.documents)
  const exato=docs.find(d=>norm(d.path)===documento||norm(d.id)===documento)
  if(exato)return resposta(exato)

  const alvoBase=base(documento)
  const porBase=docs.filter(d=>base(d.path)===alvoBase||base(d.id)===alvoBase)
  if(porBase.length===1)return resposta(porBase[0])

  const alvoLoose=loose(documento)
  const porLoose=docs.filter(d=>loose(d.path)===alvoLoose||loose(d.id)===alvoLoose)
  if(porLoose.length===1)return resposta(porLoose[0])

  return NextResponse.json({error:"Documento não localizado no acervo interno",documento},{status:404})
 }catch{
  return NextResponse.json({error:"Falha ao consultar o acervo interno"},{status:500})
 }
}
