"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import useSWR from "swr"
import { AlertTriangle, Loader2, LogIn, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { limparDadosOfflineAposExclusao } from "@/lib/offline-data"

type MeResponse = { sessao: null | { tipo: "moderador" | "membro"; usuario: { id: string; nome: string; email: string } } }
const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then((r) => r.json())

export function AccountDeletionPanel() {
  const router = useRouter()
  const { data, isLoading } = useSWR<MeResponse>("/api/auth/me", fetcher, { revalidateOnFocus: false })
  const [senha, setSenha] = useState("")
  const [confirmacao, setConfirmacao] = useState("")
  const [erro, setErro] = useState("")
  const [excluindo, setExcluindo] = useState(false)

  if (isLoading) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Verificando a conta…</div>

  if (!data?.sessao) {
    return (
      <div className="rounded-2xl border border-border bg-white p-5">
        <p className="text-sm leading-6 text-muted-foreground">Para proteger sua identidade, entre pela web com a conta que deseja excluir. Não é necessário reinstalar o aplicativo.</p>
        <Button asChild className="mt-4 gap-2"><Link href="/area-restrita/login?destino=/excluir-conta"><LogIn className="size-4" />Entrar para excluir minha conta</Link></Button>
      </div>
    )
  }

  const sessao = data.sessao

  if (sessao.tipo !== "membro") {
    return <div className="rounded-2xl border border-border bg-white p-5 text-sm leading-6 text-muted-foreground">A conta administrativa é mantida pela comunidade. Para removê-la, outro responsável deve substituir o acesso e concluir o procedimento administrativo.</div>
  }

  async function excluir() {
    setErro("")
    setExcluindo(true)
    try {
      const response = await fetch("/api/perfil/excluir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senha, confirmacao }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json.ok) throw new Error(json.erro || "Não foi possível excluir a conta.")
      limparDadosOfflineAposExclusao(sessao.usuario.id)
      router.replace("/area-restrita/login?conta=excluida")
      router.refresh()
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível excluir a conta.")
    } finally {
      setExcluindo(false)
    }
  }

  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/[0.035] p-5">
      <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" /><div><h2 className="font-serif text-xl font-semibold text-destructive">Excluir conta e dados</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Esta ação remove seu perfil, foto, registros, participações em escalas, quizzes, ranking e pontualidade. Ela não pode ser desfeita.</p></div></div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="excluir-senha">Senha atual</Label><Input id="excluir-senha" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="excluir-confirmacao">Digite EXCLUIR</Label><Input id="excluir-confirmacao" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} autoCapitalize="characters" /></div>
      </div>
      {erro && <p role="alert" className="mt-3 text-sm text-destructive">{erro}</p>}
      <Button type="button" variant="destructive" className="mt-4 gap-2" disabled={excluindo || !senha || confirmacao.trim().toUpperCase() !== "EXCLUIR"} onClick={excluir}>{excluindo ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}{excluindo ? "Excluindo…" : "Excluir definitivamente"}</Button>
    </div>
  )
}
