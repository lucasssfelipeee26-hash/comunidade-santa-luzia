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
  const alvo = buscarUsuario(id)
  if (!alvo) {
    return NextResponse.json({ ok: false, erro: "Cadastro não encontrado." }, { status: 404 })
  }
  if (alvo.tipo === "moderador") {
    return NextResponse.json({ ok: false, erro: "Este cadastro já é moderador." }, { status: 409 })
  }

  const promovido = promoverUsuarioModerador(id, promotor.id)
  if (!promovido) {
    return NextResponse.json({ ok: false, erro: "Não foi possível promover este cadastro." }, { status: 409 })
  }

  return NextResponse.json({
    ok: true,
    mensagem: `${promovido.nome} agora é moderador. O novo acesso será ativado no próximo login.`,
    moderador: {
      id: promovido.id,
      nome: promovido.nome,
      usuario: promovido.usuario,
      email: promovido.email,
    },
  })
}
