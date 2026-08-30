# Santa Luzia — referência definitiva Windows Beta → Android Kotlin/Python

Este documento é um contrato de fidelidade. Ele existe para impedir que a reescrita nativa transforme a interface aprovada em um aplicativo genérico diferente.

## Regra de prioridade

Quando houver conflito entre versões antigas, aplicar nesta ordem:

1. decisões finais registradas nas Motion Betas 15, 16, 17 e 18;
2. interface e conteúdo da Windows Beta 19 usada no teste de referência;
3. comportamento funcional consolidado nas Betas anteriores;
4. mockups, screenshots e ideias antigas somente quando não contradisserem os itens acima.

A linha verde antiga e mockups anteriores não substituem a identidade final Manto Rubi.

## Referência Windows

- Identidade histórica: `SantaLuziaWindowsBeta/0.1.0-beta.19`.
- Commit histórico informado nos relatórios Motion: `1c798019ebcb7ace6fbaa762fab398b92385a361`.
- Camadas históricas usadas na referência móvel anterior: `motion-fixes.css`, `behavior-fixes.js`, `beta7-polish.js`, `preload-v5.cjs` e `windows-beta-runtime.js` rev. 14.
- Na reescrita atual essas camadas NÃO são executadas no Android: o comportamento correspondente deve existir diretamente em Kotlin/Jetpack Compose.

## Identidade visual final

Tema padrão Manto Rubi, conforme a Windows Beta:

- fundo: `#FFF8EE`;
- texto principal: `#3F171C`;
- cartão: `#FFFAF4`;
- rubi principal: `#7B1326`;
- rubi profundo: `#5A0B18`;
- dourado: `#D4AF37`;
- dourado claro: `#F2CF62`;
- secundário: `#F4E8D3`;
- suave: `#F7EEE2`;
- borda: `#DCC7B7`.

O banner deve usar a arte real `public/images/hero-adoracao.jpg`. Logo e hero são arquivos diferentes. É proibido substituir o hero pelo ícone do aplicativo.

## Home pública — decisão final

A Beta 15 substitui variações anteriores. A Home deve ter banner limpo com a imagem integral/dominante e exatamente quatro atalhos públicos:

1. Centro Litúrgico;
2. Escala do Dia;
3. Biblioteca;
4. Liturgia Diária.

Não reintroduzir `Formação`, `Seja um Membro` ou outros cartões antigos nessa grade de quatro atalhos.

## Login e sessão

- acesso à Área Restrita por usuário/e-mail e senha;
- cadastro e recuperação de senha preservados;
- caminho explícito para continuar como visitante;
- depois do primeiro login válido, sessão e dados essenciais permanecem utilizáveis offline;
- login inicial que ainda não possui sessão válida requer internet;
- não existe animação de personagem/porta na entrada ou saída;
- saída usa ícone convencional e confirmação `Deseja sair?` com `Sim` / `Não`.

## Barra inferior autenticada

Exatamente quatro destinos, como definido na Beta 15 e preservado na Beta 18:

- Início;
- Escala;
- Formação;
- Quiz.

A animação dos ícones/transições deve ser nativa. O ícone Início mantém movimento próprio. Não reintroduzir scripts CSS/JS da Windows no APK.

## Painel de membro

Preservar a hierarquia da última Windows Beta:

- cabeçalho compacto da Área Restrita;
- resumo/editável de Meu Perfil;
- próximo compromisso;
- três atalhos compactos: Formação, Jornada e Atrasos;
- faixa horizontal de perfis da equipe, estilo Status, com arraste lateral;
- busca por nome;
- perfil aberto em modal/tela com X, rolagem interna, foto proporcional, classificação, pontos e aproveitamento;
- justificativa de ausência ligada à escala e enviada ao moderador;
- aviso de que faltas, advertências, justificativas e observações administrativas são privadas.

## Painel de moderador

A administração NÃO deve ser despejada no dashboard.

O painel principal deve permanecer compacto e conter:

- cabeçalho Área Restrita + identificação de Moderador;
- Meu Perfil;
- resumo de Acólitos, Coroinhas, Aguardando e Advertências;
- atalhos compactos de Atrasos e Presenças;
- aprovações/equipe quando existirem;
- faixa de perfis da equipe.

Funções administrativas ficam no menu.

## Menu final do membro

- Meu perfil;
- Atrasos;
- Jornada;
- Escala;
- Formação.

## Menu final do moderador

Conjunto consolidado da Windows Beta + correções posteriores:

- Painel;
- Atrasos;
- Jornada;
- Escalas;
- Formação;
- Presenças;
- Registro;
- Quizzes;
- Cores;
- Escala pública;
- Dados / Administração de dados;
- Acervo litúrgico;
- Auditor Santa Luzia.

`Administração de dados` fica aqui e nunca como um grande cartão do dashboard.

## Perfis

Correções finais das Betas 15/16/18:

- lista horizontal estilo Status;
- arraste lateral;
- pesquisa por nome;
- modal com botão X;
- rolagem interna;
- foto sem deformação;
- função/data na equipe;
- recado/bio;
- classificação;
- pontos;
- aproveitamento;
- dados administrativos privados.

Meu Perfil preserva foto, nome, datas aplicáveis, recado/bio, preferências pertinentes e exclusão de conta quando autorizada.

