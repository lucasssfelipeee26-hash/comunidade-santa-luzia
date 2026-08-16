import { NextResponse } from "next/server"
import { criarUsuario, gerarId, normalizarUsuario, usuarioJaExiste, emailJaExiste } from "@/lib/db"
import { hashSenha } from "@/lib/auth"
import { ipDaRequisicao, limitar } from "@/lib/rate-limit"

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const USUARIO_REGEX = /^[a-z0-9][a-z0-9._-]{2,29}$/
const DATA_REGEX = /^\d{4}-\d{2}-\d{2}$/
const MAX_NOME = 100
const MAX_EMAIL = 254
const MAX_SENHA = 128

function dataCivilValida(valor: string, permitirFuturo = false) {
  if (!DATA_REGEX.test(valor)) return false
  const [ano, mes, dia] = valor.split("-").map(Number)
  const data = new Date(Date.UTC(ano, mes - 1, dia))
  if (
    data.getUTCFullYear() !== ano ||
    data.getUTCMonth() !== mes - 1 ||
    data.getUTCDate() !== dia
  ) return false
  if (!permitirFuturo && data.getTime() > Date.now()) return false
  return ano >= 1900 && ano <= new Date().getUTCFullYear() + (permitirFuturo ? 5 : 0)
}

export async function POST(req: Request) {
  const limite = limitar("cadastro:" + ipDaRequisicao(req), 5, 60 * 60 * 1000)
  if (!limite.permitido) {
    return NextResponse.json({ ok: false, erro: "Muitas tentativas. Aguarde alguns minutos e tente novamente." }, { status: 429 })
  }

  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ ok: false, erro: "Requisição inválida." }, { status: 400 })

  const nome = String(body.nome ?? "").trim().replace(/\s+/g, " ")
  const usuario = normalizarUsuario(body.usuario)
  const email = String(body.email ?? "").trim().toLowerCase()
  const senha = String(body.senha ?? "")
  const funcaoBruta = String(body.funcao ?? "").trim()
  const dataNascimento = String(body.dataNascimento ?? "").trim()
  const dataVotos = String(body.dataVotos ?? "").trim() || null

  if (funcaoBruta !== "Acólito" && funcaoBruta !== "Coroinha") {
    return NextResponse.json({ ok: false, erro: "Selecione uma função válida: Acólito ou Coroinha." }, { status: 400 })
  }
  const funcao: "Acólito" | "Coroinha" = funcaoBruta

  if (!nome || !usuario || !email || !senha || !dataNascimento) {
    return NextResponse.json(
      { ok: false, erro: "Preencha nome, usuário, data de nascimento, e-mail de recuperação e senha." },
      { status: 400 },
    )
  }
  if (nome.length < 2 || nome.length > MAX_NOME) {
    return NextResponse.json({ ok: false, erro: "Informe um nome válido com até 100 caracteres." }, { status: 400 })
  }
  if (!USUARIO_REGEX.test(usuario)) {
    return NextResponse.json(
      { ok: false, erro: "O usuário deve ter de 3 a 30 caracteres e usar apenas letras minúsculas, números, ponto, hífen ou sublinhado." },
      { status: 400 },
    )
  }
  if (email.length > MAX_EMAIL || !EMAIL_REGEX.test(email)) {
    return NextResponse.json({ ok: false, erro: "E-mail de recuperação inválido." }, { status: 400 })
  }
  if (senha.length < 8 || senha.length > MAX_SENHA) {
    return NextResponse.json({ ok: false, erro: "A senha deve ter entre 8 e 128 caracteres." }, { status: 400 })
  }
  if (!dataCivilValida(dataNascimento)) {
    return NextResponse.json({ ok: false, erro: "Informe uma data de nascimento válida." }, { status: 400 })
  }
  if (dataVotos && !dataCivilValida(dataVotos)) {
    return NextResponse.json({ ok: false, erro: "Informe uma data de votos válida." }, { status: 400 })
  }
  if (dataVotos && dataVotos < dataNascimento) {
    return NextResponse.json({ ok: false, erro: "A data de votos não pode ser anterior à data de nascimento." }, { status: 400 })
  }
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
