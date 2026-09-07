import { useCallback, useMemo, useSyncExternalStore } from "react"

const ROUTE_EVENT = "santa-luzia:local-route"
let routeTransitionSequence = 0
let firstSettleFrame: number | null = null
let secondSettleFrame: number | null = null

function notify() {
  window.dispatchEvent(new Event(ROUTE_EVENT))
}

function hrefOf(value: string | URL) {
  return typeof value === "string" ? value : `${value.pathname}${value.search}${value.hash}`
}

function cancelPendingSettle() {
  if (firstSettleFrame !== null) cancelAnimationFrame(firstSettleFrame)
  if (secondSettleFrame !== null) cancelAnimationFrame(secondSettleFrame)
  firstSettleFrame = null
  secondSettleFrame = null
}

function resetScroll() {
  try { window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior }) } catch { window.scrollTo(0, 0) }
  try {
    const scrolling = document.scrollingElement
    if (scrolling) { scrolling.scrollTop = 0; scrolling.scrollLeft = 0 }
  } catch {}
}

function settleScroll(url: URL) {
  if (url.hash) {
    try {
      const id = decodeURIComponent(url.hash.slice(1))
      document.getElementById(id)?.scrollIntoView({ block: "start" })
    } catch {}
    return
  }
  resetScroll()
}

function locationTarget() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`
}

export function navigate(value: string | URL, replace = false) {
  const href = hrefOf(value)
  const url = new URL(href, window.location.href)
  if (url.origin !== window.location.origin) {
    window.location.href = url.toString()
    return
  }

  const target = `${url.pathname}${url.search}${url.hash}`
  const current = locationTarget()
  if (!replace && target === current) return

  // Cada navegação ganha uma transação própria. Se o usuário tocar rapidamente em
  // duas ou mais abas, callbacks antigos não podem encerrar a transição da rota nova.
  const transitionId = ++routeTransitionSequence
  cancelPendingSettle()
  document.documentElement.dataset.slRouteTransition = "running"
  document.documentElement.dataset.slRouteTransitionId = String(transitionId)
  document.documentElement.dataset.slRouteTransitionSince = String(Date.now())
  window.dispatchEvent(new CustomEvent("santa-luzia:route-start", { detail: { target, transitionId } }))
  if (!url.hash) resetScroll()

  if (replace) history.replaceState(history.state, "", target)
  else history.pushState(history.state, "", target)
  notify()

  // Mantém somente a última intenção de navegação como dona do settle. Isso elimina
  // o race em que um toque anterior marcava a tela como pronta depois de outro toque.
  firstSettleFrame = requestAnimationFrame(() => {
    firstSettleFrame = null
    if (transitionId !== routeTransitionSequence || locationTarget() !== target) return
    settleScroll(url)
    secondSettleFrame = requestAnimationFrame(() => {
      secondSettleFrame = null
      if (transitionId !== routeTransitionSequence || locationTarget() !== target) return
      settleScroll(url)
      document.documentElement.dataset.slRouteTransition = "settled"
      window.dispatchEvent(new CustomEvent("santa-luzia:route-settled", { detail: { target, transitionId } }))
    })
  })
}

function subscribe(callback: () => void) {
  window.addEventListener("popstate", callback)
  window.addEventListener(ROUTE_EVENT, callback)
  return () => {
    window.removeEventListener("popstate", callback)
    window.removeEventListener(ROUTE_EVENT, callback)
  }
}

function pathnameSnapshot() { return window.location.pathname || "/" }
function searchSnapshot() { return window.location.search || "" }

export function usePathname() { return useSyncExternalStore(subscribe, pathnameSnapshot, () => "/") }
export function useSearchParams() {
  const search = useSyncExternalStore(subscribe, searchSnapshot, () => "")
  return new URLSearchParams(search)
}

export function useRouter() {
  const refresh = useCallback(() => {
    window.dispatchEvent(new Event("santa-luzia:server-sync"))
    notify()
  }, [])

  return useMemo(() => ({
    push: (href: string) => navigate(href, false),
    replace: (href: string) => navigate(href, true),
    back: () => history.back(),
    forward: () => history.forward(),
    refresh,
    prefetch: async (_href: string) => undefined,
  }), [refresh])
}

export function redirect(href: string): never {
  navigate(href, true)
  throw new Error("NEXT_REDIRECT_LOCAL")
}

export function notFound(): never {
  navigate("/visitante", true)
  throw new Error("NEXT_NOT_FOUND_LOCAL")
}
