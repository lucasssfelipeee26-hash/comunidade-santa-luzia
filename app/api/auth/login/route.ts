import { NextResponse } from "next/server"
import { buscarUsuarioPorLogin, criarUsuario, db, gerarId, normalizarUsuario, type UsuarioRow } from "@/lib/db"
import { criarSessao, hashSenha, verificarSenha } from "@/lib/auth"
import { ipDaRequisicao, limitar } from "@/lib/rate-limit"

function normalizar(value: unknown) {
  return String(value ?? "").trim().toLowerCase()
}

type AdminInicial = {
  nome: string
  usuario: string
  email: string
  senha: string
}

function lerAdmin(prefixo: "INITIAL_ADMIN" | "INITIAL_ADMIN2"): AdminInicial | null {
  const nome = String(process.env[`${prefixo}_NAME`] ?? "Moderador").trim() || "Moderador"
  const usuario = normalizarUsuario(process.env[`${prefixo}_USERNAME`])
  const emailConfigurado = normalizar(process.env[`${prefixo}_EMAIL`])
  const senha = String(process.env[`${prefixo}_PASSWORD`] ?? "")

  if (!usuario || senha.length < 10) return null

  // O e-mail é opcional para o bootstrap. Se não houver e-mail real ainda,
  // usa um endereço interno não roteável; ele pode ser substituído depois.
  const email = emailConfigurado || `${usuario}@moderador.santa-luzia.invalid`
  return { nome, usuario, email, senha }
}

function adminsConfigurados() {
  return [lerAdmin("INITIAL_ADMIN"), lerAdmin("INITIAL_ADMIN2")].filter((a): a is AdminInicial => Boolean(a))
}

function adminDaCredencial(login: string, senha: string) {
  const loginNormalizado = normalizar(login)
  return adminsConfigurados().find(
    (admin) =>
      senha === admin.senha &&
      (loginNormalizado === normalizar(admin.usuario) || loginNormalizado === normalizar(admin.email)),
  )
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

  const adminInicial = adminDaCredencial(login, senha)
  let conta = buscarUsuarioPorLogin(login)

  // Se o login configurado no Railway mudou, tenta recuperar o moderador
  // pelo e-mail correspondente antes de criar outra conta.
  if (!conta && adminInicial?.email) {
    conta = db.prepare("SELECT * FROM usuarios WHERE lower(email) = ?").get(adminInicial.email) as UsuarioRow | undefined
  }

  // Se a instalação ainda não possui esse moderador, cria no primeiro login
  // válido. A senha nunca fica no GitHub: chega pelo Railway e é salva com hash.
  if (!conta && adminInicial) {
    const novaConta: UsuarioRow = {
      id: gerarId(adminInicial.nome),
      nome: adminInicial.nome,
      usuario: adminInicial.usuario,
      email: adminInicial.email,
      senha_hash: hashSenha(adminInicial.senha),
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

  // Se o moderador já existia com senha antiga, sincroniza somente quando
  // a credencial completa bate com uma das configurações seguras do Railway.
  if (conta && conta.tipo === "moderador" && !senhaValida && adminInicial) {
    const atualizou = db.prepare("UPDATE usuarios SET senha_hash = ? WHERE id = ?").run(hashSenha(adminInicial.senha), conta.id)
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
