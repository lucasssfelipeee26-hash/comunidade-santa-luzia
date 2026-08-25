import { NextResponse } from "next/server"
import { lerSessao } from "@/lib/auth"
import { buscarUsuario, listarRankingAjustes, salvarRankingAjuste } from "@/lib/db"
import { notificarMudancasRanking, snapshotRanking } from "@/lib/notificacoes-ranking"

const PONTOS_POR_DIA = 2
const DIAS_DA_SEMANA = 7
const PREFIXO = "Constância de Luz"

function dataCuiaba() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Cuiaba",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

function deslocarData(iso: string, dias: number) {
  const data = new Date(`${iso}T12:00:00Z`)
  data.setUTCDate(data.getUTCDate() + dias)
  return data.toISOString().slice(0, 10)
}

function semanaDaData(hoje: string) {
  const data = new Date(`${hoje}T12:00:00Z`)
  const dia = data.getUTCDay()
  const distanciaSegunda = (dia + 6) % 7
  const segunda = deslocarData(hoje, -distanciaSegunda)
  const datas = Array.from({ length: DIAS_DA_SEMANA }, (_, i) => deslocarData(segunda, i))
  return { segunda, domingo: datas[6], datas, indiceHoje: distanciaSegunda }
}

async function usuarioAtual() {
  const sessao = await lerSessao()
  if (!sessao) return null
  const usuario = buscarUsuario(sessao.sub)
  if (!usuario || (usuario.tipo === "membro" && usuario.status !== "aprovado")) return null
  return usuario
}

function motivoDaData(data: string) {
  return `${PREFIXO} ${data}`
}

function statusDaSemana(usuarioId: string, hoje = dataCuiaba()) {
  const semana = semanaDaData(hoje)
  const anos = [...new Set(semana.datas.map((data) => Number(data.slice(0, 4))))]
  const ajustes = anos.flatMap((ano) => listarRankingAjustes(ano)).filter((ajuste) =>
    ajuste.usuario_id === usuarioId && ajuste.pontos === PONTOS_POR_DIA && ajuste.motivo.startsWith(`${PREFIXO} `)
  )
  const recebidos = new Set(ajustes.map((ajuste) => ajuste.motivo.slice(`${PREFIXO} `.length, `${PREFIXO} `.length + 10)))
  const dias = semana.datas.map((data, indice) => ({
    numero: indice + 1,
    data,
    recebido: recebidos.has(data),
    hoje: data === hoje,
  }))
  const diasConcluidos = dias.filter((dia) => dia.recebido).length
  return {
    titulo: PREFIXO,
    pontosPorDia: PONTOS_POR_DIA,
    maximoSemanal: PONTOS_POR_DIA * DIAS_DA_SEMANA,
    semanaInicio: semana.segunda,
    semanaFim: semana.domingo,
    diaAtual: semana.indiceHoje + 1,
    dias,
    diasConcluidos,
    pontosSemana: diasConcluidos * PONTOS_POR_DIA,
    recebidoHoje: recebidos.has(hoje),
    concluida: diasConcluidos === DIAS_DA_SEMANA,
  }
}

export async function GET() {
  const usuario = await usuarioAtual()
  if (!usuario) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })
  return NextResponse.json({ ok: true, constancia: statusDaSemana(usuario.id) })
}

export async function POST() {
  const usuario = await usuarioAtual()
  if (!usuario) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 })

  const hoje = dataCuiaba()
  const ano = Number(hoje.slice(0, 4))
  const motivo = motivoDaData(hoje)
  const existente = listarRankingAjustes(ano).find((ajuste) =>
    ajuste.usuario_id === usuario.id && ajuste.pontos === PONTOS_POR_DIA && ajuste.motivo === motivo
  )

  if (existente) {
    return NextResponse.json({
      ok: true,
      jaContabilizado: true,
      pontosAdicionados: 0,
      constancia: statusDaSemana(usuario.id, hoje),
    })
  }

  const antes = snapshotRanking(ano)
  const ajuste = salvarRankingAjuste({
    usuario_id: usuario.id,
    pontos: PONTOS_POR_DIA,
    motivo,
    ano,
    criado_por: usuario.id,
  })
  notificarMudancasRanking(ano, antes, usuario.id, `constancia-luz:${hoje}`)

  return NextResponse.json({
    ok: true,
    jaContabilizado: false,
    pontosAdicionados: PONTOS_POR_DIA,
    ajusteId: ajuste.id,
    constancia: statusDaSemana(usuario.id, hoje),
  })
}
