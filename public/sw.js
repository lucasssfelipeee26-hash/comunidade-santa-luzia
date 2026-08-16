const CACHE = "santa-luzia-offline-v22"
const PRIVATE_CACHE = "santa-luzia-private-v3"
const ACERVO_BASE = "/offline/iliturgia/"
const LITURGIA_COMPLETA_BASE = "/offline/liturgia-completa/"
const PRIVATE_PAGES = new Set([
  "/",
  "/area-restrita",
  "/area-restrita/membro",
  "/area-restrita/moderador",
  "/area-restrita/perfis",
  "/area-restrita/ranking",
  "/area-restrita/atrasos",
  "/formacao",
])
const PUBLIC_OFFLINE_PAGES = ["/liturgia", "/visitante", "/escala", "/biblioteca"]
const ACERVO = [
  `${ACERVO_BASE}manifest.json`,
  `${ACERVO_BASE}indice-liturgico-2026.json`,
  `${ACERVO_BASE}catequeses.html.json.gz`,
  `${ACERVO_BASE}comentarios.html.json.gz`,
  ...Array.from({ length: 12 }, (_, i) => `${ACERVO_BASE}evangelhos-${String(i + 1).padStart(2, "0")}.html.json.gz`),
  `${ACERVO_BASE}gerais.html.json.gz`,
  `${ACERVO_BASE}lecionario.html.json.gz`,
  `${ACERVO_BASE}missal.html.json.gz`,
  ...Array.from({ length: 10 }, (_, i) => `${ACERVO_BASE}oficio-${String(i + 1).padStart(2, "0")}.html.json.gz`),
  `${ACERVO_BASE}rosario.html.json.gz`,
  `${ACERVO_BASE}salterio.html.json.gz`,
]
const LITURGIA_COMPLETA = Array.from({ length: 12 }, (_, i) => `${LITURGIA_COMPLETA_BASE}2026-${String(i + 1).padStart(2, "0")}.json`)
const CORE = [
  ...PUBLIC_OFFLINE_PAGES,
  "/api/liturgia-local",
  "/api/escalas",
  "/api/biblioteca",
  "/sounds/notification-santa.wav",
  "/sounds/notification-bells.wav",
  "/sounds/notification-chime.wav",
  "/sounds/notification-soft.wav",
  ...ACERVO,
  ...LITURGIA_COMPLETA,
]

function ehApiPrivadaOffline(pathname) {
  return pathname === "/api/auth/me" ||
    pathname === "/api/perfil" ||
    pathname === "/api/perfis" ||
    pathname === "/api/formacoes" ||
    pathname === "/api/ranking" ||
    pathname === "/api/notificacoes" ||
    pathname === "/api/membros" ||
    pathname === "/api/equipe" ||
    /^\/api\/perfis\/[^/]+$/.test(pathname) ||
    /^\/api\/membros\/[^/]+$/.test(pathname)
}

async function buscarEReter(cache, request, chave) {
  try {
    const response = await fetch(request)
    if (response.ok) await cache.put(chave, response.clone())
    return response
  } catch {
    return (await cache.match(chave)) || Response.error()
  }
}

async function cachearRecursosPagina(response) {
  try {
    const html = await response.text()
    const recursos = new Set()
    for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
      const valor = match[1]
      if (valor.startsWith("/_next/static/") || valor.startsWith("/icons/") || /\.(?:css|js|woff2?)($|\?)/.test(valor)) recursos.add(valor)
    }
    if (!recursos.size) return
    const cache = await caches.open(CACHE)
    for (const recurso of recursos) {
      try {
        const request = new Request(new URL(recurso, self.location.origin).toString(), { method: "GET", credentials: "include", cache: "no-store" })
        const asset = await fetch(request)
        if (asset.ok) await cache.put(recurso, asset.clone())
      } catch {}
    }
  } catch {}
}

async function aquecerCachePrivado() {
  try {
    const cache = await caches.open(PRIVATE_CACHE)
    const origem = self.location.origin
    const authRequest = new Request(`${origem}/api/auth/me`, { method: "GET", credentials: "include", cache: "no-store", headers: { Accept: "application/json" } })
    const authResponse = await fetch(authRequest)
    if (!authResponse.ok) return
    const authClone = authResponse.clone()
    const auth = await authResponse.json().catch(() => null)
    if (!auth?.sessao?.usuario?.id || !auth?.sessao?.tipo) return
    await cache.put("/api/auth/me", authClone)

    const usuarioId = String(auth.sessao.usuario.id)
    const moderador = auth.sessao.tipo === "moderador"
    const paginaPrincipal = moderador ? "/area-restrita/moderador" : "/area-restrita/membro"
    const paginas = [paginaPrincipal, "/area-restrita/perfis", "/formacao", "/area-restrita/ranking", "/area-restrita/atrasos"]
    const comuns = ["/api/perfil", "/api/perfis", "/api/formacoes", "/api/ranking", "/api/notificacoes"]
    const apis = moderador ? ["/api/membros", "/api/equipe", ...comuns] : [`/api/membros/${encodeURIComponent(usuarioId)}`, ...comuns]

    for (const pathname of paginas) {
      try {
        const request = new Request(`${origem}${pathname}`, { method: "GET", credentials: "include", cache: "no-store", headers: { Accept: "text/html,application/xhtml+xml" } })
        const response = await fetch(request)
        if (!response.ok || new URL(response.url).pathname !== pathname) continue
        const recursos = response.clone()
        await cache.put(pathname, response.clone())
        if (pathname === paginaPrincipal) {
          await cache.put("/area-restrita", response.clone())
          await cache.put("/", response.clone())
        }
        await cachearRecursosPagina(recursos)
      } catch {}
    }

    for (const pathname of apis) {
      try {
        const request = new Request(`${origem}${pathname}`, { method: "GET", credentials: "include", cache: "no-store", headers: { Accept: "application/json" } })
        const response = await fetch(request)
        if (response.ok) await cache.put(pathname, response.clone())
      } catch {}
    }
  } catch {}
}

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
    await Promise.all(keys.filter((key) =>
      (key.startsWith("santa-luzia-offline-") && key !== CACHE) ||
      (key.startsWith("santa-luzia-private-") && key !== PRIVATE_CACHE)
    ).map((key) => caches.delete(key)))
    await self.clients.claim()
  })())
})

