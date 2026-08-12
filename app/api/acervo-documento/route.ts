import { NextRequest, NextResponse } from "next/server"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { gunzipSync } from "node:zlib"
import { documentoHoraTemporal, type HoraLiturgica } from "@/lib/iliturgia-calendario"
import { celebracaoDoDia } from "@/lib/iliturgia-sanctoral"
import { comumDaCelebracao, documentoComum } from "@/lib/iliturgia-comuns"

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
 // A Catedra de Sao Pedro usa nomes especiais para as Horas medias no APK.
 if(chave==="catedra"&&hora&&["terca","sexta","nona"].includes(hora))itens.push(`oficio/proprio/horas/catedra_comum_${hora}.htm`)
 return itens
}

export async function GET(req:NextRequest){
 const categoria=req.nextUrl.searchParams.get("categoria")||""
 const bruto=req.nextUrl.searchParams.get("documento")||""
 const alternativas=bruto.split("||").map(norm).filter(Boolean)
 const arquivos=PACOTES[categoria]
 if(!arquivos||!alternativas.length)return NextResponse.json({error:"Parâmetros inválidos"},{status:400})
 try{
  const docs=(await Promise.all(arquivos.map(pacote))).flatMap(p=>p.documents)
  const data=dataLocal(req.nextUrl.searchParams.get("data"))
  const hora=horaDoProprio(alternativas[0])
  const chave=chaveDoProprio(alternativas[0])

  // No dia anterior a uma solenidade, Vesperas tenta primeiro as I Vesperas
  // efetivamente existentes no acervo. Se nao houver Proprio, usa o Comum.
  if(categoria==="oficio"&&hora==="vesperas"){
   const prox=celebracaoDoDia(amanha(data))
   if(prox?.grau==="solenidade"&&prox.chave){
    const primeira=`oficio/proprio/horas/${prox.chave}_Ivesperas.htm`
    const docPrimeira=procurar(docs,primeira)
    if(docPrimeira)return resposta(docPrimeira)
    const comumProx=comumDaCelebracao(prox.chave)
    if(comumProx){
      const comumPrimeira=documentoComum(comumProx,"vesperas",true)
      const docComumPrimeira=procurar(docs,comumPrimeira)
      if(docComumPrimeira)return resposta(docComumPrimeira)
    }
   }
  }

  // Primeiro tenta o Proprio exato solicitado pela Central.
  for(const alternativa of alternativas){const encontrado=procurar(docs,alternativa);if(encontrado)return resposta(encontrado)}

  // Depois trata excecoes de nomenclatura confirmadas no APK.
  if(categoria==="oficio"&&chave){
    for(const caminho of excecoesProprio(chave,hora)){const encontrado=procurar(docs,caminho);if(encontrado)return resposta(encontrado)}
  }

  // Se a celebracao nao possui aquela parte no Proprio, usa o Comum adequado.
  if(categoria==="oficio"&&hora&&hora!=="completas"&&hora!=="vigilia"&&chave){
    const comum=comumDaCelebracao(chave)
    if(comum){
      const caminho=documentoComum(comum,hora)
      const encontrado=procurar(docs,caminho)
      if(encontrado)return resposta(encontrado)
    }
  }

  // Por fim, abre o Temporal calculado para a mesma data e Hora.
  if(categoria==="oficio"&&hora){
   const temporal=documentoHoraTemporal(data,hora)
   const encontrado=procurar(docs,temporal)
   if(encontrado)return resposta(encontrado)
  }

  return NextResponse.json({error:"Documento não localizado no acervo interno",documento:alternativas[0],alternativas},{status:404})
 }catch{
  return NextResponse.json({error:"Falha ao consultar o acervo interno"},{status:500})
 }
}
