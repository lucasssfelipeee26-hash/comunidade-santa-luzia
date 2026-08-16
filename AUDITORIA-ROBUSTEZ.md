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
| Sessão viva | APROVADO | JWT prova identidade, mas tipo/status são confirmados no banco em toda requisição; bloqueio/recusa/promoção valem sem novo login |
| Sessão após troca de senha | APROVADO PARA NOVAS SESSÕES | novos tokens carregam impressão da credencial e deixam de valer após redefinição da senha; tokens legados permanecem compatíveis até o próximo login |
| Auditoria automática | ATIVA | `npm run audit:robustez` bloqueia regressões críticas |

## Fase 2 — Quadro por quadro

| Quadro / função | Rede | Android/UI | Segurança | Erros/recuperação | Estado |
|---|---|---|---|---|---|
| Entrada / autenticação | retomada/reconexão coberta | UI física pendente | sessão viva, cookie assinado, rate limit | erros HTTP tratados | APROVADO EM CÓDIGO / FALTA TESTE FÍSICO |
| Cadastro | servidor validado | UI física pendente | limites, usuário/e-mail únicos, datas civis válidas | 400/409/429 tratados | APROVADO EM CÓDIGO / FALTA TESTE FÍSICO |
| Recuperação de senha | envio externo a testar | UI física pendente | código 6 dígitos, expiração, rate limit, não enumera conta, nova sessão vinculada à senha | 400/429/502/503 tratados | APROVADO EM CÓDIGO / FALTA TESTE DE E-MAIL |
| Área Restrita / shell | iniciado | iniciado | sessão viva aplicada globalmente | aprovado | EM AUDITORIA |
| Painel do membro | a auditar | a auditar | herda sessão viva | a auditar | PENDENTE |
| Perfil / foto / bio | a auditar | em auditoria | a auditar | a auditar | EM AUDITORIA |
| Perfis da equipe | a auditar | a auditar | privacidade a auditar | a auditar | PENDENTE |
| Escalas | offline existente | a auditar | publicação herda sessão viva do moderador | a auditar | EM AUDITORIA |
| Formação | offline existente | a auditar | upload/moderação herdam sessão viva | a auditar | EM AUDITORIA |
| Atrasos / relatos | fila offline existente | a auditar | moderação a auditar | a auditar | PENDENTE |
| Jornada / ranking | sincronização existente | a auditar | pontuação a auditar | a auditar | PENDENTE |
| Jogo atual | local/nativo existente | a auditar | pontuação a auditar | a auditar | PENDENTE |
| Notificações | nativo existente | a auditar | permissão a auditar | a auditar | PENDENTE |
| Biblioteca / liturgia | pacote offline existente | a auditar | integridade a auditar | a auditar | PENDENTE |
| Painel do moderador | a auditar | a auditar | sessão viva corrigiu risco de privilégio antigo | a auditar | EM AUDITORIA |
| Gestão de membros | a auditar | a auditar | promoção já confirma moderador atual; demais rotas herdam sessão viva | a auditar | EM AUDITORIA |
| Dados disciplinares | a auditar | a auditar | registros agora herdam tipo/status atual da conta | a auditar | EM AUDITORIA |
| Atualização do APK | aprovado | aprovado | aprovado | aprovado | APROVADO |
| Offline → online | aprovado na fundação | aprovado | n/a | aprovado | APROVADO |
| Site público / visitante | a auditar | a auditar | a auditar | a auditar | PENDENTE |

## Achados já eliminados

1. **Atualização perdida enquanto o app ficava aberto:** removido. O Android observa a rede nativamente e reconsulta a release ao reconectar, ao voltar do segundo plano e periodicamente enquanto a tela está ativa.
2. **Privilégio congelado no JWT:** removido. Uma sessão antiga de moderador não mantém privilégio se a conta deixar de ser moderador; uma conta recusada perde acesso na requisição seguinte.
3. **APK íntegra, mas de pacote/chave errados:** removido. O atualizador valida pacote, versionCode e certificado além de SHA-256/tamanho.
4. **Recuperação revelava se um cadastro existia:** removido para contas inexistentes.
5. **Datas impossíveis e entradas excessivas no cadastro:** agora são rejeitadas antes de persistir.
6. **Falha React fatal podia virar tela sem recuperação:** existe boundary global com tentativa de recuperação e recarga.

## Pendências técnicas identificadas

- O rate limit ainda é um `Map` local do processo. Antes de usar múltiplas réplicas do servidor, deve migrar para armazenamento compartilhado.
- A recuperação por e-mail precisa de teste real de entrega, expiração e tentativa repetida no ambiente de produção.
- Tokens criados antes da fase de robustez não possuem a impressão da senha; eles continuam aceitos para não desconectar todos durante a atualização. Depois do próximo login, cada sessão passa a ser invalidável por troca de senha.
- O upload de formação ainda precisa de auditoria de conteúdo real/MIME e teste de arquivo corrompido, além da validação atual por extensão/tamanho.
- A matriz Android física (Samsung, Motorola, Xiaomi, claro/escuro, teclado, Voltar, permissões e menus) continua obrigatória antes da nota 10/10.

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
