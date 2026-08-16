"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import useSWR, { mutate } from "swr"
import { Camera, ChevronDown, Save, SmilePlus, Trash2 } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NotificationSoundPreferences } from "@/components/notification-sound-preferences"
import { AndroidNotificationSettings } from "@/components/android-notification-settings"

const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then((r) => r.json())
const EMOJIS_RECADOS = [
  { valor: "✝️", rotulo: "Cruz" },
  { valor: "⛪", rotulo: "Igreja" },
  { valor: "🙏", rotulo: "Oração" },
  { valor: "🕊️", rotulo: "Espírito Santo" },
  { valor: "🕯️", rotulo: "Vela" },
  { valor: "📖", rotulo: "Palavra de Deus" },
  { valor: "🌹", rotulo: "Nossa Senhora" },
  { valor: "❤️‍🔥", rotulo: "Sagrado Coração" },
  { valor: "👼", rotulo: "Anjo" },
  { valor: "📿✝️", rotulo: "Terço católico" },
] as const

function iniciais(nome: string) {
  return nome.split(" ").filter(Boolean).slice(0, 2).map((parte) => parte[0]).join("").toUpperCase()
}

type Perfil = {
  nome: string
  email: string
  tipo: "moderador" | "membro"
  data_nascimento?: string | null
  data_votos?: string | null
  foto?: string | null
  bio?: string
}

