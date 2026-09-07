const fs = require("node:fs")
const path = require("node:path")

const root = path.resolve(__dirname, "..")

function file(rel) { return path.join(root, rel) }
function read(rel) { return fs.readFileSync(file(rel), "utf8") }
function write(rel, value) { fs.mkdirSync(path.dirname(file(rel)), { recursive: true }); fs.writeFileSync(file(rel), value) }
function replaceOrFail(value, from, to, label) {
  if (!value.includes(from)) throw new Error(`[deepseek-final] ponto não encontrado: ${label}`)
  return value.replace(from, to)
}

function patchAreaMenu() {
  const rel = "components/area-menu.tsx"
  let s = read(rel)
  if (s.includes('data-menu-pruned-beta21="true"')) return
  s = s.replace('  BrainCircuit,\n', '').replace('  Palette,\n', '')
  s = replaceOrFail(s,
    '<nav role="dialog" aria-modal="true" aria-label="Menu da Área Restrita" className=',
    '<nav role="dialog" aria-modal="true" aria-label="Menu da Área Restrita" data-menu-pruned-beta21="true" className=',
    "marcador do menu")
  for (const line of [
    '    { href: "/area-restrita/ranking", label: "Jornada Litúrgica", curto: "Jornada", icon: <Sparkles className="size-5" />, motion: "quiz" },\n',
    '    { href: "/area-restrita/moderador/ranking", label: "Gerenciar Quizzes", curto: "Quizzes", icon: <BrainCircuit className="size-5" /> },\n',
    '    { href: "/area-restrita/moderador/tema", label: "Cores do Site", curto: "Cores", icon: <Palette className="size-5" /> },\n',
  ]) s = s.replaceAll(line, "")
  write(rel, s)
}

function writeRankingTrophy() {
  const rel = "components/ranking-trophy.tsx"
  const source = `"use client"\n\nimport { memo, useMemo } from "react"\n\ntype Rank = 1 | 2 | 3\n\nconst VISUAL: Record<Rank, { main: string; light: string; dark: string; label: string }> = {\n  1: { main: "#d4af37", light: "#f7dc7a", dark: "#8a6b20", label: "Troféu de 1º lugar" },\n  2: { main: "#c7c9cf", light: "#f1f2f5", dark: "#777b84", label: "Troféu de 2º lugar" },\n  3: { main: "#c98247", light: "#efb27f", dark: "#81502d", label: "Troféu de 3º lugar" },\n}\n\nexport const RankingTrophy = memo(function RankingTrophy({ rank }: { rank: Rank }) {\n  const visual = useMemo(() => VISUAL[rank], [rank])\n  const gradientId = \`sl-ranking-trophy-\${rank}\`\n\n  return (\n    <span\n      className={\`sl-ranking-trophy sl-ranking-trophy--\${rank}\`}\n      data-ranking-trophy-react="true"\n      data-rank={rank}\n      role="img"\n      aria-label={visual.label}\n    >\n      <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">\n        <defs>\n          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">\n            <stop offset="0" stopColor={visual.light} />\n            <stop offset=".48" stopColor={visual.main} />\n            <stop offset="1" stopColor={visual.dark} />\n          </linearGradient>\n        </defs>\n        <g fill={\`url(#\${gradientId})\`}>\n          <path d="M18 8h28v8c0 13-5 22-11 26v7h7v5H22v-5h7v-7c-6-4-11-13-11-26z" />\n          <path d="M18 13H9v7c0 9 5 15 12 17v-6c-4-2-6-6-6-11v-1h3zm28 0h9v7c0 9-5 15-12 17v-6c4-2 6-6 6-11v-1h-3z" />\n          <rect x="17" y="54" width="30" height="5" rx="2.5" />\n        </g>\n        <path d="M25 13h14c-1 10-3 17-7 21-4-4-6-11-7-21z" fill={visual.light} opacity=".3" />\n      </svg>\n    </span>\n  )\n})\n\nRankingTrophy.displayName = "RankingTrophy"\n`
  if (!fs.existsSync(file(rel)) || !read(rel).includes("data-ranking-trophy-react")) write(rel, source)
}

