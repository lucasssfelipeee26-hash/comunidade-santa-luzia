# Plano local-first — 7 dias

Objetivo: reduzir ao mínimo a dependência do Railway e de qualquer servidor contínuo, mantendo o Santa Luzia utilizável offline e usando a internet principalmente para sincronização de dados compartilhados.

## Dia 1 — Atualizações Android sem Railway
- Consultar metadados da versão diretamente no GitHub.
- Baixar APK diretamente do GitHub Releases.
- Validar tamanho e SHA-256 antes da instalação.
- Manter fallback temporário para o endpoint antigo durante a transição.
- Fazer o workflow de release publicar também o manifesto de atualização.

## Dia 2 — Persistência local
- Introduzir armazenamento local persistente apropriado para dados estruturados.
- Separar cache descartável de dados importantes.
- Persistir perfil, escalas, formações, histórico e preferências.

## Dia 3 — Fila offline
- Registrar mutações feitas sem internet.
- Repetir sincronização com idempotência e backoff.
- Preservar operações pendentes em reinício do app.

## Dia 4 — Sincronização inteligente
- Sincronizar escalas, formações, presença, atrasos, ranking e perfil.
- Resolver conflitos de forma previsível.
- Evitar substituir dados locais mais novos por respostas antigas.

## Dia 5 — Notificações e compartilhamento resiliente
- Persistir notificações relevantes localmente.
- Manter visualização funcional durante indisponibilidade do backend.
- Reconciliar estado ao reconectar.

## Dia 6 — Menos tráfego e menos dependência
- Sincronização por revisões/deltas quando possível.
- Reduzir polling e chamadas redundantes.
- Tornar indisponibilidade do backend apenas um estado de sincronização pendente.

## Dia 7 — Auditoria final e publicação
- Testes online/offline, reinício, limpar cache, perda e retorno de rede.
- Testes de atualização sem Railway.
- Auditorias de integridade e segurança.
- Gerar, assinar e publicar APK final.
