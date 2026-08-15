"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { androidNotificationConfig } from "@/lib/android-notifications"
import { loadSoundPreferences } from "@/lib/sound-preferences"

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

async function fetchComTimeout(input: RequestInfo | URL, init?: RequestInit) {
  const controller = new AbortController()
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
    let sincronizando = false
    let removerListener: (() => Promise<void>) | undefined
    let timer: number | undefined
    let canalPreparado = ""

    async function iniciar() {
      try {
        const [{ Capacitor }, { LocalNotifications }] = await Promise.all([
          import("@capacitor/core"),
          import("@capacitor/local-notifications"),
        ])
        if (!Capacitor.isNativePlatform() || cancelado) return

        const handle = await LocalNotifications.addListener("localNotificationActionPerformed", ({ notification }) => {
          const notificacaoId = notification.extra?.notificacaoId
          if (typeof notificacaoId === "string") {
            void fetchComTimeout("/api/notificacoes", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: notificacaoId }),
            }).catch(() => undefined)
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

        async function sincronizar() {
          if (cancelado || sincronizando || !navigator.onLine) return
          sincronizando = true
          try {
            const resposta = await fetchComTimeout("/api/notificacoes", { cache: "no-store", credentials: "same-origin" })
            if (!resposta.ok) return
            const dados = await resposta.json() as RespostaNotificacoes
            if (!dados.autenticado || !dados.usuario?.id) return

            let permissao = await LocalNotifications.checkPermissions()
            if (permissao.display !== "granted" && !localStorage.getItem(CHAVE_PERMISSAO)) {
              localStorage.setItem(CHAVE_PERMISSAO, "1")
              permissao = await LocalNotifications.requestPermissions()
            }
            if (permissao.display !== "granted") return

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
            novas.forEach((n) => exibidas.add(n.id))
            salvarExibidas(exibidas)
          } catch (error) {
            console.warn("[Santa Luzia] Falha ao sincronizar notificações nativas.", error)
          } finally {
            sincronizando = false
          }
        }

        const aoSincronizarServidor = () => void sincronizar()
        const aoVisibilidade = () => { if (document.visibilityState === "visible") void sincronizar() }
        const aoOnline = () => void sincronizar()
        window.addEventListener("santa-luzia:server-sync", aoSincronizarServidor)
        window.addEventListener("online", aoOnline)
        document.addEventListener("visibilitychange", aoVisibilidade)
        void sincronizar()
        timer = window.setInterval(() => void sincronizar(), 60_000)

        const removerBase = removerListener
        removerListener = async () => {
          window.removeEventListener("santa-luzia:server-sync", aoSincronizarServidor)
          window.removeEventListener("online", aoOnline)
          document.removeEventListener("visibilitychange", aoVisibilidade)
          if (timer) window.clearInterval(timer)
          if (removerBase) await removerBase()
        }
      } catch (error) {
        console.warn("[Santa Luzia] Notificações nativas indisponíveis neste ambiente.", error)
      }
    }

    void iniciar()
    return () => {
      cancelado = true
      if (timer) window.clearInterval(timer)
      if (removerListener) void removerListener()
    }
  }, [router])

  return null
}
