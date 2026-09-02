const fs = require("node:fs")
const path = require("node:path")

const root = path.resolve(__dirname, "..")

function read(rel) {
  const file = path.join(root, rel)
  if (!fs.existsSync(file)) throw new Error(`[media-fix] Arquivo ausente: ${rel}`)
  return fs.readFileSync(file, "utf8")
}

function write(rel, content) {
  fs.writeFileSync(path.join(root, rel), content)
}

function replaceRequired(rel, before, after, label) {
  let source = read(rel)
  if (source.includes(after)) return false
  if (!source.includes(before)) throw new Error(`[media-fix] ${label}: trecho esperado não encontrado em ${rel}`)
  source = source.replace(before, after)
  write(rel, source)
  return true
}

function requireMarker(rel, marker, label) {
  if (!read(rel).includes(marker)) throw new Error(`[media-fix] ${label}: marcador ausente em ${rel}: ${marker}`)
}

function forbidMarker(rel, marker, label) {
  if (read(rel).includes(marker)) throw new Error(`[media-fix] ${label}: marcador proibido ainda presente em ${rel}: ${marker}`)
}

function patchSource() {
  // 1) A camada Android antiga injetava um quinto card de Liturgia e um segundo
  // ícone em cada card. A Home React já possui os quatro cards e os ícones corretos.
  replaceRequired(
    "android-web/motion/android-motion-beta.js",
    "    ensureFourthHomeCard();\n    ensureHomeShortcutIcons();\n",
    "    // A Home React da Beta 18 já possui exatamente quatro cards e um ícone por card.\n    // Não injetar cards/ícones redundantes sobre a interface original.\n",
    "Home duplicada",
  )

  // 2) A imagem principal estava usando contain, criando faixas vazias. Cover
  // mantém a proporção e preenche todo o quadro, como marcado na foto.
  replaceRequired(
    "components/hero.tsx",
    'className="object-contain object-center"',
    'className="object-cover object-center"',
    "enquadramento do banner",
  )

  // 3) O grande bloco introdutório da Biblioteca foi explicitamente marcado
  // para remoção. Mantemos busca, categorias e catálogo intactos.
  replaceRequired(
    "components/biblioteca-catolica.tsx",
    'className="rounded-2xl border border-[#d4af37]/35 bg-[#073b29] p-6 text-white shadow-lg sm:p-8"',
    'className="hidden"',
    "bloco introdutório da Biblioteca",
  )

  // 4) Compactação dos cards e ícones originais da Home para reduzir rolagem.
  replaceRequired(
    "android-local/entry.tsx",
    'className="relative z-10 bg-[#fffaf0] py-4 sm:py-8"',
    'className="relative z-10 bg-[#fffaf0] py-3 sm:py-6"',
    "espaçamento da Home",
  )
  replaceRequired(
    "android-local/entry.tsx",
    'className="group min-w-0 rounded-xl border border-[#d9cfb9] bg-[#fffdf7] p-3 shadow-[0_4px_14px_rgba(72,55,21,.06)] transition active:scale-[.985] sm:rounded-2xl sm:p-5"',
    'className="group min-w-0 rounded-xl border border-[#d9cfb9] bg-[#fffdf7] p-2.5 shadow-[0_4px_14px_rgba(72,55,21,.06)] transition active:scale-[.985] sm:rounded-2xl sm:p-4"',
    "tamanho dos cards da Home",
  )
  replaceRequired(
    "android-local/entry.tsx",
    'className="sl-home-shortcut-icon mb-2 flex size-9 items-center justify-center rounded-full border border-[#d4af37] bg-[#5b071b] text-[#f2cf62] shadow-sm sm:mb-4 sm:size-11"',
    'className="sl-home-shortcut-icon mb-1.5 flex size-8 items-center justify-center rounded-full border border-[#d4af37] bg-[#5b071b] text-[#f2cf62] shadow-sm sm:mb-3 sm:size-10"',
    "tamanho dos ícones da Home",
  )
  replaceRequired(
    "android-local/entry.tsx",
    'className="size-[18px] sm:size-5"',
    'className="size-4 sm:size-[18px]"',
    "desenho interno dos ícones da Home",
  )

  // 5) O Android/AAPT expande assets .gz e os empacota sem o sufixo .gz.
  // Antes o leitor solicitava somente *.json.gz e exibia "Pacote litúrgico
  // interno não encontrado". Agora tenta o pacote compactado e, no APK,
  // usa automaticamente a cópia JSON expandida.
  const acervoRel = "components/acervo-liturgico-offline.tsx"
  let acervo = read(acervoRel)
  if (!acervo.includes("async function carregarPacote(nome:string)")) {
    const before = `async function abrir(res:Response):Promise<Pacote>{\n  if(!res.ok)throw new Error("Pacote litúrgico interno não encontrado.")\n  if(!("DecompressionStream" in window))throw new Error("Este aparelho não suporta a leitura do acervo compactado.")\n  const s=res.body?.pipeThrough(new DecompressionStream("gzip"))\n  if(!s)throw new Error("Não foi possível abrir o conteúdo.")\n  return JSON.parse(await new Response(s).text())\n}\n\nasync function carregarCategoria(m:Manifesto,categoria:string){\n  const c=m.categorias.find(x=>x.id===categoria)\n  if(!c)throw new Error("Categoria litúrgica não encontrada.")\n  const pacotes=await Promise.all(c.arquivos.map(async a=>abrir(await fetch(pacoteUrl(a),{cache:"force-cache"}))))\n  return pacotes.flatMap(x=>x.documents)\n}`
    const after = `async function abrir(res:Response):Promise<Pacote>{\n  if(!res.ok)throw new Error("Pacote litúrgico interno não encontrado.")\n  if(!("DecompressionStream" in window))throw new Error("Este aparelho não suporta a leitura do acervo compactado.")\n  const s=res.body?.pipeThrough(new DecompressionStream("gzip"))\n  if(!s)throw new Error("Não foi possível abrir o conteúdo.")\n  return JSON.parse(await new Response(s).text())\n}\n\nasync function carregarPacote(nome:string):Promise<Pacote>{\n  const compactado=await fetch(pacoteUrl(nome),{cache:"force-cache"})\n  if(compactado.ok&&("DecompressionStream" in window))return abrir(compactado)\n\n  // O Android Asset Packaging Tool expande arquivos .gz e remove esse sufixo\n  // dentro do APK. A versão JSON é, portanto, o caminho correto no WebView local.\n  const nomePlano=nome.replace(/\\.gz$/i,"")\n  if(nomePlano!==nome){\n    const plano=await fetch(pacoteUrl(nomePlano),{cache:"force-cache"})\n    if(plano.ok)return plano.json() as Promise<Pacote>\n  }\n\n  if(compactado.ok)return abrir(compactado)\n  throw new Error("Pacote litúrgico interno não encontrado.")\n}\n\nasync function carregarCategoria(m:Manifesto,categoria:string){\n  const c=m.categorias.find(x=>x.id===categoria)\n  if(!c)throw new Error("Categoria litúrgica não encontrada.")\n  const pacotes=await Promise.all(c.arquivos.map(carregarPacote))\n  return pacotes.flatMap(x=>x.documents)\n}`
    if (!acervo.includes(before)) throw new Error("[media-fix] Leitor iLiturgia: bloco esperado não encontrado")
    acervo = acervo.replace(before, after)
    write(acervoRel, acervo)
  }

  // 6) Compatibilidade do login Android. O transporte nativo agora acompanha
  // redirecionamentos HTTPS do endpoint, força resposta textual sem compressão
  // implícita e garante que o CookieManager aceite/retenha a sessão.
  const syncRel = "native-assets/android/src/main/java/br/com/comunidadesantaluzia/app/SyncHttpPlugin.java"
  replaceRequired(syncRel, "conexao.setInstanceFollowRedirects(false);", "conexao.setInstanceFollowRedirects(true);", "redirecionamento do login")
  replaceRequired(syncRel, 'conexao.setRequestProperty("Accept", "application/json, text/plain, */*");', 'conexao.setRequestProperty("Accept", "application/json, text/plain, */*");\n                conexao.setRequestProperty("Accept-Encoding", "identity");', "resposta do login")
  replaceRequired(syncRel, "SantaLuziaMotionBeta/2.0.0-beta.10", "SantaLuziaMotionBeta/2.0.0-beta.18", "identidade HTTP Beta 18")

  let sync = read(syncRel)
  if (!sync.includes("manager.setAcceptCookie(true);")) {
    sync = sync.replace(
      "CookieManager manager = CookieManager.getInstance();\n            Map<String, List<String>> headers = conexao.getHeaderFields();",
      "CookieManager manager = CookieManager.getInstance();\n            manager.setAcceptCookie(true);\n            Map<String, List<String>> headers = conexao.getHeaderFields();",
    )
    if (!sync.includes("manager.setAcceptCookie(true);")) throw new Error("[media-fix] CookieManager: não foi possível habilitar cookies")
    write(syncRel, sync)
  }

  // 7) O cliente deixa de mascarar uma resposta inesperada como um genérico
  // "Não foi possível entrar"; a autenticação passa a preservar a mensagem
  // real do servidor e o código HTTP para diagnóstico.
  const storeRel = "lib/store.tsx"
  let store = read(storeRel)
  if (!store.includes("Resposta de autenticação inválida")) {
    const before = `    const json = (await res.json()) as ResultadoAcao\n    if (json.ok) await globalMutate("/api/auth/me")\n    return json`
    const after = `    const recebido = await res.json().catch(() => null) as (ResultadoAcao & { mensagem?: string; message?: string; error?: string }) | null\n    if (!recebido || typeof recebido !== "object") {\n      return { ok: false, erro: \`Resposta de autenticação inválida (HTTP \${res.status}).\` }\n    }\n    const json: ResultadoAcao = recebido.ok\n      ? recebido\n      : {\n          ...recebido,\n          ok: false,\n          erro: recebido.erro || recebido.mensagem || recebido.message || recebido.error ||\n            (res.status === 401\n              ? "Usuário/e-mail ou senha inválidos. Confira os dados ou use ‘Esqueci minha senha’."\n              : \`Não foi possível entrar (HTTP \${res.status}).\`),\n        }\n    if (json.ok) await globalMutate("/api/auth/me")\n    return json`
    if (!store.includes(before)) throw new Error("[media-fix] Store de login: bloco esperado não encontrado")
    store = store.replace(before, after)
    write(storeRel, store)
  }

  // Contratos diretos das correções recebidas nas mídias.
  forbidMarker("android-web/motion/android-motion-beta.js", "    ensureFourthHomeCard();", "quinto card da Home")
  forbidMarker("android-web/motion/android-motion-beta.js", "    ensureHomeShortcutIcons();", "ícones duplicados da Home")
  requireMarker("components/hero.tsx", 'className="object-cover object-center"', "banner sem faixas")
  requireMarker("components/biblioteca-catolica.tsx", 'className="hidden"', "banner da Biblioteca removido")
  requireMarker(acervoRel, "nomePlano=nome.replace(/\\.gz$/i,\"\")", "fallback iLiturgia Android")
  requireMarker(syncRel, "setInstanceFollowRedirects(true)", "login Android")
  requireMarker(storeRel, "Resposta de autenticação inválida", "mensagem real de login")

  console.log("[media-fix] Fotos/vídeo aplicados: Home sem duplicações, cards compactos, banner enquadrado, Biblioteca limpa, iLiturgia Android e login reforçados.")
}

patchSource()
