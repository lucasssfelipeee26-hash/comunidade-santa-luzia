import bcrypt from "bcryptjs"
import fs from "node:fs"
import path from "node:path"

export const DATA_DIR = process.env.DATA_DIR?.trim() || path.join(process.cwd(), "data")
export const DB_PATH = path.join(DATA_DIR, "santa-luzia.json")

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
  promovido_por?: string | null
  promovido_em?: number | null
}

export type RegistroRow = {
  id: string
  usuario_id: string
  tipo: "advertencias" | "justificativas" | "faltas" | "observacoes"
  data: string
  descricao: string
  criado_em: number
}

type CodigoRow = {
  id: string
  usuario_id: string
  codigo_hash: string
  expira_em: number
  usado: number
  criado_em: number
}

export type EscalaPessoa = { id?: string; nome: string; funcao: string; categoria: "sacerdote" | "acolito" | "coroinha" }
export type EscalaRow = { id: string; data: string; horario: string; celebrante: string; pessoas: EscalaPessoa[]; observacoes: string; criado_em: number }

export type FormacaoArquivo = {
  nome_original: string
  nome_armazenado: string
  mime: string
  tamanho: number
}

export type FormacaoRow = {
  id: string
  titulo: string
  tema: string
  data: string
  horario: string | null
  descricao: string
  status: "agendada" | "cancelada"
  motivo_cancelamento: string | null
  arquivo: FormacaoArquivo | null
  criado_em: number
  atualizado_em: number
}


export type ReconhecimentoCategoria = "companheirismo" | "acolhimento" | "espirito_servico" | "disponibilidade"

export type ReconhecimentoRow = {
  id: string
  de_usuario_id: string
  para_usuario_id: string
  categoria: ReconhecimentoCategoria
  ano: number
  mes: number
  criado_em: number
}

export type QuizOrigem = "formacao" | "liturgia" | "manual"
export type QuizPergunta = { id: string; enunciado: string; opcoes: string[]; correta: number; pontos: number; explicacao?: string }
export type QuizRow = {
  id: string
  titulo: string
  descricao: string
  origem: QuizOrigem
  referencia_id: string | null
  data_referencia: string | null
  ativo: boolean
  perguntas: QuizPergunta[]
  criado_por: string
  criado_em: number
  atualizado_em: number
}

export type QuizRespostaRow = {
  id: string
  quiz_id: string
  usuario_id: string
  respostas: number[]
  acertos: number
  pontos: number
  total_pontos: number
  respondido_em: number
}

export type PontualidadeStatus = "pendente" | "confirmado" | "rejeitado"
export type PontualidadeOcorrenciaRow = {
  id: string
  client_request_id?: string | null
  usuario_id: string
  escala_id: string | null
  data_missa: string
  horario_missa: string
  limite_chegada: string
  observacao: string
  reportado_por: string
  status: PontualidadeStatus
  criado_em: number
  moderado_por: string | null
  moderado_em: number | null
}

export type PontualidadeReacaoRow = {
  id: string
  ocorrencia_id: string
  usuario_id: string
  emoji: string
  criado_em: number
}

export type RankingAjusteRow = { id: string; usuario_id: string; pontos: number; motivo: string; ano: number; criado_por: string; criado_em: number }
export type RankingConfigRow = {
  ano: number
  peso_formacao: number
  peso_liturgia: number
  peso_pontualidade: number
  peso_reconhecimento: number
  minutos_antecedencia: number
  atualizado_em: number
}

type Store = {
  usuarios: UsuarioRow[]
  registros: RegistroRow[]
  codigos_recuperacao: CodigoRow[]
  escalas: EscalaRow[]
  formacoes: FormacaoRow[]
  reconhecimentos: ReconhecimentoRow[]
  quizzes: QuizRow[]
  quiz_respostas: QuizRespostaRow[]
  pontualidade_ocorrencias: PontualidadeOcorrenciaRow[]
  pontualidade_reacoes: PontualidadeReacaoRow[]
  ranking_ajustes: RankingAjusteRow[]
  ranking_configs: RankingConfigRow[]
}

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

let storeDisponivel = true

