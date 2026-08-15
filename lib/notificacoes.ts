import fs from "node:fs"
import path from "node:path"
import { DATA_DIR } from "@/lib/db"

export type NotificacaoTipo = "quiz" | "missao" | "ranking" | "avulso" | "escala" | "sistema"

export type NotificacaoRow = {
  id: string
  usuario_id: string
  chave: string
  tipo: NotificacaoTipo
  titulo: string
  mensagem: string
  href: string
  criado_em: number
  lida_em: number | null
}

type Store = { notificacoes: NotificacaoRow[] }
const ARQUIVO = path.join(DATA_DIR, "notificacoes.json")

function ler(): Store {
  try {
    if (!fs.existsSync(ARQUIVO)) return { notificacoes: [] }
    const parsed = JSON.parse(fs.readFileSync(ARQUIVO, "utf8")) as Partial<Store>
    return { notificacoes: Array.isArray(parsed.notificacoes) ? parsed.notificacoes : [] }
  } catch (error) {
    console.error("[Notificações] Falha ao ler armazenamento.", error)
    return { notificacoes: [] }
  }
}

function salvar(store: Store) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  const temporario = `${ARQUIVO}.tmp`
  fs.writeFileSync(temporario, JSON.stringify(store, null, 2), "utf8")
  fs.renameSync(temporario, ARQUIVO)
}

export function salvarNotificacao(input: Omit<NotificacaoRow, "id" | "criado_em" | "lida_em">) {
  const store = ler()
  const existente = store.notificacoes.find((n) => n.usuario_id === input.usuario_id && n.chave === input.chave)
  if (existente) return existente
  const agora = Date.now()
  const row: NotificacaoRow = {
    ...input,
    titulo: input.titulo.trim().slice(0, 120),
    mensagem: input.mensagem.trim().slice(0, 500),
    href: input.href.startsWith("/") ? input.href : "/area-restrita/ranking",
    id: `notif-${agora}-${Math.random().toString(36).slice(2, 8)}`,
    criado_em: agora,
    lida_em: null,
  }
  store.notificacoes.push(row)
  // Evita crescimento ilimitado: preserva as 250 notificações mais recentes por usuário.
  const porUsuario = new Map<string, NotificacaoRow[]>()
  for (const n of store.notificacoes) {
    const lista = porUsuario.get(n.usuario_id) || []
    lista.push(n)
    porUsuario.set(n.usuario_id, lista)
  }
  store.notificacoes = [...porUsuario.values()].flatMap((lista) => lista.sort((a, b) => b.criado_em - a.criado_em).slice(0, 250))
  salvar(store)
  return row
}

export function notificarUsuarios(
  usuarios: string[],
  dados: Omit<NotificacaoRow, "id" | "usuario_id" | "criado_em" | "lida_em">,
) {
  const unicos = [...new Set(usuarios.filter(Boolean))]
  return unicos.map((usuario_id) => salvarNotificacao({ ...dados, usuario_id }))
}

export function listarNotificacoes(usuarioId: string, limite = 60) {
  return ler().notificacoes
    .filter((n) => n.usuario_id === usuarioId)
    .sort((a, b) => b.criado_em - a.criado_em)
    .slice(0, Math.max(1, Math.min(100, limite)))
}

export function marcarNotificacaoLida(usuarioId: string, id: string) {
  const store = ler()
  const row = store.notificacoes.find((n) => n.id === id && n.usuario_id === usuarioId)
  if (!row) return false
  if (!row.lida_em) {
    row.lida_em = Date.now()
    salvar(store)
  }
  return true
}

export function marcarTodasNotificacoesLidas(usuarioId: string) {
  const store = ler()
  const agora = Date.now()
  let alteradas = 0
  for (const n of store.notificacoes) {
    if (n.usuario_id === usuarioId && !n.lida_em) {
      n.lida_em = agora
      alteradas++
    }
  }
  if (alteradas) salvar(store)
  return alteradas
}