## Escalas

- próximas escalas;
- histórico;
- histórico mostra primeiro as mais recentes;
- escalas antigas localizáveis por data e tempo litúrgico;
- justificativa de ausência vinculada à escala;
- somente quem estiver escalado pode justificar por esse fluxo;
- edição/publicação do moderador preservada;
- consulta e dados já sincronizados funcionam offline;
- alterações locais suportadas entram em fila durável e sincronizam depois.

## Formação, Presenças e Registros

Preservar todos os fluxos consolidados da Windows/Motion:

- Formação para membros e gerenciamento do moderador;
- controle de presença;
- registros administrativos;
- privacidade por perfil/permissão;
- funcionamento local-first onde a regra de negócio permitir.

## Atrasos

- qualquer membro pode relatar atraso de um colega;
- o relato aparece ao envolvido e ao moderador;
- somente o moderador confirma se houve atraso;
- dados administrativos privados não devem vazar para perfis públicos.

## Jornada, Quiz, Ranking e Jogos

Preservar:

- Jornada Litúrgica;
- quiz diário/avulso conforme regras existentes;
- ranking;
- pontuação integrada;
- jogos empacotados/localmente disponíveis conforme o contrato offline;
- progressão e efeitos/sons já aprovados onde aplicável;
- nada deve depender de uma WebView ou de carregar a interface do servidor.

## Offline e sincronização

A arquitetura final é nativa/local-first:

- Kotlin + Jetpack Compose no aplicativo;
- SQLite nativo e DataStore;
- fila durável de mutações;
- sincronização com o servidor quando a rede volta;
- conteúdo litúrgico essencial empacotado no APK;
- nada de `server.url`, WebView, HTML/CSS/JS como interface;
- isolamento dos dados privados por conta/sessão.

O comportamento equivalente ao histórico SQLite deve preservar integridade, WAL/transações, backup/recuperação e auditoria de saúde.

## Backend final

O backend final da reescrita é Python/FastAPI. A migração só é válida com paridade endpoint a endpoint, paridade semântica, regras de negócio, uploads e proteção do banco aprovados pelos scripts de auditoria do diretório `python-backend`.

A interface Kotlin não deve depender do backend TypeScript para ser considerada concluída.

## Auditor Santa Luzia

Decisões finais das Betas 15–18:

- auditor nativo;
- online/offline;
- erros e alertas;
- rede;
- desempenho/FPS/long tasks equivalentes quando disponíveis nativamente;
- rolagem;
- ícones/alvos interativos;
- banco local;
- fila;
- exportação e compartilhamento de JSON;
- Deep Scan de interface (ícones, alvos, imagens, clipping, overflow, modais, barra inferior e transições);
- defeitos repetidos contam como uma assinatura com `occurrences`, e não como vários defeitos independentes;
- limpar histórico também deve limpar o último relatório técnico correspondente;
- NÃO reintroduzir a opção/tela `Meu relatório`.

A interface do Auditor permanece simples; detalhes técnicos extensos pertencem ao relatório exportado.

## Bugs históricos que não podem voltar

- `updateBottomNav is not defined`;
- assimilação indevida de `OfflineStore.then`;
- shell alternativo/offline diferente da interface real;
- travamento/erro de rede ao navegar offline por rotas já aquecidas;
- hero substituído pelo ícone;
- administração jogada no dashboard;
- barra inferior desaparecendo;
- perfis sem X/sem rolagem/imagen deformada;
- regressão de scroll até o rodapé;
- Next.js hydration mismatch — eliminado estruturalmente pela UI Kotlin;
- 401 pré-login/fallbacks esperados não devem inflar contagem do Auditor como defeitos únicos.

## Evidências históricas usadas

Relatórios recuperados do histórico de testes:

- `RELATORIO-MOTION-BETA3.txt`;
- `RELATORIO-MOTION-BETA4.txt`;
- `RELATORIO-MOTION-BETA5.txt`;
- `RELATORIO-MOTION-BETA7.txt`;
- `RELATORIO-MOTION-BETA13.txt`;
- `RELATORIO-MOTION-BETA15.txt`;
- `RELATORIO-MOTION-BETA16.txt`;
- `RELATORIO-MOTION-BETA17.txt`;
- `RELATORIO-MOTION-BETA18.txt`;
- relatórios `Santa-Luzia-Diagnostico-2026-08-26-*.json`.

Referências visuais recuperadas incluem screenshots da Home e da Área Restrita/moderador. Imagens/mockups verdes mais antigos são material histórico e não substituem o Manto Rubi final.

## Gate da próxima Beta

Uma Beta Kotlin/Python só pode ser entregue para teste quando:

1. compilar sem WebView/interface web;
2. backend Python passar auditorias de paridade e regras de negócio;
3. APK contiver a arte real do hero e o conteúdo offline;
4. Home, Login, membro e moderador forem validados separadamente;
5. menu do moderador for validado e Administração continuar fora do dashboard;
6. barra inferior autenticada tiver somente Início/Escala/Formação/Quiz;
7. perfis, escalas, atrasos, formação, registros, jornada/ranking/jogos e Auditor continuarem acessíveis;
8. não houver fatal exception nos testes Android;
9. o pacote continuar isolado da versão oficial enquanto estiver em Beta.
