"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { AlertCircle, Eye, EyeOff, Loader2, LockKeyhole, UserRound, BookOpenText, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useStore } from "@/lib/store"
import { emitAppFeedback } from "@/lib/sound-preferences"

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login } = useStore()
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [mostrarSenha, setMostrarSenha] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null)
    const form = new FormData(e.currentTarget)
    const usuario = String(form.get("usuario") ?? "").trim()
    const senha = String(form.get("senha") ?? "")

    if (!usuario || !senha) {
      setErro("Informe seu usuário/e-mail e sua senha.")
      return
    }

    setLoading(true)
    try {
      const res = await login(usuario, senha)
      if (!res.ok) {
        emitAppFeedback("error")
        setErro(res.erro ?? "Não foi possível entrar.")
        return
      }
      emitAppFeedback("success")
      const solicitado = searchParams.get("destino")
      const destinoSeguro = solicitado && solicitado.startsWith("/") && !solicitado.startsWith("//") ? solicitado : null
      router.replace(destinoSeguro ?? res.destino ?? "/area-restrita")
      router.refresh()
    } catch {
      emitAppFeedback("error")
      setErro("Não foi possível conectar ao servidor. Verifique a conexão do aplicativo e tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-xl border border-primary/15 bg-primary/[0.035] p-3 text-sm text-muted-foreground">
        Entre com seu <strong className="text-foreground">nome de usuário ou e-mail</strong>. A senha diferencia letras maiúsculas e minúsculas.
      </div>

      <div className="space-y-2">
        <Label htmlFor="usuario">Usuário ou e-mail</Label>
        <div className="relative">
          <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="usuario"
            name="usuario"
            type="text"
            className="pl-9"
            placeholder="lucas.santos ou seu@email.com"
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="username"
            spellCheck={false}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="senha">Senha</Label>
        <div className="relative">
          <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="senha"
            name="senha"
            type={mostrarSenha ? "text" : "password"}
            className="pl-9 pr-11"
            placeholder="Digite sua senha"
            autoComplete="current-password"
            required
          />
          <button
            type="button"
            onClick={() => setMostrarSenha((v) => !v)}
            className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
            aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
          >
            {mostrarSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        <p className="text-right text-xs">
          <Link href="/area-restrita/recuperar-senha" className="font-semibold text-primary hover:underline">
            Esqueci minha senha
          </Link>
        </p>
      </div>

      {erro && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{erro}</span>
        </div>
      )}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? <><Loader2 className="size-4 animate-spin" />Entrando…</> : "Entrar"}
      </Button>

      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
        <div className="relative flex justify-center text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground"><span className="bg-white px-3">ou</span></div>
      </div>

      <Link
        href="/visitante"
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#d4af37]/70 bg-[#fff8e7] px-4 py-3 text-sm font-bold text-[#6a1425] transition active:scale-[.99]"
      >
        <BookOpenText className="size-4" />
        Continuar como visitante
      </Link>
      <p className="-mt-2 text-center text-[11px] leading-4 text-muted-foreground">
        Sem login: Liturgia Diária, Escala do Dia e Biblioteca.
      </p>

      <Link href="/baixar" className="flex items-center justify-center gap-1.5 text-xs font-semibold text-primary hover:underline">
        <Download className="size-3.5" /> Baixar o aplicativo Android
      </Link>

      <p className="text-center text-sm text-muted-foreground">
        Ainda não tem acesso?{" "}
        <Link href="/area-restrita/cadastro" className="font-medium text-primary hover:underline">Cadastre-se</Link>
      </p>
    </form>
  )
}
