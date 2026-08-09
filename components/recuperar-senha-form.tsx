"use client"

import Link from "next/link"
import { useState } from "react"
import { AlertCircle, CheckCircle2, KeyRound, Loader2, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useStore } from "@/lib/store"

type Etapa = "solicitar" | "confirmar" | "concluido"

export function RecuperarSenhaForm() {
  const { solicitarRecuperacaoSenha, confirmarRecuperacaoSenha } = useStore()
  const [etapa, setEtapa] = useState<Etapa>("solicitar")
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<string | null>(null)

  async function handleSolicitar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null)
    setLoading(true)
    const form = new FormData(e.currentTarget)
    const valor = String(form.get("email") ?? "").trim()
    const res = await solicitarRecuperacaoSenha(valor)
    setLoading(false)
    if (!res.ok) {
      setErro(res.erro ?? "Não foi possível enviar o código.")
      return
    }
    setEmail(valor)
    setMensagem(res.mensagem ?? "Se este e-mail estiver cadastrado, enviamos um código de verificação.")
    setEtapa("confirmar")
  }

  async function handleConfirmar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null)
    const form = new FormData(e.currentTarget)
    const codigo = String(form.get("codigo") ?? "").trim()
    const novaSenha = String(form.get("novaSenha") ?? "")
    const confirmar = String(form.get("confirmar") ?? "")

    if (novaSenha.length < 6) {
      setErro("A nova senha deve ter pelo menos 6 caracteres.")
      return
    }
    if (novaSenha !== confirmar) {
      setErro("As senhas não coincidem.")
      return
    }

    setLoading(true)
    const res = await confirmarRecuperacaoSenha(email, codigo, novaSenha)
    setLoading(false)
    if (!res.ok) {
      setErro(res.erro ?? "Não foi possível redefinir a senha.")
      return
    }
    setEtapa("concluido")
  }

  if (etapa === "concluido") {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-[oklch(0.6_0.08_160)]/15 text-[oklch(0.45_0.08_160)]">
          <CheckCircle2 className="size-7" aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-serif text-2xl text-primary">Senha redefinida!</h2>
          <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">
            Sua senha foi alterada com sucesso. Você já pode entrar com a nova senha.
          </p>
        </div>
        <Link href="/area-restrita/login" className="text-sm font-medium text-primary hover:underline">
          Ir para o login
        </Link>
      </div>
    )
  }

  if (etapa === "confirmar") {
    return (
      <form onSubmit={handleConfirmar} className="space-y-4">
        {mensagem && (
          <p className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-muted-foreground">
            {mensagem}
          </p>
        )}

        <div className="space-y-2">
          <Label htmlFor="codigo">Código recebido por e-mail</Label>
          <Input
            id="codigo"
            name="codigo"
            type="text"
            inputMode="numeric"
            placeholder="000000"
            maxLength={6}
            autoComplete="one-time-code"
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="novaSenha">Nova senha</Label>
            <Input
              id="novaSenha"
              name="novaSenha"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmar">Confirmar senha</Label>
            <Input
              id="confirmar"
              name="confirmar"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              required
            />
          </div>
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

        <Button type="submit" className="w-full gap-2" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Redefinindo…
            </>
          ) : (
            <>
              <KeyRound className="size-4" aria-hidden="true" />
              Redefinir senha
            </>
          )}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Não recebeu o código?{" "}
          <button
            type="button"
            onClick={() => setEtapa("solicitar")}
            className="font-medium text-primary hover:underline"
          >
            Solicitar novamente
          </button>
        </p>
      </form>
    )
  }

  return (
    <form onSubmit={handleSolicitar} className="space-y-4">
      <p className="text-pretty text-sm text-muted-foreground">
        Informe o e-mail cadastrado — vale para membros e moderadores. Vamos enviar um código de
        verificação para você redefinir sua senha.
      </p>

      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" placeholder="seu.nome@exemplo.com" autoComplete="username" required />
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

      <Button type="submit" className="w-full gap-2" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Enviando…
          </>
        ) : (
          <>
            <Mail className="size-4" aria-hidden="true" />
            Enviar código
          </>
        )}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Lembrou a senha?{" "}
        <Link href="/area-restrita/login" className="font-medium text-primary hover:underline">
          Voltar ao login
        </Link>
      </p>
    </form>
  )
}
