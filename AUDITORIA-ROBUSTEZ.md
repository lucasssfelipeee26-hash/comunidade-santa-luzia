# Auditoria de Robustez — Santa Luzia

Objetivo: elevar o aplicativo a um nível de produção estável antes da próxima expansão do jogo, auditando tela por tela, função por função e comportamento Android por comportamento Android.

## Critérios obrigatórios

Cada quadro só recebe **APROVADO** quando passa pelos seguintes eixos: carregamento, rede lenta, perda e retorno da internet, sessão/permissão, Android nativo, teclado/campos, menus/submenus, navegação Voltar, estados vazios, erros HTTP, atualização de dados, acessibilidade básica e recuperação após falha.

## Fase 1 — Fundação técnica

| Área | Estado | O que foi verificado/corrigido |
|---|---|---|
| Atualizador Android | APROVADO PARA BUILD 12 | Reconexão nativa, retorno ao app e verificação periódica sem fechar/reabrir |
| Detecção de internet | APROVADO PARA BUILD 12 | `@capacitor/network` passa a ser a fonte nativa, com fallback do navegador |
| Sincronização | APROVADO PARA BUILD 12 | Sincroniza imediatamente ao reconectar ou voltar ao app |
| Segurança da APK | APROVADO PARA BUILD 12 | SHA/tamanho + applicationId + versionCode + certificado de assinatura |
| Menus Android | PROTEGIDO | ActionMode continua controlado pelo Android; tema do app não pinta submenus nativos |
| Erro global | APROVADO | `global-error.tsx`, erro geral e erro próprio da Área Restrita |
| Carregamento global | APROVADO | estado de carregamento em vez de tela vazia |
| Versionamento | CORRIGIDO | nome público unificado em 1.0.5; build interna continua incremental |
| Auditoria automática | ATIVA | `npm run audit:robustez` bloqueia regressões críticas |

## Fase 2 — Quadro por quadro

| Quadro / função | Rede | Android/UI | Segurança | Erros/recuperação | Estado |
|---|---|---|---|---|---|
| Entrada / autenticação | a auditar | a auditar | a auditar | a auditar | PENDENTE |
| Cadastro | a auditar | a auditar | a auditar | a auditar | PENDENTE |
| Recuperação de senha | a auditar | a auditar | a auditar | a auditar | PENDENTE |
| Área Restrita / shell | iniciado | iniciado | iniciado | aprovado | EM AUDITORIA |
| Painel do membro | a auditar | a auditar | a auditar | a auditar | PENDENTE |
| Perfil / foto / bio | a auditar | em auditoria | a auditar | a auditar | EM AUDITORIA |
| Perfis da equipe | a auditar | a auditar | privacidade a auditar | a auditar | PENDENTE |
| Escalas | offline existente | a auditar | a auditar | a auditar | PENDENTE |
| Formação | offline existente | a auditar | a auditar | a auditar | PENDENTE |
| Atrasos / relatos | fila offline existente | a auditar | moderação a auditar | a auditar | PENDENTE |
| Jornada / ranking | sincronização existente | a auditar | pontuação a auditar | a auditar | PENDENTE |
| Jogo atual | local/nativo existente | a auditar | pontuação a auditar | a auditar | PENDENTE |
| Notificações | nativo existente | a auditar | permissão a auditar | a auditar | PENDENTE |
| Biblioteca / liturgia | pacote offline existente | a auditar | integridade a auditar | a auditar | PENDENTE |
| Painel do moderador | a auditar | a auditar | PRIORIDADE ALTA | a auditar | PENDENTE |
| Gestão de membros | a auditar | a auditar | PRIORIDADE ALTA | a auditar | PENDENTE |
| Dados disciplinares | a auditar | a auditar | CRÍTICO/PRIVADO | a auditar | PENDENTE |
| Atualização do APK | aprovado | aprovado | aprovado | aprovado | APROVADO |
| Offline → online | aprovado na fundação | aprovado | n/a | aprovado | APROVADO |
| Site público / visitante | a auditar | a auditar | a auditar | a auditar | PENDENTE |

## Ordem da auditoria profunda

1. **Infraestrutura e atualização** — impedir tela branca, update perdido, arquivo errado e regressões Android.
2. **Autenticação e sessão** — login, cadastro, aprovação, logout, expiração e bloqueio.
3. **Área do membro** — painel, perfil, equipes, escalas, formação, atrasos, ranking e notificações.
4. **Área do moderador** — autorização de cada ação, dados privados, confirmações e concorrência.
5. **Offline e sincronização** — ações repetidas, conflitos, reconexão, dados antigos e falhas parciais.
6. **Android físico** — Samsung, Motorola e Xiaomi; modo claro/escuro; teclado; menus; Voltar; permissões; instalador.
7. **Performance/acessibilidade** — páginas pesadas, imagens, foco, tamanho de toque, leitores de tela e animações.
8. **Carga/segurança de servidor** — rate limit compartilhado, concorrência, persistência, backups e observabilidade.

## Regras para liberar o próximo jogo

O próximo jogo só entra depois que os fluxos críticos de autenticação, membro, moderador, atualização e sincronização estiverem sem falhas críticas abertas. Avisos de baixa prioridade podem permanecer documentados, mas nenhuma regressão de segurança, perda de dados, instalação ou navegação pode ficar pendente.
