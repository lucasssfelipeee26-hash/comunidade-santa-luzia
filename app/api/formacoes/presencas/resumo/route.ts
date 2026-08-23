import { NextRequest, NextResponse } from "next/server"
import { lerSessao } from "@/lib/auth"
import {
  listarEquipeAprovada,
  listarEscalas,
  listarFormacoes,
  listarJustificativasEscala,
  listarTodasPresencasFormacao,
  listarPontualidadeOcorrencias,
  db,
  type RegistroRow,
} from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const sessao = await lerSessao()
  const windowsBeta = request.headers.get("user-agent")?.includes("SantaLuziaWindowsBeta/") || request.headers.get("x-santa-luzia-windows-beta") === "1"
  if (!sessao || (sessao.tipo !== "moderador" && !windowsBeta)) {
    return NextResponse.json({ erro: "Acesso exclusivo do moderador." }, { status: 403 })
  }

  const equipeCompleta = listarEquipeAprovada()
  const equipe = sessao.tipo === "moderador" ? equipeCompleta : equipeCompleta.filter((usuario) => usuario.id === sessao.sub)
  const formacoes = listarFormacoes()
  const escalas = listarEscalas()
  const usuariosPorId = new Map(equipe.map((usuario) => [usuario.id, usuario]))
  const formacoesPorId = new Map(formacoes.map((formacao) => [formacao.id, formacao]))
  const registros = listarTodasPresencasFormacao()
    .filter((registro) => usuariosPorId.has(registro.usuario_id) && formacoesPorId.has(registro.formacao_id))
  const registrosAdministrativos = windowsBeta ? db.prepare("SELECT * FROM registros").all() as RegistroRow[] : []
  const atrasos = windowsBeta ? listarPontualidadeOcorrencias(false) : []
  const justificativasEscala = windowsBeta ? listarJustificativasEscala().filter((item) => usuariosPorId.has(item.usuario_id)) : []

  const contar = (itens: typeof registros) => ({
    presencas: itens.filter((item) => item.status === "presente").length,
    faltas: itens.filter((item) => item.status === "falta").length,
    justificadas: itens.filter((item) => item.status === "justificada").length,
    total: itens.length,
  })

  const pessoas = equipe.map((usuario) => {
    const itens = registros.filter((registro) => registro.usuario_id === usuario.id)
    return {
      id: usuario.id,
      nome: usuario.nome,
      funcao: usuario.funcao,
      tipo: usuario.tipo,
      advertencias: registrosAdministrativos.filter((registro) => registro.usuario_id === usuario.id && registro.tipo === "advertencias").length,
      atrasos: atrasos.filter((atraso) => atraso.usuario_id === usuario.id).length,
      ...contar(itens),
      justificadas: contar(itens).justificadas + justificativasEscala.filter((item) => item.usuario_id === usuario.id).length,
    }
  }).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))

  const porFormacao = formacoes.map((formacao) => {
    const itens = registros.filter((registro) => registro.formacao_id === formacao.id)
    return {
      id: formacao.id,
      titulo: formacao.titulo,
      tema: formacao.tema,
      data: formacao.data,
      horario: formacao.horario,
      status: formacao.status,
      naoRegistrados: Math.max(0, equipe.length - itens.length),
      ...contar(itens),
    }
  })

  const recentesPresenca = registros.map((registro) => {
    const usuario = usuariosPorId.get(registro.usuario_id)!
    const formacao = formacoesPorId.get(registro.formacao_id)!
    return {
      id: registro.id,
      usuarioId: usuario.id,
      usuarioNome: usuario.nome,
      usuarioFuncao: usuario.funcao,
      usuarioTipo: usuario.tipo,
      formacaoId: formacao.id,
      formacaoTitulo: formacao.titulo,
      formacaoData: formacao.data,
      formacaoHorario: formacao.horario,
      status: registro.status,
      justificativa: registro.justificativa,
      atualizadoEm: registro.atualizado_em,
    }
  })
  const recentesAdministrativos = windowsBeta
    ? registrosAdministrativos
      .filter((registro) => usuariosPorId.has(registro.usuario_id))
      .map((registro) => {
        const usuario = usuariosPorId.get(registro.usuario_id)!
        return {
          id: `administrativo-${registro.id}`,
          usuarioId: usuario.id,
          usuarioNome: usuario.nome,
          usuarioFuncao: usuario.funcao,
          usuarioTipo: usuario.tipo,
          formacaoId: null,
          formacaoTitulo: registro.tipo === "advertencias" ? "Advertência" : registro.tipo === "faltas" ? "Falta administrativa" : registro.tipo === "justificativas" ? "Justificativa" : "Observação",
          formacaoData: registro.data,
          formacaoHorario: null,
          status: registro.tipo === "advertencias" ? "advertencia" : registro.tipo === "faltas" ? "falta" : registro.tipo === "justificativas" ? "justificada" : "observacao",
          justificativa: registro.descricao,
          atualizadoEm: registro.criado_em,
        }
      })
    : []
  const recentesAtrasos = windowsBeta ? atrasos.map((atraso) => {
    const usuario = usuariosPorId.get(atraso.usuario_id)
    return usuario ? {
      id: `atraso-${atraso.id}`,
      usuarioId: usuario.id,
      usuarioNome: usuario.nome,
      usuarioFuncao: usuario.funcao,
      usuarioTipo: usuario.tipo,
      formacaoId: null,
      formacaoTitulo: `Atraso · Missa às ${atraso.horario_missa}`,
      formacaoData: atraso.data_missa,
      formacaoHorario: atraso.horario_missa,
      status: "atraso",
      justificativa: atraso.observacao || `Limite de chegada: ${atraso.limite_chegada}`,
      atualizadoEm: atraso.moderado_em || atraso.criado_em,
    } : null
  }).filter((item): item is NonNullable<typeof item> => Boolean(item)) : []
  const recentesEscala = windowsBeta ? justificativasEscala.map((registro) => {
    const usuario = usuariosPorId.get(registro.usuario_id)
    const escala = escalas.find((item) => item.id === registro.escala_id)
    return usuario && escala ? {
      id: `escala-justificada-${registro.id}`,
      usuarioId: usuario.id,
      usuarioNome: usuario.nome,
      usuarioFuncao: usuario.funcao,
      usuarioTipo: usuario.tipo,
      formacaoId: escala.id,
      formacaoTitulo: `Falta justificada na missa · ${escala.celebracao_liturgica || "Celebração litúrgica"}`,
      formacaoData: escala.data,
      formacaoHorario: escala.horario,
      status: "justificada",
      justificativa: registro.justificativa,
      atualizadoEm: registro.criado_em,
    } : null
  }).filter((item): item is NonNullable<typeof item> => Boolean(item)) : []
  const recentes = [...recentesPresenca, ...recentesAdministrativos, ...recentesAtrasos, ...recentesEscala]
    .sort((a, b) => b.atualizadoEm - a.atualizadoEm)
    .slice(0, 500)

  return NextResponse.json(
    {
      resumo: {
        ...contar(registros),
        justificadas: contar(registros).justificadas + justificativasEscala.length,
        naoRegistrados: Math.max(0, (equipe.length * formacoes.filter((item) => item.status !== "cancelada").length) - registros.length),
        participantes: equipe.length,
        formacoes: formacoes.length,
      },
      pessoas,
      formacoes: porFormacao,
      recentes,
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  )
}
