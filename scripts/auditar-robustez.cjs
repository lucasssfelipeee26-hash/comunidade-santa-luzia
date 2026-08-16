const fs = require("node:fs")
const path = require("node:path")

const raiz = path.resolve(__dirname, "..")
let falhas = 0
let avisos = 0

function ler(relativo) { return fs.readFileSync(path.join(raiz, relativo), "utf8") }
function existe(relativo) { return fs.existsSync(path.join(raiz, relativo)) }
function ok(titulo, detalhe = "") { console.log(`✓ ${titulo}${detalhe ? ` — ${detalhe}` : ""}`) }
function falha(titulo, detalhe = "") { falhas += 1; console.error(`✗ ${titulo}${detalhe ? ` — ${detalhe}` : ""}`) }
function aviso(titulo, detalhe = "") { avisos += 1; console.warn(`! ${titulo}${detalhe ? ` — ${detalhe}` : ""}`) }
function exigir(condicao, titulo, detalhe = "") { if (condicao) ok(titulo, detalhe); else falha(titulo, detalhe) }

function listarArquivos(pasta, resultado = []) {
  const absoluta = path.join(raiz, pasta)
  if (!fs.existsSync(absoluta)) return resultado
  for (const item of fs.readdirSync(absoluta, { withFileTypes: true })) {
    const relativo = path.join(pasta, item.name)
    if (item.isDirectory()) listarArquivos(relativo, resultado)
    else resultado.push(relativo.replaceAll("\\", "/"))
  }
  return resultado
}

console.log("\nAUDITORIA DE ROBUSTEZ — SANTA LUZIA\n")

const pkg = JSON.parse(ler("package.json"))
const build = JSON.parse(ler("config/android-build.json"))
const release = JSON.parse(ler("config/android-release.json"))
const appRelease = ler("lib/app-release.ts")
const auth = ler("lib/auth.ts")
const cadastro = ler("app/api/auth/cadastro/route.ts")
const recuperar = ler("app/api/auth/recuperar-senha/solicitar/route.ts")
const confirmar = ler("app/api/auth/recuperar-senha/confirmar/route.ts")
const authMe = ler("app/api/auth/me/route.ts")
const updater = ler("components/android-update-runtime.tsx")
const sync = ler("components/server-sync-runtime.tsx")
const mainActivity = ler("native-assets/android/src/main/java/br/com/comunidadesantaluzia/app/MainActivity.java")
const updaterNativo = ler("native-assets/android/src/main/java/br/com/comunidadesantaluzia/app/AppUpdaterPlugin.java")
const styles = ler("native-assets/android/res/values/styles.xml")
const stylesSemComentarios = styles.replace(/<!--[\s\S]*?-->/g, "")
const networkSecurity = ler("native-assets/android/res/xml/network_security_config.xml")
const validacao = ler("lib/validation.ts")
const escalas = ler("app/api/escalas/route.ts")
const formacoes = ler("app/api/formacoes/route.ts")
const presencasFormacao = ler("app/api/formacoes/[id]/presencas/route.ts")
const ranking = ler("app/api/ranking/route.ts")
const registros = ler("app/api/membros/[id]/registros/route.ts")
const quizzes = ler("app/api/quizzes/route.ts")
const quizResponder = ler("app/api/quizzes/[id]/responder/route.ts")
const jogoServidor = ler("app/api/jogo/caminho-da-luz/resultado/route.ts")
const jogoCliente = ler("components/caminho-da-luz-game.tsx")
const rateLimit = ler("lib/rate-limit.ts")
const workflowAndroid = ler(".github/workflows/android-release.yml")

console.log("[1/10] Versões e distribuição")
exigir(pkg.version === build.versionName, "package.json e Android usam o mesmo nome público", `${pkg.version} / ${build.versionName}`)
exigir(build.versionName === release.versionName, "Build e release mantêm o mesmo versionName", build.versionName)
exigir(build.versionCode > release.versionCode, "Build preparada é mais nova que a publicada", `${build.versionCode} > ${release.versionCode}`)
exigir(appRelease.includes(`APP_DISPLAY_VERSION = \"${build.versionName}\"`), "Versão exibida pelo servidor está alinhada", build.versionName)

console.log("\n[2/10] Atualização instantânea e reconexão")
exigir(Boolean(pkg.dependencies?.["@capacitor/network"]), "Plugin nativo de rede está instalado")
exigir(updater.includes("networkStatusChange"), "Atualizador reage ao retorno da internet nativamente")
exigir(updater.includes("appStateChange"), "Atualizador revalida ao voltar para o aplicativo")
exigir(updater.includes("INTERVALO_VERIFICACAO"), "Atualizador verifica nova release enquanto o app permanece aberto")
exigir(sync.includes("@capacitor/network"), "Sincronização geral usa estado de rede nativo")
exigir(sync.includes("appStateChange"), "Sincronização geral é retomada ao retornar ao app")
exigir(sync.includes("lerLocal(") && sync.includes("salvarLocal("), "Falha do localStorage não derruba a sincronização de rede")

