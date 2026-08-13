import "server-only"

import fs from "node:fs"
import path from "node:path"

export type DiaIndiceLiturgico = {
  data: string
  liturgia: string
  cor: string
  primeiraLeitura: string[]
  salmo: string[]
  segundaLeitura: string[]
  evangelho: string[]
  extras?: string[]
}

type Indice = { versao:number; ano:number; total:number; dias:Record<string,DiaIndiceLiturgico> }
const cache = new Map<number,Indice|null>()

function carregar(ano:number):Indice|null {
  if(cache.has(ano)) return cache.get(ano) || null
  const arquivo=path.join(process.cwd(),"public","offline","iliturgia",`indice-liturgico-${ano}.json`)
  try {
    if(!fs.existsSync(arquivo)){cache.set(ano,null);return null}
    const parsed=JSON.parse(fs.readFileSync(arquivo,"utf8")) as Indice
    if(!parsed?.dias||parsed.ano!==ano){cache.set(ano,null);return null}
    cache.set(ano,parsed)
    return parsed
  } catch(error) {
    console.error(`[Liturgia offline] Falha ao carregar indice anual ${ano}:`,error)
    cache.set(ano,null)
    return null
  }
}

export function liturgiaDoIndiceAnual(dataIso:string){
  const ano=Number(dataIso.slice(0,4))
  if(!Number.isInteger(ano))return null
  return carregar(ano)?.dias?.[dataIso]||null
}

export function temIndiceLiturgicoAnual(ano:number){
  const i=carregar(ano)
  return Boolean(i&&i.total>=365&&Object.keys(i.dias).length>=365)
}