self.addEventListener("message", (event) => {
  if (event.data?.tipo === "LIMPAR_CACHE_PRIVADO") {
    event.waitUntil(caches.delete(PRIVATE_CACHE))
    return
  }
  if (event.data?.tipo === "AQUECER_CACHE_PRIVADO") event.waitUntil(aquecerCachePrivado())
})

self.addEventListener("fetch", (event) => {
  const request = event.request
  if (request.method !== "GET") return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (url.pathname.startsWith(ACERVO_BASE) || url.pathname.startsWith(LITURGIA_COMPLETA_BASE)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE)
      const cached = await cache.match(request)
      if (cached) return cached
      try {
        const response = await fetch(request)
        if (response.ok) await cache.put(request, response.clone())
        return response
      } catch { return Response.error() }
    })())
    return
  }

  if (url.pathname === "/api/liturgia-local" || url.pathname === "/api/liturgia") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE)
      try {
        const response = await fetch(request)
        if (response.ok) await cache.put("/api/liturgia-local", response.clone())
        return response
      } catch {
        try {
          const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Cuiaba", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date())
          const mapa = Object.fromEntries(partes.map((parte) => [parte.type, parte.value]))
          const dataIso = `${mapa.year}-${mapa.month}-${mapa.day}`
          const pacoteResponse = await cache.match(`${LITURGIA_COMPLETA_BASE}${mapa.year}-${mapa.month}.json`)
          if (pacoteResponse) {
            const pacote = await pacoteResponse.json()
            const dia = pacote?.dias?.[dataIso]
            const temTexto = Boolean(dia?.leituras?.primeiraLeitura?.some((item) => item?.texto) && dia?.leituras?.evangelho?.some((item) => item?.texto))
            if (dia) return new Response(JSON.stringify({ ...dia, dataIso, origem: "offline", offline: true, quizDisponivel: temTexto, fonte: { nome: "Acervo Litúrgico Santa Luzia" } }), { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } })
          }
        } catch {}
        return (await cache.match("/api/liturgia-local")) || new Response(JSON.stringify({ erro: "Liturgia offline ainda não sincronizada neste aparelho.", offline: true, quizDisponivel: false }), { status: 503, headers: { "Content-Type": "application/json" } })
      }
    })())
    return
  }

  if (url.pathname === "/api/escalas" || url.pathname === "/api/biblioteca") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE)
      try {
        const response = await fetch(request)
        if (response.ok) await cache.put(url.pathname, response.clone())
        return response
      } catch {
        return (await cache.match(url.pathname)) || new Response(JSON.stringify({ ok: false, erro: "Conteúdo ainda não sincronizado neste aparelho.", offline: true }), { status: 503, headers: { "Content-Type": "application/json" } })
      }
    })())
    return
  }

  if (ehApiPrivadaOffline(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(PRIVATE_CACHE)
      return buscarEReter(cache, request, url.pathname)
    })())
    return
  }

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE)
      const privateCache = await caches.open(PRIVATE_CACHE)
      const paginaPrivadaOffline = PRIVATE_PAGES.has(url.pathname)
      try {
        const response = await fetch(request)
        if (response.ok && PUBLIC_OFFLINE_PAGES.includes(url.pathname)) await cache.put(url.pathname, response.clone())
        if (response.ok && paginaPrivadaOffline && new URL(response.url).pathname === url.pathname) await privateCache.put(url.pathname, response.clone())
        return response
      } catch {
        if (paginaPrivadaOffline) {
          const privada = await privateCache.match(url.pathname)
          if (privada) return privada
        }
        return (await cache.match(url.pathname)) || (await cache.match("/liturgia")) || Response.error()
      }
    })())
    return
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || /\.(?:css|js|woff2?|png|jpg|jpeg|gif|webp|svg|ico)$/.test(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE)
      const cached = await cache.match(request)
      if (cached) return cached
      try {
        const response = await fetch(request)
        if (response.ok) await cache.put(request, response.clone())
        return response
      } catch { return Response.error() }
    })())
  }
})
