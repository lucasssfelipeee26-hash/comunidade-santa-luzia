import "server-only"

import { readFile } from "node:fs/promises"
import path from "node:path"
import { gunzipSync } from "node:zlib"
import type { LiturgiaLocal, LeituraLocal } from "@/lib/liturgia-local"

type Documento={id:string;path:string;title?:string;text?:string;html?:string}
type Pacote={documents?:Documento[]}

let cache:Documento[]|null=null

function norm(v:string){return v.replace(/^\/+/,"").replace(/\\/g,"/").toLowerCase()}
function semHtml(v:string){return v.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<br\s*\/?\s*>/gi,"\n").replace(/<\/p>|<\/div>|<\/tr>|<\/h\d>/gi,"\n").replace(/<[^>]+>/g," ")}
function entidades(v:string){return v.replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)))}
function limpar(v:string){return entidades(v).replace(/\r/g,"").replace(/[ \t]+/g," ").replace(/ *\n */g,"\n").replace(/\n{3,}/g,"\n\n").trim()}

async function documentos(){
 if(cache)return cache
 const bin=await readFile(path.join(process.cwd(),"lecionario.html.json.gz"))
 const pacote=JSON.parse(gunzipSync(bin).toString("utf8")) as Pacote
 cache=pacote.documents||[]
 return cache
}

export async function documentoLecionarioOffline(caminho:string){
 const alvo=norm(caminho)
 return (await documentos()).find(d=>norm(d.path)===alvo||norm(d.id)===alvo)||null
}

const MARCADORES=["PRIMEIRA LEITURA","SALMO RESPONSORIAL","SEGUNDA LEITURA","ACLAMAÇÃO AO EVANGELHO","ACLAMACAO AO EVANGELHO","EVANGELHO"] as const
function posicoes(texto:string){
 const upper=texto.toLocaleUpperCase("pt-BR")
 return MARCADORES.map(m=>({m,i:upper.indexOf(m)})).filter(x=>x.i>=0).sort((a,b)=>a.i-b.i)
}
function secao(texto:string,marcador:string){
 const ps=posicoes(texto),upper=texto.toLocaleUpperCase("pt-BR"),ini=upper.indexOf(marcador)
 if(ini<0)return ""
 const prox=ps.find(x=>x.i>ini)
 return texto.slice(ini+marcador.length,prox?.i??texto.length).trim()
}
function referenciaDoTexto(v:string){
 const linhas=v.split("\n").map(x=>x.trim()).filter(Boolean)
 for(const linha of linhas.slice(0,8)){
   const m=linha.match(/((?:[1-3]\s*)?[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÀ-ÿ]{0,15})\s+(\d[0-9,;.+\-–a-zA-Z ]{1,40})$/)
   if(m)return `${m[1]} ${m[2]}`.trim()
 }
 return ""
}
function leituraDaSecao(v:string,tituloPadrao:string):LeituraLocal[]{
 if(!v)return []
 const linhas=v.split("\n").map(x=>x.trim()).filter(Boolean)
 const referencia=referenciaDoTexto(v)
 let inicio=0
 if(referencia){const idx=linhas.findIndex(x=>x.includes(referencia));if(idx>=0)inicio=idx+1}
 const titulo=linhas.slice(0,Math.max(1,inicio)).filter(x=>x!==referencia).join(" ").trim()||tituloPadrao
 const texto=linhas.slice(inicio).join("\n").replace(/^(Palavra do Senhor\.?|Palavra da Salvação\.?)$/gim,"").trim()
 return texto?[{titulo,referencia:referencia||undefined,texto}]:[]
}
function salmoDaSecao(v:string):LeituraLocal[]{
 if(!v)return []
 const referencia=referenciaDoTexto(v)
 const linhas=v.split("\n").map(x=>x.trim()).filter(Boolean)
 const refraoLinha=linhas.find(x=>/^(R\.|R:|R\s—)/i.test(x))
 const refrao=refraoLinha?.replace(/^(R\.|R:|R\s—)\s*/i,"").trim()
 const texto=linhas.filter(x=>x!==refraoLinha&&x!==referencia).join("\n").trim()
 return texto?[{titulo:"Salmo Responsorial",referencia:referencia||undefined,refrao,texto}]:[]
}

export function liturgiaEstruturadaDoDocumento(doc:Documento,base:Omit<LiturgiaLocal,"leituras">):LiturgiaLocal{
 const bruto=limpar(doc.text||semHtml(doc.html||""))
 const primeira=secao(bruto,"PRIMEIRA LEITURA")
 const salmo=secao(bruto,"SALMO RESPONSORIAL")
 const segunda=secao(bruto,"SEGUNDA LEITURA")
 const evangelho=secao(bruto,"EVANGELHO")
 return {
   ...base,
   fonte:{...(base.fonte||{}),arquivoOrigem:doc.path,nome:base.fonte?.nome||"Acervo offline iLiturgia"},
   leituras:{
     primeiraLeitura:leituraDaSecao(primeira,"Primeira Leitura"),
     salmo:salmoDaSecao(salmo),
     segundaLeitura:leituraDaSecao(segunda,"Segunda Leitura"),
     evangelho:leituraDaSecao(evangelho,"Evangelho"),
   },
 }
}

export async function liturgiaDoArquivoLecionario(caminho:string,base:Omit<LiturgiaLocal,"leituras">){
 const doc=await documentoLecionarioOffline(caminho)
 return doc?liturgiaEstruturadaDoDocumento(doc,base):null
}
