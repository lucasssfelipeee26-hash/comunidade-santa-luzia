import { registerPlugin } from "@capacitor/core"

interface OfflineStorePlugin {
  saveSnapshot(options: { snapshot: string }): Promise<{ ok: boolean; savedAt: number }>
  loadSnapshot(): Promise<{ snapshot: string }>
  saveQueue(options: { queue: string }): Promise<{ ok: boolean; savedAt?: number }>
  loadQueue(): Promise<{ queue: string }>
  saveDocument(options: { key: string; value: string }): Promise<{ ok: boolean; savedAt: number }>
  loadDocument(options: { key: string }): Promise<{ value: string }>
  removeDocument(options: { key: string }): Promise<{ ok: boolean }>
  clear(): Promise<{ ok: boolean }>
}

export const OfflineStore = registerPlugin<OfflineStorePlugin>("OfflineStore")
