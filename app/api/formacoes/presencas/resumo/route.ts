import { NextResponse } from "next/server"
import { lerSessao } from "@/lib/auth"
import {
  listarEquipeAprovada,
  listarFormacoes,
  listarTodasPresencasFormacao,
} from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET() {
  const sessao = await lerSessao()
  if (!sessao || sessao.tipo !== "moderador") {
    return NextResponse.json({ erro: "Acesso exclusivo do moderador." }, { status: 403 })
  }

  const equipe = listarEquipeAprovada()
  const formacoes = listarFormacoes()
  const usuariosPorId = new Map(equipe.map((usuario) => [usuario.id, usuario]))
  const formacoesPorId = new Map(formacoes.map((formacao) => [formacao.id, formacao]))
  const registros = listarTodasPresencasFormacao()
    .filter((registro) => usuariosPorId.has(registro.usuario_id) && formacoesPorId.has(registro.formacao_id))

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
      ...contar(itens),
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

  const recentes = registros.slice(0, 100).map((registro) => {
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
      status: registro.status,
      justificativa: registro.justificativa,
      atualizadoEm: registro.atualizado_em,
    }
  })

  return NextResponse.json(
    {
      resumo: {
        ...contar(registros),
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