console.log("\n[3/10] Segurança da APK")
exigir(updaterNativo.includes("getPackageArchiveInfo"), "APK é validada pelo PackageManager")
exigir(updaterNativo.includes("getContext().getPackageName().equals(candidato.packageName)"), "APK precisa pertencer ao mesmo applicationId")
exigir(updaterNativo.includes("versaoCandidata <= versaoInstalada"), "APK precisa ter versionCode superior")
exigir(updaterNativo.includes("assinaturaInstalada.equals(assinaturaCandidata)"), "Assinatura da APK é comparada com a instalação atual")
exigir(networkSecurity.includes('cleartextTrafficPermitted="false"'), "Android bloqueia tráfego HTTP inseguro")

console.log("\n[4/10] Sessão, cadastro e recuperação")
exigir(auth.includes("buscarUsuario(payload.sub)"), "Sessão consulta o estado atual da conta")
exigir(auth.includes('usuario.status !== "aprovado"'), "Membro bloqueado/pendente perde autorização imediatamente")
exigir(auth.includes("usuario.tipo"), "Mudança de nível de acesso usa o tipo atual do banco")
exigir(auth.includes("credencialDaSenhaHash"), "Novas sessões são vinculadas à credencial atual")
exigir(cadastro.includes("dataCivilValida"), "Cadastro rejeita datas civis impossíveis")
exigir(cadastro.includes("MAX_SENHA"), "Cadastro possui limites de entrada")
exigir(recuperar.includes("RESPOSTA_GENERICA"), "Recuperação não enumera contas inexistentes")
exigir(confirmar.includes("novaSenha.length > 128"), "Redefinição limita tamanho da nova senha")
exigir(authMe.includes("private, no-store"), "Dados da sessão não podem ser reutilizados por cache")

console.log("\n[5/10] Validação de dados administrativos")
exigir(validacao.includes("dataCivilIsoValida") && validacao.includes("horario24hValido"), "Validação civil reutilizável existe")
exigir(escalas.includes("dataCivilIsoValida") && escalas.includes("horario24hValido"), "Escalas rejeitam datas e horários impossíveis")
exigir(escalas.includes("observacoes.length > 1200"), "Escalas limitam observações extensas")
exigir(formacoes.includes("dataCivilIsoValida") && formacoes.includes("MAX_FILE_SIZE"), "Formações validam calendário e tamanho de material")
exigir(presencasFormacao.includes('formacao.status === "cancelada"'), "Formação cancelada bloqueia alteração de presença")
exigir(ranking.includes("dataCivilIsoValida") && ranking.includes("anoOperacionalValido"), "Ranking e atrasos validam calendário e ano")
exigir(registros.includes("dataCivilIsoValida") && registros.includes("2_000"), "Faltas/justificativas têm data real e limite de texto")
exigir(quizzes.includes("dataCivilIsoValida") && quizzes.includes("slice(0, 500)"), "Editor de quiz limita datas e alternativas")
exigir(quizResponder.includes("Number.isInteger") && quizResponder.includes("limitar("), "Resposta de quiz valida índices e possui rate limit")

console.log("\n[6/10] Pontuação, atrasos e antiabuso")
exigir(ranking.includes("buscarPontualidadePorRequisicao"), "Relatos de atraso são idempotentes por requisição")
exigir(ranking.includes("escala.pessoas.some"), "Atraso vinculado à escala exige membro realmente escalado")
exigir(ranking.includes("const dataMissa = escala ? escala.data"), "Data/horário da escala são definidos pelo servidor")
exigir(ranking.includes("pontos < -100") && ranking.includes("pontos > 100"), "Ajuste manual de ranking possui limite")
exigir(rateLimit.includes("MAX_CHAVES = 5_000") && rateLimit.includes("limparStore"), "Rate limit local remove chaves expiradas e limita memória")

console.log("\n[7/10] Joias da Luz e sincronização offline")
exigir(jogoServidor.includes("faseConcluida !== proximaFase"), "Servidor impede salto direto de fases")
exigir(jogoServidor.includes("scoreMinimoAteFase"), "Servidor verifica coerência mínima entre score e fase")
exigir(jogoServidor.includes("LIMITE_DIARIO = 35"), "Limite diário do jogo está explícito no servidor")
exigir(jogoServidor.includes("limitar(`jogo:joias"), "Envio de resultados possui rate limit")
exigir(jogoCliente.includes("pendentes:v5") && jogoCliente.includes("lerPendentes"), "Cliente mantém fila de fases offline")
exigir(jogoCliente.includes("faseEsperada") && jogoCliente.includes("sincronizarPendente"), "Fila offline reconcilia progresso na ordem exigida pelo servidor")

