"use client"

import { useEffect, useMemo, useState } from "react"
import { Clock3 } from "lucide-react"

const STORAGE_KEY = "santa-luzia:offline:v1:proximo-compromisso"

function dateLocal(data:string, horario:string){const [y,m,d]=data.split("-").map(Number);const [h,min]=horario.split(":").map(Number);return new Date(y,m-1,d,h,min,0,0)}
function fmt(ms:number){if(ms<=0)return "Horário limite atingido";const total=Math.floor(ms/1000);const d=Math.floor(total/86400),h=Math.floor((total%86400)/3600),m=Math.floor((total%3600)/60),s=total%60;return `${d?`${d}d `:""}${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`}

function carregarSalvo(){
 try{const salvo=JSON.parse(localStorage.getItem(STORAGE_KEY)||"null");return salvo?.dados||null}catch{return null}
}

export function MeuProximoCompromisso(){
 const [dados,setDados]=useState<any>(()=>typeof window!=="undefined"?carregarSalvo():null);const [agora,setAgora]=useState(()=>Date.now())
 useEffect(() => {
  let ativo = true
  async function carregar() {
   try {
    const r = await fetch("/api/notificacoes", { cache: "no-store" })
    const j = await r.json()
    if (!r.ok) throw new Error("Notificações indisponíveis")
    if (ativo) setDados(j)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ atualizadoEm: Date.now(), dados: j })) } catch {}
   } catch {
    const salvo = carregarSalvo()
    if (ativo && salvo) setDados(salvo)
   }
  }
  void carregar()
  const aoSincronizar = () => void carregar()
  window.addEventListener("santa-luzia:server-sync", aoSincronizar)
  return () => { ativo = false; window.removeEventListener("santa-luzia:server-sync", aoSincronizar) }
 },[])
 useEffect(()=>{const id=setInterval(()=>setAgora(Date.now()),1000);return()=>clearInterval(id)},[])
 const info=useMemo(()=>{const e=dados?.escalas?.[0];if(!e)return null;const missa=dateLocal(e.data,e.horario);const limite=new Date(missa.getTime()-Number(dados.minutosAntecedencia||30)*60000);return{e,missa,limite,restante:limite.getTime()-agora}},[dados,agora])
 if(!info)return null
 return <div className="mb-6 rounded-2xl border border-accent/50 bg-[linear-gradient(135deg,#fffaf0,#fff)] p-4 shadow-sm"><div className="flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/20 text-primary"><Clock3 className="size-5"/></span><div><p className="text-xs font-bold uppercase tracking-[.12em] text-[#9a731d]">Próxima escala</p><h3 className="font-serif text-xl font-semibold text-primary">Chegue até {info.limite.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</h3><p className="mt-1 text-sm text-muted-foreground">Missa em {info.e.data.split("-").reverse().join("/")} às {info.e.horario}. Contagem baseada no relógio deste aparelho.</p><p className="mt-2 inline-flex rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">{fmt(info.restante)}</p></div></div></div>
}
