import { NextResponse } from "next/server"
import { buscarUsuarioPorLogin, db, type UsuarioRow } from "@/lib/db"
import { criarSessao, hashSenha, verificarSenha } from "@/lib/auth"
import { ipDaRequisicao, limitar } from "@/lib/rate-limit"

function normalizar(value: unknown) {
  return String(value ?? "").trim().toLowerCase()
}

export async function POST(req: Request) {
  const limite = limitar("login:" + ipDaRequisicao(req), 12, 15 * 60 * 1000)
  if (!limite.permitido) {
    return NextResponse.json(
      { ok: false, erro: "Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente." },
      { status: 429 },
    )
  }

  let body: { usuario?: string; email?: string; senha?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, erro: "Requisição inválida." }, { status: 400 })
  }

  const login = String(body.usuario ?? body.email ?? "").trim()
  const senha = String(body.senha ?? "")

  if (!login || !senha) {
    return NextResponse.json({ ok: false, erro: "Informe seu usuário/e-mail e sua senha." }, { status: 400 })
  }

  const adminUsuario = normalizar(process.env.INITIAL_ADMIN_USERNAME)
  const adminEmail = normalizar(process.env.INITIAL_ADMIN_EMAIL)
  const adminSenha = String(process.env.INITIAL_ADMIN_PASSWORD ?? "")
  const loginNormalizado = normalizar(login)
  const credencialInicialConfere =
    adminSenha.length >= 8 &&
    senha === adminSenha &&
    ((adminUsuario && loginNormalizado === adminUsuario) || (adminEmail && loginNormalizado === adminEmail))

  let conta = buscarUsuarioPorLogin(login)

  // Recuperação segura do moderador inicial em instalações que já possuíam
  // um banco/volume anterior. O segredo continua somente no Railway.
  if (!conta && credencialInicialConfere && adminEmail) {
    conta = db.prepare("SELECT * FROM usuarios WHERE lower(email) = ?").get(adminEmail) as UsuarioRow | undefined
  }

  let senhaValida = conta?.senha_hash ? verificarSenha(senha, conta.senha_hash) : false

  if (conta && conta.tipo === "moderador" && !senhaValida && credencialInicialConfere) {
    const atualizou = db.prepare("UPDATE usuarios SET senha_hash = ? WHERE id = ?").run(hashSenha(adminSenha), conta.id)
    senhaValida = atualizou.changes > 0
  }

  if (!conta || !senhaValida) {
    return NextResponse.json(
      { ok: false, erro: "Usuário/e-mail ou senha inválidos. Confira os dados ou use ‘Esqueci minha senha’." },
      { status: 401 },
    )
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
    usuario: {
      id: conta.id,
      nome: conta.nome,
      usuario: conta.usuario,
      email: conta.email,
      tipo: conta.tipo,
      funcao: conta.funcao,
    },
  })
}
