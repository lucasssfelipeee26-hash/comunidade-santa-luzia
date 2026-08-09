import bcrypt from "bcryptjs"
import fs from "node:fs"
import path from "node:path"

export const DATA_DIR = process.env.DATA_DIR?.trim() || path.join(process.cwd(), "data")
const DB_PATH = path.join(DATA_DIR, "santa-luzia.json")

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

type Store = {
  usuarios: UsuarioRow[]
  registros: RegistroRow[]
  codigos_recuperacao: CodigoRow[]
  escalas: EscalaRow[]
  formacoes: FormacaoRow[]
}

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

let storeDisponivel = true

function readStore(): Store {
  if (!fs.existsSync(DB_PATH)) return { usuarios: [], registros: [], codigos_recuperacao: [], escalas: [], formacoes: [] }
  try {
    const raw = fs.readFileSync(DB_PATH, "utf8")
    const parsed = JSON.parse(raw) as Partial<Store>
    return {
      usuarios: Array.isArray(parsed.usuarios) ? parsed.usuarios : [],
      registros: Array.isArray(parsed.registros) ? parsed.registros : [],
      codigos_recuperacao: Array.isArray(parsed.codigos_recuperacao) ? parsed.codigos_recuperacao : [],
      escalas: Array.isArray(parsed.escalas) ? parsed.escalas : [],
      formacoes: Array.isArray(parsed.formacoes) ? parsed.formacoes : [],
    }
  } catch (error) {
    // Preserva uma cópia do arquivo problemático antes de recriar a base.
    try {
      const backup = `${DB_PATH}.corrompido-${Date.now()}.bak`
      fs.copyFileSync(DB_PATH, backup)
    } catch {}
    storeDisponivel = false
    console.error("[Banco local] Não foi possível ler data/santa-luzia.json. As gravações foram bloqueadas para proteger os dados.", error)
    return { usuarios: [], registros: [], codigos_recuperacao: [], escalas: [], formacoes: [] }
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
  }
  if (alterado && store.usuarios.length) {
    fs.writeFileSync(DB_PATH, JSON.stringify(store, null, 2), "utf8")
  }
}

function persistNow() {
  if (!storeDisponivel && fs.existsSync(DB_PATH)) {
    throw new Error("O banco local está temporariamente indisponível. Reinicie o servidor antes de tentar gravar novamente.")
  }
  fs.writeFileSync(DB_PATH, JSON.stringify(store, null, 2), "utf8")
  storeDisponivel = true
}

function norm(value: unknown) {
  return String(value ?? "").trim().toLowerCase()
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

  const moderadores: Array<{ nome: string; usuario: string; email: string; senha: string }> = []

  const nome = process.env.INITIAL_ADMIN_NAME?.trim()
  const usuario = process.env.INITIAL_ADMIN_USERNAME?.trim()
  const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase()
  const senha = process.env.INITIAL_ADMIN_PASSWORD

  if (nome && usuario && email && senha) {
    moderadores.push({ nome, usuario, email, senha })
  }

  const nome2 = process.env.INITIAL_ADMIN2_NAME?.trim()
  const usuario2 = process.env.INITIAL_ADMIN2_USERNAME?.trim()
  const email2 = process.env.INITIAL_ADMIN2_EMAIL?.trim().toLowerCase()
  const senha2 = process.env.INITIAL_ADMIN2_PASSWORD

  if (nome2 && usuario2 && email2 && senha2) {
    moderadores.push({ nome: nome2, usuario: usuario2, email: email2, senha: senha2 })
  }

  if (moderadores.length === 0) {
    console.warn("[Banco local] Nenhum moderador existe e as variáveis INITIAL_ADMIN_* não foram configuradas.")
    return
  }

  let alterado = false
  for (const m of moderadores) {
    const usuarioNormalizado = normalizarUsuario(m.usuario)
    if (!usuarioNormalizado || m.senha.length < 10) {
      console.warn(`[Banco local] Moderador inicial ${m.email} ignorado: usuário inválido ou senha com menos de 10 caracteres.`)
      continue
    }

    const existente = store.usuarios.find((u) => norm(u.email) === norm(m.email) || norm(u.usuario) === norm(usuarioNormalizado))
    if (existente) continue

    store.usuarios.push({
      id: gerarId(m.nome),
      nome: m.nome,
      usuario: gerarUsuarioUnico(usuarioNormalizado),
      email: m.email,
      senha_hash: bcrypt.hashSync(m.senha, 12),
      tipo: "moderador",
      funcao: null,
      desde: null,
      status: "aprovado",
      criado_em: Date.now(),
    })
    alterado = true
  }

  if (alterado) persistNow()
}

seedModeradores()


export function criarUsuario(d: Omit<UsuarioRow, "criado_em"> & { criado_em?: number }) {
  store.usuarios.push({ ...d, criado_em: d.criado_em ?? Date.now() }); persistNow()
}
export function atualizarPerfil(id: string, dados: Partial<Pick<UsuarioRow,"nome"|"data_nascimento"|"data_votos"|"foto">>) {
  const u=store.usuarios.find(x=>x.id===id); if(!u) return null; Object.assign(u,dados); if (dados.data_votos !== undefined) u.desde = dados.data_votos || null; persistNow(); return u
}
export function listarEscalas() { return [...store.escalas].sort((a,b)=>(a.data+a.horario).localeCompare(b.data+b.horario)) }
export function salvarEscala(e: Omit<EscalaRow,"id"|"criado_em">) { const row={...e,id:`escala-${Date.now()}`,criado_em:Date.now()}; store.escalas.push(row); persistNow(); return row }
export function excluirEscala(id:string) { const n=store.escalas.length; store.escalas=store.escalas.filter(e=>e.id!==id); persistNow(); return n!==store.escalas.length }
export function buscarUsuario(id:string){ return store.usuarios.find(u=>u.id===id) }


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
