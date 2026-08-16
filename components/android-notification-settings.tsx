"use client"

import { useEffect, useState } from "react"
import useSWR from "swr"
import { Bell, BellRing, RefreshCw, Volume2 } from "lucide-react"
import type { LocalNotificationSchema } from "@capacitor/local-notifications"
import { Button } from "@/components/ui/button"
import { androidNotificationConfig } from "@/lib/android-notifications"
import { NOTIFICATION_SOUND_OPTIONS, SOUND_PREFERENCES_EVENT, loadSoundPreferences, type SoundPreferences } from "@/lib/sound-preferences"

const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then((r) => r.json())
type Sessao = { sessao?: { usuario?: { id?: string } } | null }

function notificationId(text: string) {
  let h = 2166136261
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return Math.abs(h | 0) || 1
}

function dateLocal(data: string, horario: string) {
  const [y, m, d] = data.split("-").map(Number)
  const [hh, mm] = horario.split(":").map(Number)
  return new Date(y, m - 1, d, hh, mm, 0, 0)
}

function comPreferencias(notification: Omit<LocalNotificationSchema, "channelId" | "sound">, preferences: SoundPreferences): LocalNotificationSchema {
  const config = androidNotificationConfig(preferences)
  return { ...notification, channelId: config.channelId, ...(config.sound ? { sound: config.sound } : {}) }
}

