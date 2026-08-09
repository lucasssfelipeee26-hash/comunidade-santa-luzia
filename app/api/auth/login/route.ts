import { NextResponse } from "next/server"
import { buscarUsuarioPorLogin } from "@/lib/db"
import { criarSessao, verificarSenha } from "@/lib/auth"
import { ipDaRequisicao, limitar } from "@/lib/rate-limit"

export async function POST(req: Request) {
  const limite = limitar("login:" + ipDaRequisicao(req), 10, 15 * 60 * 1000)
  if (!limite.permitido) {
    return NextResponse.json({ ok: false, erro: "Muitas tentativas. Aguarde alguns minutos e tente novamente." }, { status: 429 })
  }
  let body: { usuario?: string; email?: string; senha?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ ok: false, erro: "Requisição inválida." }, { status: 400 })
  }

  // `email` permanece aceito apenas para compatibilidade com versões antigas do front-end.
  const login = String(body.usuario ?? body.email ?? "").trim()
  const senha = String(body.senha ?? "")
  if (!login || !senha) return NextResponse.json({ ok: false, erro: "Informe seu usuário e senha." }, { status: 400 })

  const conta = buscarUsuarioPorLogin(login)
  if (!conta || !verificarSenha(senha, conta.senha_hash)) {
    return NextResponse.json({ ok: false, erro: "Usuário ou senha inválidos." }, { status: 401 })
  }
  if (conta.tipo === "membro" && conta.status === "pendente") {
    return NextResponse.json({ ok: false, erro: "Seu cadastro aguarda aprovação do moderador." }, { status: 403 })
  }
  if (conta.tipo === "membro" && conta.status === "recusado") {
    return NextResponse.json({ ok: false, erro: "Seu acesso não foi liberado. Fale com o moderador." }, { status: 403 })
  }

  await criarSessao({ sub: conta.id, tipo: conta.tipo })
  const destino = conta.tipo === "moderador" ? "/area-restrita/moderador" : "/area-restrita/membro"
  return NextResponse.json({
    ok: true,
    destino,
    usuario: { id: conta.id, nome: conta.nome, usuario: conta.usuario, tipo: conta.tipo, funcao: conta.funcao },
  })
}
