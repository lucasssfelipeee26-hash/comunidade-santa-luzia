const fs = require('node:fs')
const path = 'components/android-offline-snapshot-runtime.tsx'
let text = fs.readFileSync(path, 'utf8')

function replace(from, to) {
  if (!text.includes(from)) throw new Error(`Padrão não encontrado: ${from.slice(0, 120)}`)
  text = text.replace(from, to)
}

replace(
  'const TIMEOUT = 7_000',
  'const TIMEOUT = 7_000\nconst SNAPSHOT_REVISION_KEY = "santa-luzia:local-first:snapshot-revision"\nconst SNAPSHOT_USER_KEY = "santa-luzia:local-first:snapshot-user"\nconst INTERVALO_SNAPSHOT = 5 * 60_000\n\nfunction lerLocal(chave: string) {\n  try { return window.localStorage.getItem(chave) } catch { return null }\n}\n\nfunction salvarLocal(chave: string, valor: string) {\n  try { window.localStorage.setItem(chave, valor) } catch {}\n}\n\nfunction removerLocal(chave: string) {\n  try { window.localStorage.removeItem(chave) } catch {}\n}'
)

replace(
  '    async function salvarSnapshotPersistente(snapshot: unknown) {\n      const texto = JSON.stringify(snapshot)\n      if (usaNativo) await OfflineStore.saveSnapshot({ snapshot: texto })\n      else enviarBridge({ type: "SL_OFFLINE_SAVE_SNAPSHOT", snapshot })\n    }',
  '    async function salvarSnapshotPersistente(snapshot: Record<string, unknown>) {\n      const texto = JSON.stringify(snapshot)\n      if (usaNativo) {\n        await OfflineStore.saveSnapshot({ snapshot: texto })\n        const documentos: Array<[string, unknown]> = [\n          ["snapshot:auth", snapshot.auth ?? null],\n          ["snapshot:perfil", snapshot.perfil ?? null],\n          ["snapshot:perfis", snapshot.perfis ?? []],\n          ["snapshot:formacoes", snapshot.formacoes ?? { formacoes: [] }],\n          ["snapshot:ranking", snapshot.ranking ?? { ranking: [], membros: [], ocorrencias: [] }],\n          ["snapshot:escalas", snapshot.escalas ?? { escalas: [] }],\n          ["snapshot:biblioteca", snapshot.biblioteca ?? { livros: [] }],\n        ]\n        await Promise.allSettled(documentos.map(([key, value]) =>\n          OfflineStore.saveDocument({ key, value: JSON.stringify(value) })\n        ))\n      } else enviarBridge({ type: "SL_OFFLINE_SAVE_SNAPSHOT", snapshot })\n    }'
)

replace(
  '    async function limparPersistente() {\n      if (usaNativo) await OfflineStore.clear().catch(() => undefined)\n      else enviarBridge({ type: "SL_OFFLINE_CLEAR" })\n    }',
  '    async function limparPersistente() {\n      if (usaNativo) await OfflineStore.clear().catch(() => undefined)\n      else enviarBridge({ type: "SL_OFFLINE_CLEAR" })\n      removerLocal(SNAPSHOT_REVISION_KEY)\n      removerLocal(SNAPSHOT_USER_KEY)\n    }'
)

replace(
  '    async function salvarSnapshot() {\n      if (encerrado || salvando || !navigator.onLine) return\n      if (!usaNativo && !bridgePronto) return\n      salvando = true\n      try {\n        const auth = await jsonComTimeout("/api/auth/me")\n        const sessao = auth?.sessao\n        if (!sessao?.usuario?.id || !sessao?.tipo) {\n          await limparPersistente()\n          return\n        }\n\n        const [perfilResposta, perfisResposta, formacoes, ranking, escalas, biblioteca] = await Promise.all([',
  '    async function salvarSnapshot() {\n      if (encerrado || salvando || !navigator.onLine) return\n      if (!usaNativo && !bridgePronto) return\n      salvando = true\n      try {\n        const auth = await jsonComTimeout("/api/auth/me")\n        const sessao = auth?.sessao\n        if (!sessao?.usuario?.id || !sessao?.tipo) {\n          await limparPersistente()\n          return\n        }\n\n        const usuarioId = String(sessao.usuario.id)\n        const status = await jsonComTimeout(`/api/app/status?snapshot=${Date.now()}`)\n        const revisaoDados = String(status?.revisaoDados || "")\n        const mesmaRevisao = Boolean(revisaoDados && lerLocal(SNAPSHOT_REVISION_KEY) === revisaoDados)\n        const mesmoUsuario = lerLocal(SNAPSHOT_USER_KEY) === usuarioId\n        if (mesmaRevisao && mesmoUsuario) return\n\n        const [perfilResposta, perfisResposta, formacoes, ranking, escalas, biblioteca] = await Promise.all(['
)

replace(
  '        const snapshot = {\n          versao: 3,\n          atualizadoEm: Date.now(),',
  '        const snapshot = {\n          versao: 4,\n          atualizadoEm: Date.now(),\n          revisaoDados: revisaoDados || null,'
)

replace(
  '        await salvarSnapshotPersistente(snapshot)\n      } finally {',
  '        await salvarSnapshotPersistente(snapshot)\n        if (revisaoDados) salvarLocal(SNAPSHOT_REVISION_KEY, revisaoDados)\n        salvarLocal(SNAPSHOT_USER_KEY, usuarioId)\n      } finally {'
)

replace(
  '    const timer = window.setInterval(() => { void salvarSnapshot(); void pedirFila() }, 90_000)',
  '    const timer = window.setInterval(() => { void salvarSnapshot(); void pedirFila() }, INTERVALO_SNAPSHOT)'
)

fs.writeFileSync(path, text)
console.log('Dia 4 aplicado: snapshot por revisão, isolamento por usuário e documentos SQLite separados.')
