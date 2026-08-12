import { randomUUID } from "node:crypto"
import { SignJWT } from "jose"
import { NextRequest, NextResponse } from "next/server"
import { lerSessao } from "@/lib/auth"
import { buscarUsuario, listarRespostasQuiz } from "@/lib/db"
import { gerarQuizLiturgia, type LiturgiaQuizFonte } from "@/lib/liturgy-quiz"

export const dynamic = "force-dynamic"
const DURACAO_SEGUNDOS = 90

function dataCuiabaIso() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Cuiaba", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date())
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]))
  return `${map.year}-${map.month}-${map.day}`
}

function secret() {
  const valor = process.env.AUTH_SECRET?.trim()
  if (!valor) throw new Error("AUTH_SECRET não configurado.")
  return new TextEncoder().encode(valor)
}

export async function GET(req: NextRequest) {
  const sessao = await lerSessao()
  if (!sessao) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })
  const usuario = buscarUsuario(sessao.sub)
  if (!usuario || (usuario.tipo === "membro" && usuario.status !== "aprovado")) return NextResponse.json({ erro: "Perfil sem acesso ao quiz." }, { status: 403 })

  const dataIso = dataCuiabaIso()
  const prefixo = `liturgia-auto:${dataIso}:`
  const concluida = listarRespostasQuiz().find((r) => r.usuario_id === usuario.id && r.quiz_id.startsWith(prefixo))
  if (concluida) return NextResponse.json({ respondido: true, resultado: concluida }, { headers: { "Cache-Control": "no-store" } })

  const resposta = await fetch(new URL("/api/liturgia", req.url), { cache: "no-store" })
  if (!resposta.ok) return NextResponse.json({ erro: "A Liturgia de hoje ainda não está disponível para o quiz." }, { status: 503 })
  const fonte = await resposta.json() as LiturgiaQuizFonte

  const seed = randomUUID()
  const perguntas = gerarQuizLiturgia(fonte, seed)
  if (perguntas.length < 3) return NextResponse.json({ erro: "Ainda não há informações suficientes para gerar o quiz de hoje." }, { status: 503 })

  const token = await new SignJWT({ kind: "liturgy-quiz", seed, dataIso })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(usuario.id)
    .setIssuedAt()
    .setExpirationTime(`${DURACAO_SEGUNDOS}s`)
    .sign(secret())

  return NextResponse.json({
    respondido: false,
    quiz: {
      token,
      titulo: "Quiz da Liturgia de Hoje",
      descricao: "Perguntas geradas automaticamente a partir da Liturgia Diária.",
      duracaoSegundos: DURACAO_SEGUNDOS,
      expiraEm: Date.now() + DURACAO_SEGUNDOS * 1000,
      perguntas: perguntas.map((p) => ({ id: p.id, enunciado: p.enunciado, opcoes: p.opcoes, pontos: p.pontos })),
    },
  }, { headers: { "Cache-Control": "no-store" } })
}
