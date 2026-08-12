import { inicioAdvento, pascoa, semanaTempoComum, tempoLiturgico } from "@/lib/iliturgia-calendario"

const dias=["domingo","segunda","terca","quarta","quinta","sexta","sabado"] as const
const MS=86400000
function soData(d:Date){return new Date(d.getFullYear(),d.getMonth(),d.getDate())}
function diffDias(a:Date,b:Date){return Math.round((soData(b).getTime()-soData(a).getTime())/MS)}
function semanaDesde(inicio:Date,data:Date){return Math.floor(diffDias(inicio,data)/7)+1}

export function documentoMissalProprio(data:Date,chaveCelebracao?:string|null){
  // O Próprio de uma solenidade/festa/memória tem prioridade quando existe.
  if(chaveCelebracao)return `missal/proprio/proprio/${chaveCelebracao}.htm`

  const tempo=tempoLiturgico(data)
  const dia=dias[data.getDay()]

  if(tempo==="tempocomum"){
    return data.getDay()===0 ? `missal/proprio/tempocomum/${semanaTempoComum(data)}domingoTC.htm` : ""
  }

  if(tempo==="advento"){
    if(data.getMonth()===11 && data.getDate()>=17 && data.getDate()<=23)return `missal/proprio/advento/${data.getDate()}dezembroAD.htm`
    if(data.getMonth()===11 && data.getDate()===24)return "missal/proprio/advento/_24dezembroAD.htm"
    const semana=Math.max(1,Math.min(4,semanaDesde(inicioAdvento(data.getFullYear()),data)))
    return `missal/proprio/advento/${semana}${dia}AD.htm`
  }

  if(tempo==="quaresma"){
    const p=pascoa(data.getFullYear())
    const cinzas=new Date(p);cinzas.setDate(cinzas.getDate()-46)
    const desdeCinzas=diffDias(cinzas,data)
    if(desdeCinzas===1)return "missal/proprio/quaresma/quinta_depoisdascinzas.htm"
    if(desdeCinzas===2)return "missal/proprio/quaresma/sexta_depoisdascinzas.htm"
    if(desdeCinzas===3)return "missal/proprio/quaresma/sabado_depoisdascinzas.htm"
    const primeiroDomingo=new Date(cinzas);primeiroDomingo.setDate(primeiroDomingo.getDate()+4)
    const semana=Math.max(1,Math.min(5,semanaDesde(primeiroDomingo,data)))
    return `missal/proprio/quaresma/${semana}${dia}QA.htm`
  }

  if(tempo==="pascoa"){
    const p=pascoa(data.getFullYear())
    const desdePascoa=diffDias(p,data)
    if(desdePascoa>=1 && desdePascoa<=6)return `missal/proprio/pascoa/${dia}_oitava.htm`
    const semana=Math.floor(desdePascoa/7)+1
    if(semana>=2 && semana<=7 && data.getDay()!==0)return `missal/proprio/pascoa/${semana}${dia}PA.htm`
    return ""
  }

  if(tempo==="natal"){
    const mes=data.getMonth()+1,d=data.getDate()
    if(mes===12 && d>=29 && d<=31)return `missal/proprio/natal/${d}dezembroNA.htm`
    if(mes===1){
      const antesEpifania=d<=6
      const sufixo=antesEpifania?"antesdaepifania":"ateobatismo"
      if(data.getDay()!==0)return `missal/proprio/natal/${dia}_${sufixo}.htm`
    }
  }
  return ""
}
