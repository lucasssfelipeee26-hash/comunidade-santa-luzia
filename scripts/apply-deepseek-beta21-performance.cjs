const fs = require("node:fs")
const path = require("node:path")

const root = path.resolve(__dirname, "..")
const file = (rel) => path.join(root, rel)
const read = (rel) => fs.readFileSync(file(rel), "utf8")
const write = (rel, value) => fs.writeFileSync(file(rel), value)

function replaceOrFail(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`[deepseek-performance] ponto não encontrado: ${label}`)
  return source.replace(from, to)
}

function patchRanking() {
  const rel = "components/ranking-interativo.tsx"
  let s = read(rel)
  if (s.includes('data-ranking-windowed="true"')) return

  s = replaceOrFail(
    s,
    'import { memo, useEffect, useMemo, useRef, useState } from "react"',
    'import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"',
    "useCallback no ranking",
  )

  const posicao = `function Posicao({ valor }: { valor: number }) {\n  return <span className={\`flex h-9 min-w-9 items-center justify-center gap-1 rounded-xl px-2 text-xs font-bold \${valor <= 3 ? "bg-primary/10 text-primary" : "bg-secondary text-primary"}\`}>{valor === 1 ? <Crown className="size-3.5" /> : valor <= 3 ? <Medal className="size-3.5" /> : null}<span>{valor}º</span></span>\n}\n`
  const posicaoNova = `function Posicao({ valor }: { valor: number }) {\n  return <span data-icon="ranking-position" className={\`flex h-9 min-w-9 items-center justify-center gap-1 rounded-xl px-2 text-xs font-bold \${valor <= 3 ? "bg-primary/10 text-primary" : "bg-secondary text-primary"}\`}>{valor === 1 ? <Crown className="size-3.5" aria-hidden="true" /> : valor <= 3 ? <Medal className="size-3.5" aria-hidden="true" /> : null}<span>{valor}º</span></span>\n}\n\nconst RankingRow = memo(function RankingRow({ linha, atual }: { linha: RankingLinha; atual: boolean }) {\n  return (\n    <div\n      data-ranking-row="memo"\n      className={\`sl-ranking-row-windowed flex items-center gap-2.5 rounded-2xl border p-2.5 shadow-sm \${atual ? "border-primary/25 bg-primary/[.03]" : "border-border bg-white/85"}\`}\n    >\n      <Posicao valor={linha.posicao} />\n      <Avatar className="size-9 shrink-0"><AvatarImage src={linha.foto || undefined} /><AvatarFallback className="bg-primary/8 text-[9px] font-bold text-primary">{iniciais(linha.nome)}</AvatarFallback></Avatar>\n      <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{linha.nome}</p><p className="truncate text-[9px] text-muted-foreground">{linha.funcao || "Participante"} · {linha.quizzesRespondidos} quiz(es) · {linha.aproveitamento}%</p></div>\n      <div className="shrink-0 text-right"><strong className="text-base text-primary">{linha.pontos}</strong><p className="text-[8px] text-muted-foreground">pts</p></div>\n    </div>\n  )\n})\n`
  s = replaceOrFail(s, posicao, posicaoNova, "linha memoizada do ranking")

  s = replaceOrFail(
    s,
    '  const [direcaoAba, setDirecaoAba] = useState(1)\n  const tentativaAtiva = useRef(false)',
    '  const [direcaoAba, setDirecaoAba] = useState(1)\n  const [limiteRanking, setLimiteRanking] = useState(20)\n  const tentativaAtiva = useRef(false)',
    "janela progressiva do ranking",
  )

  s = replaceOrFail(
    s,
    '  const top3 = useMemo(() => ranking.slice(0, 3), [ranking])\n  const restantes = useMemo(() => ranking.slice(3), [ranking])\n  const classeAba = `mt-3 sl-ranking-tab-content ${direcaoAba < 0 ? "sl-ranking-tab-content--reverse" : ""}`\n\n  function trocarAba(proxima: string) {\n    const ordem = ["hoje", "missao", "classificacao", "avulsos"]\n    setDirecaoAba(ordem.indexOf(proxima) >= ordem.indexOf(abaAtiva) ? 1 : -1)\n    setAbaAtiva(proxima)\n  }',
    '  const top3 = useMemo(() => ranking.slice(0, 3), [ranking])\n  const restantes = useMemo(() => ranking.slice(3), [ranking])\n  const restantesVisiveis = useMemo(() => restantes.slice(0, limiteRanking), [limiteRanking, restantes])\n  const classeAba = `mt-3 sl-ranking-tab-content ${direcaoAba < 0 ? "sl-ranking-tab-content--reverse" : ""}`\n\n  const trocarAba = useCallback((proxima: string) => {\n    const ordem = ["hoje", "missao", "classificacao", "avulsos"]\n    setDirecaoAba(ordem.indexOf(proxima) >= ordem.indexOf(abaAtiva) ? 1 : -1)\n    setAbaAtiva(proxima)\n  }, [abaAtiva])\n\n  const carregarMaisRanking = useCallback(() => {\n    setLimiteRanking((atual) => Math.min(atual + 20, restantes.length))\n  }, [restantes.length])',
    "memoização e paginação progressiva",
  )

  s = replaceOrFail(
    s,
    '<div className="mt-3 space-y-1.5">{restantes.map((l) => <div key={l.usuarioId} className={`flex items-center gap-2.5 rounded-2xl border p-2.5 shadow-sm ${l.usuarioId === dados.eu.id ? "border-primary/25 bg-primary/[.03]" : "border-border bg-white/85"}`}><Posicao valor={l.posicao} /><Avatar className="size-9 shrink-0"><AvatarImage src={l.foto || undefined} /><AvatarFallback className="bg-primary/8 text-[9px] font-bold text-primary">{iniciais(l.nome)}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{l.nome}</p><p className="truncate text-[9px] text-muted-foreground">{l.funcao || "Participante"} · {l.quizzesRespondidos} quiz(es) · {l.aproveitamento}%</p></div><div className="shrink-0 text-right"><strong className="text-base text-primary">{l.pontos}</strong><p className="text-[8px] text-muted-foreground">pts</p></div></div>)}</div>',
    '<div className="mt-3 space-y-1.5" data-ranking-windowed="true">{restantesVisiveis.map((l) => <RankingRow key={l.usuarioId} linha={l} atual={l.usuarioId === dados.eu.id} />)}</div>\n              {limiteRanking < restantes.length && <Button type="button" size="sm" variant="outline" className="mt-3 w-full" onClick={carregarMaisRanking}>Carregar mais 20 participantes</Button>}',
    "lista progressiva do ranking",
  )

  write(rel, s)
}

