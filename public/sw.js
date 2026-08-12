const CACHE = "santa-luzia-offline-v13"
const CORE = ["/liturgia", "/visitante", "/api/liturgia-local"]

self.addEventListener("install", (event) => {
  self.skipWaiting()
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE)
    for (const url of CORE) {
      try {
        const response = await fetch(url, { cache: "no-store" })
        if (response.ok) await cache.put(url, response.clone())
      } catch {}
    }
  })())
})

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((key) => key.startsWith("santa-luzia-offline-") && key !== CACHE).map((key) => caches.delete(key)))
    await self.clients.claim()
  })())
})

self.addEventListener("fetch", (event) => {
  const request = event.request
  if (request.method !== "GET") return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (url.pathname === "/api/liturgia-local" || url.pathname === "/api/liturgia") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE)
      try {
        const response = await fetch(request)
        if (response.ok) await cache.put("/api/liturgia-local", response.clone())
        return response
      } catch {
        return (await cache.match("/api/liturgia-local")) || new Response(JSON.stringify({ erro: "Liturgia offline ainda não sincronizada neste aparelho.", offline: true, quizDisponivel: false }), { status: 503, headers: { "Content-Type": "application/json" } })
      }
    })())
    return
  }

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE)
      try {
        const response = await fetch(request)
        if (response.ok && ["/liturgia", "/visitante"].includes(url.pathname)) await cache.put(url.pathname, response.clone())
        return response
      } catch {
        return (await cache.match(url.pathname)) || (await cache.match("/liturgia")) || Response.error()
      }
    })())
    return
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || /\.(?:css|js|woff2?|png|svg|ico)$/.test(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE)
      const cached = await cache.match(request)
      if (cached) return cached
      try {
        const response = await fetch(request)
        if (response.ok) await cache.put(request, response.clone())
        return response
      } catch {
        return Response.error()
      }
    })())
  }
})
