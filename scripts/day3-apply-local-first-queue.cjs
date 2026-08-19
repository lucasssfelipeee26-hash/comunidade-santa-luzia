const fs = require('node:fs')

function patch(path, replacements) {
  let text = fs.readFileSync(path, 'utf8')
  for (const [from, to] of replacements) {
    if (!text.includes(from)) throw new Error(`Padrão não encontrado em ${path}: ${from.slice(0, 100)}`)
    text = text.replace(from, to)
  }
  fs.writeFileSync(path, text)
}

patch('lib/offline-data.ts', [
  [
    'export const OFFLINE_DATA_EVENT = "santa-luzia:offline-data"',
    'import { espelharPresencasNaFilaDuravel, espelharRelatosAtrasoNaFilaDuravel, filaNativaDisponivel, migrarFilasLegadasParaNativa } from "@/lib/local-first-queue"\n\nexport const OFFLINE_DATA_EVENT = "santa-luzia:offline-data"',
  ],
  [
    '  const salvo = salvarJson(ATRASOS_KEY, itens)\n  if (salvo) emitirAtualizacao({ tipo: "atrasos", pendentes: itens.length })\n  return salvo',
    '  const salvo = salvarJson(ATRASOS_KEY, itens)\n  if (salvo) {\n    espelharRelatosAtrasoNaFilaDuravel(itens)\n    emitirAtualizacao({ tipo: "atrasos", pendentes: itens.length })\n  }\n  return salvo',
  ],
  [
    'export async function sincronizarRelatosAtrasoPendentes() {\n  if (typeof window === "undefined" || !navigator.onLine) return { enviados: 0, restantes: listarRelatosAtrasoPendentes().length }\n\n  const todos = listarRelatosAtrasoPendentes()',
    'export async function sincronizarRelatosAtrasoPendentes() {\n  if (typeof window === "undefined" || !navigator.onLine) return { enviados: 0, restantes: listarRelatosAtrasoPendentes().length }\n  if (await filaNativaDisponivel()) {\n    await migrarFilasLegadasParaNativa()\n    return { enviados: 0, restantes: listarRelatosAtrasoPendentes().length }\n  }\n\n  const todos = listarRelatosAtrasoPendentes()',
  ],
  [
    '  const salvo = salvarJson(PRESENCAS_FORMACAO_KEY, itens)\n  if (salvo) emitirAtualizacao({ tipo: "presencas-formacao", pendentes: itens.length })\n  return salvo',
    '  const salvo = salvarJson(PRESENCAS_FORMACAO_KEY, itens)\n  if (salvo) {\n    espelharPresencasNaFilaDuravel(itens)\n    emitirAtualizacao({ tipo: "presencas-formacao", pendentes: itens.length })\n  }\n  return salvo',
  ],
  [
    'export async function sincronizarPresencasFormacaoPendentes() {\n  if (typeof window === "undefined" || !navigator.onLine) {\n    return { enviados: 0, restantes: listarPresencasFormacaoPendentes().length }\n  }\n\n  const todos = listarPresencasFormacaoPendentes()',
    'export async function sincronizarPresencasFormacaoPendentes() {\n  if (typeof window === "undefined" || !navigator.onLine) {\n    return { enviados: 0, restantes: listarPresencasFormacaoPendentes().length }\n  }\n  if (await filaNativaDisponivel()) {\n    await migrarFilasLegadasParaNativa()\n    return { enviados: 0, restantes: listarPresencasFormacaoPendentes().length }\n  }\n\n  const todos = listarPresencasFormacaoPendentes()',
  ],
])

