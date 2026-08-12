import { NextResponse } from "next/server"
import { buscarUsuarioPorLogin, criarUsuario, db, gerarId, normalizarUsuario, type UsuarioRow } from "@/lib/db"
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
  const adminNome = String(process.env.INITIAL_ADMIN_NAME ?? "Moderador").trim() || "Moderador"
  const loginNormalizado = normalizar(login)
  const credencialInicialConfere =
    adminSenha.length >= 8 &&
    senha === adminSenha &&
    ((adminUsuario && loginNormalizado === adminUsuario) || (adminEmail && loginNormalizado === adminEmail))

  let conta = buscarUsuarioPorLogin(login)

  // Recupera uma instalação antiga pelo e-mail configurado no Railway.
  if (!conta && credencialInicialConfere && adminEmail) {
    conta = db.prepare("SELECT * FROM usuarios WHERE lower(email) = ?").get(adminEmail) as UsuarioRow | undefined
  }

  // Em uma instalação nova, cria o moderador no primeiro login válido.
  // A senha continua somente nas variáveis do Railway e entra no banco já com hash.
  if (!conta && credencialInicialConfere && adminEmail) {
    const usuario = adminUsuario || normalizarUsuario(adminEmail.split("@")[0]) || "moderador"
    const novaConta: UsuarioRow = {
      id: gerarId(adminNome),
      nome: adminNome,
      usuario,
      email: adminEmail,
      senha_hash: hashSenha(adminSenha),
      tipo: "moderador",
      funcao: null,
      desde: null,
      status: "aprovado",
      criado_em: Date.now(),
    }
    criarUsuario(novaConta)
    conta = novaConta
  }

  let senhaValida = conta?.senha_hash ? verificarSenha(senha, conta.senha_hash) : false

  // Se a conta já existia com uma senha antiga, sincroniza com a senha atual do Railway.
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
