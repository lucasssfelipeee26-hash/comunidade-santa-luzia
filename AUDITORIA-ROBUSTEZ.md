# Auditoria de Robustez — Santa Luzia

Objetivo: elevar o aplicativo a um nível de produção estável antes da próxima expansão de jogos, auditando tela por tela, função por função e comportamento Android por comportamento Android.

## Critérios obrigatórios

Cada quadro crítico só recebe **APROVADO EM CÓDIGO** quando passa por carregamento, rede lenta, perda/retorno da internet, sessão/permissão, validação de entradas, repetição de requisições, estados vazios, erros HTTP, atualização dos dados, recuperação após falha e compatibilidade com o shell Android. A aprovação **FÍSICA** exige execução em aparelho real.

## Fase 1 — Fundação técnica

| Área | Estado | O que foi verificado/corrigido |
|---|---|---|
| Atualizador Android | APROVADO PARA BUILD 12 | Reconexão nativa, retorno ao app, evento de status e verificação periódica sem fechar/reabrir |
| Detecção de internet | APROVADO PARA BUILD 12 | `@capacitor/network` é a fonte nativa, com fallback do navegador |
| Sincronização | APROVADO PARA BUILD 12 | Reconecta imediatamente; falha de `localStorage` não passa mais a fingir que a internet caiu |
| Segurança da APK | APROVADO PARA BUILD 12 | SHA/tamanho + applicationId + versionCode + certificado de assinatura |
| Menus Android | PROTEGIDO | ActionMode continua controlado pelo Android; tema do app não pinta submenus nativos |
| Erro global | APROVADO | `global-error.tsx`, erro geral e erro próprio da Área Restrita |
| Carregamento global | APROVADO | estado de carregamento em vez de tela vazia |
| Versionamento | APROVADO | versão pública permanece 1.0.5; publicada está no code 11 e a candidata é code 12 |
| Sessão viva | APROVADO | JWT prova identidade, mas tipo/status são confirmados no banco em cada requisição; bloqueio, recusa e promoção valem sem novo login |
| Sessão após troca de senha | APROVADO PARA NOVAS SESSÕES | novos tokens carregam impressão da credencial e deixam de valer após redefinição; tokens legados continuam compatíveis até o próximo login |
| Cache de sessão | APROVADO | `/api/auth/me` responde com `private, no-store` |
| Rate limit local | APROVADO PARA UMA RÉPLICA | remove chaves expiradas e limita o mapa a 5.000 entradas; ainda não é distribuído |
| Auditoria automática | ATIVA | `npm run audit:robustez` cobre agora 10 blocos críticos e bloqueia regressões |
| CI Android | ENDURECIDA | cache Gradle + até 3 tentativas contra falhas transitórias do Maven; publicação só com certificado histórico correto |

## Fase 2 — Quadro por quadro

| Quadro / função | Rede/offline | Segurança/dados | Recuperação | Estado |
|---|---|---|---|---|
| Entrada / autenticação | reconexão coberta | sessão atual, rate limit | erros HTTP tratados | APROVADO EM CÓDIGO / FALTA APARELHO |
| Cadastro | online | limites, unicidade e datas civis reais | 400/409/429 tratados | APROVADO EM CÓDIGO / FALTA APARELHO |
| Recuperação de senha | depende do provedor de e-mail | código, expiração, não enumeração e limites | 400/429/502/503 | APROVADO EM CÓDIGO / FALTA TESTE DE E-MAIL |
| Área Restrita / shell | sincronização global | sessão viva | boundaries global e local | APROVADO EM CÓDIGO / FALTA APARELHO |
| Painel do membro | revalidação global | dados privados por sessão | revalidação após sync | APROVADO EM CÓDIGO / FALTA APARELHO |
| Perfil / foto / bio | revalidação global | foto/bio limitadas; bio pública separada | erros tratados | APROVADO EM CÓDIGO / FALTA APARELHO |
| Perfis da equipe | cache curto autenticado | somente equipe aprovada e campos públicos | perfil inexistente retorna 404 | APROVADO EM CÓDIGO / FALTA APARELHO |
| Escalas | cache offline + atualização | data/hora civil, celebrante, observações, funções e membros validados | exclusão 404 previsível | APROVADO EM CÓDIGO / FALTA APARELHO |
| Formação | cache offline + material | calendário real, limites de texto, arquivo 20 MB, extensão autorizada | cancelada bloqueia presença; exclusão limpa material | APROVADO EM CÓDIGO / FALTA APARELHO |
| Presença em formação | fila offline existente | alvo autenticado, justificativa limitada, rate limit | reenvio é sobrescrita idempotente do estado atual | APROVADO EM CÓDIGO / FALTA APARELHO |
| Atrasos / relatos | fila offline | request id idempotente; escala define data/hora; membro precisa estar escalado; rate limit | moderação 403/404/409 | APROVADO EM CÓDIGO / FALTA APARELHO |
| Jornada / ranking | revalidação global | ajustes -100..100; pesos e ano validados; reconhecimentos limitados | respostas previsíveis | APROVADO EM CÓDIGO / FALTA APARELHO |
| Quizzes | sincronização normal | datas, textos, opções e índices limitados; rate limit | resposta duplicada idempotente no banco | APROVADO EM CÓDIGO / FALTA APARELHO |
| Quiz litúrgico diário | liturgia offline | tentativa assinada e temporizada + rate limit | expiração/duplicidade tratadas | APROVADO EM CÓDIGO / FALTA APARELHO |
| Joias da Luz | jogo local + fila offline v5 | servidor exige fases sequenciais, score mínimo coerente, 35 pontos/dia e rate limit | fila reconcilia `faseEsperada` sem perder fases | APROVADO EM CÓDIGO / FALTA APARELHO |
| Notificações | polling/sync nativo existente | avisos autenticados; mensagem do jogo alinhada a 35 pontos | revalidação automática | APROVADO EM CÓDIGO / FALTA PERMISSÕES REAIS |
| Biblioteca / liturgia | pacotes offline | caminhos do acervo normalizados; download de formação é autenticado | 404/500 tratados | APROVADO EM CÓDIGO / FALTA APARELHO |
| Painel do moderador | sincronização global | toda ação sensível revalida o papel atual | erros de autorização previsíveis | APROVADO EM CÓDIGO / FALTA APARELHO |
| Gestão de membros | revalidação global | promoção exige membro aprovado e vale imediatamente | 404/409 tratados | APROVADO EM CÓDIGO / FALTA APARELHO |
| Dados disciplinares | online | data civil, descrição até 2.000, membro só justifica a si; rate limit | autorização por tipo atual | APROVADO EM CÓDIGO / FALTA APARELHO |
| Atualização do APK | instantânea ao reconectar | pacote/versionCode/certificado/hash/tamanho | retry de consulta e CI | APROVADO EM CÓDIGO / FALTA INSTALAÇÃO CODE 12 |
| Offline → online | eventos nativos + fallback | filas de atraso, formação e jogo | sincronização retomada sem reiniciar app | APROVADO EM CÓDIGO / FALTA APARELHO |
| Site público / visitante | conteúdo público | headers `nosniff`, frame/referrer/permissions | boundaries globais | APROVADO EM CÓDIGO / TESTE VISUAL CONTÍNUO |