function patchRanking() {
  const rel = "components/ranking-interativo.tsx"
  let s = read(rel)
  if (s.includes("ultimaCargaRanking") && s.includes("sl-ranking-tab-content")) return
  s = replaceOrFail(s, 'import { useEffect, useRef, useState } from "react"', 'import { memo, useEffect, useMemo, useRef, useState } from "react"', "imports ranking")
  s = replaceOrFail(s, 'import { carregarCacheRanking, salvarCacheRanking } from "@/lib/offline-data"', 'import { carregarCacheRanking, salvarCacheRanking } from "@/lib/offline-data"\nimport { RankingTrophy } from "@/components/ranking-trophy"', "import troféu")
  const oldPodio = `function Podio({ linha, destaque }: { linha: RankingLinha; destaque?: boolean }) {\n  return (\n    <div className={\`relative min-w-0 rounded-[22px] border bg-white p-3 text-center shadow-sm \${destaque ? "border-[#c8ad69]/60 sm:-translate-y-2" : "border-border"}\`}>\n      <span className={\`absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full px-2 py-0.5 text-[9px] font-black \${linha.posicao === 1 ? "bg-[#bfa66a] text-[#342b20]" : "bg-primary/10 text-primary"}\`}>{linha.posicao}º</span>\n      <Avatar className={\`\${destaque ? "size-16" : "size-13"} mx-auto mt-1 border-2 border-white shadow-md\`}><AvatarImage src={linha.foto || undefined} /><AvatarFallback className="bg-primary/8 text-xs font-bold text-primary">{iniciais(linha.nome)}</AvatarFallback></Avatar>\n      <p className="mt-2 truncate font-serif text-sm font-semibold text-foreground">{linha.nome}</p>\n      <p className="truncate text-[9px] text-muted-foreground">{linha.funcao || "Participante"}</p>\n      <p className="mt-1 text-lg font-black text-primary">{linha.pontos}</p><p className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground">pontos</p>\n    </div>\n  )\n}\n`
  const newPodio = `const Podio = memo(function Podio({ linha, destaque }: { linha: RankingLinha; destaque?: boolean }) {\n  const rank = Math.min(3, Math.max(1, linha.posicao)) as 1 | 2 | 3\n  return (\n    <div data-ranking-podium-item="react" data-rank={rank} className={\`relative min-w-0 rounded-[22px] border bg-white p-3 pt-8 text-center shadow-sm \${destaque ? "border-[#c8ad69]/60 sm:-translate-y-2" : "border-border"}\`}>\n      <RankingTrophy rank={rank} />\n      <span className={\`absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full px-2 py-0.5 text-[9px] font-black \${linha.posicao === 1 ? "bg-[#bfa66a] text-[#342b20]" : "bg-primary/10 text-primary"}\`}>{linha.posicao}º</span>\n      <Avatar className={\`\${destaque ? "size-16" : "size-13"} mx-auto mt-1 border-2 border-white shadow-md\`}><AvatarImage src={linha.foto || undefined} /><AvatarFallback className="bg-primary/8 text-xs font-bold text-primary">{iniciais(linha.nome)}</AvatarFallback></Avatar>\n      <p className="mt-2 truncate font-serif text-sm font-semibold text-foreground">{linha.nome}</p>\n      <p className="truncate text-[9px] text-muted-foreground">{linha.funcao || "Participante"}</p>\n      <p className="mt-1 text-lg font-black text-primary">{linha.pontos}</p><p className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground">pontos</p>\n    </div>\n  )\n})\n`
  s = replaceOrFail(s, oldPodio, newPodio, "pódio React")
  s = replaceOrFail(s, '  const [abaAtiva, setAbaAtiva] = useState("hoje")\n  const tentativaAtiva = useRef(false)', '  const [abaAtiva, setAbaAtiva] = useState("hoje")\n  const [direcaoAba, setDirecaoAba] = useState(1)\n  const tentativaAtiva = useRef(false)\n  const ultimaCargaRanking = useRef(0)', "estado abas/ranking")
  s = replaceOrFail(s, '  async function carregarDados() {\n    setErro("")', '  async function carregarDados(forcar = false) {\n    const agora = Date.now()\n    if (!forcar && agora - ultimaCargaRanking.current < 60_000) return\n    ultimaCargaRanking.current = agora\n    setErro("")', "throttle ranking")
  s = s.replace('    void carregarDados()\n', '    void carregarDados(true)\n')
  s = s.replaceAll('await carregarDados()', 'await carregarDados(true)')
  s = replaceOrFail(s,
    '  const isMod = dados.eu.tipo === "moderador"\n  const ranking = dados.ranking || []\n  const euRanking = ranking.find((l) => l.usuarioId === dados.eu.id)\n  const top3 = ranking.slice(0, 3)\n  const restantes = ranking.slice(3)\n',
    '  const isMod = dados.eu.tipo === "moderador"\n  const ranking = useMemo(() => dados.ranking || [], [dados.ranking])\n  const euRanking = useMemo(() => ranking.find((l) => l.usuarioId === dados.eu.id), [dados.eu.id, ranking])\n  const top3 = useMemo(() => ranking.slice(0, 3), [ranking])\n  const restantes = useMemo(() => ranking.slice(3), [ranking])\n  const classeAba = `mt-3 sl-ranking-tab-content ${direcaoAba < 0 ? "sl-ranking-tab-content--reverse" : ""}`\n\n  function trocarAba(proxima: string) {\n    const ordem = ["hoje", "missao", "classificacao", "avulsos"]\n    setDirecaoAba(ordem.indexOf(proxima) >= ordem.indexOf(abaAtiva) ? 1 : -1)\n    setAbaAtiva(proxima)\n  }\n',
    "memoização ranking")
  s = s.replace('<Tabs value={abaAtiva} onValueChange={setAbaAtiva}>', '<Tabs value={abaAtiva} onValueChange={trocarAba}>')
  s = s.replace('<TabsContent value="hoje" className="mt-3">', '<TabsContent value="hoje" className={classeAba}>')
  s = s.replace('<TabsContent value="missao" className="mt-3">', '<TabsContent value="missao" className={classeAba}>')
  s = s.replace('<TabsContent value="classificacao" className="mt-3">', '<TabsContent value="classificacao" className={classeAba}>')
  s = s.replace('<TabsContent value="avulsos" className="mt-3 space-y-2">', '<TabsContent value="avulsos" className={`${classeAba} space-y-2`}>')
  s = s.replace('<section className="rounded-[24px] border border-border bg-white/70 p-3 shadow-sm">', '<section data-ranking-podium="react" className="rounded-[24px] border border-border bg-white/70 p-3 shadow-sm">')
  write(rel, s)
}

