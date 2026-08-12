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