function readStore(): Store {
  if (!fs.existsSync(DB_PATH)) return { usuarios: [], registros: [], codigos_recuperacao: [], escalas: [], formacoes: [], reconhecimentos: [], quizzes: [], quiz_respostas: [], pontualidade_ocorrencias: [], pontualidade_reacoes: [], ranking_ajustes: [], ranking_configs: [] }
  try {
    const raw = fs.readFileSync(DB_PATH, "utf8")
    const parsed = JSON.parse(raw) as Partial<Store>
    return {
      usuarios: Array.isArray(parsed.usuarios) ? parsed.usuarios : [],
      registros: Array.isArray(parsed.registros) ? parsed.registros : [],
      codigos_recuperacao: Array.isArray(parsed.codigos_recuperacao) ? parsed.codigos_recuperacao : [],
      escalas: Array.isArray(parsed.escalas) ? parsed.escalas : [],
      formacoes: Array.isArray(parsed.formacoes) ? parsed.formacoes : [],
      reconhecimentos: Array.isArray(parsed.reconhecimentos) ? parsed.reconhecimentos : [],
      quizzes: Array.isArray(parsed.quizzes) ? parsed.quizzes : [],
      quiz_respostas: Array.isArray(parsed.quiz_respostas) ? parsed.quiz_respostas : [],
      pontualidade_ocorrencias: Array.isArray(parsed.pontualidade_ocorrencias) ? parsed.pontualidade_ocorrencias : [],
      pontualidade_reacoes: Array.isArray(parsed.pontualidade_reacoes) ? parsed.pontualidade_reacoes : [],
      ranking_ajustes: Array.isArray(parsed.ranking_ajustes) ? parsed.ranking_ajustes : [],
      ranking_configs: Array.isArray(parsed.ranking_configs) ? parsed.ranking_configs : [],
    }
  } catch (error) {
    // Preserva uma cópia do arquivo problemático antes de recriar a base.
    try {
      const backup = `${DB_PATH}.corrompido-${Date.now()}.bak`
      fs.copyFileSync(DB_PATH, backup)
    } catch {}
    storeDisponivel = false
    console.error("[Banco local] Não foi possível ler data/santa-luzia.json. As gravações foram bloqueadas para proteger os dados.", error)
    return { usuarios: [], registros: [], codigos_recuperacao: [], escalas: [], formacoes: [], reconhecimentos: [], quizzes: [], quiz_respostas: [], pontualidade_ocorrencias: [], pontualidade_reacoes: [], ranking_ajustes: [], ranking_configs: [] }
  }
}

let store = readStore()

// Migração automática e não destrutiva: bancos antigos não tinham o campo `usuario`.
// Ao iniciar, cada conta antiga recebe um usuário único baseado no e-mail/nome.
{
  const usados = new Set<string>()
  let alterado = false
  for (const conta of store.usuarios) {
    let candidato = normalizarUsuario(conta.usuario)
    if (!candidato || usados.has(candidato)) {
      const base = gerarUsuarioBase(conta.nome, conta.email)
      candidato = base
      let n = 2
      while (usados.has(candidato)) candidato = `${base}${n++}`
      conta.usuario = candidato
      alterado = true
    } else if (conta.usuario !== candidato) {
      conta.usuario = candidato
      alterado = true
    }
    usados.add(candidato)

    // O nível de acesso (moderador) não substitui a função litúrgica.
    // Os moderadores antigos foram cadastrados como acólitos antes desse campo ser preservado.
    if (conta.tipo === "moderador" && conta.funcao !== "Acólito" && conta.funcao !== "Coroinha") {
      conta.funcao = "Acólito"
      conta.status = "aprovado"
      alterado = true
    }
  }
  if (alterado && store.usuarios.length) {
    fs.writeFileSync(DB_PATH, JSON.stringify(store, null, 2), "utf8")
  }
}

function persistNow() {
  if (!storeDisponivel && fs.existsSync(DB_PATH)) {
    throw new Error("O banco local está temporariamente indisponível. Reinicie o servidor antes de tentar gravar novamente.")
  }

  // Grava primeiro em um arquivo temporário e só então substitui o banco.
  // Isso reduz o risco de deixar o JSON pela metade se o processo for interrompido.
  const temporario = `${DB_PATH}.tmp`
  fs.writeFileSync(temporario, JSON.stringify(store, null, 2), "utf8")
  fs.renameSync(temporario, DB_PATH)
  storeDisponivel = true
}

