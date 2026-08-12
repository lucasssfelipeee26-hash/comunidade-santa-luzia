import { inicioAdvento, pascoa, semanaTempoComum, tempoLiturgico } from "@/lib/iliturgia-calendario"

const dias=["domingo","segunda","terca","quarta","quinta","sexta","sabado"] as const
function add(d:Date,n:number){const x=new Date(d);x.setDate(x.getDate()+n);return x}
function diff(a:Date,b:Date){const aa=Date.UTC(a.getFullYear(),a.getMonth(),a.getDate()),bb=Date.UTC(b.getFullYear(),b.getMonth(),b.getDate());return Math.floor((bb-aa)/86400000)}
function domingoAnteriorOuIgual(d:Date){return add(d,-d.getDay())}
function semanaDesde(inicio:Date,data:Date){return Math.max(1,Math.floor(diff(domingoAnteriorOuIgual(inicio),data)/7)+1)}
function ciclo(data:Date){return data.getFullYear()%2===0?"par":"impar"}

export function documentoLeituraBienal(data:Date){
 const t=tempoLiturgico(data),dia=dias[data.getDay()],c=ciclo(data),ano=data.getFullYear()
 if(t==="tempocomum"){
  const s=String(semanaTempoComum(data)).padStart(2,"0")
  return `oficio/tempocomum/leituras/bienal/${s}${dia}TC_${c}.htm`
 }
 if(t==="advento"){
  if(data.getMonth()===11&&data.getDate()>=17&&data.getDate()<=24)return `oficio/advento/leituras/bienal/${data.getDate()}dezembro_${c}.htm`
  const s=Math.min(4,semanaDesde(inicioAdvento(ano),data))
  return `oficio/advento/leituras/bienal/${s}${dia}Advento_${c}.htm`
 }
 if(t==="quaresma"){
  const p=pascoa(ano),cinzas=add(p,-46),desde=diff(cinzas,data)
  if(desde===1)return `oficio/quaresma/oficiodasleituras/bienal/quintacinzas_${c}.htm`
  if(desde===2)return `oficio/quaresma/oficiodasleituras/bienal/sextacinzas_${c}.htm`
  if(desde===3)return `oficio/quaresma/oficiodasleituras/bienal/sabadocinzas_${c}.htm`
  const ramos=add(p,-7)
  if(data>ramos&&data<p){const nomes=["domingo","segundafeirasanta","tercafeirasanta","quartafeirasanta","quinta","sexta","sabado"];const n=nomes[data.getDay()];return n?`oficio/quaresma/oficiodasleituras/bienal/${n}_${c}.htm`:""}
  const primeiroDomingo=add(cinzas,4),s=Math.max(1,Math.min(5,semanaDesde(primeiroDomingo,data)))
  return `oficio/quaresma/oficiodasleituras/bienal/${s}${dia}_quaresma_${c}.htm`
 }
 if(t==="pascoa"){
  const p=pascoa(ano),desde=diff(p,data),s=Math.max(1,Math.min(7,Math.floor(desde/7)+1))
  return `oficio/pascoa/oficiodasleituras/bienal/${s}${dia}Pascoa_${c}.htm`
 }
 if(t==="natal"){
  const m=data.getMonth()+1,d=data.getDate()
  if(m===12&&d>=29&&d<=31)return `oficio/natal/leituras/bienal/${d}dezembro_${c}.htm`
  if(m===1&&d>=2&&d<=7)return `oficio/natal/leituras/bienal/${d}janeiro_${c}.htm`
  return `oficio/natal/leituras/bienal/${dia}_aposepifania_${c}.htm`
 }
 return ""
}

export function tituloLeituraBienal(data:Date){return `Leituras bienais · ano ${ciclo(data)==="par"?"par":"ímpar"}`}
