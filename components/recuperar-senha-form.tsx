"use client"

import Link from "next/link"
import { useState } from "react"
import { AlertCircle, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Mail, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useStore } from "@/lib/store"
import { emitAppFeedback } from "@/lib/sound-preferences"

type Etapa = "solicitar" | "confirmar" | "concluido"

export function RecuperarSenhaForm() {
  const { solicitarRecuperacaoSenha, confirmarRecuperacaoSenha } = useStore()
  const [etapa, setEtapa] = useState<Etapa>("solicitar")
  const [identificador, setIdentificador] = useState("")
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [mostrarSenha, setMostrarSenha] = useState(false)

  async function handleSolicitar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null)
    setMensagem(null)
    const form = new FormData(e.currentTarget)
    const valor = String(form.get("identificador") ?? "").trim()

    if (!valor) {
      setErro("Informe seu usuário ou e-mail.")
      return
    }

    setLoading(true)
    try {
      const res = await solicitarRecuperacaoSenha(valor)
      if (!res.ok) {
        emitAppFeedback("error")
        setErro(res.erro ?? "Não foi possível enviar o código.")
        return
      }
      emitAppFeedback("success")
      setIdentificador(valor)
      setMensagem(res.mensagem ?? "Código enviado ao e-mail cadastrado.")
      setEtapa("confirmar")
    } catch {
      emitAppFeedback("error")
      setErro("Não foi possível conectar ao servidor para enviar o código.")
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirmar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null)
    const form = new FormData(e.currentTarget)
    const codigo = String(form.get("codigo") ?? "").replace(/\D/g, "")
    const novaSenha = String(form.get("novaSenha") ?? "")
    const confirmar = String(form.get("confirmar") ?? "")

    if (codigo.length !== 6) {
      setErro("Digite os 6 números do código recebido por e-mail.")
      return
    }
    if (novaSenha.length < 8) {
      setErro("A nova senha deve ter pelo menos 8 caracteres.")
      return
    }
    if (novaSenha !== confirmar) {
      setErro("As duas senhas não coincidem.")
      return
    }

    setLoading(true)
    try {
      const res = await confirmarRecuperacaoSenha(identificador, codigo, novaSenha)
      if (!res.ok) {
        emitAppFeedback("error")
        setErro(res.erro ?? "Não foi possível redefinir a senha.")
        return
      }
      emitAppFeedback("success")
      setEtapa("concluido")
    } catch {
      emitAppFeedback("error")
      setErro("Não foi possível conectar ao servidor para redefinir a senha.")
    } finally {
      setLoading(false)
    }
  }

  if (etapa === "concluido") {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700">
          <CheckCircle2 className="size-7" aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-serif text-2xl text-primary">Senha redefinida</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Sua nova senha já está ativa. Entre novamente usando seu usuário/e-mail e a nova senha.</p>
        </div>
        <Link href="/area-restrita/login" className="inline-flex h-9 w-full items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80">Voltar para o login</Link>
      </div>
    )
  }

  if (etapa === "confirmar") {
    return (
      <form onSubmit={handleConfirmar} className="space-y-4">
        {mensagem && <div className="rounded-lg border border-emerald-600/20 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-800">{mensagem}</div>}

        <div className="space-y-2">
          <Label htmlFor="codigo">Código de 6 dígitos</Label>
          <Input id="codigo" name="codigo" type="text" inputMode="numeric" pattern="[0-9]*" placeholder="000000" maxLength={6} autoComplete="one-time-code" className="text-center text-xl tracking-[0.35em]" required />
          <p className="text-xs text-muted-foreground">Use somente o código mais recente. Ele expira em 15 minutos.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="novaSenha">Nova senha</Label>
          <div className="relative">
            <Input id="novaSenha" name="novaSenha" type={mostrarSenha ? "text" : "password"} className="pr-11" placeholder="Mínimo de 8 caracteres" autoComplete="new-password" required />
            <button type="button" onClick={() => setMostrarSenha((v) => !v)} className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted" aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}>
              {mostrarSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmar">Confirme a nova senha</Label>
          <Input id="confirmar" name="confirmar" type={mostrarSenha ? "text" : "password"} placeholder="Digite novamente" autoComplete="new-password" required />
        </div>

        {erro && <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm text-destructive"><AlertCircle className="mt-0.5 size-4 shrink-0" /><span>{erro}</span></div>}

        <Button type="submit" className="w-full gap-2" disabled={loading}>
          {loading ? <><Loader2 className="size-4 animate-spin" />Redefinindo…</> : <><KeyRound className="size-4" />Salvar nova senha</>}
        </Button>

        <button type="button" onClick={() => { setEtapa("solicitar"); setErro(null); setMensagem(null) }} className="flex w-full items-center justify-center gap-2 text-sm font-medium text-primary hover:underline">
          <RotateCcw className="size-4" />Solicitar outro código
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={handleSolicitar} className="space-y-5">
      <div className="rounded-xl border border-primary/15 bg-primary/[0.035] p-3 text-sm leading-relaxed text-muted-foreground">
        Digite seu <strong className="text-foreground">usuário ou e-mail</strong>. O código será enviado somente para o e-mail de recuperação cadastrado na sua conta.
      </div>

      <div className="space-y-2">
        <Label htmlFor="identificador">Usuário ou e-mail</Label>
        <Input id="identificador" name="identificador" type="text" placeholder="seu.usuario ou seu@email.com" autoCapitalize="none" autoCorrect="off" autoComplete="username" spellCheck={false} required />
      </div>

      {erro && <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm text-destructive"><AlertCircle className="mt-0.5 size-4 shrink-0" /><span>{erro}</span></div>}

      <Button type="submit" className="w-full gap-2" disabled={loading}>
        {loading ? <><Loader2 className="size-4 animate-spin" />Enviando…</> : <><Mail className="size-4" />Enviar código por e-mail</>}
      </Button>

      <p className="text-center text-sm text-muted-foreground">Lembrou a senha? <Link href="/area-restrita/login" className="font-medium text-primary hover:underline">Voltar ao login</Link></p>
    </form>
  )
}