function norm(value: unknown) {
  return String(value ?? "").trim().toLowerCase()
}


export function obterRevisaoDados() {
  try {
    const stat = fs.statSync(DB_PATH)
    return `${Math.trunc(stat.mtimeMs)}-${stat.size}`
  } catch {
    return "sem-dados"
  }
}

export function normalizarUsuario(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/\.{2,}/g, ".")
    .replace(/^[._-]+|[._-]+$/g, "")
}

function gerarUsuarioBase(nome: string, email?: string) {
  const peloEmail = normalizarUsuario(String(email ?? "").split("@")[0])
  const peloNome = normalizarUsuario(nome)
  return peloEmail || peloNome || "usuario"
}

export function gerarUsuarioUnico(base: string, ignorarId?: string) {
  const raiz = normalizarUsuario(base) || "usuario"
  let candidato = raiz
  let n = 2
  while (store.usuarios.some((u) => u.id !== ignorarId && normalizarUsuario(u.usuario) === candidato)) {
    candidato = `${raiz}${n++}`
  }
  return candidato
}

export function buscarUsuarioPorLogin(login: string) {
  const chave = norm(login)
  const usuario = normalizarUsuario(login)
  return store.usuarios.find((u) => normalizarUsuario(u.usuario) === usuario || norm(u.email) === chave)
}

export function usuarioJaExiste(usuario: string) {
  const chave = normalizarUsuario(usuario)
  return store.usuarios.some((u) => normalizarUsuario(u.usuario) === chave)
}

export function emailJaExiste(email: string) {
  const chave = norm(email)
  return store.usuarios.some((u) => norm(u.email) === chave)
}

function result<T>(value: T) {
  return value
}

class Statement {
  constructor(private readonly sql: string) {}

  get(...args: unknown[]): unknown {
    const s = this.sql.replace(/\s+/g, " ").trim().toLowerCase()
    if (s.includes("select 1 from usuarios where lower(usuario) =")) {
      const usuario = normalizarUsuario(args[0])
      return store.usuarios.find((u) => normalizarUsuario(u.usuario) === usuario) ? result({ 1: 1 }) : undefined
    }
    if (s.includes("select * from usuarios where lower(usuario) =")) {
      const usuario = normalizarUsuario(args[0])
      return store.usuarios.find((u) => normalizarUsuario(u.usuario) === usuario)
    }
    if (s.includes("select 1 from usuarios where lower(email) =")) {
      const email = norm(args[0])
      return store.usuarios.find((u) => norm(u.email) === email) ? result({ 1: 1 }) : undefined
    }
    if (s.includes("select * from usuarios where lower(email) =")) {
      const email = norm(args[0])
      return store.usuarios.find((u) => norm(u.email) === email)
    }
    if (s.includes("select id, nome, usuario, email, tipo, funcao, desde, status from usuarios where id =")) {
      const u = store.usuarios.find((x) => x.id === String(args[0]))
      if (!u) return undefined
      const { senha_hash: _senha, criado_em: _criado, ...safe } = u
      return safe
    }
    if (s.includes("select * from usuarios where id = ? and tipo = 'membro'")) {
      return store.usuarios.find((u) => u.id === String(args[0]) && u.tipo === "membro")
    }
    if (s.includes("select 1 from usuarios where id = ? and tipo = 'membro'")) {
      return store.usuarios.find((u) => u.id === String(args[0]) && u.tipo === "membro") ? { 1: 1 } : undefined
    }
    if (s.includes("select 1 from usuarios where id = ?")) {
      return store.usuarios.find((u) => u.id === String(args[0])) ? { 1: 1 } : undefined
    }
    if (s.includes("select * from usuarios where id =")) {
      return store.usuarios.find((u) => u.id === String(args[0]))
    }
    if (s.includes("select * from codigos_recuperacao where usuario_id = ? and usado = 0")) {
      return store.codigos_recuperacao
        .filter((c) => c.usuario_id === String(args[0]) && c.usado === 0)
        .sort((a, b) => b.criado_em - a.criado_em)[0]
    }
    if (s.includes("select * from registros where usuario_id =")) {
      return store.registros.filter((r) => r.usuario_id === String(args[0]))
    }
    if (s.includes("select * from usuarios where tipo = 'membro'")) {
      return store.usuarios.filter((u) => u.tipo === "membro").sort((a, b) => b.criado_em - a.criado_em)
    }
    return undefined
  }