console.log("\n[8/10] Menus/submenus Android")
exigir(mainActivity.includes("setHandleNativeActionModesEnabled(false)"), "ActionMode permanece sob controle nativo do Android")
const atributosProibidos = ["actionModeTheme", "actionModeBackground", "actionMenuTextColor", "colorBackgroundFloating", "android:background"]
for (const atributo of atributosProibidos) {
  const existeItem = stylesSemComentarios.includes(`name=\"${atributo}\"`) || stylesSemComentarios.includes(`name='${atributo}'`)
  exigir(!existeItem, `Tema nativo não força ${atributo}`)
}

console.log("\n[9/10] Recuperação de interface e build Android")
exigir(existe("app/error.tsx"), "Boundary de erro da aplicação existe")
exigir(existe("app/global-error.tsx"), "Boundary global evita tela branca irrecuperável")
exigir(existe("app/area-restrita/error.tsx"), "Área Restrita possui recuperação própria")
exigir(existe("app/loading.tsx"), "Aplicação possui estado global de carregamento")
exigir(workflowAndroid.includes("cache: gradle"), "CI reutiliza cache do Gradle")
exigir(workflowAndroid.includes("for tentativa in 1 2 3"), "CI repete compilação após falha transitória do Maven")
exigir(workflowAndroid.includes("EXPECTED_CERT"), "CI exige o certificado Android histórico")

console.log("\n[10/10] Inventário quadro por quadro")
const arquivosApp = listarArquivos("app")
const paginas = arquivosApp.filter((arquivo) => arquivo.endsWith("/page.tsx") || arquivo === "app/page.tsx")
const apis = arquivosApp.filter((arquivo) => arquivo.endsWith("/route.ts"))
const boundaries = arquivosApp.filter((arquivo) => arquivo.endsWith("/error.tsx") || arquivo.endsWith("/global-error.tsx"))
ok("Telas/páginas encontradas", String(paginas.length))
ok("Rotas de API encontradas", String(apis.length))
ok("Boundaries de erro encontrados", String(boundaries.length))
exigir(paginas.length >= 20, "Inventário contém as principais janelas do aplicativo", `${paginas.length} páginas`)
exigir(apis.length >= 30, "Inventário contém a malha principal de APIs", `${apis.length} rotas`)

const rotasSensiveis = [
  "app/api/membros/route.ts",
  "app/api/membros/[id]/status/route.ts",
  "app/api/membros/[id]/promover/route.ts",
  "app/api/membros/[id]/registros/route.ts",
  "app/api/formacoes/[id]/presencas/route.ts",
  "app/api/ranking/route.ts",
  "app/api/quizzes/route.ts",
  "app/api/quizzes/[id]/responder/route.ts",
  "app/api/jogo/caminho-da-luz/resultado/route.ts",
]
for (const rota of rotasSensiveis) {
  exigir(existe(rota) && ler(rota).includes("lerSessao"), `Rota sensível exige sessão: ${rota.replace("app/api/", "")}`)
}

const mobilePolish = ler("components/mobile-polish-runtime.tsx")
if (/area-restrita-shell[^`]*select/s.test(mobilePolish)) aviso("Selects web ainda recebem aparência do shell", "revisar individualmente no Android físico; opções nativas continuam sob controle do sistema")

if (rateLimit.includes("new Map")) aviso("Rate limit é local ao processo", "antes de usar múltiplas réplicas do servidor, migrar contadores para armazenamento compartilhado")

const db = ler("lib/db.ts")
if (db.includes("santa-luzia.json")) aviso("Persistência principal é arquivo JSON local", "manter uma única réplica com volume persistente ou migrar para banco transacional antes de escalar horizontalmente")

const recarregamentos = [...listarArquivos("components"), ...arquivosApp]
  .filter((arquivo) => /\.(ts|tsx)$/.test(arquivo))
  .filter((arquivo) => ler(arquivo).includes("window.location.reload()"))
if (recarregamentos.length) aviso("Há recarregamentos completos intencionais", recarregamentos.join(", "))

console.log(`\nResultado: ${falhas} falha(s) crítica(s), ${avisos} aviso(s).`)
if (falhas > 0) process.exit(1)
console.log("Auditoria crítica aprovada. Avisos restantes são limites arquiteturais ou verificações de aparelho físico.\n")
