import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"

const DATA_DIR = process.env.DATA_DIR?.trim() || path.join(process.cwd(), "data")
const DB_PATH = path.join(DATA_DIR, "santa-luzia.json")
const BACKUP_DIR = path.join(DATA_DIR, "backups-santa-luzia")
const HEALTH_PATH = path.join(DATA_DIR, "database-health.json")
const MAX_BACKUPS = 8
const WATCH_INTERVAL_MS = 2_000
const SNAPSHOT_DEBOUNCE_MS = 900

type DatabaseHealth = {
  checkedAt: string
  status: "ok" | "recovered" | "missing" | "error"
  databasePath: string
  size: number
  sha256: string | null
  backupCount: number
  lastBackup: string | null
  recoveredFrom?: string | null
  error?: string | null
}

type GlobalProtection = typeof globalThis & {
  __santaLuziaDataProtection?: {
    started: boolean
    timer?: NodeJS.Timeout
    lastSha?: string
  }
}

function ensureDirectories() {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.mkdirSync(BACKUP_DIR, { recursive: true })
}

function sha256(buffer: Buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex")
}

function readValidDatabase(file: string) {
  if (!fs.existsSync(file)) return null
  const buffer = fs.readFileSync(file)
  if (!buffer.length) throw new Error(`Banco vazio: ${file}`)
  const parsed = JSON.parse(buffer.toString("utf8")) as Record<string, unknown>
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(`Estrutura inválida: ${file}`)
  const expectedArrays = [
    "usuarios",
    "registros",
    "escalas",
    "formacoes",
    "formacao_presencas",
    "ranking_ajustes",
  ]
  for (const key of expectedArrays) {
    if (key in parsed && !Array.isArray(parsed[key])) throw new Error(`Campo ${key} não é uma lista válida.`)
  }
  return { buffer, parsed, sha: sha256(buffer), size: buffer.length }
}

