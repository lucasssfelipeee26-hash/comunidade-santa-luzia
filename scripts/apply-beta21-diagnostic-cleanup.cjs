const fs = require("node:fs")
const path = require("node:path")

const root = path.resolve(__dirname, "..")
const file = (rel) => path.join(root, rel)
const read = (rel) => fs.readFileSync(file(rel), "utf8")
const write = (rel, value) => fs.writeFileSync(file(rel), value)

function replaceOrFail(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`[beta21-cleanup] ponto não encontrado: ${label}`)
  return source.replace(from, to)
}

function patchScrollWatchdog() {
  const rel = "android-web/motion/android-scroll-watchdog-beta21.js"
  let s = read(rel)
  if (s.includes("KEYBOARD_MIN_DROP_PX") && s.includes("keyboardLikely")) return

  s = replaceOrFail(
    s,
    "  const RESIZE_DIRECTION_THRESHOLD = 4;\n",
    "  const RESIZE_DIRECTION_THRESHOLD = 4;\n  const KEYBOARD_MIN_DROP_PX = 140;\n  const KEYBOARD_GRACE_MS = 1400;\n",
    "constantes de teclado",
  )

  s = replaceOrFail(
    s,
    "  let observer = null;\n  let resizeState = new WeakMap();\n  const observed = new WeakSet();\n",
    "  let observer = null;\n  let resizeState = new WeakMap();\n  const observed = new WeakSet();\n  let maxVisualViewportHeight = Math.max(Math.round(window.innerHeight || 0), Math.round(window.visualViewport?.height || 0));\n  let keyboardGraceUntil = 0;\n",
    "estado de teclado",
  )

  s = replaceOrFail(
    s,
    "  function clearTimer(timer) {\n    if (timer) window.clearTimeout(timer);\n  }\n",
    `  function activeEditable() {\n    const element = document.activeElement;\n    return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element?.getAttribute?.("contenteditable") === "true";\n  }\n\n  function currentVisualViewportHeight() {\n    return Math.round(window.visualViewport?.height || window.innerHeight || document.documentElement.clientHeight || 0);\n  }\n\n  function keyboardLikely(now = performance.now()) {\n    const current = currentVisualViewportHeight();\n    if (current > maxVisualViewportHeight) maxVisualViewportHeight = current;\n    const dropped = maxVisualViewportHeight - current >= KEYBOARD_MIN_DROP_PX;\n    return now < keyboardGraceUntil || (activeEditable() && dropped);\n  }\n\n  function noteViewportChange() {\n    const now = performance.now();\n    const current = currentVisualViewportHeight();\n    if (current > maxVisualViewportHeight) maxVisualViewportHeight = current;\n    if (activeEditable() && maxVisualViewportHeight - current >= KEYBOARD_MIN_DROP_PX) {\n      keyboardGraceUntil = now + KEYBOARD_GRACE_MS;\n      resetTransientBuckets();\n      lastSample = { ...geometry(), at: now };\n    }\n  }\n\n  function clearTimer(timer) {\n    if (timer) window.clearTimeout(timer);\n  }\n`,
    "detecção do teclado Android",
  )

  s = replaceOrFail(
    s,
    "  function flush(kind) {\n",
    "  function flush(kind) {\n    if (keyboardLikely()) { resetTransientBuckets(); return; }\n",
    "ignorar buckets do teclado",
  )

  s = replaceOrFail(
    s,
    "    const current = geometry();\n    const routeNow = currentRoute();\n\n    if (routeNow !== lastRoute) {",
    "    const current = geometry();\n    const routeNow = currentRoute();\n\n    if (keyboardLikely(now)) {\n      resetTransientBuckets();\n      lastSample = { ...current, at: now };\n      return;\n    }\n\n    if (routeNow !== lastRoute) {",
    "amostragem ignora teclado",
  )

  s = replaceOrFail(
    s,
    "      const now = performance.now();\n      if (document.visibilityState !== \"visible\" || now < routeGraceUntil) return;\n",
    "      const now = performance.now();\n      if (document.visibilityState !== \"visible\" || now < routeGraceUntil || keyboardLikely(now)) return;\n",
    "ResizeObserver ignora teclado",
  )

  s = replaceOrFail(
    s,
    "  const interval = window.setInterval(sample, SAMPLE_MS);\n",
    `  window.visualViewport?.addEventListener("resize", noteViewportChange, { passive: true });\n  document.addEventListener("focusin", () => { window.setTimeout(noteViewportChange, 40); }, true);\n  document.addEventListener("focusout", () => { keyboardGraceUntil = performance.now() + 500; lastSample = geometry(); }, true);\n\n  const interval = window.setInterval(sample, SAMPLE_MS);\n`,
    "listeners do teclado",
  )

  write(rel, s)
}

