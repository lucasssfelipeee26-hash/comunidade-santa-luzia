"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import useSWR, { mutate } from "swr"
import { Camera, Save, SmilePlus, Trash2 } from "lucide-react"
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
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join("")
    .toUpperCase()
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
    if (!arquivo.type.startsWith("image/")) {
      setMensagem("Escolha uma imagem válida.")
      return
    }
    if (arquivo.size > 1024 * 1024) {
      setMensagem("A foto deve ter no máximo 1 MB.")
      return
    }
    const leitor = new FileReader()
    leitor.onload = () => {
      setFoto(String(leitor.result))
      setMensagem("")
    }
    leitor.readAsDataURL(arquivo)
  }

  function adicionarEmoji(emoji: string) {
    setBio((atual) => {
      const espaco = atual && !atual.endsWith(" ") ? " " : ""
      return `${atual}${espaco}${emoji}`.slice(0, 280)
    })
  }

  async function salvar() {
    if (nome.trim().length < 3) {
      setMensagem("Informe um nome válido.")
      return
    }
    if (bio.length > 280) {
      setMensagem("O recado deve ter no máximo 280 caracteres.")
      return
    }

    setSalvando(true)
    setMensagem("")
    try {
      const resposta = await fetch("/api/perfil", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nome.trim(),
          dataNascimento: nascimento,
          dataVotos: votos,
          foto,
          bio,
        }),
      })
      const json = await resposta.json().catch(() => ({}))
      if (!resposta.ok || !json.ok) throw new Error(json.erro || "Não foi possível atualizar o perfil.")
      setMensagem("Perfil e recado atualizados com sucesso.")
      await Promise.all([
        mutate("/api/perfil"),
        mutate("/api/auth/me"),
        mutate("/api/membros"),
        mutate("/api/perfis"),
      ])
      window.dispatchEvent(new CustomEvent("santa-luzia:offline-snapshot-sync"))
    } catch (erro) {
      setMensagem(erro instanceof Error ? erro.message : "Erro ao atualizar o perfil.")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <section className="mb-6 w-full min-w-0 overflow-hidden rounded-[28px] border border-white/70 bg-white/78 p-4 shadow-[0_18px_45px_rgba(79,24,35,.08)] backdrop-blur-2xl sm:mb-8 sm:p-6">
      <div className="mb-5">
        <h2 className="font-serif text-2xl font-semibold text-primary">Meu perfil</h2>
        <p className="mt-1 text-sm text-muted-foreground">Atualize sua foto, seus dados e o recado que a equipe verá no seu perfil.</p>
      </div>

      <div className="grid min-w-0 gap-5 md:grid-cols-[150px_minmax(0,1fr)] md:gap-6">
        <div className="flex min-w-0 flex-col items-center gap-3">
          <Avatar className="size-20 border-2 border-accent/55 shadow-sm sm:size-24">
            <AvatarImage src={foto || undefined} />
            <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">{iniciais(nome || perfil.nome)}</AvatarFallback>
          </Avatar>
          <label className="inline-flex min-h-11 max-w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-white px-4 py-2 text-center text-sm font-semibold text-primary shadow-sm transition active:scale-[.98]">
            <Camera className="size-4 shrink-0" />
            <span className="min-w-0 break-words">Escolher foto</span>
            <input type="file" accept="image/*" className="hidden" onChange={escolherFoto} />
          </label>
          {foto && (
            <button
              type="button"
              className="inline-flex max-w-full items-center gap-1.5 text-center text-xs text-destructive"
              onClick={() => setFoto(null)}
            >
              <Trash2 className="size-3.5 shrink-0" />
              Remover foto
            </button>
          )}
        </div>

        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="perfil-nome">Nome</Label>
            <Input id="perfil-nome" value={nome} onChange={(event) => setNome(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="perfil-email">E-mail</Label>
            <Input id="perfil-email" value={perfil.email} disabled />
          </div>

          {perfil.tipo === "membro" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="perfil-nascimento">Data de nascimento</Label>
                <Input id="perfil-nascimento" type="date" value={nascimento} onChange={(event) => setNascimento(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="perfil-votos">Na equipe desde (opcional)</Label>
                <Input id="perfil-votos" type="date" value={votos} onChange={(event) => setVotos(event.target.value)} />
              </div>
            </>
          )}

          <div className="min-w-0 space-y-3 rounded-[22px] border border-primary/12 bg-primary/[.035] p-3.5 sm:col-span-2 sm:p-4">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <SmilePlus className="size-4 shrink-0 text-primary" />
                  <Label htmlFor="perfil-bio" className="text-sm font-bold text-foreground">Recado / Bio</Label>
                </div>
                <p className="mt-1 text-[11px] leading-4 text-muted-foreground">Como no WhatsApp: escreva uma frase, devoção ou recado para a equipe.</p>
              </div>
              <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[11px] font-medium text-muted-foreground">{bio.length}/280</span>
            </div>

            <textarea
              id="perfil-bio"
              value={bio}
              onChange={(event) => setBio(event.target.value.slice(0, 280))}
              rows={3}
              maxLength={280}
              placeholder="Ex.: Servir com alegria é minha missão 🙏✝️"
              className="w-full min-w-0 resize-none rounded-2xl border border-input bg-white px-3 py-3 text-sm leading-6 outline-none transition focus:border-primary/45 focus:ring-3 focus:ring-primary/10"
            />

            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold text-muted-foreground">Emojis católicos:</span>
              {EMOJIS_RECADOS.map((item) => (
                <button
                  key={item.rotulo}
                  type="button"
                  aria-label={`Adicionar ${item.rotulo} ao recado`}
                  title={item.rotulo}
                  onClick={() => adicionarEmoji(item.valor)}
                  className="flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-white px-2 text-lg shadow-sm transition active:scale-95"
                >
                  {item.valor}
                </button>
              ))}
            </div>

            <div className="min-w-0 rounded-2xl bg-white/85 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-[.12em] text-primary">Prévia do recado</p>
              <p className="mt-1 min-h-5 whitespace-pre-wrap break-words text-sm text-foreground">
                {bio.trim() || "Seu recado aparecerá aqui."}
              </p>
            </div>

            <p className="text-[11px] leading-4 text-muted-foreground">
              Seu recado, foto, função e desempenho público podem ser vistos pela equipe. Faltas, advertências, justificativas e observações continuam privadas.
            </p>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-3 sm:col-span-2">
            <Button onClick={salvar} disabled={salvando} className="gap-2">
              <Save className="size-4" />
              {salvando ? "Salvando..." : "Salvar perfil"}
            </Button>
            {mensagem && <span className="min-w-0 break-words text-sm text-muted-foreground">{mensagem}</span>}
          </div>
        </div>
      </div>

      <NotificationSoundPreferences />
      <div className="mt-3">
        <AndroidNotificationSettings />
      </div>

      {perfil.tipo === "membro" && (
        <div className="mt-4 flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-white/75 p-4 text-sm">
          <div className="min-w-0">
            <p className="font-semibold text-foreground">Privacidade e conta</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Consulte como os dados são usados ou exclua sua conta.</p>
          </div>
          <div className="flex min-w-0 flex-wrap gap-3">
            <Link href="/privacidade" className="font-semibold text-primary hover:underline">Política</Link>
            <Link href="/excluir-conta" className="font-semibold text-destructive hover:underline">Excluir conta</Link>
          </div>
        </div>
      )}
    </section>
  )
}
