import type { HoraLiturgica } from "@/lib/iliturgia-calendario"

export type ComumILiturgia =
  | "apostolos"
  | "dedicacaoigreja"
  | "doutores"
  | "nossasenhora"
  | "pastores"
  | "santasmulheres"
  | "santasreligiosas"
  | "santoshomens"
  | "santoshomenscaridade"
  | "santosreligiosos"
  | "ummartir"
  | "variosmartires"
  | "virgens"

export const comunsILiturgia:{id:ComumILiturgia;titulo:string;temIVesperas:boolean}[]=[
  {id:"apostolos",titulo:"Comum dos Apóstolos",temIVesperas:true},
  {id:"dedicacaoigreja",titulo:"Comum da Dedicação de uma Igreja",temIVesperas:true},
  {id:"doutores",titulo:"Comum dos Doutores da Igreja",temIVesperas:true},
  {id:"nossasenhora",titulo:"Comum de Nossa Senhora",temIVesperas:true},
  {id:"pastores",titulo:"Comum dos Pastores",temIVesperas:true},
  {id:"santasmulheres",titulo:"Comum das Santas Mulheres",temIVesperas:true},
  {id:"santasreligiosas",titulo:"Comum das Santas Religiosas",temIVesperas:true},
  {id:"santoshomens",titulo:"Comum dos Santos Homens",temIVesperas:true},
  {id:"santoshomenscaridade",titulo:"Comum dos Santos dedicados à Caridade",temIVesperas:false},
  {id:"santosreligiosos",titulo:"Comum dos Santos Religiosos",temIVesperas:true},
  {id:"ummartir",titulo:"Comum de um Mártir",temIVesperas:true},
  {id:"variosmartires",titulo:"Comum de vários Mártires",temIVesperas:true},
  {id:"virgens",titulo:"Comum das Virgens",temIVesperas:true},
]

const sufixoHora:Record<Exclude<HoraLiturgica,"completas"|"vigilia">,string>={
  leituras:"leituras",laudes:"laudes",terca:"terca",sexta:"sexta",nona:"nona",vesperas:"vesperas",
}

export function documentoComum(comum:ComumILiturgia,hora:Exclude<HoraLiturgica,"completas"|"vigilia">,primeirasVesperas=false){
  if(primeirasVesperas&&hora==="vesperas")return `oficio/outros/comum_${comum}_Ivesperas.htm`
  return `oficio/outros/comum_${comum}_${sufixoHora[hora]}.htm`
}

// Mapeamentos confirmados pelo tipo litúrgico da celebração. Quando não houver
// classificação segura, o motor não adivinha e deixa o Temporal como fallback.
const porChave:Record<string,ComumILiturgia>={
  saoandre:"apostolos",saobartolomeu:"apostolos",saofilipeetiago:"apostolos",saomatias:"apostolos",saotiago:"apostolos",saotome:"apostolos",simaoejudas:"apostolos",
  saomarcos:"apostolos",saolucas:"apostolos",
  santaines:"virgens",santaclara:"virgens",santaluzia:"virgens",santateresinha:"virgens",
  santoantonio:"doutores",santoagostinho:"doutores",santoambrosio:"doutores",santoatanasio:"doutores",santotomas:"doutores",saojeronimo:"doutores",saogregorio:"doutores",saoboaventura:"doutores",saobernardo:"doutores",saojoaocrisostomo:"doutores",saojoaodacruz:"doutores",santateresa:"doutores",
  saojmvianney:"pastores",saocarlosborromeu:"pastores",saofranciscosales:"pastores",saovicentedepaulo:"pastores",
  santoestevao:"ummartir",saolourenco:"ummartir",saojustino:"ummartir",santainesmartir:"ummartir",
  saopaulomiki:"variosmartires",saocarloslwanga:"variosmartires",inaciodeazevedo:"variosmartires",roquegonzalez:"variosmartires",
  santapaulina:"santasreligiosas",santaescolastica:"santasreligiosas",santacatarina:"santasmulheres",santamonica:"santasmulheres",santamarta:"santasmulheres",stamariamadalena:"santasmulheres",
  saobento:"santosreligiosos",saodomingos:"santosreligiosos",saofrancisco:"santosreligiosos",santoinacio:"santosreligiosos",saopiox:"pastores",
  NSAparecida:"nossasenhora",NSCarmo:"nossasenhora",NSDores:"nossasenhora",NSGuadalupe:"nossasenhora",NSRainha:"nossasenhora",NSRosario:"nossasenhora",
}

export function comumDaCelebracao(chave?:string|null):ComumILiturgia|""{
  if(!chave)return ""
  return porChave[chave]||""
}