function patchTrophy() {
  const rel = "components/ranking-trophy.tsx"
  let s = read(rel)
  if (s.includes('data-icon="ranking-trophy"')) return
  s = replaceOrFail(
    s,
    '      data-ranking-trophy-react="true"\n      data-rank={rank}',
    '      data-ranking-trophy-react="true"\n      data-icon="ranking-trophy"\n      data-rank={rank}',
    "marcador do ícone de troféu",
  )
  write(rel, s)
}

function patchLoginForm() {
  const rel = "components/login-form.tsx"
  let s = read(rel)
  if (s.includes('data-login-layout-stable="true"')) return
  s = replaceOrFail(
    s,
    '<form onSubmit={handleSubmit} className="space-y-5" data-login-standard-icon="true">',
    '<form onSubmit={handleSubmit} className="sl-login-form space-y-5" data-login-standard-icon="true" data-login-layout-stable="true">',
    "marcador de layout estável",
  )
  s = replaceOrFail(
    s,
    '      {erro && <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm text-destructive"><AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><span>{erro}</span></div>}',
    '      <div className="min-h-[50px]" aria-live="polite" data-login-error-slot="stable">{erro ? <div role="alert" className="flex min-h-[50px] items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm text-destructive"><AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><span>{erro}</span></div> : <span className="sr-only">Nenhum erro de autenticação.</span>}</div>',
    "slot de erro estável",
  )
  write(rel, s)
}

function patchAuthShell() {
  const rel = "components/auth-shell.tsx"
  let s = read(rel)
  if (s.includes('data-auth-layout-stable="true"')) return
  s = replaceOrFail(
    s,
    '<main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white px-4 py-10 text-foreground sm:py-14">',
    '<main data-auth-layout-stable="true" className="sl-auth-shell relative flex h-[100svh] min-h-[100svh] items-center justify-center overflow-x-hidden overflow-y-auto overscroll-none bg-white px-4 py-6 text-foreground sm:py-10">',
    "shell de autenticação estável",
  )
  s = replaceOrFail(
    s,
    '<div className="relative w-full max-w-md">',
    '<div className="sl-auth-card relative w-full max-w-md">',
    "card de autenticação",
  )
  write(rel, s)
}

function patchCss() {
  const rel = "app/globals.css"
  let s = read(rel)
  if (s.includes("BETA 21 — PERFORMANCE DEEPSEEK")) return
  s += `\n\n/* ==========================================================\n   BETA 21 — PERFORMANCE DEEPSEEK\n   Ranking progressivo, layout de login estável e primeira\n   pintura sem salto de elementos exclusivos da Web.\n   ========================================================== */\n.sl-ranking-row-windowed {\n  content-visibility: auto;\n  contain: layout paint style;\n  contain-intrinsic-size: 64px;\n}\n.sl-auth-shell {\n  contain: layout paint;\n  overflow-anchor: none;\n  scrollbar-gutter: stable;\n}\n.sl-auth-card {\n  contain: layout style;\n  min-height: min(700px, calc(100svh - 32px));\n}\n.sl-login-form {\n  contain: layout style;\n}\nhtml[data-native-platform="android"] [data-web-download-only] {\n  display: none !important;\n}\n@media (prefers-reduced-motion: reduce) {\n  .sl-ranking-row-windowed { content-visibility: auto; }\n}\n`
  write(rel, s)
}