  all(...args: unknown[]): unknown[] {
    const value = this.get(...args)
    if (Array.isArray(value)) return value
    const s = this.sql.replace(/\s+/g, " ").trim().toLowerCase()
    if (s.includes("select * from registros")) return [...store.registros]
    return value == null ? [] : [value]
  }

  run(...args: unknown[]): { changes: number } {
    const s = this.sql.replace(/\s+/g, " ").trim().toLowerCase()
    if (s.startsWith("insert into usuarios")) {
      const [id, nome, email, senha_hash, funcao, desde, criado_em] = args
      const usuario = gerarUsuarioUnico(gerarUsuarioBase(String(nome), String(email)))
      store.usuarios.push({
        id: String(id), nome: String(nome), usuario, email: String(email), senha_hash: String(senha_hash),
        tipo: s.includes("'moderador'") ? "moderador" : "membro",
        funcao: funcao == null ? null : String(funcao), desde: desde == null ? null : String(desde),
        status: s.includes("'pendente'") ? "pendente" : "aprovado", criado_em: Number(criado_em),
      })
      persistNow()
      return { changes: 1 }
    }
    if (s.startsWith("insert into registros")) {
      const [id, usuario_id, tipo, data, descricao, criado_em] = args
      store.registros.push({ id: String(id), usuario_id: String(usuario_id), tipo: String(tipo) as RegistroRow["tipo"], data: String(data), descricao: String(descricao), criado_em: Number(criado_em) })
      persistNow()
      return { changes: 1 }
    }
    if (s.startsWith("insert into codigos_recuperacao")) {
      const [id, usuario_id, codigo_hash, expira_em, criado_em] = args
      store.codigos_recuperacao.push({ id: String(id), usuario_id: String(usuario_id), codigo_hash: String(codigo_hash), expira_em: Number(expira_em), usado: 0, criado_em: Number(criado_em) })
      persistNow()
      return { changes: 1 }
    }
    if (s.startsWith("delete from codigos_recuperacao")) {
      const before = store.codigos_recuperacao.length
      store.codigos_recuperacao = store.codigos_recuperacao.filter((c) => c.usuario_id !== String(args[0]))
      persistNow()
      return { changes: before - store.codigos_recuperacao.length }
    }
    if (s.startsWith("update usuarios set senha_hash")) {
      const u = store.usuarios.find((x) => x.id === String(args[1]))
      if (!u) return { changes: 0 }
      u.senha_hash = String(args[0]); persistNow(); return { changes: 1 }
    }
    if (s.startsWith("update usuarios set status")) {
      const u = store.usuarios.find((x) => x.id === String(args[1]) && x.tipo === "membro")
      if (!u) return { changes: 0 }
      u.status = String(args[0]) as UsuarioRow["status"]; persistNow(); return { changes: 1 }
    }
    if (s.startsWith("update codigos_recuperacao set usado")) {
      const c = store.codigos_recuperacao.find((x) => x.id === String(args[0]))
      if (!c) return { changes: 0 }
      c.usado = 1; persistNow(); return { changes: 1 }
    }
    if (s.startsWith("delete from registros")) {
      const before = store.registros.length
      store.registros = store.registros.filter((r) => !(r.id === String(args[0]) && r.usuario_id === String(args[1])))
      persistNow(); return { changes: before - store.registros.length }
    }
    return { changes: 0 }
  }
}

export const db = {
  prepare(sql: string) { return new Statement(sql) },
}

export function gerarId(nome: string) {
  const base = nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "usuario"
  let id = base, n = 2
  while (store.usuarios.some((u) => u.id === id)) id = `${base}-${n++}`
  return id
}