export function AndroidNotificationSettings() {
  const { data: sessaoData } = useSWR<Sessao>("/api/auth/me", fetcher, { revalidateOnFocus: false })
  const userId = sessaoData?.sessao?.usuario?.id || null
  const [status, setStatus] = useState("")
  const [carregando, setCarregando] = useState(false)
  const [testando, setTestando] = useState(false)
  const [prefs, setPrefs] = useState<SoundPreferences>(() => loadSoundPreferences(null))

  useEffect(() => {
    const atualizar = () => setPrefs(loadSoundPreferences(userId))
    atualizar()
    window.addEventListener(SOUND_PREFERENCES_EVENT, atualizar)
    return () => window.removeEventListener(SOUND_PREFERENCES_EVENT, atualizar)
  }, [userId])

  async function prepararCanal(LocalNotifications: { createChannel: (options: any) => Promise<void> }) {
    const config = androidNotificationConfig(prefs)
    await LocalNotifications.createChannel({ id: config.channelId, name: config.channelName, description: "Escalas, Liturgia, Ranking e avisos do grupo.", ...(config.sound ? { sound: config.sound } : {}), importance: prefs.notificationSound === "none" ? 3 : 4, vibration: config.vibration, lights: true, lightColor: "#D4AF37" })
    return config
  }

  async function ativar() {
    setCarregando(true); setStatus("")
    try {
      const [{ Capacitor }, { LocalNotifications }] = await Promise.all([import("@capacitor/core"), import("@capacitor/local-notifications")])
      if (!Capacitor.isNativePlatform()) { setStatus("Disponível no aplicativo Android instalado."); return }
      let permissao = await LocalNotifications.checkPermissions()
      if (permissao.display !== "granted") permissao = await LocalNotifications.requestPermissions()
      if (permissao.display !== "granted") { setStatus("Ative a permissão de notificações no Android."); return }
      if (Capacitor.getPlatform() === "android") await prepararCanal(LocalNotifications)
      const res = await fetch("/api/notificacoes", { cache: "no-store" })
      if (!res.ok) throw new Error(`Falha HTTP ${res.status}`)
      const dados = await res.json()
      if (!dados.autenticado) { setStatus("Entre na Área Restrita para sincronizar."); return }

      const notificacoes: LocalNotificationSchema[] = []
      const agora = new Date()
      for (const escala of dados.escalas || []) {
        const missa = dateLocal(escala.data, escala.horario)
        const limite = new Date(missa.getTime() - Number(dados.minutosAntecedencia || 30) * 60_000)
        const antes = new Date(limite.getTime() - 60 * 60_000)
        const funcoes = (escala.pessoas || []).filter((p: { id?: string; nome?: string }) => p.id === dados.usuario.id || p.nome === dados.usuario.nome).map((p: { funcao?: string }) => p.funcao).filter(Boolean).join(", ")
        if (antes > agora) notificacoes.push(comPreferencias({ id: notificationId(`escala-aviso-${escala.id}`), title: "Sua escala está chegando", body: `Missa às ${escala.horario}. Você deve estar na igreja até ${limite.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}${funcoes ? ` · ${funcoes}` : ""}.`, schedule: { at: antes, allowWhileIdle: true }, extra: { rota: "/escala" } }, prefs))
        if (limite > agora) notificacoes.push(comPreferencias({ id: notificationId(`escala-limite-${escala.id}`), title: "Hora de estar na igreja", body: `Sua missa começa às ${escala.horario}. Confira sua função na Escala do Dia.`, schedule: { at: limite, allowWhileIdle: true }, extra: { rota: "/escala" } }, prefs))
      }
      for (let i = 0; i < 7; i += 1) {
        const d = new Date(); d.setDate(d.getDate() + i); d.setHours(7, 0, 0, 0)
        if (d <= agora) continue
        notificacoes.push(comPreferencias({ id: notificationId(`liturgia-${d.toISOString().slice(0, 10)}`), title: "Liturgia do Dia", body: "Comece o dia com a Palavra. A Liturgia de hoje já está no Santa Luzia.", schedule: { at: d }, extra: { rota: "/liturgia" } }, prefs))
      }
      notificacoes.push(comPreferencias({ id: notificationId("ranking-semanal"), title: "Ranking e desafios", body: "Confira sua evolução, os novos quizzes e os reconhecimentos da equipe.", schedule: { on: { weekday: 1, hour: 19, minute: 0 } }, extra: { rota: "/area-restrita/ranking" } }, prefs))
      const pending = await LocalNotifications.getPending()
      if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) })
      if (notificacoes.length) await LocalNotifications.schedule({ notifications: notificacoes })
      localStorage.setItem("santa-luzia-notificacoes", "ativas")
      const label = NOTIFICATION_SOUND_OPTIONS.find((item) => item.value === prefs.notificationSound)?.label || "Padrão"
      setStatus(`${notificacoes.length} lembrete(s) sincronizados · ${label}.`)
    } catch (error) {
      console.error(error); setStatus("Não foi possível sincronizar. Verifique conexão e permissão.")
    } finally { setCarregando(false) }
  }

  async function testarSom() {
    setTestando(true); setStatus("")
    try {
      const [{ Capacitor }, { LocalNotifications }] = await Promise.all([import("@capacitor/core"), import("@capacitor/local-notifications")])
      if (!Capacitor.isNativePlatform()) { setStatus("O teste funciona no aplicativo Android."); return }
      let permissao = await LocalNotifications.checkPermissions()
      if (permissao.display !== "granted") permissao = await LocalNotifications.requestPermissions()
      if (permissao.display !== "granted") { setStatus("Permissão não concedida."); return }
      if (Capacitor.getPlatform() === "android") await prepararCanal(LocalNotifications)
      await LocalNotifications.schedule({ notifications: [comPreferencias({ id: notificationId(`teste-som-${Date.now()}`), title: "Santa Luzia", body: "Preferência de notificação aplicada neste aparelho.", schedule: { at: new Date(Date.now() + 1200) }, extra: { rota: "/area-restrita" } }, prefs)] })
      setStatus("Teste agendado para aparecer em instantes.")
    } catch (error) { console.error(error); setStatus("Não foi possível testar.") }
    finally { setTestando(false) }
  }

  return (
    <div className="rounded-2xl border border-border/75 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary"><BellRing className="size-4" /></span>
        <div className="min-w-0 flex-1"><h3 className="font-serif text-base font-semibold text-primary">Notificações no celular</h3><p className="text-[11px] leading-4 text-muted-foreground">Escalas, Liturgia e avisos sincronizados no Android.</p></div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Button type="button" size="sm" onClick={ativar} disabled={carregando || testando} className="h-9 gap-1.5 rounded-xl px-3 text-xs">{carregando ? <RefreshCw className="size-3.5 animate-spin" /> : <Bell className="size-3.5" />}{carregando ? "Sincronizando…" : "Sincronizar"}</Button>
        <Button type="button" size="sm" variant="outline" onClick={testarSom} disabled={carregando || testando} className="h-9 gap-1.5 rounded-xl px-3 text-xs">{testando ? <RefreshCw className="size-3.5 animate-spin" /> : <Volume2 className="size-3.5" />}{testando ? "Testando…" : "Testar"}</Button>
      </div>
      {status && <p className="mt-1.5 text-[10px] leading-4 text-muted-foreground">{status}</p>}
    </div>
  )
}
