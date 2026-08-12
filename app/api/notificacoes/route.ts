import { NextResponse } from "next/server"
import { lerSessao } from "@/lib/auth"
import { buscarUsuario, listarEscalas, listarQuizzes, obterRankingConfig } from "@/lib/db"

export async function GET() {
  const sessao = await lerSessao()
  if (!sessao) return NextResponse.json({ autenticado: false })
  const usuario = buscarUsuario(sessao.sub)
  if (!usuario) return NextResponse.json({ autenticado: false })

  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Cuiaba" }).format(new Date())
  const ano = Number(hoje.slice(0,4))
  const escalas = usuario.tipo === "membro" ? listarEscalas().filter((e) => e.data >= hoje && e.pessoas.some((p) => p.id === usuario.id || p.nome === usuario.nome)).slice(0, 20) : []
  const quizzesPendentes = usuario.tipo === "membro" ? listarQuizzes(false).length : 0

  return NextResponse.json({
    autenticado: true,
    usuario: { id: usuario.id, nome: usuario.nome, tipo: usuario.tipo },
    minutosAntecedencia: obterRankingConfig(ano).minutos_antecedencia,
    escalas,
    quizzesPendentes,
  })
}