function seedModeradores() {
  if (!storeDisponivel) return
  if (store.usuarios.some((u) => u.tipo === "moderador")) return

  const nome = process.env.INITIAL_ADMIN_NAME?.trim()
  const usuario = process.env.INITIAL_ADMIN_USERNAME?.trim()
  const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase()
  const senha = process.env.INITIAL_ADMIN_PASSWORD

  if (!nome || !usuario || !email || !senha) {
    console.warn("[Banco local] Nenhum moderador existe e as variáveis INITIAL_ADMIN_* não foram configuradas.")
    return
  }

  const usuarioNormalizado = normalizarUsuario(usuario)
  if (!usuarioNormalizado || senha.length < 10) {
    console.warn(`[Banco local] Moderador inicial ${email} ignorado: usuário inválido ou senha com menos de 10 caracteres.`)
    return
  }

  const existente = store.usuarios.find((u) => norm(u.email) === norm(email) || norm(u.usuario) === norm(usuarioNormalizado))
  if (existente) return

  store.usuarios.push({
    id: gerarId(nome),
    nome,
    usuario: gerarUsuarioUnico(usuarioNormalizado),
    email,
    senha_hash: bcrypt.hashSync(senha, 12),
    tipo: "moderador",
    funcao: "Acólito",
    desde: null,
    status: "aprovado",
    criado_em: Date.now(),
  })
  persistNow()
}

seedModeradores()


export function criarUsuario(d: Omit<UsuarioRow, "criado_em"> & { criado_em?: number }) {
  store.usuarios.push({ ...d, criado_em: d.criado_em ?? Date.now() }); persistNow()
}
export function atualizarPerfil(id: string, dados: Partial<Pick<UsuarioRow,"nome"|"data_nascimento"|"data_votos"|"foto">>) {
  const u=store.usuarios.find(x=>x.id===id); if(!u) return null; Object.assign(u,dados); if (dados.data_votos !== undefined) u.desde = dados.data_votos || null; persistNow(); return u
}
export function listarEscalas() {
  return store.escalas
    .map((escala) => ({
      ...escala,
      pessoas: escala.pessoas.map((pessoa) => {
        const usuario = pessoa.id ? buscarUsuario(pessoa.id) : undefined
        if (!usuario) return { ...pessoa }
        return { ...pessoa, nome: usuario.nome }
      }),
    }))
    .sort((a,b)=>(a.data+a.horario).localeCompare(b.data+b.horario))
}
export function salvarEscala(e: Omit<EscalaRow,"id"|"criado_em">) { const row={...e,id:`escala-${Date.now()}`,criado_em:Date.now()}; store.escalas.push(row); persistNow(); return row }
export function excluirEscala(id:string) { const n=store.escalas.length; store.escalas=store.escalas.filter(e=>e.id!==id); persistNow(); return n!==store.escalas.length }
export function buscarUsuario(id:string){ return store.usuarios.find(u=>u.id===id) }

export function promoverUsuarioModerador(id: string, promotorId: string) {
  const usuario = store.usuarios.find((u) => u.id === id)
  const promotor = store.usuarios.find((u) => u.id === promotorId && u.tipo === "moderador")
  if (!usuario || usuario.tipo !== "membro" || !promotor) return null

  usuario.tipo = "moderador"
  usuario.status = "aprovado"
  usuario.promovido_por = promotor.id
  usuario.promovido_em = Date.now()
  persistNow()
  return usuario
}

export function excluirContaUsuario(id: string) {
  const usuario = store.usuarios.find((u) => u.id === id)
  if (!usuario) return false

  const quizzesCriados = new Set(store.quizzes.filter((q) => q.criado_por === id).map((q) => q.id))
  const ocorrenciasRemovidas = new Set(
    store.pontualidade_ocorrencias
      .filter((o) => o.usuario_id === id || o.reportado_por === id)
      .map((o) => o.id),
  )

  store.usuarios = store.usuarios.filter((u) => u.id !== id)
  store.registros = store.registros.filter((r) => r.usuario_id !== id)
  store.codigos_recuperacao = store.codigos_recuperacao.filter((c) => c.usuario_id !== id)
  store.escalas = store.escalas.map((escala) => ({
    ...escala,
    pessoas: escala.pessoas.filter((pessoa) => pessoa.id !== id && !(pessoa.id == null && pessoa.nome === usuario.nome)),
  }))
  store.reconhecimentos = store.reconhecimentos.filter((r) => r.de_usuario_id !== id && r.para_usuario_id !== id)
  store.quizzes = store.quizzes.filter((q) => q.criado_por !== id)
  store.quiz_respostas = store.quiz_respostas.filter((r) => r.usuario_id !== id && !quizzesCriados.has(r.quiz_id))
  store.pontualidade_ocorrencias = store.pontualidade_ocorrencias.filter((o) => !ocorrenciasRemovidas.has(o.id))
  store.pontualidade_reacoes = store.pontualidade_reacoes.filter((r) => r.usuario_id !== id && !ocorrenciasRemovidas.has(r.ocorrencia_id))
  store.ranking_ajustes = store.ranking_ajustes.filter((a) => a.usuario_id !== id && a.criado_por !== id)
  persistNow()
  return true
}