export function ProfileSettings() {
  const { data } = useSWR<{ perfil?: Perfil }>("/api/perfil", fetcher)
  const perfil = data?.perfil
  const [nome, setNome] = useState("")
  const [nascimento, setNascimento] = useState("")
  const [votos, setVotos] = useState("")
  const [bio, setBio] = useState("")
  const [foto, setFoto] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState("")
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!perfil) return
    setNome(perfil.nome || "")
    setNascimento(perfil.data_nascimento || "")
    setVotos(perfil.data_votos || "")
    setBio(perfil.bio || "")
    setFoto(perfil.foto || null)
  }, [perfil])

  if (!perfil) return null

  function escolherFoto(event: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0]
    if (!arquivo) return
    if (!arquivo.type.startsWith("image/")) { setMensagem("Escolha uma imagem válida."); return }
    if (arquivo.size > 1024 * 1024) { setMensagem("A foto deve ter no máximo 1 MB."); return }
    const leitor = new FileReader()
    leitor.onload = () => { setFoto(String(leitor.result)); setMensagem("") }
    leitor.readAsDataURL(arquivo)
  }

  function adicionarEmoji(emoji: string) {
    setBio((atual) => {
      const espaco = atual && !atual.endsWith(" ") ? " " : ""
      return `${atual}${espaco}${emoji}`.slice(0, 280)
    })
  }

  async function salvar() {
    if (nome.trim().length < 3) { setMensagem("Informe um nome válido."); return }
    if (bio.length > 280) { setMensagem("O recado deve ter no máximo 280 caracteres."); return }
    setSalvando(true); setMensagem("")
    try {
      const resposta = await fetch("/api/perfil", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome: nome.trim(), dataNascimento: nascimento, dataVotos: votos, foto, bio }) })
      const json = await resposta.json().catch(() => ({}))
      if (!resposta.ok || !json.ok) throw new Error(json.erro || "Não foi possível atualizar o perfil.")
      setMensagem("Perfil e recado atualizados com sucesso.")
      await Promise.all([mutate("/api/perfil"), mutate("/api/auth/me"), mutate("/api/membros"), mutate("/api/perfis")])
      window.dispatchEvent(new CustomEvent("santa-luzia:offline-snapshot-sync"))
    } catch (erro) { setMensagem(erro instanceof Error ? erro.message : "Erro ao atualizar o perfil.") }
    finally { setSalvando(false) }
  }

  return (
    <details className="group mb-3 w-full min-w-0 overflow-hidden rounded-2xl border border-white/70 bg-white/80 shadow-[0_10px_28px_rgba(79,24,35,.06)]">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2.5 marker:hidden sm:px-4">
        <Avatar className="size-11 shrink-0 border-2 border-accent/40 shadow-sm"><AvatarImage src={foto || undefined} /><AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{iniciais(nome || perfil.nome)}</AvatarFallback></Avatar>
        <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h2 className="truncate font-serif text-lg font-semibold text-primary">Meu perfil</h2><span className="rounded-full bg-primary/7 px-1.5 py-0.5 text-[8px] font-bold uppercase text-primary">Editar</span></div><p className="truncate text-[10px] text-muted-foreground">{bio.trim() || "Adicione um recado para a equipe"}</p></div>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition group-open:rotate-180" />
      </summary>

      <div className="border-t border-border/70 p-3 sm:p-4">
        <div className="grid min-w-0 gap-3 md:grid-cols-[105px_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col items-center gap-2">
            <Avatar className="size-16 border-2 border-accent/45 shadow-sm"><AvatarImage src={foto || undefined} /><AvatarFallback className="bg-primary/10 text-base font-semibold text-primary">{iniciais(nome || perfil.nome)}</AvatarFallback></Avatar>
            <label className="inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-primary/15 bg-white px-3 py-1.5 text-[11px] font-semibold text-primary"><Camera className="size-3.5" />Foto<input type="file" accept="image/*" className="hidden" onChange={escolherFoto} /></label>
            {foto && <button type="button" className="inline-flex items-center gap-1 text-[10px] text-destructive" onClick={() => setFoto(null)}><Trash2 className="size-3" />Remover</button>}
          </div>

          <div className="grid min-w-0 gap-2.5 sm:grid-cols-2">
            <div className="space-y-1"><Label htmlFor="perfil-nome" className="text-[11px]">Nome</Label><Input id="perfil-nome" value={nome} onChange={(event) => setNome(event.target.value)} className="h-10" /></div>
            <div className="space-y-1"><Label htmlFor="perfil-email" className="text-[11px]">E-mail</Label><Input id="perfil-email" value={perfil.email} disabled className="h-10" /></div>
            {perfil.tipo === "membro" && <><div className="space-y-1"><Label htmlFor="perfil-nascimento" className="text-[11px]">Nascimento</Label><Input id="perfil-nascimento" type="date" value={nascimento} onChange={(event) => setNascimento(event.target.value)} className="h-10" /></div><div className="space-y-1"><Label htmlFor="perfil-votos" className="text-[11px]">Na equipe desde</Label><Input id="perfil-votos" type="date" value={votos} onChange={(event) => setVotos(event.target.value)} className="h-10" /></div></>}

            <div className="min-w-0 space-y-2 rounded-2xl border border-primary/10 bg-primary/[.025] p-2.5 sm:col-span-2">
              <div className="flex min-w-0 items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-1.5"><SmilePlus className="size-3.5 shrink-0 text-primary" /><Label htmlFor="perfil-bio" className="truncate text-[11px] font-bold">Recado / Bio</Label></div><span className="shrink-0 text-[9px] text-muted-foreground">{bio.length}/280</span></div>
              <textarea id="perfil-bio" value={bio} onChange={(event) => setBio(event.target.value.slice(0, 280))} rows={2} maxLength={280} placeholder="Ex.: Servir com alegria é minha missão 🙏✝️" className="min-h-[72px] w-full min-w-0 resize-none rounded-xl border border-input bg-white px-3 py-2 text-sm leading-5 outline-none" />
              <div className="flex min-w-0 flex-wrap items-center gap-1"><span className="mr-1 text-[9px] font-semibold text-muted-foreground">Emojis católicos</span>{EMOJIS_RECADOS.map((item) => <button key={item.rotulo} type="button" aria-label={`Adicionar ${item.rotulo} ao recado`} title={item.rotulo} onClick={() => adicionarEmoji(item.valor)} className="flex min-h-7 min-w-7 items-center justify-center rounded-lg border border-border bg-white px-1.5 text-sm shadow-sm active:scale-95">{item.valor}</button>)}</div>
              <p className="line-clamp-2 rounded-xl bg-white/80 px-2.5 py-2 text-[11px] leading-4 text-foreground">{bio.trim() || "Seu recado aparecerá aqui."}</p>
            </div>

            <div className="flex min-w-0 flex-wrap items-center gap-2 sm:col-span-2"><Button size="sm" onClick={salvar} disabled={salvando} className="h-9 gap-1.5 rounded-xl px-3 text-xs"><Save className="size-3.5" />{salvando ? "Salvando..." : "Salvar perfil"}</Button>{mensagem && <span className="min-w-0 break-words text-[10px] text-muted-foreground">{mensagem}</span>}</div>
          </div>
        </div>

        <NotificationSoundPreferences />
        <div className="mt-2"><AndroidNotificationSettings /></div>

        {perfil.tipo === "membro" && <div className="mt-2 flex min-w-0 items-center justify-between gap-2 rounded-xl border border-border bg-white/70 px-3 py-2 text-[10px]"><span className="truncate text-muted-foreground">Privacidade e conta</span><div className="flex shrink-0 gap-2"><Link href="/privacidade" className="font-semibold text-primary hover:underline">Política</Link><Link href="/excluir-conta" className="font-semibold text-destructive hover:underline">Excluir</Link></div></div>}
      </div>
    </details>
  )
}