function patchCss() {
  const rel = "app/globals.css"
  let s = read(rel)
  if (s.includes("BETA 21 — RANKING/TROFÉUS REACT")) return
  s += `\n\n/* ==========================================================\n   BETA 21 — RANKING/TROFÉUS REACT + TRANSIÇÕES LEVES\n   Sem injeção DOM; anima somente transform/opacity e respeita\n   prefers-reduced-motion.\n   ========================================================== */\n.sl-ranking-trophy { position:relative; display:inline-grid; place-items:center; width:42px; height:42px; margin:0 auto 4px; transform:translateZ(0); will-change:transform,opacity; animation:slTrophyFloat 3.4s ease-in-out infinite; filter:drop-shadow(0 4px 8px rgba(61,34,22,.16)); }\n.sl-ranking-trophy svg { width:100%; height:100%; display:block; }\n.sl-ranking-trophy--1 { --sl-trophy-glow:#f2cf62; animation-duration:3.2s; }\n.sl-ranking-trophy--2 { --sl-trophy-glow:#d7d9df; animation-duration:3.6s; }\n.sl-ranking-trophy--3 { --sl-trophy-glow:#d5955f; animation-duration:4s; }\n.sl-ranking-trophy--1::after { content:""; position:absolute; inset:-4px; z-index:-1; border-radius:999px; background:radial-gradient(circle at 30% 30%,var(--sl-trophy-glow),transparent 70%); opacity:.28; transform:translateZ(0); animation:slTrophyGlow 2.4s ease-in-out infinite; pointer-events:none; }\n@keyframes slTrophyFloat { 0%,100%{transform:translateY(0) scale(1) translateZ(0);opacity:.95} 50%{transform:translateY(-5px) scale(1.035) translateZ(0);opacity:1} }\n@keyframes slTrophyGlow { 0%,100%{transform:scale(1) translateZ(0);opacity:.18} 50%{transform:scale(1.09) translateZ(0);opacity:.42} }\n.sl-ranking-tab-content { transform:translateZ(0); will-change:transform,opacity; animation:slRankingTabEnter 280ms cubic-bezier(.2,.78,.2,1) both; }\n.sl-ranking-tab-content--reverse { animation-name:slRankingTabEnterReverse; }\n@keyframes slRankingTabEnter { from{opacity:0;transform:translateY(10px) translateZ(0)} to{opacity:1;transform:translateY(0) translateZ(0)} }\n@keyframes slRankingTabEnterReverse { from{opacity:0;transform:translateY(-10px) translateZ(0)} to{opacity:1;transform:translateY(0) translateZ(0)} }\n.sl-presencas-stability-zone { min-height:min(46rem,80svh); overflow-anchor:none; }\n@media (prefers-reduced-motion:reduce) { .sl-ranking-trophy,.sl-ranking-trophy--1::after,.sl-ranking-tab-content { animation:none!important; transform:none!important; will-change:auto!important; } }\n`
  write(rel, s)
}

