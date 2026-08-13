export type HoraLiturgica = "leituras"|"laudes"|"terca"|"sexta"|"nona"|"vesperas"|"completas"|"vigilia"

const nomesDia=["domingo","segunda","terca","quarta","quinta","sexta","sabado"] as const

function diaUtc(d:Date){return Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())}
function diasEntre(a:Date,b:Date){return Math.floor((diaUtc(b)-diaUtc(a))/86400000)}
function add(d:Date,n:number){const x=new Date(d);x.setDate(x.getDate()+n);return x}
function domingoAnteriorOuIgual(d:Date){return add(d,-d.getDay())}
function domingoDepoisOuIgual(d:Date){return add(d,(7-d.getDay())%7)}

export function pascoa(ano:number){
 const a=ano%19,b=Math.floor(ano/100),c=ano%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mes=Math.floor((h+l-7*m+114)/31),dia=((h+l-7*m+114)%31)+1
 return new Date(ano,mes-1,dia)
}
export function inicioAdvento(ano:number){return domingoDepoisOuIgual(new Date(ano,10,27))}

export function tempoLiturgico(data:Date){
 const ano=data.getFullYear(),p=pascoa(ano),cinzas=add(p,-46),pentecostes=add(p,49),adv=inicioAdvento(ano),natal=new Date(ano,11,25)
 const epifania=new Date(ano,0,6),batismo=domingoDepoisOuIgual(epifania)
 if(data>=adv&&data<natal)return "advento" as const
 if(data>=natal||data<=batismo)return "natal" as const
 if(data>=cinzas&&data<p)return "quaresma" as const
 if(data>=p&&data<=pentecostes)return "pascoa" as const
 return "tempocomum" as const
}

function semanaDesde(inicio:Date,data:Date){return Math.max(1,Math.floor(diasEntre(domingoAnteriorOuIgual(inicio),data)/7)+1)}

export function semanaTempoComum(data:Date){
 const ano=data.getFullYear(),p=pascoa(ano),cinzas=add(p,-46),epifania=new Date(ano,0,6),batismo=domingoDepoisOuIgual(epifania)
 if(data<cinzas)return Math.max(1,semanaDesde(add(batismo,1),data)+1)
 const domingoCristoRei=add(inicioAdvento(ano),-7)
 const semanasRestantes=Math.floor(diasEntre(domingoAnteriorOuIgual(data),domingoCristoRei)/7)
 return Math.max(1,34-semanasRestantes)
}

export function semanaSalterio(data:Date){
 const t=tempoLiturgico(data)
 if(t==="tempocomum")return ((semanaTempoComum(data)-1)%4)+1
 if(t==="advento"){const n=semanaDesde(inicioAdvento(data.getFullYear()),data);return ((n-1)%4)+1}
 if(t==="quaresma"){const n=semanaDesde(add(pascoa(data.getFullYear()),-46),data);return ((n-1)%4)+1}
 if(t==="pascoa"){const n=semanaDesde(pascoa(data.getFullYear()),data);return ((n-1)%4)+1}
 return 1
}

export function documentoHoraTemporal(data:Date,hora:HoraLiturgica){
 const tempo=tempoLiturgico(data),dia=nomesDia[data.getDay()],semana=semanaSalterio(data)
 if(hora==="completas"){
  if(tempo==="tempocomum")return `oficio/tempocomum/horas/completas_${dia}.htm`
  if(tempo==="advento")return `oficio/advento/horas/completas${dia}.htm`
  if(tempo==="natal")return `oficio/natal/horas/completas_${dia==="domingo"?"domingoI":dia}.htm`
 }
 if(tempo==="tempocomum")return `oficio/tempocomum/horas/${semana}${dia}_${hora}.htm`
 if(tempo==="advento")return `oficio/advento/horas/${semana}${dia}_${hora}.htm`
 if(tempo==="quaresma")return `oficio/quaresma/horas/${semana}${dia}quaresma_${hora}.htm`
 if(tempo==="pascoa")return `oficio/pascoa/horas/${semana}${dia}pascoa_${hora}.htm`
 const mes=data.getMonth()+1,d=data.getDate()
 if(mes===12&&d>=29)return `oficio/natal/horas/${d}dezembro_${hora}.htm`
 if(mes===1&&d>=2&&d<=7)return `oficio/natal/horas/${d}janeiro_${hora}.htm`
 return `oficio/natal/horas/${dia}_aposepifania_${hora}.htm`
}

export function documentoHoraSanto(chave:string|undefined|null,hora:HoraLiturgica){
 if(!chave||chave==="santadulcelopespontes"||hora==="completas"||hora==="vigilia")return ""
 if(hora==="leituras")return `oficio/proprio/oficiodasleituras/${chave}.htm`
 return `oficio/proprio/horas/${chave}_${hora}.htm`
}
