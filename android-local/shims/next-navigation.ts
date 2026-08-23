import { useCallback, useSyncExternalStore } from "react"

const ROUTE_EVENT = "santa-luzia:local-route"

function notify() {
  window.dispatchEvent(new Event(ROUTE_EVENT))
}

function hrefOf(value: string | URL) {
  return typeof value === "string" ? value : `${value.pathname}${value.search}${value.hash}`
}

export function navigate(value: string | URL, replace = false) {
  const href = hrefOf(value)
  const url = new URL(href, window.location.href)
  if (url.origin !== window.location.origin) {
    window.location.href = url.toString()
    return
  }
  const target = `${url.pathname}${url.search}${url.hash}`
  if (replace) history.replaceState(history.state, "", target)
  else history.pushState(history.state, "", target)
  notify()
  window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior })
}

function subscribe(callback: () => void) {
  window.addEventListener("popstate", callback)
  window.addEventListener(ROUTE_EVENT, callback)
  return () => {
    window.removeEventListener("popstate", callback)
    window.removeEventListener(ROUTE_EVENT, callback)
  }
}

function pathnameSnapshot() {
  return window.location.pathname || "/"
}

function searchSnapshot() {
  return window.location.search || ""
}

export function usePathname() {
  return useSyncExternalStore(subscribe, pathnameSnapshot, () => "/")
}

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
