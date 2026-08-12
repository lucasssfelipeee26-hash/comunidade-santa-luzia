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

function norm(v:string){return v.replace(/^\/+/,"").toLowerCase()}

export async function GET(req:NextRequest){
 const categoria=req.nextUrl.searchParams.get("categoria")||""
 const documento=norm(req.nextUrl.searchParams.get("documento")||"")
 const arquivos=PACOTES[categoria]
 if(!arquivos||!documento)return NextResponse.json({error:"Parâmetros inválidos"},{status:400})
 try{
  for(const arquivo of arquivos){
   const bin=await readFile(path.join(process.cwd(),arquivo))
   const pacote=JSON.parse(gunzipSync(bin).toString("utf8")) as Pacote
   const exato=pacote.documents.find(d=>norm(d.path)===documento||norm(d.id)===documento)
   if(exato)return NextResponse.json(exato,{headers:{"Cache-Control":"public, max-age=86400"}})
  }
  const base=documento.split("/").pop()||documento
  for(const arquivo of arquivos){
   const bin=await readFile(path.join(process.cwd(),arquivo))
   const pacote=JSON.parse(gunzipSync(bin).toString("utf8")) as Pacote
   const candidatos=pacote.documents.filter(d=>(norm(d.path).split("/").pop()||"")===base)
   if(candidatos.length===1)return NextResponse.json(candidatos[0],{headers:{"Cache-Control":"public, max-age=86400"}})
  }
  return NextResponse.json({error:"Documento não localizado no acervo interno",documento},{status:404})
 }catch{
  return NextResponse.json({error:"Falha ao consultar o acervo interno"},{status:500})
 }
}