export function listarFormacoes() {
  return [...store.formacoes].sort((a, b) => {
    const da = `${a.data} ${a.horario || ""}`
    const db = `${b.data} ${b.horario || ""}`
    return db.localeCompare(da)
  })
}

export function buscarFormacao(id: string) {
  return store.formacoes.find((f) => f.id === id)
}

export function salvarFormacao(dados: Omit<FormacaoRow, "id" | "criado_em" | "atualizado_em">) {
  const agora = Date.now()
  const row: FormacaoRow = { ...dados, id: `formacao-${agora}-${Math.random().toString(36).slice(2, 8)}`, criado_em: agora, atualizado_em: agora }
  store.formacoes.push(row)
  persistNow()
  return row
}

export function atualizarFormacao(id: string, dados: Partial<Omit<FormacaoRow, "id" | "criado_em">>) {
  const row = store.formacoes.find((f) => f.id === id)
  if (!row) return null
  Object.assign(row, dados, { atualizado_em: Date.now() })
  persistNow()
  return row
}

export function excluirFormacao(id: string) {
  const row = store.formacoes.find((f) => f.id === id)
  if (!row) return null
  store.formacoes = store.formacoes.filter((f) => f.id !== id)
  persistNow()
  return row
}


// ---------------- Gamificação, quizzes, ranking e pontualidade ----------------
export function listarEquipeAprovada() {
  return store.usuarios
    .filter((u) => u.status === "aprovado" && (u.funcao === "Acólito" || u.funcao === "Coroinha"))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
}

export function listarMembrosAprovados() {
  return listarEquipeAprovada()
}

export function listarReconhecimentos(ano?: number) {
  return store.reconhecimentos.filter((r) => !ano || r.ano === ano)
}

export function salvarReconhecimento(row: Omit<ReconhecimentoRow, "id" | "criado_em">) {
  const novo: ReconhecimentoRow = { ...row, id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, criado_em: Date.now() }
  store.reconhecimentos.push(novo); persistNow(); return novo
}

export function reconhecimentoMensalJaFeito(deId: string, categoria: ReconhecimentoCategoria, ano: number, mes: number) {
  return store.reconhecimentos.some((r) => r.de_usuario_id === deId && r.categoria === categoria && r.ano === ano && r.mes === mes)
}

export function listarQuizzes(incluirInativos = false) {
  return [...store.quizzes].filter((q) => incluirInativos || q.ativo).sort((a, b) => b.criado_em - a.criado_em)
}
export function buscarQuiz(id: string) { return store.quizzes.find((q) => q.id === id) }
export function salvarQuiz(dados: Omit<QuizRow, "id" | "criado_em" | "atualizado_em">) {
  const agora = Date.now(); const q: QuizRow = { ...dados, id: `quiz-${agora}-${Math.random().toString(36).slice(2,7)}`, criado_em: agora, atualizado_em: agora }
  store.quizzes.push(q); persistNow(); return q
}
export function atualizarQuiz(id: string, dados: Partial<Omit<QuizRow, "id" | "criado_em" | "criado_por">>) {
  const q = store.quizzes.find((x) => x.id === id); if (!q) return null; Object.assign(q, dados, { atualizado_em: Date.now() }); persistNow(); return q
}
export function excluirQuiz(id: string) {
  const antes = store.quizzes.length; store.quizzes = store.quizzes.filter((q) => q.id !== id); store.quiz_respostas = store.quiz_respostas.filter((r) => r.quiz_id !== id); persistNow(); return antes !== store.quizzes.length
}
export function buscarRespostaQuiz(quizId: string, usuarioId: string) { return store.quiz_respostas.find((r) => r.quiz_id === quizId && r.usuario_id === usuarioId) }
export function listarRespostasQuiz() { return [...store.quiz_respostas] }
export function salvarRespostaQuiz(row: Omit<QuizRespostaRow, "id" | "respondido_em">) {
  const existente = buscarRespostaQuiz(row.quiz_id, row.usuario_id); if (existente) return existente
  const novo: QuizRespostaRow = { ...row, id: `qresp-${Date.now()}-${Math.random().toString(36).slice(2,7)}`, respondido_em: Date.now() }
  store.quiz_respostas.push(novo); persistNow(); return novo
}

