import { semanaSalterio } from "@/lib/iliturgia-calendario"

const dias=["domingo","segunda","terca","quarta","quinta","sexta","sabado"] as const

export function documentoCatequeseDoDia(data:Date, periodo:"laudes"|"vesperas"="laudes"){
  const semana=semanaSalterio(data)
  const dia=dias[data.getDay()]
  return `catequeses/semana${semana}_${dia}_${periodo}.htm`
}

function abreviarLivro(nome:string){
  const n=nome.normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase()
  const mapa:Record<string,string>={
    "mateus":"Mt","marcos":"Mc","lucas":"Lc","joao":"Jo",
  }
  for(const [k,v] of Object.entries(mapa)) if(n.includes(k)) return v
  const m=nome.match(/^([1-3]?\s*[A-Za-zÀ-ÿ]+)/)
  return m?m[1].replace(/\s/g,""):""
}

export function documentoEvangelhoDaReferencia(referencia?:string,titulo?:string){
  if(!referencia)return ""
  const livroMatch=referencia.match(/^([1-3]?\s*[A-Za-zÀ-ÿ]+)/)
  const livro=livroMatch?.[1]?.replace(/\s/g,"")||abreviarLivro(titulo||"")
  const capVers=referencia.replace(/^([1-3]?\s*[A-Za-zÀ-ÿ]+)\s*/,"").trim()
  if(!livro||!capVers)return ""
  const nome=capVers
    .replace(/\s+/g,"")
    .replace(/,/g,"_")
    .replace(/;/g,"+")
    .replace(/\./g,"")
  return `evangelho/${livro}X${nome}.htm`
}

function chaveLeitura(referencia?:string){
  if(!referencia)return ""
  // Os nomes do Lecionário no APK concatenam livro/capítulo/versículos sem
  // espaços e sinais tipográficos: "Ez 9,1-7; 10,18-22" -> "Ez917101822".
  return referencia
    .replace(/\([^)]*\)/g,"")
    .replace(/\bR\.?\s*.*$/i,"")
    .replace(/[^0-9A-Za-zÀ-ÿ]/g,"")
}

type LeituraRef={referencia?:string}
export function documentoLecionarioDasLeituras(primeira?:LeituraRef[],segunda?:LeituraRef[],evangelho?:LeituraRef[]){
  const partes=[primeira?.[0]?.referencia,segunda?.[0]?.referencia,evangelho?.[0]?.referencia].map(chaveLeitura).filter(Boolean)
  return partes.length>=2?`lecionario/${partes.join("")}.htm`:""
}
