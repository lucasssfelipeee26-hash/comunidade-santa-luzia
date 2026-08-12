import { semanaTempoComum, tempoLiturgico } from "@/lib/iliturgia-calendario"

const dias=["domingo","segunda","terca","quarta","quinta","sexta","sabado"] as const

export function documentoMissalProprio(data:Date,chaveCelebracao?:string|null){
  if(chaveCelebracao){
    return `missal/proprio/proprio/${chaveCelebracao}.htm`
  }
  const tempo=tempoLiturgico(data)
  if(tempo==="tempocomum" && data.getDay()===0){
    return `missal/proprio/tempocomum/${semanaTempoComum(data)}domingoTC.htm`
  }
  if(tempo==="advento"){
    const semana=Math.max(1,Math.min(4,Math.floor((data.getDate()+6)/7)))
    if(data.getMonth()===11 && data.getDate()>=17 && data.getDate()<=23)return `missal/proprio/advento/${data.getDate()}dezembroAD.htm`
    if(data.getMonth()===11 && data.getDate()===24)return "missal/proprio/advento/_24dezembroAD.htm"
    return `missal/proprio/advento/${semana}${dias[data.getDay()]}AD.htm`
  }
  if(tempo==="pascoa"){
    const pascoaRef=new Date(data.getFullYear(),3,1)
    void pascoaRef
    return ""
  }
  return ""
}
