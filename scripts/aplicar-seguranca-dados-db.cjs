const fs = require('node:fs')
const path = require('node:path')

const arquivo = path.resolve(__dirname, '..', 'lib', 'db.ts')
let fonte = fs.readFileSync(arquivo, 'utf8')

function substituir(rotulo, antes, depois) {
  if (!fonte.includes(antes)) throw new Error(`Trecho não encontrado: ${rotulo}`)
  fonte = fonte.replace(antes, depois)
  console.log(`✓ ${rotulo}`)
}

substituir(
  'tipo de auditoria de presença',
  `export type FormacaoPresencaRow = {\n  id: string\n  formacao_id: string\n  usuario_id: string\n  status: FormacaoPresencaStatus\n  justificativa: string | null\n  registrado_por: string\n  criado_em: number\n  atualizado_em: number\n}\n`,
  `export type FormacaoPresencaRow = {\n  id: string\n  formacao_id: string\n  usuario_id: string\n  status: FormacaoPresencaStatus\n  justificativa: string | null\n  registrado_por: string\n  criado_em: number\n  atualizado_em: number\n}\n\nexport type FormacaoPresencaAuditoriaRow = {\n  id: string\n  formacao_id: string\n  usuario_id: string\n  status_anterior: FormacaoPresencaStatus\n  status_novo: FormacaoPresencaStatus | null\n  justificativa_anterior: string | null\n  justificativa_nova: string | null\n  alterado_por: string\n  alterado_em: number\n}\n`,
)

substituir(
  'coleção de auditoria no Store',
  `  formacao_presencas: FormacaoPresencaRow[]\n  reconhecimentos: ReconhecimentoRow[]`,
  `  formacao_presencas: FormacaoPresencaRow[]\n  formacao_presenca_auditoria: FormacaoPresencaAuditoriaRow[]\n  reconhecimentos: ReconhecimentoRow[]`,
)

fonte = fonte.replaceAll(
  'formacoes: [], formacao_presencas: [], reconhecimentos:',
  'formacoes: [], formacao_presencas: [], formacao_presenca_auditoria: [], reconhecimentos:',
)

substituir(
  'leitura compatível da auditoria',
  `      formacao_presencas: Array.isArray(parsed.formacao_presencas) ? parsed.formacao_presencas : [],\n      reconhecimentos:`,
  `      formacao_presencas: Array.isArray(parsed.formacao_presencas) ? parsed.formacao_presencas : [],\n      formacao_presenca_auditoria: Array.isArray(parsed.formacao_presenca_auditoria) ? parsed.formacao_presenca_auditoria : [],\n      reconhecimentos:`,
)

substituir(
  'bloqueio de gravação sem Volume Railway',
  `function persistNow() {\n  if (!storeDisponivel && fs.existsSync(DB_PATH)) {`,
  `function validarPersistenciaRailwayAntesDeGravar() {\n  const emRailway = Boolean(process.env.RAILWAY_DEPLOYMENT_ID || process.env.RAILWAY_PROJECT_ID)\n  const emBuild = process.env.NEXT_PHASE === "phase-production-build" || process.env.npm_lifecycle_event === "build"\n  if (!emRailway || emBuild) return\n\n  const mount = process.env.RAILWAY_VOLUME_MOUNT_PATH?.trim() || ""\n  if (!mount || path.resolve(mount) !== path.resolve(DATA_DIR)) {\n    throw new Error("Persistência bloqueada: o Volume Railway não está montado no mesmo diretório de DATA_DIR.")\n  }\n}\n\nfunction persistNow() {\n  validarPersistenciaRailwayAntesDeGravar()\n  if (!storeDisponivel && fs.existsSync(DB_PATH)) {`,
)

substituir(
  'snapshot imutável das pessoas da escala',
  `export function listarEscalas() {\n  return store.escalas\n    .map((escala) => ({\n      ...escala,\n      pessoas: escala.pessoas.map((pessoa) => {\n        const usuario = pessoa.id ? buscarUsuario(pessoa.id) : undefined\n        if (!usuario) return { ...pessoa }\n        const categoria: EscalaPessoa["categoria"] =\n          usuario.funcao === "Acólito"\n            ? "acolito"\n            : usuario.funcao === "Coroinha"\n              ? "coroinha"\n              : pessoa.categoria\n        return { ...pessoa, nome: usuario.nome, categoria }\n      }),\n    }))\n    .sort((a,b)=>(a.data+a.horario).localeCompare(b.data+b.horario))\n}`,
  `export function listarEscalas() {\n  return store.escalas\n    .map((escala) => ({\n      ...escala,\n      pessoas: escala.pessoas.map((pessoa) => ({ ...pessoa })),\n    }))\n    .sort((a,b)=>(a.data+a.horario).localeCompare(b.data+b.horario))\n}`,
)