patch('components/android-offline-snapshot-runtime.tsx', [
  [
    'import { OfflineStore } from "@/lib/native-offline-store"',
    'import { OfflineStore } from "@/lib/native-offline-store"\nimport { OFFLINE_DATA_EVENT } from "@/lib/offline-data"\nimport { migrarFilasLegadasParaNativa, removerEspelhosLegados } from "@/lib/local-first-queue"',
  ],
  [
    '  criadoEm?: number\n  formacaoId?: string',
    '  criadoEm?: number\n  ownerId?: string\n  formacaoId?: string',
  ],
  [
    '    async function drenarFila(items: QueueItem[]) {\n      if (encerrado || drenando || !navigator.onLine || !Array.isArray(items) || !items.length) return\n      drenando = true\n      const restantes: QueueItem[] = []\n      try {\n        for (const item of items) {',
    '    async function drenarFila(items: QueueItem[]) {\n      if (encerrado || drenando || !navigator.onLine || !Array.isArray(items) || !items.length) return\n      drenando = true\n      const restantes: QueueItem[] = []\n      try {\n        const auth = await jsonComTimeout("/api/auth/me")\n        const usuarioAtual = String(auth?.sessao?.usuario?.id || "")\n        if (!usuarioAtual) return\n        for (const item of items) {\n          if (item.ownerId && String(item.ownerId) !== usuarioAtual) {\n            restantes.push(item)\n            continue\n          }',
  ],
  [
    '        if (usaNativo) await salvarFila(restantes)\n        else {\n          const removidos = items.filter((item) => !restantes.some((r) => r.id === item.id)).map((item) => String(item.id))\n          if (removidos.length) enviarBridge({ type: "SL_OFFLINE_QUEUE_REMOVE", ids: removidos })\n        }',
    '        const removidos = items.filter((item) => !restantes.some((r) => r.id === item.id)).map((item) => String(item.id))\n        if (usaNativo) {\n          await salvarFila(restantes)\n          if (removidos.length) removerEspelhosLegados(removidos)\n        } else if (removidos.length) {\n          enviarBridge({ type: "SL_OFFLINE_QUEUE_REMOVE", ids: removidos })\n        }',
  ],
  [
    '    async function pedirFila() {\n      if (!navigator.onLine) return\n      if (usaNativo) void drenarFila(await lerFila())\n      else enviarBridge({ type: "SL_OFFLINE_GET_QUEUE" })\n    }',
    '    async function pedirFila() {\n      if (!navigator.onLine) return\n      if (usaNativo) {\n        await migrarFilasLegadasParaNativa()\n        void drenarFila(await lerFila())\n      } else enviarBridge({ type: "SL_OFFLINE_GET_QUEUE" })\n    }',
  ],
  [
    '    const aoOnline = () => { void salvarSnapshot(); void pedirFila() }\n    const aoSincronizar = () => { void salvarSnapshot(); void pedirFila() }',
    '    const aoOnline = () => { void salvarSnapshot(); void pedirFila() }\n    const aoSincronizar = () => { void salvarSnapshot(); void pedirFila() }\n    const aoFilaOffline = () => { void pedirFila() }',
  ],
  [
    '    window.addEventListener("santa-luzia:server-sync", aoSincronizar)\n    window.addEventListener("santa-luzia:offline-snapshot-sync", aoSincronizar)',
    '    window.addEventListener("santa-luzia:server-sync", aoSincronizar)\n    window.addEventListener("santa-luzia:offline-snapshot-sync", aoSincronizar)\n    window.addEventListener(OFFLINE_DATA_EVENT, aoFilaOffline)',
  ],
  [
    '      window.removeEventListener("santa-luzia:server-sync", aoSincronizar)\n      window.removeEventListener("santa-luzia:offline-snapshot-sync", aoSincronizar)',
    '      window.removeEventListener("santa-luzia:server-sync", aoSincronizar)\n      window.removeEventListener("santa-luzia:offline-snapshot-sync", aoSincronizar)\n      window.removeEventListener(OFFLINE_DATA_EVENT, aoFilaOffline)',
  ],
])

patch('android-web/offline.html', [
  [
    'async function enqueue(item){queueCache.push(item);await saveQueue();renderAll()}',
    'async function enqueue(item){const owner=user()?.id;if(owner&&!item.ownerId)item.ownerId=String(owner);queueCache.push(item);await saveQueue();renderAll()}',
  ],
])

console.log('Dia 3 aplicado: fila nativa durável, migração de filas antigas e isolamento por usuário.')
