const fs = require('node:fs')
const path = require('node:path')

const dataDir = (process.env.DATA_DIR || path.join(process.cwd(), 'data')).trim()
const destino = path.join(dataDir, 'acervo-liturgico')
const origem = path.join(process.cwd(), 'public', 'offline', 'iliturgia')

function log(msg) { console.log(`[acervo-offline] ${msg}`) }
function lerJson(arquivo) { return JSON.parse(fs.readFileSync(arquivo, 'utf8')) }
function arquivosDoManifesto(m) {
  return [...new Set((m.categorias || []).flatMap((c) => Array.isArray(c.arquivos) ? c.arquivos : []))]
}

try {
  const manifestoOrigemPath = path.join(origem, 'manifest.json')
  if (!fs.existsSync(manifestoOrigemPath)) {
    log('manifesto empacotado ausente; mantendo o volume atual.')
    process.exit(0)
  }

  const manifestoOrigem = lerJson(manifestoOrigemPath)
  const esperados = arquivosDoManifesto(manifestoOrigem)
  const ausentesOrigem = esperados.filter((nome) => !fs.existsSync(path.join(origem, nome)))

  if (ausentesOrigem.length) {
    log(`pacote empacotado ainda incompleto (${ausentesOrigem.length} arquivo(s) ausente(s)); nenhuma instalação parcial será feita.`)
    process.exit(0)
  }

  fs.mkdirSync(destino, { recursive: true })
  const manifestoDestinoPath = path.join(destino, 'manifest.json')
  let atual = null
  try { if (fs.existsSync(manifestoDestinoPath)) atual = lerJson(manifestoDestinoPath) } catch {}

  const mesmaVersao = Number(atual?.version || 0) === Number(manifestoOrigem.version || 1)
  const destinoCompleto = mesmaVersao && esperados.every((nome) => fs.existsSync(path.join(destino, nome)))
  if (destinoCompleto) {
    log(`acervo v${manifestoOrigem.version || 1} já instalado (${manifestoOrigem.total || 0} documentos).`)
    process.exit(0)
  }

  const temp = `${destino}.bootstrap-${Date.now()}`
  fs.mkdirSync(temp, { recursive: true })
  for (const nome of esperados) fs.copyFileSync(path.join(origem, nome), path.join(temp, nome))
  fs.copyFileSync(manifestoOrigemPath, path.join(temp, 'manifest.json'))

  const backup = `${destino}.backup-${Date.now()}`
  if (fs.existsSync(destino)) fs.renameSync(destino, backup)
  fs.renameSync(temp, destino)
  fs.rmSync(backup, { recursive: true, force: true })
  log(`instalação automática concluída: ${manifestoOrigem.total || 0} documentos, versão ${manifestoOrigem.version || 1}.`)
} catch (erro) {
  console.error('[acervo-offline] bootstrap falhou sem interromper o site:', erro)
}