function patchNotifications() {
  const rel = "components/notification-center.tsx"
  let s = read(rel)
  if (s.includes("AbortSignal.timeout(6_000)") && s.includes("dedupingInterval: 60_000")) return
  s = replaceOrFail(s, 'const response = await fetch(url, { cache: "no-store", credentials: "same-origin" })', 'const response = await fetch(url, { cache: "no-store", credentials: "same-origin", signal: AbortSignal.timeout(6_000) })', "timeout notificações")
  s = replaceOrFail(s, '    refreshInterval: 2 * 60_000,\n    revalidateOnFocus: true,\n    revalidateOnReconnect: true,\n    dedupingInterval: 30_000,', '    refreshInterval: 60_000,\n    revalidateOnFocus: false,\n    revalidateOnReconnect: true,\n    dedupingInterval: 60_000,\n    keepPreviousData: true,', "SWR notificações")
  write(rel, s)
}

function patchPresencas() {
  let rel = "components/controle-presencas-formacao.tsx"
  let s = read(rel)
  if (!s.includes("ultimaCargaRef")) {
    s = replaceOrFail(s, 'import { useEffect, useState } from "react"', 'import { useEffect, useRef, useState } from "react"', "useRef presenças")
    s = replaceOrFail(s, '  const [relatorioAberto, setRelatorioAberto] = useState(false)\n\n  async function carregar() {', '  const [relatorioAberto, setRelatorioAberto] = useState(false)\n  const ultimaCargaRef = useRef(0)\n\n  async function carregar(forcar = false) {\n    const agora = Date.now()\n    if (!forcar && agora - ultimaCargaRef.current < 60_000) return\n    ultimaCargaRef.current = agora', "throttle presenças")
    s = replaceOrFail(s, '    void carregar()\n    const sincronizar = () => void carregar()\n    window.addEventListener("santa-luzia:server-sync", sincronizar)\n    return () => window.removeEventListener("santa-luzia:server-sync", sincronizar)', '    void carregar(true)\n    let timer: number | undefined\n    const sincronizar = () => {\n      if (timer) window.clearTimeout(timer)\n      timer = window.setTimeout(() => void carregar(false), 900)\n    }\n    window.addEventListener("santa-luzia:server-sync", sincronizar)\n    return () => {\n      if (timer) window.clearTimeout(timer)\n      window.removeEventListener("santa-luzia:server-sync", sincronizar)\n    }', "debounce presenças")
    s = s.replaceAll('onClick={carregar}', 'onClick={() => void carregar(true)}')
    write(rel, s)
  }

  rel = "components/moderador-presencas-page.tsx"
  s = read(rel)
  if (!s.includes("data-presencas-layout-stable")) {
    s = replaceOrFail(s, '        <ControlePresencasFormacao />', '        <div className="sl-presencas-stability-zone" data-presencas-layout-stable="true">\n          <ControlePresencasFormacao />\n        </div>', "zona estável presenças")
    write(rel, s)
  }
}

