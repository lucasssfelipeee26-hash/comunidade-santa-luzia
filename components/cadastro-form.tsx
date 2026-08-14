"use client"

import Link from "next/link"
import { useState } from "react"
import { AlertCircle, CheckCircle2, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useStore } from "@/lib/store"

export function CadastroForm() {
  const { cadastrar } = useStore()
  const [funcao, setFuncao] = useState<"Acólito" | "Coroinha">("Coroinha")
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null)
    const form = new FormData(e.currentTarget)
    const senha = String(form.get("senha") ?? "")
    const confirmar = String(form.get("confirmar") ?? "")
    if (senha.length < 8) {
      setErro("A senha deve ter pelo menos 8 caracteres.")
      return
    }
    if (senha !== confirmar) {
      setErro("As senhas não coincidem.")
      return
    }
    const res = await cadastrar({
      nome: String(form.get("nome") ?? ""),
      usuario: String(form.get("usuario") ?? ""),
      email: String(form.get("email") ?? ""),
      senha,
      funcao,
      dataNascimento: String(form.get("dataNascimento") ?? ""),
      dataVotos: String(form.get("dataVotos") ?? ""),
    })
    if (!res.ok) {
      setErro(res.erro ?? "Não foi possível concluir o cadastro.")
      return
    }
    setSucesso(true)
  }

  if (sucesso) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-[oklch(0.6_0.08_160)]/15 text-[oklch(0.45_0.08_160)]">
          <CheckCircle2 className="size-7" aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-serif text-2xl text-primary">Cadastro enviado!</h2>
          <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">
            Seu cadastro foi registrado e aguarda a <strong>aprovação do moderador</strong> da
            equipe. Assim que for liberado, você poderá acessar a área restrita com seu usuário e
            senha.
          </p>
        </div>
        <Link
          href="/area-restrita/login"
          className="text-sm font-medium text-primary hover:underline"
        >
          Ir para o login
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="nome">Nome completo</Label>
        <Input id="nome" name="nome" type="text" placeholder="Seu nome completo" required />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="dataNascimento">Data de nascimento</Label><Input id="dataNascimento" name="dataNascimento" type="date" required /></div>
        <div className="space-y-2"><Label htmlFor="dataVotos">Data de profissão dos votos (opcional)</Label><Input id="dataVotos" name="dataVotos" type="date" /><p className="text-xs text-muted-foreground">Quando informada, aparecerá no perfil como {funcao} desde esta data.</p></div>
      </div>

      <div className="space-y-2">
        <Label>Função</Label>
        <div className="grid grid-cols-2 gap-2">
          {(["Coroinha", "Acólito"] as const).map((op) => (
            <button
              key={op}
              type="button"
              onClick={() => setFuncao(op)}
              aria-pressed={funcao === op}
              className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                funcao === op
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:border-primary/40"
              }`}
            >
              {op}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="usuario">Criar usuário</Label>
          <Input
            id="usuario"
            name="usuario"
            type="text"
            placeholder="ex.: joao.silva"
            autoComplete="username"
            minLength={3}
            maxLength={30}
            required
          />
          <p className="text-xs text-muted-foreground">
            Este será o nome usado para entrar na Área Restrita.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">E-mail para recuperação de senha</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="seu.nome@exemplo.com"
            autoComplete="email"
            required
          />
          <p className="text-xs text-muted-foreground">
            Usaremos este e-mail somente para sua conta e recuperação de senha.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="senha">Senha</Label>
          <Input id="senha" name="senha" type="password" placeholder="••••••••" autoComplete="new-password" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmar">Confirmar senha</Label>
          <Input id="confirmar" name="confirmar" type="password" placeholder="••••••••" autoComplete="new-password" required />
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

      <Button type="submit" className="w-full gap-2">
        <UserPlus className="size-4" aria-hidden="true" />
        Enviar cadastro
      </Button>

      <p className="text-center text-xs leading-5 text-muted-foreground">Ao enviar o cadastro, você declara que leu a <Link href="/privacidade" className="font-semibold text-primary hover:underline">Política de Privacidade</Link>. Se for menor de idade, o cadastro deve ser autorizado pelo responsável.</p>

      <p className="text-center text-sm text-muted-foreground">
        Já tem acesso?{" "}
        <Link href="/area-restrita/login" className="font-medium text-primary hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  )
}
