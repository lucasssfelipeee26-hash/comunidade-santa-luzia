import { NextResponse } from "next/server"
import { encerrarSessao, lerSessao, verificarSenha } from "@/lib/auth"
import { buscarUsuario, excluirContaUsuario } from "@/lib/db"
import { ipDaRequisicao, limitar } from "@/lib/rate-limit"

export async function POST(req: Request) {
  const limite = limitar(`excluir-conta:${ipDaRequisicao(req)}`, 5, 30 * 60 * 1000)
  if (!limite.permitido) {
    return NextResponse.json({ ok: false, erro: "Muitas tentativas. Aguarde alguns minutos." }, { status: 429 })
  }

  const sessao = await lerSessao()
  if (!sessao) return NextResponse.json({ ok: false, erro: "Entre na conta para solicitar a exclusão." }, { status: 401 })
  if (sessao.tipo !== "membro") return NextResponse.json({ ok: false, erro: "Contas administrativas devem ser tratadas pela administração da comunidade." }, { status: 403 })

  const body = await req.json().catch(() => ({})) as { senha?: string; confirmacao?: string }
  if (String(body.confirmacao || "").trim().toUpperCase() !== "EXCLUIR") {
    return NextResponse.json({ ok: false, erro: "Digite EXCLUIR para confirmar." }, { status: 400 })
  }

  const usuario = buscarUsuario(sessao.sub)
  if (!usuario || !verificarSenha(String(body.senha || ""), usuario.senha_hash)) {
    return NextResponse.json({ ok: false, erro: "Senha incorreta." }, { status: 401 })
  }

  if (!excluirContaUsuario(usuario.id)) {
    return NextResponse.json({ ok: false, erro: "Não foi possível excluir a conta." }, { status: 500 })
  }

  await encerrarSessao()
  return NextResponse.json({ ok: true })
}
