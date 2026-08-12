import { NextResponse } from "next/server"
import { ciclosLiturgicos, dataIsoParaDate } from "@/lib/ciclo-liturgico"
import { dataCuiabaIso, obterLiturgiaLocal } from "@/lib/liturgia-local"
import { liturgiaDoArquivoLecionario } from "@/lib/iliturgia-lecionario-offline"

export const dynamic = "force-dynamic"

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
  const ciclos = ciclosLiturgicos(dataIsoParaDate(dataIso))
  const localOriginal = obterLiturgiaLocal(dataIso)

  if (!localOriginal) {
    return NextResponse.json({
      erro: "A Liturgia de hoje ainda não está disponível na base offline.",
      offline: true,
      dataIso,
      quizDisponivel: false,
    }, { status: 404, headers: { "Cache-Control": "no-store" } })
  }

  let local = localOriginal
  const arquivoOrigem = localOriginal.fonte?.arquivoOrigem?.replace(/^assets\/Resources\//, "")
  if (arquivoOrigem?.toLowerCase().startsWith("lecionario/")) {
    try {
      const extraida = await liturgiaDoArquivoLecionario(arquivoOrigem, {
        ...localOriginal,
        leituras: undefined as never,
      })
      if (extraida && (extraida.leituras.primeiraLeitura?.length || extraida.leituras.evangelho?.length)) local = extraida
    } catch (error) {
      console.error("[Liturgia offline] Falha ao estruturar o Lecionário incorporado:", error)
    }
  }

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
    santoDoDia: local.santoDoDia ? { ...local.santoDoDia, fonte: "Base offline" } : null,
  }, { headers: { "Cache-Control": "public, max-age=3600, immutable" } })
}
