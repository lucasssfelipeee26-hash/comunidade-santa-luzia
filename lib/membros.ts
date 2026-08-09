export type UsuarioRow = {
  id: string
  nome: string
  usuario: string
  email: string
  senha_hash: string
  tipo: "moderador" | "membro"
  funcao: string | null
  desde: string | null
  data_nascimento?: string | null
  data_votos?: string | null
  foto?: string | null
  status: "pendente" | "aprovado" | "recusado"
  criado_em: number
}

export type RegistroRow = {
  id: string
  usuario_id: string
  tipo: "advertencias" | "justificativas" | "faltas" | "observacoes"
  data: string
  descricao: string
  criado_em: number
}

export type RegistroDTO = {
  id: string
  data: string
  descricao: string
  criadoEm: number
}

export type MembroDTO = {
  id: string
  nome: string
  usuario: string
  funcao: string | null
  email: string
  desde: string | null
  data_nascimento?: string | null
  data_votos?: string | null
  foto?: string | null
  status: "pendente" | "aprovado" | "recusado"
  advertencias: RegistroDTO[]
  justificativas: RegistroDTO[]
  faltas: RegistroDTO[]
  observacoes: RegistroDTO[]
}

function porTipo(registros: RegistroRow[], usuarioId: string, tipo: RegistroRow["tipo"]): RegistroDTO[] {
  return registros
    .filter((r) => r.usuario_id === usuarioId && r.tipo === tipo)
    .map((r) => ({ id: r.id, data: r.data, descricao: r.descricao, criadoEm: r.criado_em }))
    .sort((a, b) => b.criadoEm - a.criadoEm)
}

export function montarMembro(usuario: UsuarioRow, registros: RegistroRow[]): MembroDTO {
  return {
    id: usuario.id,
    nome: usuario.nome,
    usuario: usuario.usuario,
    funcao: usuario.funcao,
    email: usuario.email,
    desde: usuario.desde,
    data_nascimento: usuario.data_nascimento ?? null,
    data_votos: usuario.data_votos ?? null,
    foto: usuario.foto ?? null,
    status: usuario.status,
    advertencias: porTipo(registros, usuario.id, "advertencias"),
    justificativas: porTipo(registros, usuario.id, "justificativas"),
    faltas: porTipo(registros, usuario.id, "faltas"),
    observacoes: porTipo(registros, usuario.id, "observacoes"),
  }
}
