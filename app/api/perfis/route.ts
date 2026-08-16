import { NextResponse } from "next/server"
import { lerSessao } from "@/lib/auth"
import { listarEquipeAprovada } from "@/lib/db"
import { calcularRanking } from "@/lib/ranking"
import { obterBioPublica } from "@/lib/perfis-publicos"

function anoCuiaba() {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Cuiaba", year: "numeric" }).format(new Date()))
}

export async function GET() {
  const sessao = await lerSessao()
  if (!sessao) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const { ranking } = calcularRanking(anoCuiaba())
  const porId = new Map(ranking.map((linha) => [linha.usuarioId, linha]))
  const perfis = listarEquipeAprovada().map((usuario) => {
    const linha = porId.get(usuario.id)
    return {
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
    }
  })

  return NextResponse.json({ perfis }, { headers: { "Cache-Control": "private, max-age=30" } })
}
