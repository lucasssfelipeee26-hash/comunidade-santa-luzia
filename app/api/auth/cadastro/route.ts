import { NextResponse } from "next/server"
import { criarUsuario, gerarId, normalizarUsuario, usuarioJaExiste, emailJaExiste } from "@/lib/db"
import { hashSenha } from "@/lib/auth"
import { ipDaRequisicao, limitar } from "@/lib/rate-limit"

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const USUARIO_REGEX = /^[a-z0-9][a-z0-9._-]{2,29}$/

export async function POST(req: Request) {
  const limite = limitar("cadastro:" + ipDaRequisicao(req), 5, 60 * 60 * 1000)
  if (!limite.permitido) {
    return NextResponse.json({ ok: false, erro: "Muitas tentativas. Aguarde alguns minutos e tente novamente." }, { status: 429 })
  }
  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ ok: false, erro: "Requisição inválida." }, { status: 400 })

  const nome = String(body.nome ?? "").trim()
  const usuario = normalizarUsuario(body.usuario)
  const email = String(body.email ?? "").trim().toLowerCase()
  const senha = String(body.senha ?? "")
  const funcaoBruta = String(body.funcao ?? "").trim()
  if (funcaoBruta !== "Acólito" && funcaoBruta !== "Coroinha") {
    return NextResponse.json({ ok: false, erro: "Selecione uma função válida: Acólito ou Coroinha." }, { status: 400 })
  }
  const funcao: "Acólito" | "Coroinha" = funcaoBruta
  const dataNascimento = String(body.dataNascimento ?? "").trim()
  const dataVotos = String(body.dataVotos ?? "").trim() || null

  if (!nome || !usuario || !email || !senha || !dataNascimento) {
    return NextResponse.json(
      { ok: false, erro: "Preencha nome, usuário, data de nascimento, e-mail de recuperação e senha." },
      { status: 400 },
    )
  }
  if (!USUARIO_REGEX.test(usuario)) {
    return NextResponse.json(
      { ok: false, erro: "O usuário deve ter de 3 a 30 caracteres e usar apenas letras minúsculas, números, ponto, hífen ou sublinhado." },
      { status: 400 },
    )
  }
  if (!EMAIL_REGEX.test(email)) return NextResponse.json({ ok: false, erro: "E-mail de recuperação inválido." }, { status: 400 })
  if (senha.length < 8) return NextResponse.json({ ok: false, erro: "A senha deve ter pelo menos 8 caracteres." }, { status: 400 })
  if (usuarioJaExiste(usuario)) return NextResponse.json({ ok: false, erro: "Este nome de usuário já está em uso. Escolha outro." }, { status: 409 })
  if (emailJaExiste(email)) return NextResponse.json({ ok: false, erro: "Este e-mail já está vinculado a uma conta." }, { status: 409 })

  criarUsuario({
    id: gerarId(nome),
    nome,
    usuario,
    email,
    senha_hash: hashSenha(senha),
    tipo: "membro",
    funcao,
    desde: dataVotos,
    data_nascimento: dataNascimento,
    data_votos: dataVotos,
    foto: null,
    status: "pendente",
  })

  return NextResponse.json({ ok: true })
}
