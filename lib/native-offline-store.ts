import { registerPlugin } from "@capacitor/core"

interface OfflineStorePlugin {
  saveSnapshot(options: { snapshot: string }): Promise<{ ok: boolean; savedAt: number }>
  loadSnapshot(): Promise<{ snapshot: string }>
  saveQueue(options: { queue: string }): Promise<{ ok: boolean }>
  loadQueue(): Promise<{ queue: string }>
  clear(): Promise<{ ok: boolean }>
}

export const OfflineStore = registerPlugin<OfflineStorePlugin>("OfflineStore")