function backupFiles() {
  ensureDirectories()
  return fs.readdirSync(BACKUP_DIR)
    .filter((name) => /^santa-luzia-\d{8}-\d{6}-[a-f0-9]{12}\.json$/.test(name))
    .map((name) => ({ name, file: path.join(BACKUP_DIR, name), mtime: fs.statSync(path.join(BACKUP_DIR, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
}

function trimBackups() {
  const files = backupFiles()
  for (const item of files.slice(MAX_BACKUPS)) {
    try { fs.rmSync(item.file, { force: true }) } catch {}
  }
}

function timestamp(date = new Date()) {
  const p = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`
}

function atomicWrite(file: string, buffer: Buffer) {
  const temp = `${file}.tmp-${process.pid}-${Date.now()}`
  const fd = fs.openSync(temp, "w", 0o600)
  try {
    fs.writeFileSync(fd, buffer)
    fs.fsyncSync(fd)
  } finally {
    fs.closeSync(fd)
  }
  fs.renameSync(temp, file)
  try {
    const dirFd = fs.openSync(path.dirname(file), "r")
    try { fs.fsyncSync(dirFd) } finally { fs.closeSync(dirFd) }
  } catch {}
}

function writeHealth(health: DatabaseHealth) {
  try { atomicWrite(HEALTH_PATH, Buffer.from(`${JSON.stringify(health, null, 2)}\n`, "utf8")) } catch {}
}

function latestValidBackup() {
  for (const item of backupFiles()) {
    try {
      const valid = readValidDatabase(item.file)
      if (valid) return { ...item, ...valid }
    } catch {}
  }
  return null
}

function createBackup(force = false) {
  if (!fs.existsSync(DB_PATH)) return null
  const current = readValidDatabase(DB_PATH)
  if (!current) return null
  const backups = backupFiles()
  if (!force && backups.length) {
    try {
      const last = readValidDatabase(backups[0].file)
      if (last?.sha === current.sha) return { file: backups[0].file, sha: current.sha, size: current.size, reused: true }
    } catch {}
  }
  const name = `santa-luzia-${timestamp()}-${current.sha.slice(0, 12)}.json`
  const target = path.join(BACKUP_DIR, name)
  atomicWrite(target, current.buffer)
  trimBackups()
  return { file: target, sha: current.sha, size: current.size, reused: false }
}

function recoverIfNeeded() {
  ensureDirectories()
  if (!fs.existsSync(DB_PATH)) {
    const backup = latestValidBackup()
    if (!backup) {
      writeHealth({ checkedAt: new Date().toISOString(), status: "missing", databasePath: DB_PATH, size: 0, sha256: null, backupCount: backupFiles().length, lastBackup: null })
      return { status: "missing" as const, sha: "" }
    }
    atomicWrite(DB_PATH, backup.buffer)
    writeHealth({ checkedAt: new Date().toISOString(), status: "recovered", databasePath: DB_PATH, size: backup.size, sha256: backup.sha, backupCount: backupFiles().length, lastBackup: path.basename(backup.file), recoveredFrom: path.basename(backup.file) })
    return { status: "recovered" as const, sha: backup.sha }
  }

  try {
    const current = readValidDatabase(DB_PATH)!
    const backup = createBackup(false)
    writeHealth({ checkedAt: new Date().toISOString(), status: "ok", databasePath: DB_PATH, size: current.size, sha256: current.sha, backupCount: backupFiles().length, lastBackup: backup ? path.basename(backup.file) : null })
    return { status: "ok" as const, sha: current.sha }
  } catch (error) {
    const corrupt = `${DB_PATH}.corrompido-${timestamp()}.json`
    try { fs.renameSync(DB_PATH, corrupt) } catch {}
    const backup = latestValidBackup()
    if (!backup) {
      writeHealth({ checkedAt: new Date().toISOString(), status: "error", databasePath: DB_PATH, size: 0, sha256: null, backupCount: backupFiles().length, lastBackup: null, error: error instanceof Error ? error.message : String(error) })
      return { status: "error" as const, sha: "" }
    }
    atomicWrite(DB_PATH, backup.buffer)
    writeHealth({ checkedAt: new Date().toISOString(), status: "recovered", databasePath: DB_PATH, size: backup.size, sha256: backup.sha, backupCount: backupFiles().length, lastBackup: path.basename(backup.file), recoveredFrom: path.basename(backup.file), error: error instanceof Error ? error.message : String(error) })
    console.warn(`[Proteção do banco] Banco principal inválido. Recuperado de ${path.basename(backup.file)}.`)
    return { status: "recovered" as const, sha: backup.sha }
  }
}

function snapshotAfterWrite(state: NonNullable<GlobalProtection["__santaLuziaDataProtection"]>) {
  if (state.timer) clearTimeout(state.timer)
  state.timer = setTimeout(() => {
    try {
      const current = readValidDatabase(DB_PATH)
      if (!current || current.sha === state.lastSha) return
      const backup = createBackup(false)
      state.lastSha = current.sha
      writeHealth({ checkedAt: new Date().toISOString(), status: "ok", databasePath: DB_PATH, size: current.size, sha256: current.sha, backupCount: backupFiles().length, lastBackup: backup ? path.basename(backup.file) : null })
    } catch (error) {
      writeHealth({ checkedAt: new Date().toISOString(), status: "error", databasePath: DB_PATH, size: 0, sha256: null, backupCount: backupFiles().length, lastBackup: backupFiles()[0]?.name ?? null, error: error instanceof Error ? error.message : String(error) })
    }
  }, SNAPSHOT_DEBOUNCE_MS)
  state.timer.unref?.()
}

export function iniciarProtecaoDadosSantaLuzia() {
  const globals = globalThis as GlobalProtection
  if (globals.__santaLuziaDataProtection?.started) return
  const state: NonNullable<GlobalProtection["__santaLuziaDataProtection"]> = { started: true }
  globals.__santaLuziaDataProtection = state

  const recovery = recoverIfNeeded()
  state.lastSha = recovery.sha

  fs.watchFile(DB_PATH, { interval: WATCH_INTERVAL_MS, persistent: false }, (current, previous) => {
    if (current.mtimeMs === previous.mtimeMs && current.size === previous.size) return
    snapshotAfterWrite(state)
  })

  process.once("beforeExit", () => {
    try { createBackup(false) } catch {}
  })
}

export function lerSaudeBancoSantaLuzia(): DatabaseHealth | null {
  try { return JSON.parse(fs.readFileSync(HEALTH_PATH, "utf8")) as DatabaseHealth } catch { return null }
}