substituir(
  'defesa interna contra exclusão de conta com histórico',
  `export function excluirContaUsuario(id: string) {\n  const usuario = store.usuarios.find((u) => u.id === id)\n  if (!usuario) return false\n\n  const quizzesCriados`,
  `export function excluirContaUsuario(id: string) {\n  const usuario = store.usuarios.find((u) => u.id === id)\n  if (!usuario) return false\n\n  const possuiHistorico =\n    store.registros.some((r) => r.usuario_id === id) ||\n    store.escalas.some((escala) => escala.pessoas.some((pessoa) => pessoa.id === id)) ||\n    store.escala_justificativas.some((item) => item.usuario_id === id) ||\n    store.formacao_presencas.some((item) => item.usuario_id === id || item.registrado_por === id) ||\n    store.reconhecimentos.some((item) => item.de_usuario_id === id || item.para_usuario_id === id) ||\n    store.quizzes.some((item) => item.criado_por === id) ||\n    store.quiz_respostas.some((item) => item.usuario_id === id) ||\n    store.pontualidade_ocorrencias.some((item) => item.usuario_id === id || item.reportado_por === id || item.moderado_por === id) ||\n    store.ranking_ajustes.some((item) => item.usuario_id === id || item.criado_por === id)\n  if (possuiHistorico) return false\n\n  const quizzesCriados`,
)

substituir(
  'auditoria antes de alterar presença',
  `  const existentes = new Map(\n    store.formacao_presencas\n      .filter((presenca) => presenca.formacao_id === formacaoId && idsAtualizados.has(presenca.usuario_id))\n      .map((presenca) => [presenca.usuario_id, presenca]),\n  )\n\n  store.formacao_presencas = store.formacao_presencas.filter(`,
  `  const existentes = new Map(\n    store.formacao_presencas\n      .filter((presenca) => presenca.formacao_id === formacaoId && idsAtualizados.has(presenca.usuario_id))\n      .map((presenca) => [presenca.usuario_id, presenca]),\n  )\n\n  for (const registro of registros) {\n    const existente = existentes.get(registro.usuario_id)\n    if (!existente) continue\n    const justificativaNova = registro.status === "justificada" ? registro.justificativa : null\n    if (existente.status === registro.status && existente.justificativa === justificativaNova) continue\n    store.formacao_presenca_auditoria.push({\n      id: \`presenca-audit-\${agora}-\${Math.random().toString(36).slice(2, 8)}\`,\n      formacao_id: formacaoId,\n      usuario_id: registro.usuario_id,\n      status_anterior: existente.status,\n      status_novo: registro.status,\n      justificativa_anterior: existente.justificativa,\n      justificativa_nova: justificativaNova,\n      alterado_por: moderadorId,\n      alterado_em: agora,\n    })\n  }\n\n  store.formacao_presencas = store.formacao_presencas.filter(`,
)

substituir(
  'consulta da auditoria de presença',
  `export function listarTodasPresencasFormacao() {\n  return [...store.formacao_presencas].sort((a, b) => b.atualizado_em - a.atualizado_em)\n}\n`,
  `export function listarTodasPresencasFormacao() {\n  return [...store.formacao_presencas].sort((a, b) => b.atualizado_em - a.atualizado_em)\n}\n\nexport function listarAuditoriaPresencasFormacao(formacaoId?: string) {\n  return store.formacao_presenca_auditoria\n    .filter((item) => !formacaoId || item.formacao_id === formacaoId)\n    .sort((a, b) => b.alterado_em - a.alterado_em)\n}\n`,
)

substituir(
  'defesa interna da exclusão de formação',
  `export function excluirFormacao(id: string) {\n  const row = store.formacoes.find((f) => f.id === id)\n  if (!row) return null\n  store.formacoes =`,
  `export function excluirFormacao(id: string) {\n  const row = store.formacoes.find((f) => f.id === id)\n  if (!row) return null\n  if (row.status === "concluida" || store.formacao_presencas.some((presenca) => presenca.formacao_id === id)) return null\n  store.formacoes =`,
)

substituir(
  'defesa interna do histórico de quiz',
  `export function excluirQuiz(id: string) {\n  const antes = store.quizzes.length; store.quizzes = store.quizzes.filter((q) => q.id !== id); store.quiz_respostas = store.quiz_respostas.filter((r) => r.quiz_id !== id); persistNow(); return antes !== store.quizzes.length\n}`,
  `export function excluirQuiz(id: string) {\n  if (store.quiz_respostas.some((r) => r.quiz_id === id)) return false\n  const antes = store.quizzes.length; store.quizzes = store.quizzes.filter((q) => q.id !== id); persistNow(); return antes !== store.quizzes.length\n}`,
)

substituir(
  'defesa interna da decisão de atraso',
  `export function moderarPontualidade(id: string, status: Exclude<PontualidadeStatus, "pendente">, moderadorId: string) {\n  const row = buscarPontualidadeOcorrencia(id); if (!row) return null; row.status = status; row.moderado_por = moderadorId; row.moderado_em = Date.now(); persistNow(); return row\n}`,
  `export function moderarPontualidade(id: string, status: Exclude<PontualidadeStatus, "pendente">, moderadorId: string) {\n  const row = buscarPontualidadeOcorrencia(id); if (!row || row.status !== "pendente") return null; row.status = status; row.moderado_por = moderadorId; row.moderado_em = Date.now(); persistNow(); return row\n}`,
)

fs.writeFileSync(arquivo, fonte, 'utf8')
console.log('Banco reforçado com preservação e proteção de persistência.')
