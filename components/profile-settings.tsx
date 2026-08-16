"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import useSWR, { mutate } from "swr"
import { Camera, Save, Trash2 } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NotificationSoundPreferences } from "@/components/notification-sound-preferences"
import { AndroidNotificationSettings } from "@/components/android-notification-settings"

const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then((r) => r.json())
function iniciais(nome: string) { return nome.split(" ").filter(Boolean).slice(0,2).map((p)=>p[0]).join("").toUpperCase() }
type Perfil={nome:string;email:string;tipo:"moderador"|"membro";data_nascimento?:string|null;data_votos?:string|null;foto?:string|null;bio?:string}

export function ProfileSettings(){
 const{data}=useSWR<{perfil?:Perfil}>("/api/perfil",fetcher);const perfil=data?.perfil
 const[nome,setNome]=useState("");const[nascimento,setNascimento]=useState("");const[votos,setVotos]=useState("");const[bio,setBio]=useState("");const[foto,setFoto]=useState<string|null>(null);const[mensagem,setMensagem]=useState("");const[salvando,setSalvando]=useState(false)
 useEffect(()=>{if(!perfil)return;setNome(perfil.nome||"");setNascimento(perfil.data_nascimento||"");setVotos(perfil.data_votos||"");setBio(perfil.bio||"");setFoto(perfil.foto||null)},[perfil])
 if(!perfil)return null
 function escolherFoto(e:React.ChangeEvent<HTMLInputElement>){const a=e.target.files?.[0];if(!a)return;if(!a.type.startsWith("image/")){setMensagem("Escolha uma imagem válida.");return}if(a.size>1024*1024){setMensagem("A foto deve ter no máximo 1 MB.");return}const l=new FileReader();l.onload=()=>{setFoto(String(l.result));setMensagem("")};l.readAsDataURL(a)}
 async function salvar(){if(nome.trim().length<3){setMensagem("Informe um nome válido.");return}if(bio.length>280){setMensagem("A bio deve ter no máximo 280 caracteres.");return}setSalvando(true);setMensagem("");try{const r=await fetch("/api/perfil",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({nome:nome.trim(),dataNascimento:nascimento,dataVotos:votos,foto,bio})});const j=await r.json().catch(()=>({}));if(!r.ok||!j.ok)throw new Error(j.erro||"Não foi possível atualizar o perfil.");setMensagem("Perfil atualizado com sucesso.");await Promise.all([mutate("/api/perfil"),mutate("/api/auth/me"),mutate("/api/membros"),mutate("/api/perfis")])}catch(e){setMensagem(e instanceof Error?e.message:"Erro ao atualizar o perfil.")}finally{setSalvando(false)}}
 return <section className="mb-6 w-full overflow-hidden rounded-[28px] border border-white/70 bg-white/78 p-4 shadow-[0_18px_45px_rgba(79,24,35,.08)] backdrop-blur-2xl sm:mb-8 sm:p-6">
  <div className="mb-5"><h2 className="font-serif text-2xl font-semibold text-primary">Meu perfil</h2><p className="mt-1 text-sm text-muted-foreground">Atualize seus dados públicos e as preferências do aplicativo.</p></div>
  <div className="grid min-w-0 gap-5 md:grid-cols-[150px_minmax(0,1fr)] md:gap-6"><div className="flex flex-col items-center gap-3"><Avatar className="size-20 border-2 border-accent/55 shadow-sm sm:size-24"><AvatarImage src={foto||undefined}/><AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">{iniciais(nome||perfil.nome)}</AvatarFallback></Avatar><label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl border border-primary/20 bg-white px-4 py-2 text-sm font-semibold text-primary shadow-sm transition active:scale-[.98]"><Camera className="size-4"/>Escolher foto<input type="file" accept="image/*" className="hidden" onChange={escolherFoto}/></label>{foto&&<button type="button" className="inline-flex items-center gap-1.5 text-xs text-destructive" onClick={()=>setFoto(null)}><Trash2 className="size-3.5"/>Remover foto</button>}</div>
   <div className="grid min-w-0 gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="perfil-nome">Nome</Label><Input id="perfil-nome" value={nome} onChange={e=>setNome(e.target.value)}/></div><div className="space-y-2"><Label htmlFor="perfil-email">E-mail</Label><Input id="perfil-email" value={perfil.email} disabled/></div>{perfil.tipo==="membro"&&<><div className="space-y-2"><Label htmlFor="perfil-nascimento">Data de nascimento</Label><Input id="perfil-nascimento" type="date" value={nascimento} onChange={e=>setNascimento(e.target.value)}/></div><div className="space-y-2"><Label htmlFor="perfil-votos">Na equipe desde (opcional)</Label><Input id="perfil-votos" type="date" value={votos} onChange={e=>setVotos(e.target.value)}/></div><div className="space-y-2 sm:col-span-2"><div className="flex items-center justify-between gap-3"><Label htmlFor="perfil-bio">Bio pública</Label><span className="text-[11px] text-muted-foreground">{bio.length}/280</span></div><textarea id="perfil-bio" value={bio} onChange={e=>setBio(e.target.value.slice(0,280))} rows={4} maxLength={280} placeholder="Conte brevemente sobre seu serviço no altar, uma devoção ou algo que queira compartilhar com a equipe." className="w-full resize-none rounded-2xl border border-input bg-background px-3 py-3 text-sm outline-none transition focus:border-primary/45 focus:ring-3 focus:ring-primary/10"/><p className="text-[11px] leading-4 text-muted-foreground">Esta bio, sua foto, função e desempenho na Jornada podem ser vistos pelos outros membros. Dados administrativos continuam privados.</p></div></>}<div className="flex flex-wrap items-center gap-3 sm:col-span-2"><Button onClick={salvar} disabled={salvando} className="gap-2"><Save className="size-4"/>{salvando?"Salvando...":"Salvar perfil"}</Button>{mensagem&&<span className="text-sm text-muted-foreground">{mensagem}</span>}</div></div>
  </div>
  <NotificationSoundPreferences/><div className="mt-3"><AndroidNotificationSettings/></div>
  {perfil.tipo==="membro"&&<div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-white/75 p-4 text-sm"><div><p className="font-semibold text-foreground">Privacidade e conta</p><p className="mt-0.5 text-xs text-muted-foreground">Consulte como os dados são usados ou exclua sua conta.</p></div><div className="flex gap-3"><Link href="/privacidade" className="font-semibold text-primary hover:underline">Política</Link><Link href="/excluir-conta" className="font-semibold text-destructive hover:underline">Excluir conta</Link></div></div>}
 </section>
}
