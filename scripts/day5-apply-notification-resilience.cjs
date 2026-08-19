const fs = require('node:fs')

function patch(path, replacements) {
  let text = fs.readFileSync(path, 'utf8')
  for (const [from, to] of replacements) {
    if (!text.includes(from)) throw new Error(`Padrão não encontrado em ${path}: ${from.slice(0, 140)}`)
    text = text.replace(from, to)
  }
  fs.writeFileSync(path, text)
}

patch('components/android-offline-snapshot-runtime.tsx', [
  [
    'tipo: "atraso" | "formacao-presenca" | "quiz-liturgia"',
    'tipo: "atraso" | "formacao-presenca" | "quiz-liturgia" | "notificacao-lida"',
  ],
  [
    '      if (item.tipo === "quiz-liturgia") {\n        const response = await fetch("/api/quizzes/liturgia/offline", {\n          method: "POST",\n          headers: { "Content-Type": "application/json" },\n          credentials: "same-origin",\n          body: JSON.stringify(item.payload),\n        })\n        return response.ok || response.status === 409\n      }\n      return false',
    '      if (item.tipo === "quiz-liturgia") {\n        const response = await fetch("/api/quizzes/liturgia/offline", {\n          method: "POST",\n          headers: { "Content-Type": "application/json" },\n          credentials: "same-origin",\n          body: JSON.stringify(item.payload),\n        })\n        return response.ok || response.status === 409\n      }\n      if (item.tipo === "notificacao-lida") {\n        const response = await fetch("/api/notificacoes", {\n          method: "POST",\n          headers: { "Content-Type": "application/json" },\n          credentials: "same-origin",\n          body: JSON.stringify(item.payload),\n        })\n        return response.ok || response.status === 404\n      }\n      return false',
  ],
])

patch('components/native-notification-runtime.tsx', [
  [
    'import { loadSoundPreferences } from "@/lib/sound-preferences"',
    'import { loadSoundPreferences } from "@/lib/sound-preferences"\nimport { enfileirarNotificacaoLida, salvarNotificacoesCache, ultimoUsuarioNotificacoes } from "@/lib/local-notification-cache"',
  ],
  [
    'const INTERVALO_NOTIFICACOES = 10_000',
    'const INTERVALO_NOTIFICACOES = 60_000',
  ],
  [
    '    let canalPreparado = ""',
    '    let canalPreparado = ""\n    let usuarioAtualId = ultimoUsuarioNotificacoes()',
  ],
  [
    '          if (typeof notificacaoId === "string") {\n            void fetchComTimeout("/api/notificacoes", {\n              method: "POST",\n              headers: { "Content-Type": "application/json" },\n              body: JSON.stringify({ id: notificacaoId }),\n            })\n              .then(() => window.dispatchEvent(new CustomEvent("santa-luzia:notificacoes-atualizadas")))\n              .catch(() => undefined)\n          }',
    '          if (typeof notificacaoId === "string") {\n            const ownerId = usuarioAtualId || ultimoUsuarioNotificacoes()\n            void fetchComTimeout("/api/notificacoes", {\n              method: "POST",\n              headers: { "Content-Type": "application/json" },\n              credentials: "same-origin",\n              body: JSON.stringify({ id: notificacaoId }),\n            })\n              .then((resposta) => {\n                if (!resposta.ok && ownerId) enfileirarNotificacaoLida(ownerId, notificacaoId)\n                window.dispatchEvent(new CustomEvent("santa-luzia:notificacoes-atualizadas"))\n              })\n              .catch(() => { if (ownerId) enfileirarNotificacaoLida(ownerId, notificacaoId) })\n          }',
  ],
  [
    '            if (!dados.autenticado || !dados.usuario?.id) return\n\n            let permissao',
    '            if (!dados.autenticado || !dados.usuario?.id) return\n            usuarioAtualId = String(dados.usuario.id)\n            await salvarNotificacoesCache(usuarioAtualId, dados.notificacoes || [], (dados.notificacoes || []).filter((n) => !n.lida_em).length)\n\n            let permissao',
  ],
])