function patchAuditor() {
  const rel = "android-web/motion/android-auditor-beta12.js"
  let s = read(rel)
  if (!s.includes('"/api/quizzes": ["santa-luzia:offline:v1:quizzes"]')) {
    s = replaceOrFail(
      s,
      '  const LOCAL_FALLBACKS = {\n    "/api/ranking": ["santa-luzia:offline:v1:ranking"],',
      '  const LOCAL_FALLBACKS = {\n    "/api/quizzes": ["santa-luzia:offline:v1:quizzes"],\n    "/api/ranking": ["santa-luzia:offline:v1:ranking"],',
      "fallback offline de quizzes",
    )
  }

  if (!s.includes("auditorPersistScheduled")) {
    s = replaceOrFail(
      s,
      '  function persist() {\n    try {\n      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, updatedAt: Date.now(), events: events.slice(-MAX_EVENTS) }));\n    } catch {}\n  }',
      '  let auditorPersistScheduled = false;\n  function flushPersist() {\n    auditorPersistScheduled = false;\n    try {\n      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, updatedAt: Date.now(), events: events.slice(-MAX_EVENTS) }));\n    } catch {}\n  }\n  function persist() {\n    if (auditorPersistScheduled) return;\n    auditorPersistScheduled = true;\n    const run = () => flushPersist();\n    if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(run, { timeout: 1200 });\n    else window.setTimeout(run, 220);\n  }',
      "persistência ociosa do auditor",
    )
  }

  if (!s.includes("iconScopedLinks")) {
    s = replaceOrFail(
      s,
      '      const visibleLinks = links.filter((link) => link instanceof HTMLElement && link.offsetParent !== null);\n      if (visibleLinks.length && !visibleLinks.some((link) => hasVisualIcon(link))) missing.push(href);',
      '      const visibleLinks = links.filter((link) => link instanceof HTMLElement && link.offsetParent !== null);\n      const iconScopedLinks = visibleLinks.filter((link) => link.closest("nav,[role=\\"navigation\\"],.mobile-app-bottom-nav,.app-nav-panel,.app-mobile-menu-layer,[data-icon-audit-scope=\\"true\\"]"));\n      if (iconScopedLinks.length && !iconScopedLinks.some((link) => hasVisualIcon(link))) missing.push(href);',
      "escopo correto da auditoria de ícones",
    )
  }

  s = s.replace(
    '  setTimeout(() => { auditIcons(); measureFps(1200); void databaseHealth(); }, 1200);',
    '  setTimeout(() => { auditIcons(); measureFps(1200); void databaseHealth(); }, 2200);',
  )

  if (!s.includes('window.addEventListener("pagehide", flushPersist')) {
    s = replaceOrFail(
      s,
      '  add("auditor-ready", "info", { version: VERSION, mode: "online-offline" });',
      '  window.addEventListener("pagehide", flushPersist);\n  add("auditor-ready", "info", { version: VERSION, mode: "online-offline" });',
      "flush do auditor no encerramento",
    )
  }

  write(rel, s)
}

function patchOfflineData() {
  const rel = "lib/offline-data.ts"
  let s = read(rel)
  if (!s.includes('QUIZZES_KEY = "santa-luzia:offline:v1:quizzes"')) {
    s = replaceOrFail(
      s,
      'const RANKING_KEY = "santa-luzia:offline:v1:ranking"\n',
      'const RANKING_KEY = "santa-luzia:offline:v1:ranking"\nconst QUIZZES_KEY = "santa-luzia:offline:v1:quizzes"\n',
      "chave offline de quizzes",
    )
    s = replaceOrFail(
      s,
      '    window.localStorage.removeItem(RANKING_KEY)\n',
      '    window.localStorage.removeItem(RANKING_KEY)\n    window.localStorage.removeItem(QUIZZES_KEY)\n',
      "limpeza do cache de quizzes",
    )
  }
  write(rel, s)
}