## Achados eliminados nesta auditoria

1. **Atualização perdida enquanto o app ficava aberto:** removido. O Android observa a rede nativamente e reconsulta a release ao reconectar, ao voltar do segundo plano e periodicamente.
2. **Privilégio congelado no JWT:** removido. Tipo e status atuais são revalidados no banco.
3. **APK íntegra, mas de pacote/chave errados:** removido. O atualizador também valida package, versionCode e certificado.
4. **Recuperação revelando cadastro:** removida para contas inexistentes.
5. **Datas impossíveis:** cadastro, escalas, formações, atrasos, registros e quizzes usam validação civil real.
6. **Entradas administrativas sem limites suficientes:** celebrante, observações, formação, justificativas, registros, quizzes e ajustes receberam limites explícitos.
7. **Relato de atraso manipulando horário da escala:** removido. Com `escalaId`, data e horário vêm exclusivamente da escala do servidor e o alvo precisa estar nela.
8. **Resultado do jogo saltando direto para o limite diário:** removido. O servidor só aceita a próxima fase e verifica score mínimo cumulativo.
9. **Fases offline do jogo sendo sobrescritas:** removido. O cliente mantém uma fila ordenada e migra o formato antigo.
10. **`localStorage` indisponível fazendo sync parecer offline:** removido com acesso protegido ao armazenamento.
11. **Rate limit crescendo sem limite:** removido no modo de uma réplica; mapa local tem limpeza e teto de chaves.
12. **Maven Central 429 derrubando validação Android de primeira:** CI agora usa cache e repete o Gradle até três vezes.
13. **Promoção dizendo que exigia novo login:** corrigido; o papel novo é reconhecido automaticamente nas próximas requisições.
14. **Sessão autenticada sem diretiva explícita de cache:** `/api/auth/me` agora é `private, no-store`.

## Limites arquiteturais que permanecem documentados

- **Persistência principal em `data/santa-luzia.json`:** é segura para a arquitetura atual de **uma única réplica** com volume persistente e gravação por arquivo temporário, mas não deve ser usada com várias réplicas concorrentes. Antes de escalar horizontalmente, migrar para PostgreSQL/SQLite transacional compartilhado conforme a infraestrutura escolhida.
- **Rate limit:** possui limite de memória, mas é local à réplica. Em múltiplas réplicas, usar Redis/banco compartilhado.
- **Anti-cheat do jogo:** ficou muito mais resistente a salto e repetição, porém um jogo cujo tabuleiro roda no cliente não fornece prova criptográfica de cada movimento. Para competição de alto valor, o próximo nível é sessão de partida assinada/estado validado no servidor.
- **E-mail:** entrega real, spam, indisponibilidade do provedor e expiração precisam de ensaio no ambiente de produção.
- **Arquivo de formação:** extensão/tamanho e download como anexo estão protegidos; antivírus/inspeção profunda de conteúdo não existe nesta arquitetura.
- **Tokens legados:** tokens anteriores à impressão da senha permanecem compatíveis até o próximo login para não desconectar todos de uma vez.
- **Android físico:** Samsung, Motorola e Xiaomi; teclado; menus de seleção; botão Voltar; permissões; suspensão/retorno; Wi-Fi↔dados; instalador e atualização sobre a versão publicada continuam sendo validações obrigatórias que código/CI não conseguem substituir.

## Gate para liberar o próximo jogo

O código pode avançar para a próxima etapa quando `npm run audit:robustez`, `npm run build`, sincronização Capacitor e a compilação Android code 12 passarem sem falha de projeto. A publicação da APK code 12 só ocorre com a chave original e o certificado histórico esperado. A nota física 10/10 só é fechada depois do ensaio em aparelhos reais; esses testes não devem ser simulados nem marcados como concluídos pelo CI.
