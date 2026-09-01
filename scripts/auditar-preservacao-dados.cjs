const fs = require("node:fs")
const path = require("node:path")

const raiz = path.resolve(__dirname, "..")
let falhas = 0

function ler(relativo) {
  return fs.readFileSync(path.join(raiz, relativo), "utf8")
}

function exigir(condicao, titulo) {
  if (condicao) console.log(`✓ ${titulo}`)
  else {
    falhas += 1
    console.error(`✗ ${titulo}`)
  }
}

const offlineRuntime = ler("components/android-offline-snapshot-runtime.tsx")
const offlineData = ler("lib/offline-data.ts")
const localFirstQueue = ler("lib/local-first-queue.ts")
const minhaPresencaFormacao = ler("app/api/formacoes/[id]/minha-presenca/route.ts")
const formacaoDetalhe = ler("app/api/formacoes/[id]/route.ts")
const escalaDetalhe = ler("app/api/escalas/[id]/route.ts")
const adminDados = ler("app/api/app/admin-dados/route.ts")
const excluirPerfil = ler("app/api/perfil/excluir/route.ts")

console.log("\nAUDITORIA DE PRESERVAÇÃO DE DADOS — SANTA LUZIA\n")

exigir(!offlineRuntime.includes("OfflineStore.clear()"), "Limpeza de sessão não apaga a fila offline nativa")
exigir(offlineRuntime.includes("OfflineStore.removeDocument") && offlineRuntime.includes("SL_OFFLINE_SAVE_SNAPSHOT"), "Limpeza remove apenas snapshots privados")
exigir(minhaPresencaFormacao.includes("clientRequestId") && minhaPresencaFormacao.includes("criadoNoAparelhoEm") && minhaPresencaFormacao.includes("replayOfflineDoDia"), "Presença offline preserva instante original e replay controlado")
exigir(offlineData.includes("response.status === 409 && json.presenca"), "Conflito de presença só sai da fila quando o servidor confirma registro")
exigir(offlineData.includes("response.status === 404 || response.status >= 500"), "Erro 404 não descarta presença offline silenciosamente")
exigir(localFirstQueue.includes("removerItensFilaDuravelPorOwner"), "Exclusão real remove somente a fila do proprietário")
exigir(formacaoDetalhe.includes("listarPresencasFormacao(id).length > 0"), "Formação com histórico não pode ser excluída")
exigir(escalaDetalhe.includes("possuiHistoricoVinculado"), "Escala com histórico não pode ser alterada ou excluída")
exigir(adminDados.includes("possuiHistoricoUsuario") && excluirPerfil.includes("possuiHistoricoUsuario"), "Cadastro com histórico não pode destruir registros anteriores")

if (falhas > 0) {
  console.error(`\nPreservação de dados reprovada: ${falhas} falha(s).\n`)
  process.exit(1)
}

console.log("\nPreservação de dados aprovada.\n")