function patchBlackBox() {
  const rel = "android-web/motion/android-blackbox-beta21.js"
  let s = read(rel)
  if (s.includes("const MAX_EVENTS = 200;") && s.includes("function flushPersist()")) return
  s = replaceOrFail(s, "  const MAX_EVENTS = 500;", "  const MAX_EVENTS = 200;", "limite da caixa-preta")
  s = replaceOrFail(
    s,
    '  function persist() {\n    try { localStorage.setItem(EVENTS_KEY, JSON.stringify({ version: VERSION, updatedAt: Date.now(), runId, events: events.slice(-MAX_EVENTS) })); } catch {}\n  }',
    '  let persistScheduled = false;\n  function flushPersist() {\n    persistScheduled = false;\n    try { localStorage.setItem(EVENTS_KEY, JSON.stringify({ version: VERSION, updatedAt: Date.now(), runId, events: events.slice(-MAX_EVENTS) })); } catch {}\n  }\n  function persist() {\n    if (persistScheduled) return;\n    persistScheduled = true;\n    const run = () => flushPersist();\n    if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(run, { timeout: 1200 });\n    else window.setTimeout(run, 250);\n  }',
    "persistência ociosa da caixa-preta",
  )
  s = replaceOrFail(
    s,
    '  const heartbeat = window.setInterval(() => writeRuntime(false), 5000);',
    '  const heartbeat = window.setInterval(() => writeRuntime(false), 10000);',
    "heartbeat reduzido",
  )
  s = replaceOrFail(
    s,
    '  function cleanShutdown(kind) {\n    record("runtime-shutdown", "info", { kind }, "Encerramento do runtime observado.");\n    writeRuntime(true);\n  }',
    '  function cleanShutdown(kind) {\n    record("runtime-shutdown", "info", { kind }, "Encerramento do runtime observado.");\n    flushPersist();\n    writeRuntime(true);\n  }',
    "flush no encerramento",
  )
  write(rel, s)
}

function patchAuditorIconLogic() {
  const rel = "android-web/motion/android-auditor-beta12.js"
  let s = read(rel)
  if (s.includes("const visibleLinks = links.filter")) return
  s = replaceOrFail(
    s,
    '    return Boolean(element?.querySelector?.("svg,[data-prayer-person-icon],.sl-r10-profile-icon,.sl-r6-clock,.sl-r8-native-clock,.sl-r13-native-clock"));',
    '    return Boolean(element?.querySelector?.("svg,[data-icon],[data-ranking-trophy-react],[data-prayer-person-icon],.sl-r10-profile-icon,.sl-r6-clock,.sl-r8-native-clock,.sl-r13-native-clock"));',
    "detecção de ícones React",
  )
  s = replaceOrFail(
    s,
    '      const links = [...document.querySelectorAll(`a[href="${href}"]`)];\n      for (const link of links) {\n        if (!(link instanceof HTMLElement) || link.offsetParent === null) continue;\n        if (!hasVisualIcon(link)) missing.push(href);\n      }',
    '      const links = [...document.querySelectorAll(`a[href="${href}"]`)];\n      const visibleLinks = links.filter((link) => link instanceof HTMLElement && link.offsetParent !== null);\n      if (visibleLinks.length && !visibleLinks.some((link) => hasVisualIcon(link))) missing.push(href);',
    "auditoria por rota em vez de cada link",
  )
  write(rel, s)
}

patchRanking()
patchTrophy()
patchLoginForm()
patchAuthShell()
patchCss()
patchBlackBox()
patchAuditorIconLogic()

for (const [rel, marker] of [
  ["components/ranking-interativo.tsx", 'data-ranking-windowed="true"'],
  ["components/ranking-trophy.tsx", 'data-icon="ranking-trophy"'],
  ["components/login-form.tsx", 'data-login-layout-stable="true"'],
  ["components/auth-shell.tsx", 'data-auth-layout-stable="true"'],
  ["android-web/motion/android-blackbox-beta21.js", "const MAX_EVENTS = 200;"],
]) {
  if (!read(rel).includes(marker)) throw new Error(`[deepseek-performance] validação falhou: ${rel} -> ${marker}`)
}

console.log("[deepseek-performance] ranking, login, ícones e caixa-preta otimizados.")
