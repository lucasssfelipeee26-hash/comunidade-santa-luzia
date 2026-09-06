import { useCallback, useMemo, useSyncExternalStore } from "react"

const ROUTE_EVENT = "santa-luzia:local-route"

function notify() {
  window.dispatchEvent(new Event(ROUTE_EVENT))
}

function hrefOf(value: string | URL) {
  return typeof value === "string" ? value : `${value.pathname}${value.search}${value.hash}`
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

export function navigate(value: string | URL, replace = false) {
  const href = hrefOf(value)
  const url = new URL(href, window.location.href)
  if (url.origin !== window.location.origin) {
    window.location.href = url.toString()
    return
  }

  const target = `${url.pathname}${url.search}${url.hash}`
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
  if (!replace && target === current) return

  document.documentElement.dataset.slRouteTransition = "running"
  document.documentElement.dataset.slRouteTransitionSince = String(Date.now())
  window.dispatchEvent(new CustomEvent("santa-luzia:route-start", { detail: { target } }))
  if (!url.hash) resetScroll()

  if (replace) history.replaceState(history.state, "", target)
  else history.pushState(history.state, "", target)
  notify()

  // Mantém a tela nova no mesmo WebView, sem navegação duplicada. O segundo
  // frame garante que layout/âncora já estejam montados antes de encerrar a transição.
  requestAnimationFrame(() => {
    settleScroll(url)
    requestAnimationFrame(() => {
      settleScroll(url)
      document.documentElement.dataset.slRouteTransition = "settled"
      window.dispatchEvent(new CustomEvent("santa-luzia:route-settled", { detail: { target } }))
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
