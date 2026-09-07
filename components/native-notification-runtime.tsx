"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { androidNotificationConfig } from "@/lib/android-notifications"
import { loadSoundPreferences } from "@/lib/sound-preferences"
import { enfileirarNotificacaoLida, salvarNotificacoesCache, ultimoUsuarioNotificacoes } from "@/lib/local-notification-cache"

type NotificacaoServidor = {
  id: string
  titulo: string
  mensagem: string
  href: string
  lida_em: number | null
}

type RespostaNotificacoes = {
  autenticado?: boolean
  usuario?: { id?: string }
  notificacoes?: NotificacaoServidor[]
}

const CHAVE_EXIBIDAS = "santa-luzia:notificacoes-nativas-exibidas:v2"
const CHAVE_PERMISSAO = "santa-luzia:notificacoes-permissao-solicitada:v1"
const TIMEOUT_NOTIFICACOES = 6_500
const INTERVALO_NOTIFICACOES = 2 * 60_000
const MIN_GAP_NOTIFICACOES = 45_000
const STARTUP_GRACE_NOTIFICACOES = 2_500

function idNumerico(texto: string) {
  let hash = 2166136261
  for (let i = 0; i < texto.length; i += 1) hash = Math.imul(hash ^ texto.charCodeAt(i), 16777619)
  return Math.abs(hash | 0) || 1
}

function lerExibidas() {
  try {
    const lista = JSON.parse(localStorage.getItem(CHAVE_EXIBIDAS) || "[]")
    return new Set<string>(Array.isArray(lista) ? lista.map(String) : [])
  } catch {
    return new Set<string>()
  }
}

function salvarExibidas(exibidas: Set<string>) {
  try {
    localStorage.setItem(CHAVE_EXIBIDAS, JSON.stringify([...exibidas].slice(-250)))
  } catch {}
}

async function fetchComTimeout(input: RequestInfo | URL, init: RequestInit = {}, controller = new AbortController()) {
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_NOTIFICACOES)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    window.clearTimeout(timer)
  }
}