patch('components/notification-center.tsx', [
  [
    'import { Bell, BrainCircuit, CalendarDays, Gamepad2, Sparkles, Trophy, X } from "lucide-react"',
    'import { Bell, BrainCircuit, CalendarDays, Gamepad2, Sparkles, Trophy, X } from "lucide-react"\nimport { carregarNotificacoesCache, enfileirarTodasNotificacoesLidas, marcarCacheComoLido, salvarNotificacoesCache, ultimoUsuarioNotificacoes } from "@/lib/local-notification-cache"',
  ],
  [
    'type Dados = { autenticado?: boolean; notificacoes?: Notificacao[]; naoLidas?: number }\nconst fetcher = (url: string) => fetch(url, { cache: "no-store", credentials: "same-origin" }).then(async (r) => r.ok ? r.json() : null)',
    'type Dados = { autenticado?: boolean; usuario?: { id?: string }; notificacoes?: Notificacao[]; naoLidas?: number; offline?: boolean }\n\nconst fetcher = async (url: string): Promise<Dados | null> => {\n  try {\n    const response = await fetch(url, { cache: "no-store", credentials: "same-origin" })\n    if (response.ok) {\n      const dados = await response.json() as Dados\n      const usuarioId = String(dados.usuario?.id || "")\n      if (dados.autenticado && usuarioId && Array.isArray(dados.notificacoes)) {\n        await salvarNotificacoesCache(usuarioId, dados.notificacoes, dados.naoLidas)\n      }\n      return dados\n    }\n  } catch {}\n\n  const cache = carregarNotificacoesCache()\n  if (!cache) return null\n  return {\n    autenticado: true,\n    usuario: { id: cache.usuarioId },\n    notificacoes: cache.notificacoes as Notificacao[],\n    naoLidas: cache.naoLidas,\n    offline: true,\n  }\n}',
  ],
  [
    '    refreshInterval: 8_000,',
    '    refreshInterval: 60_000,',
  ],
  [
    '  function marcarTodasComoVistas() {\n    if (!data || naoLidas <= 0) return\n    const agora = Date.now()\n    void mutate({\n      ...data,\n      naoLidas: 0,\n      notificacoes: notificacoes.map((n) => ({ ...n, lida_em: n.lida_em || agora })),\n    }, false)\n\n    void fetch("/api/notificacoes", {\n      method: "POST",\n      headers: { "Content-Type": "application/json" },\n      body: JSON.stringify({ action: "todas" }),\n    })\n      .then(() => mutate())\n      .catch(() => mutate())\n  }',
    '  function marcarTodasComoVistas() {\n    if (!data || naoLidas <= 0) return\n    const agora = Date.now()\n    const usuarioId = String(data.usuario?.id || ultimoUsuarioNotificacoes() || "")\n    const atualizadas = notificacoes.map((n) => ({ ...n, lida_em: n.lida_em || agora }))\n    void mutate({ ...data, naoLidas: 0, notificacoes: atualizadas }, false)\n    if (usuarioId) marcarCacheComoLido(usuarioId)\n\n    if (!navigator.onLine) {\n      if (usuarioId) enfileirarTodasNotificacoesLidas(usuarioId)\n      return\n    }\n\n    void fetch("/api/notificacoes", {\n      method: "POST",\n      headers: { "Content-Type": "application/json" },\n      credentials: "same-origin",\n      body: JSON.stringify({ action: "todas" }),\n    })\n      .then((response) => {\n        if (!response.ok && usuarioId) enfileirarTodasNotificacoesLidas(usuarioId)\n        if (response.ok) void mutate()\n      })\n      .catch(() => { if (usuarioId) enfileirarTodasNotificacoesLidas(usuarioId) })\n  }',
  ],
  [
    '            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 pb-4">',
    '            {data?.offline && <div className="mx-3 mt-3 rounded-xl bg-secondary/60 px-3 py-2 text-center text-[11px] font-medium text-muted-foreground">Exibindo as notificações salvas neste aparelho. A sincronização será retomada quando a conexão voltar.</div>}\n            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 pb-4">',
  ],
])

console.log('Dia 5 aplicado: cache persistente, fallback offline e reconciliação de leitura.')
