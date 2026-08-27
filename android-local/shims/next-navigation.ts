import { useCallback, useSyncExternalStore } from "react"

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

export function navigate(value: string | URL, replace = false) {
  const href = hrefOf(value)
  const url = new URL(href, window.location.href)
  if (url.origin !== window.location.origin) {
    window.location.href = url.toString()
    return
  }

  const target = `${url.pathname}${url.search}${url.hash}`
  document.documentElement.dataset.slRouteTransition = "running"
  document.documentElement.dataset.slRouteTransitionSince = String(Date.now())
  resetScroll()

  if (replace) history.replaceState(history.state, "", target)
  else history.pushState(history.state, "", target)
  notify()

  // O React local troca a rota no mesmo WebView. Reforçamos o topo depois do
  // commit para impedir que a tela nova herde a posição/altura da tela anterior.
  requestAnimationFrame(() => {
    resetScroll()
    requestAnimationFrame(() => {
      resetScroll()
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
  return {
    push: (href: string) => navigate(href, false),
    replace: (href: string) => navigate(href, true),
    back: () => history.back(),
    forward: () => history.forward(),
    refresh,
    prefetch: async (_href: string) => undefined,
  }
}

export function redirect(href: string): never {
  navigate(href, true)
  throw new Error("NEXT_REDIRECT_LOCAL")
}

export function notFound(): never {
  navigate("/visitante", true)
  throw new Error("NEXT_NOT_FOUND_LOCAL")
}