function patchOfflineSnapshot() {
  const rel = "components/android-offline-snapshot-runtime.tsx"
  let s = read(rel)
  if (s.includes('snapshot:quizzes') && s.includes('/api/quizzes')) return

  s = replaceOrFail(
    s,
    '          ["snapshot:ranking", snapshot.ranking ?? { ranking: [], membros: [], ocorrencias: [] }],\n          ["snapshot:escalas", snapshot.escalas ?? { escalas: [] }],',
    '          ["snapshot:ranking", snapshot.ranking ?? { ranking: [], membros: [], ocorrencias: [] }],\n          ["snapshot:quizzes", snapshot.quizzes ?? { quizzes: [] }],\n          ["snapshot:escalas", snapshot.escalas ?? { escalas: [] }],',
    "documento nativo de quizzes",
  )

  s = replaceOrFail(
    s,
    '      removerLocal(SNAPSHOT_REVISION_KEY)\n      removerLocal(SNAPSHOT_USER_KEY)',
    '      removerLocal(SNAPSHOT_REVISION_KEY)\n      removerLocal(SNAPSHOT_USER_KEY)\n      removerLocal("santa-luzia:offline:v1:quizzes")',
    "limpeza snapshot quizzes",
  )

  s = replaceOrFail(
    s,
    '        const [ranking, biblioteca] = await Promise.all([\n          jsonComTimeout("/api/ranking"),\n          jsonComTimeout("/api/biblioteca"),\n        ])',
    '        const [ranking, biblioteca, quizzes] = await Promise.all([\n          jsonComTimeout("/api/ranking"),\n          jsonComTimeout("/api/biblioteca"),\n          jsonComTimeout("/api/quizzes"),\n        ])',
    "coleta de quizzes no snapshot",
  )

  s = replaceOrFail(
    s,
    '          escalas: escalas || { escalas: [] },\n          biblioteca: biblioteca || { livros: [] },',
    '          escalas: escalas || { escalas: [] },\n          quizzes: quizzes || { quizzes: [] },\n          biblioteca: biblioteca || { livros: [] },',
    "quizzes no snapshot",
  )

  s = replaceOrFail(
    s,
    '        await salvarSnapshotPersistente(snapshot)\n        if (revisaoDados) salvarLocal(SNAPSHOT_REVISION_KEY, revisaoDados)',
    '        await salvarSnapshotPersistente(snapshot)\n        salvarLocal("santa-luzia:offline:v1:quizzes", JSON.stringify({ atualizadoEm: Date.now(), dados: quizzes || { quizzes: [] } }))\n        if (revisaoDados) salvarLocal(SNAPSHOT_REVISION_KEY, revisaoDados)',
    "cache local de quizzes",
  )

  write(rel, s)
}

function patchQuizOffline() {
  const rel = "android-web/motion/android-quiz-offline-beta10.js"
  let s = read(rel)
  if (s.includes("QUIZZES_CACHE_KEY") && s.includes("cachedQuizList")) return

  s = replaceOrFail(
    s,
    '  const DONE_PREFIX = "santa-luzia:beta10:quiz-done:";\n',
    '  const DONE_PREFIX = "santa-luzia:beta10:quiz-done:";\n  const QUIZZES_CACHE_KEY = "santa-luzia:offline:v1:quizzes";\n',
    "chave lista quizzes",
  )

  s = replaceOrFail(
    s,
    '  function options(correct, others, rotate) {',
    '  function cachedQuizList() {\n    try {\n      const envelope = JSON.parse(localStorage.getItem(QUIZZES_CACHE_KEY) || "null");\n      return envelope?.dados || null;\n    } catch { return null; }\n  }\n  function options(correct, others, rotate) {',
    "leitura do cache de quizzes",
  )

  s = replaceOrFail(
    s,
    '    if (!connected && method === "GET" && parsed.pathname === "/api/quizzes/liturgia") return localQuiz();',
    '    if (!connected && method === "GET" && parsed.pathname === "/api/quizzes") {\n      const cached = cachedQuizList();\n      return cached ? json({ ...cached, offline: true }) : json({ quizzes: [], offline: true, indisponivel: true }, 503);\n    }\n    if (!connected && method === "GET" && parsed.pathname === "/api/quizzes/liturgia") return localQuiz();',
    "fallback offline da lista de quizzes",
  )

  s = replaceOrFail(
    s,
    '    const response = await previousFetch(input, init);\n    // Quizzes avulsos não carregam a chave de correção no cliente.',
    '    const response = await previousFetch(input, init);\n    if (connected && method === "GET" && parsed.pathname === "/api/quizzes" && response.ok) {\n      void response.clone().json().then((payload) => {\n        try { localStorage.setItem(QUIZZES_CACHE_KEY, JSON.stringify({ atualizadoEm: Date.now(), dados: payload })); } catch {}\n      }).catch(() => undefined);\n    }\n    // Quizzes avulsos não carregam a chave de correção no cliente.',
    "atualização online do cache quizzes",
  )

  write(rel, s)
}

