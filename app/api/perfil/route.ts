import { NextResponse } from "next/server"
import { lerSessao } from "@/lib/auth"
import { atualizarPerfil, buscarUsuario } from "@/lib/db"
import { obterBioPublica, salvarBioPublica } from "@/lib/perfis-publicos"

type PerfilPatch = {
  nome?: unknown
  dataNascimento?: unknown
  dataVotos?: unknown
  foto?: unknown
  bio?: unknown
}

const DATA_REGEX = /^\d{4}-\d{2}-\d{2}$/
const FOTO_REGEX = /^data:image\/(?:jpeg|jpg|png|webp);base64,[a-z0-9+/=\r\n]+$/i

function dataCivilValida(valor: string) {
  if (!DATA_REGEX.test(valor)) return false
  const [ano, mes, dia] = valor.split("-").map(Number)
  const data = new Date(Date.UTC(ano, mes - 1, dia))
  return (
    ano >= 1900 &&
    ano <= new Date().getUTCFullYear() &&
    data.getUTCFullYear() === ano &&
    data.getUTCMonth() === mes - 1 &&
    data.getUTCDate() === dia &&
    data.getTime() <= Date.now()
  )
}

export async function GET() {
  const sessao = await lerSessao()
  if (!sessao) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const usuario = buscarUsuario(sessao.sub)
  if (!usuario) return NextResponse.json({ erro: "Usuário não encontrado." }, { status: 404 })

  const { senha_hash: _senha, ...perfil } = usuario
  return NextResponse.json(
    { perfil: { ...perfil, bio: obterBioPublica(usuario.id) } },
    { headers: { "Cache-Control": "no-store" } },
  )
}

export async function PATCH(req: Request) {
  const sessao = await lerSessao()
  if (!sessao) return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 401 })

  const body = (await req.json().catch(() => null)) as PerfilPatch | null
  if (!body) return NextResponse.json({ ok: false, erro: "Dados inválidos." }, { status: 400 })

  const nome = body.nome === undefined ? undefined : String(body.nome ?? "").trim().replace(/\s+/g, " ")
  if (nome !== undefined && (nome.length < 2 || nome.length > 100)) {
    return NextResponse.json({ ok: false, erro: "Informe um nome válido com até 100 caracteres." }, { status: 400 })
  }

  const dataNascimento = body.dataNascimento === undefined ? undefined : String(body.dataNascimento ?? "").trim()
  if (dataNascimento && !dataCivilValida(dataNascimento)) {
    return NextResponse.json({ ok: false, erro: "Data de nascimento inválida." }, { status: 400 })
  }

  const dataVotosBruta = body.dataVotos === undefined ? undefined : String(body.dataVotos ?? "").trim()
  if (dataVotosBruta && !dataCivilValida(dataVotosBruta)) {
    return NextResponse.json({ ok: false, erro: "Data de profissão dos votos inválida." }, { status: 400 })
  }
  if (dataNascimento && dataVotosBruta && dataVotosBruta < dataNascimento) {
    return NextResponse.json({ ok: false, erro: "A data de votos não pode ser anterior à data de nascimento." }, { status: 400 })
  }

  const foto = body.foto === undefined ? undefined : body.foto === null ? null : String(body.foto)
  if (foto && !FOTO_REGEX.test(foto)) {
    return NextResponse.json({ ok: false, erro: "Formato de foto inválido. Use JPEG, PNG ou WebP." }, { status: 400 })
  }
  if (foto && foto.length > 1_400_000) {
    return NextResponse.json({ ok: false, erro: "A foto deve ter no máximo 1 MB." }, { status: 400 })
  }

  const bio = body.bio === undefined ? undefined : String(body.bio ?? "").trim()
  if (bio !== undefined && bio.length > 280) {
    return NextResponse.json({ ok: false, erro: "O recado deve ter no máximo 280 caracteres." }, { status: 400 })
  }

  const atual = buscarUsuario(sessao.sub)
  if (!atual) return NextResponse.json({ ok: false, erro: "Usuário não encontrado." }, { status: 404 })
  const nascimentoFinal = dataNascimento === undefined ? atual.data_nascimento ?? "" : dataNascimento
  const votosFinal = dataVotosBruta === undefined ? atual.data_votos ?? atual.desde ?? "" : dataVotosBruta
  if (nascimentoFinal && votosFinal && votosFinal < nascimentoFinal) {
    return NextResponse.json({ ok: false, erro: "A data de votos não pode ser anterior à data de nascimento." }, { status: 400 })
  }

  const atualizado = atualizarPerfil(sessao.sub, {
    nome,
    data_nascimento: dataNascimento,
    data_votos: dataVotosBruta === undefined ? undefined : dataVotosBruta || null,
    foto,
  })

  if (!atualizado) {
    return NextResponse.json({ ok: false, erro: "Usuário não encontrado." }, { status: 404 })
  }

  if (bio !== undefined) salvarBioPublica(sessao.sub, bio)

  return NextResponse.json({ ok: true })
}
