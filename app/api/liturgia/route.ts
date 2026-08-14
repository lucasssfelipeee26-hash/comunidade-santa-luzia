import { NextResponse } from "next/server"
import { ciclosLiturgicos, dataIsoParaDate } from "@/lib/ciclo-liturgico"
import { dataCuiabaIso, obterLiturgiaLocal } from "@/lib/liturgia-local"
import { obterLiturgiaCompletaOffline } from "@/lib/liturgia-completa-offline"

export const dynamic = "force-dynamic"

export type Leitura = { referencia?: string; titulo?: string; texto?: string; refrao?: string }
export type SantoDoDia = { nome: string; resumo?: string; fonte?: string }
export type Liturgia = {
  data: string
  dataIso?: string
  liturgia: string
  liturgiaOriginal?: string
  cor: string
  tempoLiturgicoAtual: string
  tempoCategoria: string
  origem?: "offline"
  offline?: boolean
  quizDisponivel?: boolean
  cicloDominical?: "A" | "B" | "C"
  cicloFerial?: "I" | "II"
  anoLiturgico?: number
  santoDoDia?: SantoDoDia | null
  fonte: { nome: string; licenca?: string; arquivoOrigem?: string }
  oracoes: { coleta?: string; oferendas?: string; comunhao?: string }
  leituras: { primeiraLeitura?: Leitura[]; salmo?: Leitura[]; segundaLeitura?: Leitura[]; evangelho?: Leitura[]; extras?: Leitura[] }
}

function dataPorExtenso(dataIso: string) {
  const [ano, mes, dia] = dataIso.split("-").map(Number)
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Cuiaba",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(ano, mes - 1, dia, 12, 0, 0)))
}

export async function GET() {
  const dataIso = dataCuiabaIso()
  const local = obterLiturgiaLocal(dataIso) || obterLiturgiaCompletaOffline(dataIso)
  if (!local) {
    return NextResponse.json({
      erro: "Liturgia offline indisponível para esta data.",
      offline: true,
      dataIso,
      quizDisponivel: false,
    }, { status: 404, headers: { "Cache-Control": "no-store" } })
  }

  const ciclos = ciclosLiturgicos(dataIsoParaDate(dataIso))
  return NextResponse.json({
    ...local,
    dataIso,
    data: local.data || dataPorExtenso(dataIso),
    cicloDominical: ciclos.cicloDominical,
    cicloFerial: ciclos.cicloFerial,
    anoLiturgico: ciclos.anoLiturgico,
    origem: "offline",
    offline: true,
    quizDisponivel: true,
    fonte: {
      nome: local.fonte?.nome || "Base offline Santa Luzia",
      ...(local.fonte?.licenca ? { licenca: local.fonte.licenca } : {}),
      ...(local.fonte?.arquivoOrigem ? { arquivoOrigem: local.fonte.arquivoOrigem } : {}),
    },
  }, { headers: { "Cache-Control": "public, max-age=3600, immutable" } })
}