function patchAndroidBuild() {
  const rel = "scripts/build-android-local.cjs"
  let s = read(rel)
  if (s.includes("legacyPodium") && s.includes("data-ranking-trophy-react")) return
  s = s.replaceAll('  "android-podium-beta12.js",\n', '')
  s = replaceOrFail(s, 'const scriptTags = requiredScripts.map((file) => `    <script defer src="/motion/${file}"></script>`).join("\\n")', 'const legacyPodium = path.join(out, "motion", "android-podium-beta12.js")\nif (fs.existsSync(legacyPodium)) fs.rmSync(legacyPodium, { force: true })\nconst scriptTags = requiredScripts.map((file) => `    <script defer src="/motion/${file}"></script>`).join("\\n")', "remoção podium legado")
  s = replaceOrFail(s, 'for (const marker of [\n  "android-native-fetch-beta10.js"', 'for (const marker of ["data-ranking-trophy-react", "data-menu-pruned-beta21", "sl-ranking-tab-content"]) if (!outputJs.includes(marker)) fail(`Bundle React Beta 21 sem marcador: ${marker}`)\nfor (const marker of [\n  "android-native-fetch-beta10.js"', "marcadores local-app")
  s = s.replace('console.log(`[android-local] Beta 12 empacotada: ${outputJs.length} bytes JS, ${cssFiles.length} CSS Next; histórico, Auditor, integridade SQLite, performance, scroll estável e pódio incluídos.`)', 'console.log(`[android-local] Beta 21 empacotada: ${outputJs.length} bytes JS, ${cssFiles.length} CSS Next; pódio React, menu saneado, Auditor, integridade SQLite, performance e scroll estável incluídos.`)')
  write(rel, s)
}

function patchPrepare20() {
  const rel = "scripts/prepare-motion-beta20.cjs"
  let s = read(rel)
  if (s.includes("Runtime final ainda contém injetor legado de troféus")) return
  s = replaceOrFail(s, '  "data-escala-history-search", "data-standard-logout", "Deseja sair?", "Sim, sair",', '  "data-escala-history-search", "data-standard-logout", "Deseja sair?", "Sim, sair",\n  "data-ranking-trophy-react", "data-menu-pruned-beta21", "sl-ranking-tab-content",', "marcadores prepare")
  s = replaceOrFail(s, '  "resize-loop-burst",\n  "android-auditor-beta12.js",\n  "android-podium-beta12.js",\n], "Runtime Motion consolidado")', '  "resize-loop-burst",\n  "android-auditor-beta12.js",\n], "Runtime Motion consolidado")\nif (read(consolidated).includes("android-podium-beta12.js")) fail("Runtime final ainda contém injetor legado de troféus.")', "podium consolidado")
  write(rel, s)
}