export function listarPontualidadeOcorrencias(incluirPendentes = false) {
  return [...store.pontualidade_ocorrencias].filter((o) => incluirPendentes || o.status === "confirmado").sort((a,b) => b.criado_em - a.criado_em)
}
export function buscarPontualidadeOcorrencia(id: string) { return store.pontualidade_ocorrencias.find((o) => o.id === id) }
export function buscarPontualidadePorRequisicao(clientRequestId: string, reportadoPor: string) {
  return store.pontualidade_ocorrencias.find((o) => o.client_request_id === clientRequestId && o.reportado_por === reportadoPor)
}
export function salvarPontualidadeOcorrencia(row: Omit<PontualidadeOcorrenciaRow, "id" | "criado_em" | "status" | "moderado_por" | "moderado_em">) {
  const novo: PontualidadeOcorrenciaRow = { ...row, id: `atraso-${Date.now()}-${Math.random().toString(36).slice(2,7)}`, status: "pendente", criado_em: Date.now(), moderado_por: null, moderado_em: null }
  store.pontualidade_ocorrencias.push(novo); persistNow(); return novo
}
export function moderarPontualidade(id: string, status: Exclude<PontualidadeStatus, "pendente">, moderadorId: string) {
  const row = buscarPontualidadeOcorrencia(id); if (!row) return null; row.status = status; row.moderado_por = moderadorId; row.moderado_em = Date.now(); persistNow(); return row
}
export function listarPontualidadeReacoes() { return [...store.pontualidade_reacoes] }
export function salvarPontualidadeReacao(ocorrenciaId: string, usuarioId: string, emoji: string) {
  const existente = store.pontualidade_reacoes.find((r) => r.ocorrencia_id === ocorrenciaId && r.usuario_id === usuarioId)
  if (existente) { existente.emoji = emoji; existente.criado_em = Date.now(); persistNow(); return existente }
  const row: PontualidadeReacaoRow = { id: `reacao-${Date.now()}-${Math.random().toString(36).slice(2,7)}`, ocorrencia_id: ocorrenciaId, usuario_id: usuarioId, emoji, criado_em: Date.now() }
  store.pontualidade_reacoes.push(row); persistNow(); return row
}

export function listarRankingAjustes(ano?: number) { return store.ranking_ajustes.filter((a) => !ano || a.ano === ano) }
export function salvarRankingAjuste(row: Omit<RankingAjusteRow, "id" | "criado_em">) {
  const novo: RankingAjusteRow = { ...row, id: `ajuste-${Date.now()}-${Math.random().toString(36).slice(2,7)}`, criado_em: Date.now() }; store.ranking_ajustes.push(novo); persistNow(); return novo
}

export function obterRankingConfig(ano: number): RankingConfigRow {
  return store.ranking_configs.find((c) => c.ano === ano) || { ano, peso_formacao: 25, peso_liturgia: 25, peso_pontualidade: 30, peso_reconhecimento: 20, minutos_antecedencia: 30, atualizado_em: 0 }
}
export function salvarRankingConfig(config: RankingConfigRow) {
  const idx = store.ranking_configs.findIndex((c) => c.ano === config.ano); const next = { ...config, atualizado_em: Date.now() }
  if (idx >= 0) store.ranking_configs[idx] = next; else store.ranking_configs.push(next); persistNow(); return next
}
