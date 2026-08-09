"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useStore } from "@/lib/store"

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login } = useStore()
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null)
    const form = new FormData(e.currentTarget)
    const usuario = String(form.get("usuario") ?? "")
    const senha = String(form.get("senha") ?? "")

    setLoading(true)
    const res = await login(usuario, senha)
    if (!res.ok) {
      setErro(res.erro ?? "Não foi possível entrar.")
      setLoading(false)
      return
    }
    const solicitado = searchParams.get("destino")
    const destinoSeguro = solicitado && solicitado.startsWith("/") && !solicitado.startsWith("//") ? solicitado : null
    router.replace(destinoSeguro ?? res.destino ?? "/area-restrita")
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="usuario">Usuário</Label>
        <Input
          id="usuario"
          name="usuario"
          type="text"
          placeholder="seu.usuario"
          autoComplete="username"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="senha">Senha</Label>
        <Input
          id="senha"
          name="senha"
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          required
        />
        <p className="text-right text-xs">
          <Link href="/area-restrita/recuperar-senha" className="font-medium text-primary hover:underline">
            Esqueceu sua senha?
          </Link>
        </p>
      </div>

      {erro && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{erro}</span>
        </div>
      )}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Entrando…
          </>
        ) : (
          "Entrar"
        )}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Ainda não tem acesso?{" "}
        <Link href="/area-restrita/cadastro" className="font-medium text-primary hover:underline">
          Cadastre-se
        </Link>
      </p>
    </form>
  )
}
