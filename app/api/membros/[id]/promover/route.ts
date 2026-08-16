import { NextResponse } from "next/server"
import { lerSessao } from "@/lib/auth"
import { buscarUsuario, promoverUsuarioModerador } from "@/lib/db"

export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await lerSessao()
  if (!sessao || sessao.tipo !== "moderador") {
    return NextResponse.json({ ok: false, erro: "Apenas um moderador pode promover outro cadastro." }, { status: 403 })
  }

  const promotor = buscarUsuario(sessao.sub)
  if (!promotor || promotor.tipo !== "moderador") {
    return NextResponse.json({ ok: false, erro: "A sessão de moderador não é mais válida." }, { status: 403 })
  }

  const { id } = await params
  if (!id || id.length > 160) return NextResponse.json({ ok: false, erro: "Cadastro inválido." }, { status: 400 })
  if (id === promotor.id) return NextResponse.json({ ok: false, erro: "Sua conta já possui acesso de moderador." }, { status: 409 })

  const alvo = buscarUsuario(id)
  if (!alvo) return NextResponse.json({ ok: false, erro: "Cadastro não encontrado." }, { status: 404 })
  if (alvo.tipo === "moderador") return NextResponse.json({ ok: false, erro: "Este cadastro já é moderador." }, { status: 409 })
  if (alvo.status !== "aprovado" || (alvo.funcao !== "Acólito" && alvo.funcao !== "Coroinha")) {
    return NextResponse.json({ ok: false, erro: "Apenas um acólito ou coroinha aprovado pode ser promovido a moderador." }, { status: 409 })
  }

  const promovido = promoverUsuarioModerador(id, promotor.id)
  if (!promovido) {
    return NextResponse.json({ ok: false, erro: "Não foi possível promover este cadastro." }, { status: 409 })
  }

  return NextResponse.json({
    ok: true,
    mensagem: `${promovido.nome} agora é moderador. O novo nível de acesso passa a valer automaticamente nas próximas requisições.`,
    moderador: {
      id: promovido.id,
      nome: promovido.nome,
      usuario: promovido.usuario,
      email: promovido.email,
    },
  })
}
