const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const p = (rel) => path.join(root, rel)
const read = (rel) => fs.readFileSync(p(rel), 'utf8')
const write = (rel, value) => fs.writeFileSync(p(rel), value)

function mustReplace(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`[beta21-final] ponto não encontrado: ${label}`)
  return source.replace(from, to)
}

function patchAndroidEntry() {
  const rel = 'android-local/entry.tsx'
  let s = read(rel)
  if (!s.includes('useAuthSession') || !s.includes('data-auth-ranking-session-shared')) {
    if (!s.includes('import { useAuthSession } from "@/components/auth-session-runtime"')) {
      s = mustReplace(
        s,
        'import { AppRuntime } from "@/components/app-runtime"\n',
        'import { AppRuntime } from "@/components/app-runtime"\nimport { useAuthSession } from "@/components/auth-session-runtime"\n',
        'import useAuthSession',
      )
    }

    const oldBlock = `type AuthMe = { sessao: null | { tipo: "membro" | "moderador"; usuario: { id: string; nome: string } } }\nfunction RankingRoute() {\n  const store = useGuard()\n  const [usuario, setUsuario] = useState<{ id: string; nome: string; tipo: "membro" | "moderador" } | null>(null)\n  useEffect(() => {\n    if (!store.sessao) return\n    let ativo = true\n    void fetch("/api/auth/me", { cache: "no-store", credentials: "same-origin" }).then(r => r.json()).then((j: AuthMe) => { if (ativo && j?.sessao?.usuario?.id) setUsuario({ ...j.sessao.usuario, tipo: j.sessao.tipo }) }).catch(() => {})\n    return () => { ativo = false }\n  }, [store.sessao])\n  if (!store.sessao || !usuario) return <Loading texto="Abrindo Jornada Litúrgica…" />\n  return <RankingInterativo usuarioInicial={usuario} />\n}`

    const newBlock = `function RankingRoute() {\n  const store = useGuard()\n  const { liveSession } = useAuthSession()\n  const usuario = liveSession?.usuario?.id\n    ? { id: liveSession.usuario.id, nome: liveSession.usuario.nome, tipo: liveSession.tipo }\n    : null\n  if (!store.sessao || !usuario) return <Loading texto="Abrindo Jornada Litúrgica…" />\n  return <div data-auth-ranking-session-shared="true"><RankingInterativo usuarioInicial={usuario} /></div>\n}`

    s = mustReplace(s, oldBlock, newBlock, 'RankingRoute sem fetch duplicado')
    write(rel, s)
  }
}

function patchWarmup() {
  const rel = 'android-web/motion/android-original-ui-beta10.js'
  let s = read(rel)

  // O warmup já consulta /api/auth/me antes de percorrer COMMON_APIS.
  // Mantê-lo também no array causava uma segunda consulta desnecessária.
  s = s.replace('    "/api/auth/me",\n', '')

  if (!s.includes('beta21IdleInitialWarm')) {
    s = s.replace('  setTimeout(() => void warm(false), 800);\n', '')
    s = s.replace('  setTimeout(() => void warm(false), 3500);\n', `  function beta21IdleInitialWarm() {\n    const run = () => {\n      if (document.visibilityState === "visible") void warm(false);\n    };\n    if (typeof window.requestIdleCallback === "function") {\n      window.requestIdleCallback(run, { timeout: 4500 });\n    } else {\n      setTimeout(run, 3000);\n    }\n  }\n  beta21IdleInitialWarm();\n`)
  }

  write(rel, s)
}

function assertAuthInFlightOnly() {
  const s = read('lib/auth-client.ts')
  if (!s.includes('let authMeInFlight: { generation: number; promise: Promise<unknown> } | null = null')) {
    throw new Error('[beta21-final] coalescência auth/me em voo não encontrada')
  }
  if (!s.includes('let authGeneration = 0') || !s.includes('authMeInFlight?.generation === generation')) {
    throw new Error('[beta21-final] geração global de auth/me não aplicada')
  }
  if (s.includes('AUTH_ME_RECENT_MS') || s.includes('authMeRecent')) {
    throw new Error('[beta21-final] cache resolvido de auth/me não deve voltar')
  }
}

function patchStructuralAudit() {
  const rel = 'scripts/auditar-beta20-estrutural.cjs'
  let s = read(rel)
  const old = 'ok(authClientFinal.includes("AUTH_ME_RECENT_MS = 5_000"), "janela compartilhada de deduplicação auth/me ampliada")'
  const next = `ok(authClientFinal.includes("authGeneration") && authClientFinal.includes("authMeInFlight") && !authClientFinal.includes("AUTH_ME_RECENT_MS"), "auth/me compartilha somente a requisição em voo, sem cache resolvido")\nconst nativeFetchFinal = read("android-web/motion/android-native-fetch-beta10.js")\nok(nativeFetchFinal.includes('AUTH_ME_PATH = "/api/auth/me"') && nativeFetchFinal.includes("key === AUTH_ME_PATH"), "ponte nativa mantém auth/me coalescido até a chamada terminar")\nok(nativeFetchFinal.includes("nativeRequestWithAbort") && nativeFetchFinal.includes('new DOMException("The operation was aborted.", "AbortError")'), "ponte nativa encerra fetch sinalizado imediatamente como AbortError")\nconst notificationRuntimeFinal = read("components/native-notification-runtime.tsx")\nok(notificationRuntimeFinal.includes('App.addListener("appStateChange"') && notificationRuntimeFinal.includes("pausarSincronizacaoNotificacoes") && notificationRuntimeFinal.includes("retomarSincronizacaoNotificacoes"), "notificações acompanham lifecycle nativo background/resume")\nok(notificationRuntimeFinal.includes("geracaoSincronizacao") && notificationRuntimeFinal.includes("sincronizacaoAtiva?.controller.abort()") && notificationRuntimeFinal.includes("obsoleta()"), "notificações abortam e ignoram resultados obsoletos após background")`
  if (s.includes(old)) s = s.replace(old, next)
  if (!s.includes('auth/me compartilha somente a requisição em voo')) throw new Error('[beta21-final] auditoria auth in-flight não atualizada')
  if (!s.includes('notificações acompanham lifecycle nativo background/resume')) throw new Error('[beta21-final] auditoria lifecycle de notificações ausente')
  write(rel, s)
}

patchAndroidEntry()
patchWarmup()
assertAuthInFlightOnly()
patchStructuralAudit()

console.log('[beta21-final] auth/me em voo e lifecycle de notificações preservados.')
