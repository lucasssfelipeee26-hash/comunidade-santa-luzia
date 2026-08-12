import { mkdir, readdir, readFile, writeFile, copyFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const apk = process.argv[2]
if (!apk) throw new Error('Uso: node scripts/importar-iliturgia-offline.mjs caminho/iliturgia.apk')

const root = process.cwd()
const temp = path.join(root, '.tmp-iliturgia')
const origem = path.join(temp, 'assets', 'Resources')
const destino = path.join(root, 'public', 'offline', 'iliturgia')
const ignorar = new Set(['pics','paints','fonts','sounds','appicon.png','@mipmap'])
const extensoes = new Set(['.htm','.html','.txt','.json','.xml','.js','.css'])

await mkdir(temp, { recursive: true })
execFileSync(process.platform === 'win32' ? 'tar.exe' : 'unzip', process.platform === 'win32' ? ['-xf', apk, '-C', temp] : ['-oq', apk, '-d', temp], { stdio: 'inherit' })
await mkdir(destino, { recursive: true })

const docs = []
async function caminhar(dir, relativo='') {
  for (const nome of await readdir(dir)) {
    if (ignorar.has(nome)) continue
    const abs = path.join(dir, nome)
    const rel = path.join(relativo, nome).replaceAll('\\','/')
    const s = await stat(abs)
    if (s.isDirectory()) { await caminhar(abs, rel); continue }
    if (!extensoes.has(path.extname(nome).toLowerCase())) continue
    const out = path.join(destino, rel)
    await mkdir(path.dirname(out), { recursive: true })
    await copyFile(abs, out)
    docs.push({ id: rel, categoria: rel.split('/')[0], arquivo: rel, bytes: s.size })
  }
}
await caminhar(origem)

docs.sort((a,b) => a.arquivo.localeCompare(b.arquivo, 'pt-BR'))
const categorias = Object.entries(docs.reduce((acc,d) => {
  acc[d.categoria] = (acc[d.categoria] || 0) + 1
  return acc
}, {})).map(([nome,total]) => ({ nome,total })).sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'))

await writeFile(path.join(destino, 'manifest.json'), JSON.stringify({
  geradoEm: new Date().toISOString(),
  origem: 'Acervo iLiturgia fornecido pelo responsável do projeto com autorização declarada para redistribuição',
  offline: true,
  imagensImportadas: false,
  total: docs.length,
  categorias,
  documentos: docs,
}, null, 2), 'utf8')

console.log(`Importação concluída: ${docs.length} documentos textuais, sem imagens.`)
console.table(categorias)
