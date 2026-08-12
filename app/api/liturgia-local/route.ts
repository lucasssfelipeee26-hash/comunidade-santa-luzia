import { NextResponse } from "next/server"
import { GET as obterLiturgiaOnline } from "@/app/api/liturgia/route"
import { ciclosLiturgicos, dataIsoParaDate } from "@/lib/ciclo-liturgico"
import { obterLiturgiaLocal } from "@/lib/liturgia-local"

export const dynamic = "force-dynamic"

function dataCuiabaIso() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Cuiaba",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]))
  return `${map.year}-${map.month}-${map.day}`
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
  const ciclos = ciclosLiturgicos(dataIsoParaDate(dataIso))
  const local = obterLiturgiaLocal(dataIso)

  if (local) {
    return NextResponse.json({
      ...local,
      dataIso,
      data: local.data || dataPorExtenso(dataIso),
      cicloDominical: ciclos.cicloDominical,
      cicloFerial: ciclos.cicloFerial,
      anoLiturgico: ciclos.anoLiturgico,
      origem: "local",
      fonte: {
        nome: local.fonte?.nome || "Base litúrgica local Santa Luzia",
        ...(local.fonte?.url ? { url: local.fonte.url } : {}),
        ...(local.fonte?.licenca ? { licenca: local.fonte.licenca } : {}),
      },
      santoDoDia: local.santoDoDia
        ? {
            ...local.santoDoDia,
            fonte: local.fonte?.url || "",
          }
        : null,
    }, { headers: { "Cache-Control": "public, max-age=3600" } })
  }

  // Transição segura: enquanto a base local autorizada ainda não contém este dia,
  // mantém a fonte atual para não deixar Liturgia e Quiz fora do ar.
  const resposta = await obterLiturgiaOnline()
  const payload = await resposta.json().catch(() => null)
  if (!resposta.ok || !payload) return resposta

  return NextResponse.json({
    ...payload,
    dataIso,
    cicloDominical: ciclos.cicloDominical,
    cicloFerial: ciclos.cicloFerial,
    anoLiturgico: ciclos.anoLiturgico,
    origem: "online",
  }, {
    status: resposta.status,
    headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=1500" },
  })
}
