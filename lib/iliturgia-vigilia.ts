import { tempoLiturgico } from "@/lib/iliturgia-calendario"

export type DocumentoVigilia={id:string;titulo:string;documento:string}

export function documentosVigilia(data:Date,chaveCelebracao?:string|null):DocumentoVigilia[]{
  if(chaveCelebracao){
    return [{id:"vigilia-proprio",titulo:"Vigília",documento:`oficio/proprio/horas/${chaveCelebracao}_vigilia.htm`}]
  }
  const tempo=tempoLiturgico(data)
  if(tempo==="advento")return [
    {id:"vigilia-canticos",titulo:"Cânticos da Vigília",documento:"oficio/advento/horas/vigilia_canticos.htm"},
    ...[1,2,3,4].map(n=>({id:`vigilia-evangelho-${n}`,titulo:`Evangelho da Vigília ${n}`,documento:`oficio/advento/horas/vigilia_evangelho_${n}.htm`})),
  ]
  if(tempo==="quaresma")return [
    {id:"vigilia-canticos",titulo:"Cânticos da Vigília",documento:"oficio/quaresma/horas/vigilia_canticos.htm"},
    ...[1,2,3,4,5].map(n=>({id:`vigilia-evangelho-${n}`,titulo:`Evangelho da Vigília ${n}`,documento:`oficio/quaresma/horas/vigilia_evangelho_${n}.htm`})),
  ]
  if(tempo==="pascoa")return [
    {id:"vigilia-canticos",titulo:"Cânticos da Vigília",documento:"oficio/pascoa/horas/vigilia_canticos.htm"},
    ...[2,3,4,5,6].map(n=>({id:`vigilia-evangelho-${n}`,titulo:`Evangelho da Vigília ${n}`,documento:`oficio/pascoa/horas/vigilia_evangelho_${n}.htm`})),
  ]
  if(tempo==="natal")return [{id:"vigilia-canticos",titulo:"Cânticos da Vigília",documento:"oficio/natal/horas/vigilia_canticos.htm"}]
  return [
    {id:"vigilia-canticos",titulo:"Cânticos da Vigília",documento:"oficio/tempocomum/horas/vigilia_canticos.htm"},
    ...[1,2,3,4,5,6,7,8].map(n=>({id:`vigilia-evangelho-${n}`,titulo:`Evangelho da Vigília ${n}`,documento:`oficio/tempocomum/horas/vigilia_evangelho_${n}.htm`})),
  ]
}
