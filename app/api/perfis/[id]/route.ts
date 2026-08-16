import { NextResponse } from "next/server"
import { lerSessao } from "@/lib/auth"
import { buscarUsuario } from "@/lib/db"
import { calcularRanking } from "@/lib/ranking"
import { obterBioPublica } from "@/lib/perfis-publicos"

function anoCuiaba() {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Cuiaba", year: "numeric" }).format(new Date()))
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await lerSessao()
  if (!sessao) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { id } = await params
  const usuario = buscarUsuario(id)
  if (!usuario || usuario.status !== "aprovado" || (usuario.funcao !== "Acólito" && usuario.funcao !== "Coroinha")) {
    return NextResponse.json({ erro: "Perfil não encontrado." }, { status: 404 })
  }

  const linha = calcularRanking(anoCuiaba()).ranking.find((item) => item.usuarioId === id)
  return NextResponse.json({
    perfil: {
      id: usuario.id,
      nome: usuario.nome,
      funcao: usuario.funcao,
      desde: usuario.desde,
      foto: usuario.foto || null,
      bio: obterBioPublica(usuario.id),
      ranking: linha ? {
        posicao: linha.posicao,
        pontos: linha.pontos,
        quizzesRespondidos: linha.quizzesRespondidos,
        acertos: linha.acertos,
        aproveitamento: linha.aproveitamento,
      } : null,
    },
  }, { headers: { "Cache-Control": "private, max-age=30" } })
}
