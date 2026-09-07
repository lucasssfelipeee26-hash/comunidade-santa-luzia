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

function patchAuthCacheWindow() {
  const rel = 'lib/auth-client.ts'
  let s = read(rel)
  s = s.replace('const AUTH_ME_RECENT_MS = 1_200', 'const AUTH_ME_RECENT_MS = 5_000')
  if (!s.includes('const AUTH_ME_RECENT_MS = 5_000')) throw new Error('[beta21-final] janela de deduplicação auth/me não aplicada')
  write(rel, s)
}

function patchStructuralAudit() {
  const rel = 'scripts/auditar-beta20-estrutural.cjs'
  let s = read(rel)
  if (s.includes('ranking Android reutiliza sessão central sem novo auth/me')) return
  s += `\n\nconst androidEntryFinal = read("android-local/entry.tsx")\nok(androidEntryFinal.includes('data-auth-ranking-session-shared="true"'), "ranking Android reutiliza sessão central sem novo auth/me")\nok(androidEntryFinal.includes("useAuthSession") && !androidEntryFinal.includes('void fetch("/api/auth/me"'), "ranking Android não dispara fetch direto de auth/me")\nconst originalUiFinal = read("android-web/motion/android-original-ui-beta10.js")\nok(originalUiFinal.includes("beta21IdleInitialWarm"), "warmup inicial pesado foi adiado para período ocioso")\nok(!originalUiFinal.includes('setTimeout(() => void warm(false), 800)'), "warmup de 800 ms não voltou ao startup")\nconst commonBlock = originalUiFinal.slice(originalUiFinal.indexOf("const COMMON_APIS"), originalUiFinal.indexOf("const MODERATOR_APIS"))\nok(!commonBlock.includes('/api/auth/me'), "warmup não consulta auth/me duas vezes")\nconst authClientFinal = read("lib/auth-client.ts")\nok(authClientFinal.includes("AUTH_ME_RECENT_MS = 5_000"), "janela compartilhada de deduplicação auth/me ampliada")\n`
  write(rel, s)
}

patchAndroidEntry()
patchWarmup()
patchAuthCacheWindow()
patchStructuralAudit()

console.log('[beta21-final] auth/me deduplicado e warmup inicial deferido.')