export function NativeNotificationRuntime() {
  const router = useRouter()

  useEffect(() => {
    let cancelado = false
    let removerListener: (() => Promise<void>) | undefined
    let timer: number | undefined
    let initialTimer: number | undefined
    let canalPreparado = ""
    let ultimaSincronizacao = 0
    const startupGraceUntil = Date.now() + STARTUP_GRACE_NOTIFICACOES
    let usuarioAtualId = ultimoUsuarioNotificacoes()
    let pausado = document.visibilityState !== "visible"
    let geracaoSincronizacao = 0
    let sincronizacaoAtiva: { geracao: number; controller: AbortController } | null = null

    async function iniciar() {
      try {
        const [{ Capacitor }, { LocalNotifications }, { App }] = await Promise.all([
          import("@capacitor/core"),
          import("@capacitor/local-notifications"),
          import("@capacitor/app"),
        ])
        if (!Capacitor.isNativePlatform() || cancelado) return

        const handle = await LocalNotifications.addListener("localNotificationActionPerformed", ({ notification }) => {
          const notificacaoId = notification.extra?.notificacaoId
          if (typeof notificacaoId === "string") {
            const ownerId = usuarioAtualId || ultimoUsuarioNotificacoes()
            void fetchComTimeout("/api/notificacoes", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "same-origin",
              body: JSON.stringify({ id: notificacaoId }),
            })
              .then((resposta) => {
                if (!resposta.ok && ownerId) enfileirarNotificacaoLida(ownerId, notificacaoId)
                window.dispatchEvent(new CustomEvent("santa-luzia:notificacoes-atualizadas"))
              })
              .catch(() => { if (ownerId) enfileirarNotificacaoLida(ownerId, notificacaoId) })
          }
          const rota = notification.extra?.rota
          if (typeof rota === "string" && rota.startsWith("/")) {
            router.push(rota)
            router.refresh()
          }
        })
        if (cancelado) {
          await handle.remove()
          return
        }
        removerListener = () => handle.remove()

        function pausarSincronizacaoNotificacoes() {
          if (pausado) return
          pausado = true
          geracaoSincronizacao += 1
          const ativa = sincronizacaoAtiva
          sincronizacaoAtiva = null
          ativa?.controller.abort()
        }

        function retomarSincronizacaoNotificacoes() {
          const estavaPausado = pausado
          pausado = false
          if (!estavaPausado || cancelado) return
          geracaoSincronizacao += 1
          void sincronizar(true)
        }

        async function sincronizar(forcar = false) {
          const agora = Date.now()
          if (cancelado || pausado || sincronizacaoAtiva || !navigator.onLine) return
          if (!forcar && (agora < startupGraceUntil || agora - ultimaSincronizacao < MIN_GAP_NOTIFICACOES)) return
          ultimaSincronizacao = agora

          const token = { geracao: geracaoSincronizacao, controller: new AbortController() }
          sincronizacaoAtiva = token
          const obsoleta = () => cancelado || pausado || token.geracao !== geracaoSincronizacao

          try {
            const resposta = await fetchComTimeout(
              "/api/notificacoes",
              { cache: "no-store", credentials: "same-origin" },
              token.controller,
            )
            if (obsoleta() || !resposta.ok) return
            const dados = await resposta.json() as RespostaNotificacoes
            if (obsoleta() || !dados.autenticado || !dados.usuario?.id) return
            usuarioAtualId = String(dados.usuario.id)
            await salvarNotificacoesCache(usuarioAtualId, dados.notificacoes || [], (dados.notificacoes || []).filter((n) => !n.lida_em).length)
            if (obsoleta()) return

            let permissao = await LocalNotifications.checkPermissions()
            if (obsoleta()) return
            if (permissao.display !== "granted" && !localStorage.getItem(CHAVE_PERMISSAO)) {
              localStorage.setItem(CHAVE_PERMISSAO, "1")
              permissao = await LocalNotifications.requestPermissions()
            }
            if (obsoleta() || permissao.display !== "granted") return

            const prefs = loadSoundPreferences(dados.usuario.id)
            const config = androidNotificationConfig(prefs)
            if (Capacitor.getPlatform() === "android" && canalPreparado !== config.channelId) {
              await LocalNotifications.createChannel({
                id: config.channelId,
                name: config.channelName,
                description: "Jornada Litúrgica, ranking, quizzes, escalas e avisos da equipe.",
                ...(config.sound ? { sound: config.sound } : {}),
                importance: prefs.notificationSound === "none" ? 3 : 4,
                vibration: config.vibration,
                lights: true,
                lightColor: "#D4AF37",
              })
              canalPreparado = config.channelId
            }
            if (obsoleta()) return

            const exibidas = lerExibidas()
            const novas = (dados.notificacoes || [])
              .filter((n) => !n.lida_em && !exibidas.has(n.id))
              .slice(0, 8)
            if (!novas.length) return

            await LocalNotifications.schedule({
              notifications: novas.map((n) => ({
                id: idNumerico(n.id),
                title: n.titulo,
                body: n.mensagem,
                channelId: config.channelId,
                ...(config.sound ? { sound: config.sound } : {}),
                extra: { rota: n.href, notificacaoId: n.id },
              })),
            })
            if (obsoleta()) return
            novas.forEach((n) => exibidas.add(n.id))
            salvarExibidas(exibidas)
            window.dispatchEvent(new CustomEvent("santa-luzia:notificacoes-atualizadas"))
          } catch (error) {
            const nome = String((error as { name?: string } | null)?.name || "")
            if (nome === "AbortError" || obsoleta()) return
            console.warn("[Santa Luzia] Falha ao sincronizar notificações nativas.", error)
          } finally {
            if (sincronizacaoAtiva === token) sincronizacaoAtiva = null
          }
        }

        const aoSincronizarServidor = () => void sincronizar()
        const aoVisibilidade = () => {
          if (document.visibilityState === "visible") retomarSincronizacaoNotificacoes()
          else pausarSincronizacaoNotificacoes()
        }
        const aoOnline = () => void sincronizar()
        const appStateHandle = await App.addListener("appStateChange", ({ isActive }) => {
          if (isActive) retomarSincronizacaoNotificacoes()
          else pausarSincronizacaoNotificacoes()
        })
        if (cancelado) {
          await appStateHandle.remove()
          if (removerListener) await removerListener()
          return
        }

        window.addEventListener("santa-luzia:server-sync", aoSincronizarServidor)
        window.addEventListener("online", aoOnline)
        document.addEventListener("visibilitychange", aoVisibilidade)
        initialTimer = window.setTimeout(() => void sincronizar(true), STARTUP_GRACE_NOTIFICACOES)
        timer = window.setInterval(() => void sincronizar(), INTERVALO_NOTIFICACOES)

        const removerBase = removerListener
        removerListener = async () => {
          window.removeEventListener("santa-luzia:server-sync", aoSincronizarServidor)
          window.removeEventListener("online", aoOnline)
          document.removeEventListener("visibilitychange", aoVisibilidade)
          if (timer) window.clearInterval(timer)
          if (initialTimer) window.clearTimeout(initialTimer)
          geracaoSincronizacao += 1
          sincronizacaoAtiva?.controller.abort()
          sincronizacaoAtiva = null
          await appStateHandle.remove()
          if (removerBase) await removerBase()
        }
      } catch (error) {
        console.warn("[Santa Luzia] Notificações nativas indisponíveis neste ambiente.", error)
      }
    }

    void iniciar()
    return () => {
      cancelado = true
      geracaoSincronizacao += 1
      sincronizacaoAtiva?.controller.abort()
      sincronizacaoAtiva = null
      if (timer) window.clearInterval(timer)
      if (initialTimer) window.clearTimeout(initialTimer)
      if (removerListener) void removerListener()
    }
  }, [router])

  return null
}