function patchValidators() {
  let rel = "scripts/validate-android-web.cjs"
  let s = read(rel)
  if (!s.includes("Troféu React")) {
    s = s.replace('  podium: path.join(root, "android-web", "motion", "android-podium-beta12.js"),\n', '')
    s = s.replace('  [required.podium, "pódio atual", "2.0.0-beta.12"],\n', '')
    s = s.replace(/\nrequireMarkers\(required\.podium, "Pódio", \[[^\n]+\]\)\n/, '\n')
    const needle = 'if (parity.includes("function trophyMarkup") || parity.includes("slB11CupFloat")) throw new Error("A camada de compatibilidade voltou a desenhar o troféu antigo.")'
    s = replaceOrFail(s, needle, needle + '\nrequireMarkers(path.join(root, "components", "ranking-trophy.tsx"), "Troféu React", ["data-ranking-trophy-react", "RankingTrophy", "viewBox=\\\"0 0 64 64\\\""])\nif (fs.existsSync(path.join(root, "android-web", "motion", "android-podium-beta12.js"))) throw new Error("Injetor legado android-podium-beta12.js não deve permanecer no pacote Android gerado.")', "validador troféu")
    write(rel, s)
  }

  rel = "scripts/auditar-motion-beta.cjs"
  s = read(rel)
  if (!s.includes("Pódio React atual")) {
    s = replaceOrFail(s, 'requireAll("android-web/motion/android-podium-beta12.js", ["2.0.0-beta.12", ".sl-r5-card-trophy", "viewBox=\\\"0 0 64 64\\\"", "normalizeCard", "valid.slice(1)", ".sl-b11-card-trophy"], "Pódio atual")', 'requireAll("components/ranking-trophy.tsx", ["RankingTrophy", "data-ranking-trophy-react", "viewBox=\\\"0 0 64 64\\\"", "memo", "useMemo"], "Pódio React atual")\nforbid("components/ranking-trophy.tsx", ["dangerouslySetInnerHTML", "MutationObserver", "innerHTML"], "Pódio React não pode voltar à injeção DOM")', "auditoria troféu")
    write(rel, s)
  }

  rel = "scripts/auditar-beta13-historico.cjs"
  s = read(rel)
  if (!s.includes("Pódio React sem injeção duplicada")) {
    s = replaceOrFail(s, 'requireAll("android-web/motion/android-podium-beta12.js", [\n  ".sl-r5-card-trophy",\n  "normalizeCard",\n  "valid.slice(1)",\n  ".sl-b11-card-trophy",\n], "Pódio sem troféu duplicado")', 'requireAll("components/ranking-trophy.tsx", [\n  "RankingTrophy",\n  "data-ranking-trophy-react",\n  "viewBox=\\\"0 0 64 64\\\"",\n  "memo",\n], "Pódio React sem injeção duplicada")', "auditoria histórica troféu")
    write(rel, s)
  }

  rel = "scripts/auditar-beta20-estrutural.cjs"
  s = read(rel)
  if (!s.includes("menu de ferramentas registra saneamento")) {
    const needle = 'ok(!exists("cordova_plugins.js") || !read("cordova_plugins.js").trim(), "nenhum código Cordova ativo no fonte raiz")\n'
    const block = `\nconst menuArea = read("components/area-menu.tsx")\nok(menuArea.includes('data-menu-pruned-beta21="true"'), "menu de ferramentas registra saneamento Beta 21")\nfor (const removido of ['curto: "Jornada"', 'curto: "Quizzes"', 'curto: "Cores"']) ok(!menuArea.includes(removido), \`atalho removido não voltou ao menu: \${removido}\`)\nfor (const mantido of ['curto: "Perfis"', 'curto: "Atrasos"', 'curto: "Escalas"', 'curto: "Formação"', 'curto: "Presenças"', 'curto: "Registro"', 'curto: "Dados"', 'curto: "Diagnóstico"']) ok(menuArea.includes(mantido), \`atalho mantido continua no menu: \${mantido}\`)\nconst trophyReact = read("components/ranking-trophy.tsx")\nok(trophyReact.includes("data-ranking-trophy-react") && trophyReact.includes("RankingTrophy"), "troféus do ranking são renderizados por React")\nok(trophyReact.includes("memo") && trophyReact.includes("useMemo"), "troféu React é memoizado")\nok(!trophyReact.includes("dangerouslySetInnerHTML") && !trophyReact.includes("MutationObserver") && !trophyReact.includes("innerHTML"), "troféu React não usa injeção DOM")\nconst rankingUi = read("components/ranking-interativo.tsx")\nok(rankingUi.includes("sl-ranking-tab-content") && rankingUi.includes("trocarAba"), "abas do ranking usam transição leve controlada")\nok(rankingUi.includes("ultimaCargaRanking") && rankingUi.includes("60_000"), "ranking limita sincronizações repetidas")\nconst notifications = read("components/notification-center.tsx")\nok(notifications.includes("AbortSignal.timeout(6_000)") && notifications.includes("dedupingInterval: 60_000"), "notificações têm timeout e deduplicação de 1 minuto")\nconst presencasUi = read("components/controle-presencas-formacao.tsx")\nok(presencasUi.includes("ultimaCargaRef") && presencasUi.includes("window.setTimeout(() => void carregar(false), 900)"), "presenças desacoplam rajadas de sincronização")\n`
    s = replaceOrFail(s, needle, needle + block, "auditoria estrutural DeepSeek")
    s = s.replace('console.log("Beta 21 aprovada na auditoria estática: regressões visuais, iLiturgia, login/sincronização, caixa-preta, Scroll Watchdog, GET coalescido, ApplicationExitInfo, memória, Perfetto e adaptador Crashlytics presentes.")', 'console.log("Beta 21 aprovada na auditoria estática: menu saneado, troféus React, transições leves, notificações/presenças deduplicadas, iLiturgia, login/sincronização e diagnósticos profundos presentes.")')
    write(rel, s)
  }
}

patchAreaMenu()
writeRankingTrophy()
patchRanking()
patchCss()
patchNotifications()
patchPresencas()
patchAndroidBuild()
patchPrepare20()
patchValidators()

console.log("[deepseek-final] correções finais aplicadas com sucesso.")
