"use client"

import { useEffect, useState } from "react"
import useSWR, { mutate } from "swr"
import { Camera, Save, Trash2 } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then((r) => r.json())

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
}

export function ProfileSettings() {
  const { data } = useSWR<{ perfil?: Perfil }>("/api/perfil", fetcher)
  const perfil = data?.perfil
  const [nome, setNome] = useState("")
  const [nascimento, setNascimento] = useState("")
  const [votos, setVotos] = useState("")
  const [foto, setFoto] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState("")
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!perfil) return
    setNome(perfil.nome || "")
    setNascimento(perfil.data_nascimento || "")
    setVotos(perfil.data_votos || "")
    setFoto(perfil.foto || null)
  }, [perfil])

  if (!perfil) return null

  function escolherFoto(evento: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0]
    if (!arquivo) return
    if (!arquivo.type.startsWith("image/")) {
      setMensagem("Escolha um arquivo de imagem válido.")
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

  async function salvar() {
    if (nome.trim().length < 3) {
      setMensagem("Informe um nome válido.")
      return
    }

    setSalvando(true)
    setMensagem("")
    try {
      const resposta = await fetch("/api/perfil", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: nome.trim(), dataNascimento: nascimento, dataVotos: votos, foto }),
      })
      const json = (await resposta.json().catch(() => ({}))) as { ok?: boolean; erro?: string }
      if (!resposta.ok || !json.ok) throw new Error(json.erro || "Não foi possível atualizar o perfil.")

      setMensagem("Perfil atualizado com sucesso.")
      await Promise.all([mutate("/api/perfil"), mutate("/api/auth/me"), mutate("/api/membros")])
    } catch (erro) {
      setMensagem(erro instanceof Error ? erro.message : "Erro ao atualizar o perfil.")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <section className="mb-8 rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5">
        <h2 className="font-serif text-2xl font-semibold text-primary">Meu perfil</h2>
        <p className="mt-1 text-sm text-muted-foreground">Atualize seus dados pessoais e a foto exibida na Área Restrita.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-[160px_1fr]">
        <div className="flex flex-col items-center gap-3">
          <Avatar className="size-24 border-2 border-accent/55 shadow-sm">
            <AvatarImage src={foto || undefined} />
            <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
              {iniciais(nome || perfil.nome)}
            </AvatarFallback>
          </Avatar>

          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-primary/25 bg-white px-3 py-2 text-sm font-medium text-primary transition hover:bg-primary/5">
            <Camera className="size-4" />
            Escolher foto
            <input type="file" accept="image/*" className="hidden" onChange={escolherFoto} />
          </label>

          {foto && (
            <button type="button" className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive hover:underline" onClick={() => setFoto(null)}>
              <Trash2 className="size-3.5" /> Remover foto
            </button>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="perfil-nome">Nome</Label>
            <Input id="perfil-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="perfil-email">E-mail</Label>
            <Input id="perfil-email" value={perfil.email} disabled />
          </div>

          {perfil.tipo === "membro" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="perfil-nascimento">Data de nascimento</Label>
                <Input id="perfil-nascimento" type="date" value={nascimento} onChange={(e) => setNascimento(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="perfil-votos">Profissão dos votos (opcional)</Label>
                <Input id="perfil-votos" type="date" value={votos} onChange={(e) => setVotos(e.target.value)} />
              </div>
            </>
          )}

          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <Button type="button" onClick={salvar} disabled={salvando} className="gap-2">
              <Save className="size-4" /> {salvando ? "Salvando..." : "Salvar perfil"}
            </Button>
            {mensagem && <span className="text-sm text-muted-foreground" role="status">{mensagem}</span>}
          </div>
        </div>
      </div>
    </section>
  )
}