function patchAuthClient() {
  const rel = "lib/auth-client.ts"
  let s = read(rel)
  if (s.includes("AUTH_ME_RECENT_MS") && s.includes("authMeRecent")) return

  s = replaceOrFail(
    s,
    'let authMeInFlight: Promise<unknown> | null = null\n',
    'let authMeInFlight: Promise<unknown> | null = null\nlet authMeRecent: { at: number; value: unknown } | null = null\nconst AUTH_ME_RECENT_MS = 1_200\n',
    "cache curto auth/me",
  )

  s = replaceOrFail(
    s,
    '  if (path === "/api/auth/me" && method === "GET") {\n    if (authMeInFlight) return authMeInFlight\n    authMeInFlight = requestJson(path, init).finally(() => { authMeInFlight = null })\n    return authMeInFlight\n  }\n  return requestJson(path, init)',
    '  if (path === "/api/auth/me" && method === "GET") {\n    const recent = authMeRecent\n    if (recent && Date.now() - recent.at <= AUTH_ME_RECENT_MS) return recent.value\n    if (authMeInFlight) return authMeInFlight\n    authMeInFlight = requestJson(path, init)\n      .then((value) => { authMeRecent = { at: Date.now(), value }; return value })\n      .finally(() => { authMeInFlight = null })\n    return authMeInFlight\n  }\n  if (path.startsWith("/api/auth/") && method !== "GET") authMeRecent = null\n  return requestJson(path, init)',
    "deduplicação auth/me",
  )

  write(rel, s)
}

function patchNativeNotifications() {
  const rel = "components/native-notification-runtime.tsx"
  let s = read(rel)
  if (s.includes("MIN_GAP_NOTIFICACOES") && s.includes("startupGraceUntil")) return

  s = replaceOrFail(
    s,
    'const INTERVALO_NOTIFICACOES = 2 * 60_000\n',
    'const INTERVALO_NOTIFICACOES = 2 * 60_000\nconst MIN_GAP_NOTIFICACOES = 45_000\nconst STARTUP_GRACE_NOTIFICACOES = 2_500\n',
    "intervalos de notificações",
  )

  s = replaceOrFail(
    s,
    '    let timer: number | undefined\n    let canalPreparado = ""',
    '    let timer: number | undefined\n    let initialTimer: number | undefined\n    let canalPreparado = ""\n    let ultimaSincronizacao = 0\n    const startupGraceUntil = Date.now() + STARTUP_GRACE_NOTIFICACOES',
    "estado de deduplicação notificações",
  )

  s = replaceOrFail(
    s,
    '        async function sincronizar() {\n          if (cancelado || sincronizando || !navigator.onLine) return\n          sincronizando = true',
    '        async function sincronizar(forcar = false) {\n          const agora = Date.now()\n          if (cancelado || sincronizando || !navigator.onLine) return\n          if (!forcar && (agora < startupGraceUntil || agora - ultimaSincronizacao < MIN_GAP_NOTIFICACOES)) return\n          ultimaSincronizacao = agora\n          sincronizando = true',
    "throttle notificações",
  )

  s = replaceOrFail(
    s,
    '        void sincronizar()\n        timer = window.setInterval(() => void sincronizar(), INTERVALO_NOTIFICACOES)',
    '        initialTimer = window.setTimeout(() => void sincronizar(true), STARTUP_GRACE_NOTIFICACOES)\n        timer = window.setInterval(() => void sincronizar(), INTERVALO_NOTIFICACOES)',
    "sync inicial adiada",
  )

  s = replaceOrFail(
    s,
    '          if (timer) window.clearInterval(timer)\n          if (removerBase) await removerBase()',
    '          if (timer) window.clearInterval(timer)\n          if (initialTimer) window.clearTimeout(initialTimer)\n          if (removerBase) await removerBase()',
    "limpeza timer inicial",
  )

  s = replaceOrFail(
    s,
    '      if (timer) window.clearInterval(timer)\n      if (removerListener) void removerListener()',
    '      if (timer) window.clearInterval(timer)\n      if (initialTimer) window.clearTimeout(initialTimer)\n      if (removerListener) void removerListener()',
    "cleanup externo notificações",
  )

  write(rel, s)
}

patchScrollWatchdog()
patchAuditor()
patchOfflineData()
patchOfflineSnapshot()
patchQuizOffline()
patchAuthClient()
patchNativeNotifications()

const checks = [
  ["android-web/motion/android-scroll-watchdog-beta21.js", "KEYBOARD_MIN_DROP_PX"],
  ["android-web/motion/android-auditor-beta12.js", "auditorPersistScheduled"],
  ["android-web/motion/android-auditor-beta12.js", 'data-icon-audit-scope'],
  ["components/android-offline-snapshot-runtime.tsx", 'snapshot:quizzes'],
  ["android-web/motion/android-quiz-offline-beta10.js", "QUIZZES_CACHE_KEY"],
  ["lib/auth-client.ts", "AUTH_ME_RECENT_MS"],
  ["components/native-notification-runtime.tsx", "MIN_GAP_NOTIFICACOES"],
]
for (const [rel, marker] of checks) {
  if (!read(rel).includes(marker)) throw new Error(`[beta21-cleanup] validação falhou: ${rel} -> ${marker}`)
}

console.log("[beta21-cleanup] teclado, ícones, quizzes offline, auth, notificações e persistência do auditor corrigidos.")
