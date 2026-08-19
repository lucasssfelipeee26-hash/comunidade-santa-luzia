const fs = require('node:fs')

function patch(path, replacements) {
  let text = fs.readFileSync(path, 'utf8')
  for (const [from, to] of replacements) {
    if (!text.includes(from)) throw new Error(`Padrão não encontrado em ${path}: ${from.slice(0, 140)}`)
    text = text.replace(from, to)
  }
  fs.writeFileSync(path, text)
}

patch('components/server-sync-runtime.tsx', [
  [
    'const RELEASE_KEY = "santa-luzia:release-visto"\nconst INTERVALO_STATUS = 7_000\nconst INTERVALO_COMPLETO = 60_000',
    'const RELEASE_KEY = "santa-luzia:release-visto"\nconst ULTIMA_COMPLETA_KEY = "santa-luzia:ultima-sincronizacao-completa"\nconst INTERVALO_STATUS = 60_000\nconst INTERVALO_COMPLETO = 15 * 60_000',
  ],
  [
    '    let ultimaCompleta = 0',
    '    let ultimaCompleta = Number(lerLocal(ULTIMA_COMPLETA_KEY) || 0)',
  ],
  [
    '        const precisaCompleta =\n          forcarRevalidacao ||\n          primeiraSincronizacao ||\n          mudou ||\n          agora - ultimaCompleta >= INTERVALO_COMPLETO',
    '        const precisaCompleta =\n          primeiraSincronizacao ||\n          mudou ||\n          agora - ultimaCompleta >= INTERVALO_COMPLETO',
  ],
  [
    '        if (precisaCompleta) {\n          ultimaCompleta = agora',
    '        if (precisaCompleta) {\n          ultimaCompleta = agora\n          salvarLocal(ULTIMA_COMPLETA_KEY, String(agora))',
  ],
  [
    '          mudou ||\n          forcarRevalidacao ||\n          primeiraSincronizacao ||',
    '          mudou ||\n          primeiraSincronizacao ||',
  ],
  [
    '      void sincronizar(Date.now() - ultima > 15_000)',
    '      void sincronizar(Date.now() - ultima > INTERVALO_STATUS)',
  ],
])

patch('components/native-notification-runtime.tsx', [
  ['const INTERVALO_NOTIFICACOES = 60_000', 'const INTERVALO_NOTIFICACOES = 2 * 60_000'],
])

patch('components/notification-center.tsx', [
  ['    refreshInterval: 60_000,', '    refreshInterval: 2 * 60_000,'],
  ['    dedupingInterval: 2_000,', '    dedupingInterval: 30_000,'],
])

patch('components/pull-to-refresh.tsx', [
  [
    '        router.refresh()\n        await mutate((key) => typeof key === "string" && key.startsWith("/api/"), undefined, { revalidate: true })',
    '        window.dispatchEvent(new CustomEvent("santa-luzia:manual-sync"))\n        router.refresh()\n        await mutate((key) => typeof key === "string" && key.startsWith("/api/"), undefined, { revalidate: true })',
  ],
])

patch('components/server-sync-runtime.tsx', [
  [
    '    window.addEventListener("online", aoVoltarInternet)\n    window.addEventListener("offline", aoPerderInternet)\n    document.addEventListener("visibilitychange", aoVisibilidade)',
    '    const aoSincronizacaoManual = () => { void sincronizar(true) }\n\n    window.addEventListener("online", aoVoltarInternet)\n    window.addEventListener("offline", aoPerderInternet)\n    window.addEventListener("santa-luzia:manual-sync", aoSincronizacaoManual)\n    document.addEventListener("visibilitychange", aoVisibilidade)',
  ],
  [
    '      window.removeEventListener("online", aoVoltarInternet)\n      window.removeEventListener("offline", aoPerderInternet)\n      document.removeEventListener("visibilitychange", aoVisibilidade)',
    '      window.removeEventListener("online", aoVoltarInternet)\n      window.removeEventListener("offline", aoPerderInternet)\n      window.removeEventListener("santa-luzia:manual-sync", aoSincronizacaoManual)\n      document.removeEventListener("visibilitychange", aoVisibilidade)',
  ],
])

console.log('Dia 6 aplicado: polling reduzido, sync completa espaçada e eventos imediatos preservados.')
