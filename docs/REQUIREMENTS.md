# Requisitos do Forca Gama

> Descreve o que o sistema **faz hoje**, extraído do código (`index.html`, `script.js`, `servico-supabase.js`, `supabase/migrations/*`) e dos testes (engenharia reversa). Não é uma especificação de intenção: o que o negócio quer e o sistema ainda não faz está na seção 7.
>
> Última análise: 2026-10-21. Os testes foram lidos, não executados. O CSS não foi analisado (aparência e responsividade não estão cobertas).

## 1. Convenções

**Estado:** `IMPL` implementado e confirmado no código · `PARCIAL` implementado com ressalva · `DEMO` demonstrativo (sem efeito real) · `AUSENTE` não existe.

**Teste** (cobertura declarada pela leitura dos testes, ver [TESTING.md](TESTING.md)): `S` = `regras_do_jogo.sql` · `E` = `e2e.mjs` · `U` = `ui.mjs` · `—` = sem teste.

**IDs:** prefixos por área, estáveis (`AUTH-05` continua sendo `AUTH-05` se outro requisito for acrescentado). Regras de negócio `RN-`, não funcionais `NFR-`.

**Fonte de verdade das regras:** o banco (`public.tentar_letra` e demais funções em `supabase/migrations/`). O modo local replica as regras em `script.js` (`aplicarFimDePartidaLocal`, `verificarConquistasERecompensas`); as duas versões precisam ficar iguais.

## 2. Visão geral

- **O que é:** jogo da forca temático (Bruce Banner → Hulk) para navegador, em HTML/CSS/JS puro, com contas por e-mail e senha, progresso salvo na nuvem (Supabase) e ranking global.
- **Atores:** Visitante (sem conta) · Jogador autenticado · Jogador em modo local (offline) · Operador (Dashboard/SQL do Supabase: palavras, consulta de jogadores).
- **Objetivo de negócio** (declarado pelo responsável do produto em 2026-10-21): estimular o exercício da mente e trocar esse esforço por recompensas. O produto entrega desafios e recompensas e quer produzir estatísticas e números sobre o uso.
- **Público-alvo** (declarado): do jogador casual ao frequente, que busca melhorar funções cognitivas ou estimular o cérebro como parte de uma jornada de qualidade de vida e longevidade.
- **Intenção estratégica sobre presença** (declarada, **ainda não implementada**): a pontuação e a presença dos jogadores são estratégicas. Quem joga todo dia mantém sua pontuação; quem se ausenta perde algo, sem que isso desestimule. Ver seção 7.

## 3. Requisitos funcionais

### 3.1 Conta e acesso

| ID | Requisito (comportamento atual) | Estado | Teste | Evidência |
|---|---|---|---|---|
| AUTH-01 | **Cadastro** com nome de exibição, e-mail, senha e confirmação de senha. Validações no cliente: nome obrigatório e ≤ 24 caracteres; e-mail em formato válido (≤ 254); senha de 8 a 72 caracteres; confirmação igual à senha. O nome tem espaços repetidos colapsados. | IMPL | E U | script.js (`validarCadastro`, `enviarCadastro`) |
| AUTH-02 | **Confirmação de e-mail obrigatória** (confirmada no projeto remoto em 2026-10-19). Após o cadastro sem sessão, a tela volta ao login com o e-mail preenchido e um aviso neutro (igual para e-mail novo ou já cadastrado). Se o servidor devolver sessão, entra direto. | IMPL | E U | script.js (`mostrarConfirmacaoPendente`) |
| AUTH-03 | **Login** com e-mail e senha. | IMPL | E U | script.js (`enviarLogin`) |
| AUTH-04 | **Mensagens de erro de autenticação** em português, sem detalhe técnico e sem revelar se um e-mail existe. Cobre: credenciais inválidas, e-mail não confirmado, senha fraca, limite de tentativas, e-mail inválido, cadastro desativado, conta existente, falha de rede, erro genérico. | IMPL | E U | script.js (`traduzirErroDeAutenticacao`) |
| AUTH-05 | **Sessão persistente:** ao abrir/recarregar a página a sessão é recuperada (inclusive a vinda do link de confirmação) e o jogador vai direto ao painel, sem o login "piscar" (tela "Verificando sua sessão…"). | IMPL | E U | script.js (`verificarSessao`, `inicializar`) |
| AUTH-06 | **Logout** encerra apenas o dispositivo atual (escopo local) e descarta da memória e da tela os dados privados (perfil, ranking, categorias, conquistas). | IMPL | E U | script.js (`sairDaConta`, `limparEstadoPrivado`) |
| AUTH-07 | **Sessão expirada ou inválida** durante o uso: volta ao login com "Sua sessão expirou. Entre novamente." | IMPL | U | script.js (`erroDeSessao`, `encerrarSessaoLocal`) |
| AUTH-08 | **Falha de conexão com sessão salva:** tela "Tentar novamente" (e "Sair da conta"), sem trocar para o modo local, para não criar progresso paralelo. | IMPL | U | script.js (`abrirSessao`, `inicializar`) |
| AUTH-09 | **Perfil automático:** criado por trigger no cadastro e recriado de forma idempotente por `garantir_perfil()` se faltar. Nome do perfil: 1 a 24 caracteres; vazio vira "Jogador". | IMPL | S E | migration `autenticacao_email` |
| AUTH-10 | **Contas anônimas não jogam:** as RPCs as recusam e o trigger não lhes cria perfil. O login anônimo está desligado no projeto (verificado em 2026-10-19). | IMPL | S | migration `autenticacao_email` |
| AUTH-11 | **Sincronia entre abas:** login feito em outra aba abre a sessão aqui; logout em outra aba encerra esta. | IMPL | — | script.js (`tratarMudancaDeSessao`) |

### 3.2 Partida

| ID | Requisito | Estado | Teste | Evidência |
|---|---|---|---|---|
| GAME-01 | **Escolher dificuldade** (Fácil ×1, Médio ×2, Difícil ×3) e **categoria**. As categorias oferecidas são as que têm palavras ativas no servidor para a dificuldade (no modo local, as do banco local). Há 16 categorias no catálogo: Fácil usa 10, Médio 12 e Difícil 12. | IMPL | U (parcial) | script.js (`categoriasDisponiveis`, `selecionarDificuldade`) |
| GAME-02 | **Iniciar partida:** o servidor sorteia uma palavra ativa da dificuldade e categoria e devolve **apenas o tamanho**. A tela mostra uma lacuna por letra, erros em 0, letras usadas vazias, estágio inicial da transformação e a mensagem "Partida iniciada…". Sem palavras para a combinação, a partida não inicia. | IMPL | S U | `public.iniciar_partida`; script.js (`iniciarPartida`) |
| GAME-03 | **Informar uma letra** pelo teclado virtual QWERTY ou pelo teclado físico (só durante a partida, apenas a–z). Maiúscula e minúscula são equivalentes; qualquer outra entrada é ignorada. Combinações com Ctrl, Cmd ou Alt não são jogadas (os atalhos do navegador, como Ctrl+R, seguem funcionando). Só uma jogada por vez é enviada enquanto o servidor responde. | IMPL | S U (físico) | script.js (`processarTentativaDeLetra`) |
| GAME-04 | **Acerto:** a letra aparece em todas as posições, sem penalidade, a tecla é marcada como correta e a sequência de letras seguidas aumenta. | IMPL | S U | `public.tentar_letra` |
| GAME-05 | **Erro:** soma 1 ao contador (limite 6), a tecla é marcada como errada, a sequência de letras zera e a transformação avança um estágio (7 estágios, 0 a 6, cada um com seu rótulo, de "Bruce Banner: calmo" a "HULK SMASH! Transformação completa"). | IMPL | S | script.js (`ROTULOS_DE_ESTAGIO`) |
| GAME-06 | **Letra repetida:** mostra "A letra X já foi utilizada." e não altera erros, palavra nem lista de tentativas (o servidor também devolve `repetida` sem alterar nada). | IMPL | S | `public.tentar_letra` |
| GAME-07 | **Vitória:** quando todas as letras distintas da palavra foram descobertas. Encerra a partida, revela a palavra e mostra o resultado, com confete. | IMPL | S U | `public.tentar_letra`; script.js (`mostrarResultado`) |
| GAME-08 | **Derrota:** ao chegar a 6 erros sem descobrir a palavra. Encerra a partida e revela a palavra. | IMPL | S | `public.tentar_letra` |
| GAME-09 | **Partida encerrada não aceita letras** (servidor recusa com código `22023`; teclado virtual é desabilitado). Se a resposta da última letra se perdeu, mas o servidor já encerrou a partida, a interface sincroniza o perfil e avisa. | IMPL | S E | `public.tentar_letra`; script.js (`sincronizarPartidaEncerrada`) |
| GAME-10 | **Estado exibido:** lacunas, % da palavra descoberta, letras usadas (diferenciadas entre corretas e erradas), "Exposição: n / 6", medidor de 6 segmentos, sequência de letras seguidas, nível, sequência de vitórias e multiplicador de pontos da dificuldade. | IMPL | U (parcial) | script.js |
| GAME-11 | **Tela de resultado:** pontos da partida, pontos de treino mental, vitórias seguidas, novidades (conquistas e recompensas) e um anúncio demonstrativo (oculto para quem marcou Plus). Ações: "Continuar jornada" (painel) e "Jogar novamente" (mesma dificuldade e categoria). | IMPL | U | script.js (`mostrarResultado`) |
| GAME-12 | **Sair da partida:** o botão volta ao painel; não conta como derrota. No servidor a partida só é marcada como abandonada quando o jogador inicia a próxima. | IMPL | S (abandono) | `public.iniciar_partida` |
| GAME-13 | **Falha de conexão durante a partida:** a letra não é registrada, aparece "Falha de conexão… tente novamente" e o jogo continua. Respostas atrasadas de partidas já abandonadas são descartadas. | IMPL | — | script.js (`processarTentativaDeLetra`) |

### 3.3 Pontuação e progressão

| ID | Requisito | Estado | Teste | Evidência |
|---|---|---|---|---|
| PROG-01 | **Pontos ao fim da partida** conforme RN-09 e RN-10; o placar só muda pelas funções do servidor. | IMPL | S | `public.tentar_letra` |
| PROG-02 | **Nível, XP e título da jornada:** nível = pontuação ÷ 300 + 1; barra "x / 300 XP". Títulos: níveis 1–2 Semente, 3–4 Em crescimento, 5–7 Árvore forte, 8–11 Brilho Gama, 12+ Lenda Gama. | IMPL | — | script.js (`atualizarPainel`) |
| PROG-03 | **Sequências:** de vitórias (zera na derrota; abandonar não zera) com a melhor registrada, e de letras seguidas (zera no erro). São contadas **por partida**, não por dia. | IMPL | S | `public.tentar_letra` |
| PROG-04 | **Conquistas** (7), avaliadas ao fim de cada partida (ver RN-11). O painel mostra 3 e o contador "n / 7"; o modal mostra todas. | IMPL | S E | `interno.avaliar_progressao` |
| PROG-05 | **Recompensas "Oportuni Clube"** (7), avaliadas ao fim da partida, com metas reduzidas nos níveis Médio e Difícil (RN-12). São **simuladas**: o texto diz "Oportuni Clube (simulado)" e não há resgate. | DEMO | S (parcial) | `interno.avaliar_progressao` |
| PROG-06 | **Progresso na conta:** pontuação, partidas, sequências, conquistas e recompensas são recuperados ao entrar de novo ou em outro dispositivo. | IMPL | E U | script.js (`abrirSessao`) |
| PROG-07 | **Histórico:** o modal "Progresso" lista as 5 últimas partidas concluídas (resultado, categoria, dificuldade, pontos, data). Nunca expõe a palavra. | IMPL | E U | script.js (`preencherHistorico`) |
| PROG-08 | **Atividade cognitiva:** pontos de treino mental acumulados, mostrados como "indicador lúdico" (barra = pontos mod 100). Não é medida clínica. | IMPL | — | script.js (`atualizarPainel`) |

### 3.4 Painel, ranking e comunidade

| ID | Requisito | Estado | Teste | Evidência |
|---|---|---|---|---|
| DASH-01 | **Painel:** saudação, nível, pontos, vitórias, sequência, barras de XP e de atividade, avatar de jornada, 3 conquistas, escolha de desafio e atalhos para os modais (Progresso, Conquistas, Ranking, Recompensas, Apoio/Plus). | IMPL | U | script.js (`mostrarPainel`) |
| DASH-02 | **Ranking global:** o servidor devolve o top 10 e a posição do próprio jogador. Enquanto o ranking e as estatísticas carregam, o painel mostra "—", "Carregando…" e rótulos neutros; se a carga falhar, "indisponível no momento". Nunca mostra dados simulados no modo online. O painel mostra 5 linhas (se o jogador está fora do top 5, ele aparece no lugar da última); o modal mostra a lista recebida. Nomes em maiúsculas. Ver RN-13. | IMPL | S E | `public.obter_ranking` |
| DASH-03 | **Atividade em tempo real:** "estimados jogando" (jogadores vistos nos últimos 5 min), "nesta categoria" (jogadores com partida iniciada nos últimos 15 min) e média de pontos por categoria (30 dias), além da contagem de palavras por categoria. | IMPL | S (palavras) | `public.obter_estatisticas` |
| DASH-04 | **Presença de sessão:** a cada 2 minutos, com a aba visível e logado, a interface chama `obter_perfil`, que atualiza "visto em". Serve ao contador de jogadores online; não registra dias de jogo. | IMPL | — | script.js (`INTERVALO_PRESENCA_MS`) |
| DASH-05 | **Preferências:** dificuldade e categoria escolhidas e a marcação de interesse em Plus são salvas no perfil e restauradas depois. | IMPL | S | servico-supabase.js (`salvarPreferencias`) |
| DASH-06 | **Modais:** Progresso, Conquistas, Ranking, Recompensas, Apoio e Plus; fecham com Esc, clique fora ou botão. | IMPL | — | script.js (`abrirModal`) |

### 3.5 Modo local (offline)

| ID | Requisito | Estado | Teste | Evidência |
|---|---|---|---|---|
| LOCAL-01 | **Quando ativa:** sem a biblioteca do Supabase, sem configuração, ou com o servidor inacessível **e** nenhuma sessão salva. | IMPL | U | script.js (`inicializar`) |
| LOCAL-02 | **Identificação por apelido** (sem senha); progresso no `localStorage` (`forcaGama.player.v1`) deste navegador; "Trocar" apaga o perfil local. | IMPL | U | script.js (`carregarPerfil`, `trocarUsuario`) |
| LOCAL-03 | **Mesmas regras de jogo e pontuação** do servidor, com banco de palavras embutido no `script.js`. Ranking e atividade são **simulados** e rotulados como "demonstrativos". | IMPL | U (parcial) | script.js (`motorLocal`, `DADOS_MOCK`) |
| LOCAL-04 | **Sem sincronização:** o progresso local nunca é enviado à nuvem. | IMPL | — | README (limitação conhecida) |

### 3.6 Elementos demonstrativos

| ID | Requisito | Estado | Evidência |
|---|---|---|---|
| DEMO-01 | **Conta Plus:** só registra interesse (alterna `is_plus`); não há pagamento e a opção oculta o anúncio demonstrativo. | DEMO | script.js (`abrirModal('plus')`) |
| DEMO-02 | **Anúncio pós-partida:** bloco fixo "Parceiro demonstrativo… nenhum anúncio real". | DEMO | index.html |
| DEMO-03 | **Apoio ao projeto:** espaço reservado para QR Code, sem cobrança. | DEMO | script.js (`abrirModal('apoio')`) |

## 4. Regras de negócio

| ID | Regra | Fonte |
|---|---|---|
| RN-01 | Cada partida tem **uma única palavra secreta**, sorteada no servidor entre as palavras ativas da dificuldade e categoria. Ela só chega ao cliente quando a partida termina. | `iniciar_partida`, `tentar_letra` |
| RN-02 | Cada tentativa é **uma letra de A a Z**; minúsculas valem como maiúsculas. As palavras do catálogo não têm acento (`^[A-Z]{2,30}$`). | `tentar_letra`, tabela `palavras` |
| RN-03 | **Acerto:** a letra é revelada em todas as posições e não há penalidade. | `tentar_letra` |
| RN-04 | **Erro:** soma 1 ao contador. O limite é **6 erros**. | tabela `partidas`, `tentar_letra` |
| RN-05 | **Letra repetida:** não gera penalidade nem altera o estado. | `tentar_letra` |
| RN-06 | **Vitória** = todas as letras distintas da palavra descobertas. **Derrota** = 6 erros antes disso. | `tentar_letra` |
| RN-07 | Após vitória ou derrota, **nenhuma nova letra** é aceita naquela partida. | `tentar_letra` |
| RN-08 | Cada jogador tem **no máximo uma partida em andamento**. Iniciar outra marca a anterior como "abandonada", **sem derrota** e sem alterar vitórias, derrotas ou sequência de vitórias. | índice `partidas_uma_aberta_idx`, `iniciar_partida` |
| RN-09 | **Pontos da partida.** Base única de 40 pontos, escalada pelo multiplicador da dificuldade (Fácil ×1, Médio ×2, Difícil ×3). Vitória: `(40 + 5 × letras distintas acertadas) × multiplicador`. Derrota: `round(20% × 40 × multiplicador)` (8, 16 ou 24). O multiplicador também reduz as metas de recompensa (RN-12). Regra vigente desde 2026-10-21 (migration `pontos_multiplicados`); as partidas anteriores mantêm os pontos que receberam (antes a base era 40/90/150 e o multiplicador não escalava os pontos). | `tentar_letra`; script.js `aplicarFimDePartidaLocal` |
| RN-10 | **Pontos cognitivos:** `base + letras distintas acertadas + 5 se vencer`. Base: Fácil 5, Médio 9, Difícil 14. | `tentar_letra` |
| RN-11 | **Conquistas** (avaliadas só ao fim da partida): Primeiro acerto (1 letra descoberta no total), Primeira missão (1 vitória), Olho atento (melhor sequência de 5 letras), Dez vitórias, Mestre das palavras (100 letras descobertas), Centenário (100 partidas), Domínio Gama (1 vitória no Difícil). | migration `catalogo_inicial` |
| RN-12 | **Recompensas simuladas:** por vitórias (metas-base 5, 10, 25, 50) e por sequência de vitórias (3, 7, 14). No Médio e Difícil, as metas de vitória viram `ceil(meta ÷ multiplicador)` (Médio 3, 5, 13, 25; Difícil 2, 4, 9, 17) e as de sequência `max(2, meta − (multiplicador − 1))` (Médio 2, 6, 13; Difícil 2, 5, 12). Cada recompensa tem variante "base" (Fácil) ou "evolução" (Médio/Difícil). | `interno.avaliar_progressao` |
| RN-13 | **Ranking:** entram quem jogou pelo menos uma partida e o próprio jogador; ordem por pontuação decrescente (empates dividem a posição); o limite pedido vai de 1 a 50 (padrão 10). Expõe só nome, pontos, nível, posição e "é você". É acessível **apenas a usuários autenticados**. | `obter_ranking` |
| RN-14 | **Nome de exibição:** 1 a 24 caracteres, espaços colapsados; vazio vira "Jogador". O nome é público no ranking. | `interno.nome_de_exibicao` |
| RN-15 | **Presença:** "online" = visto nos últimos 5 minutos. | `obter_estatisticas` |
| RN-16 | **Privacidade das credenciais:** e-mail e senha ficam só no Supabase Auth; nenhuma tabela da aplicação os copia. | migration `autenticacao_email` |
| RN-17 | **Mudanças no placar** (pontos, vitórias, sequências, conquistas) só ocorrem por funções do servidor; o cliente altera apenas nome, dificuldade, categoria e Plus. | grants e RLS ([SECURITY.md](SECURITY.md)) |

## 5. Requisitos não funcionais (observados)

| ID | Requisito observado | Evidência |
|---|---|---|
| NFR-01 | **Segurança de dados:** RLS em todas as tabelas; grants mínimos; funções `SECURITY DEFINER` com `search_path` vazio; `EXECUTE` só para `authenticated`; schema `interno` fechado; coluna da palavra secreta ilegível até para o dono. Detalhes em [SECURITY.md](SECURITY.md). | migrations; testes S E |
| NFR-02 | **Integridade e concorrência:** jogadas na mesma partida são serializadas (`FOR UPDATE`); índice único impede duas partidas abertas; jogadas repetidas ou em partida encerrada não duplicam efeitos; a interface descarta respostas de partidas antigas. | `tentar_letra`; script.js |
| NFR-03 | **Resiliência:** toda chamada ao servidor tem limite de 8 s; falhas de rede têm tratamento próprio; modo local quando não há servidor nem sessão. | servico-supabase.js |
| NFR-04 | **Privacidade no log:** o log do cliente registra só nome, código e status do erro, nunca e-mail, senha ou token. | script.js (`registrarErro`) |
| NFR-05 | **Implantação:** site estático sem build no GitHub Pages; migrations aplicadas automaticamente ao mesclar na `main`. Ver [DEPLOYMENT.md](DEPLOYMENT.md). | `.github/workflows` |
| NFR-06 | **Idioma:** apenas português do Brasil, com textos embutidos no código. | — |
| NFR-07 | **Compatibilidade:** exige navegador moderno (usa `AbortSignal.timeout`, encadeamento opcional). Versões suportadas **não definidas**. | servico-supabase.js |
| NFR-08 | **Acessibilidade:** há rótulos ARIA, foco em campos com erro, `aria-live` e `role="alert"`. Não há armadilha de foco no modal. Nenhuma auditoria foi feita. | index.html; script.js |
| NFR-09 | **Desempenho, capacidade, disponibilidade (SLA), retenção e metas quantitativas:** *não identificados*. | — |

## 6. Dados de referência (catálogo atual)

- 3 dificuldades, 16 categorias, 179 palavras ativas, 7 conquistas, 7 recompensas.
- Palavras repetidas entre categorias: LIVRO (Geral e Cultura); JUPITER, SATURNO, GALAXIA, NEBULOSA, ASTEROIDE, METEORO (Viagens e Planetas e Galáxias); PREVISAO e MODELO (Tecnologia e Inteligência Artificial).

## 7. O que não existe hoje

### 7.1 Intenção de negócio ainda não implementada (roadmap, a especificar)

| ID | Intenção declarada | Estado atual | O que falta definir |
|---|---|---|---|
| ROAD-01 | **Presença estratégica:** quem joga todo dia mantém a pontuação; quem se ausenta perde algo, sem desestimular. | AUSENTE. O modelo só tem sequências por partida (PROG-03) e presença de sessão de 5 min (DASH-04). Nenhum dado registra dias jogados. | O que decai (pontos, nível, sequência?); dias de carência; taxa e piso da perda; como recuperar o que foi perdido; limite do dia (fuso America/Sao_Paulo); efeito no ranking; como comunicar ao jogador. Exige novo dado no banco (por exemplo, último dia jogado e sequência diária) e a mesma regra no modo local. |
| ROAD-02 | **Trocar o esforço por recompensas reais.** | DEMO (PROG-05, DEMO-01 a DEMO-03). Não há resgate, parceiros nem cobrança. | Catálogo de recompensas, regras de resgate, parceiros, custos, aspectos legais e de privacidade. |
| ROAD-03 | **Estatísticas e números** sobre o uso e a evolução dos jogadores. | PARCIAL: ranking, atividade por categoria, histórico das 5 últimas partidas e médias por categoria. | Quais indicadores, para quem (jogador, operador) e com que período. |
| ROAD-04 | **Benefícios cognitivos e de longevidade** como proposta de valor. | O jogo chama os pontos de "indicador lúdico" (PROG-08); não mede função cognitiva. | Qualquer alegação de melhora cognitiva ou de longevidade precisa de validação (científica, regulatória e jurídica) antes de ser comunicada ao público. |

### 7.2 Funcionalidades ausentes

Recuperação de senha · login social · alterar e-mail ou senha na interface · excluir a conta pela interface (só pelo Dashboard) · moderação ou filtro de nomes · aviso de privacidade e termos na interface · anúncios, pagamento ou resgate de recompensas reais · cache offline/PWA · telemetria · interface administrativa de palavras (é por SQL) · filtros do ranking por período · segundo jogo (a coluna `modalidade` só deixa o histórico preparado) · auditoria de acessibilidade.

## 8. Discrepâncias e observações

### Abertas

| ID | Observação | Impacto |
|---|---|---|
| D-05 | As letras seguidas são gravadas a cada jogada, então partidas **abandonadas** alteram a "melhor sequência de letras"; a conquista só é avaliada ao fim de uma partida concluída. | Efeito sutil; sem dano aparente. |
| D-06 | Sair da partida **não encerra** a partida no servidor; ela continua "em andamento" (e conta em "jogando agora" por até 15 min) até a próxima partida. Jogar e abandonar não custa nada. | Estatística de atividade inflada; sem penalidade ao abandonar. |
| D-07 | O ranking é chamado de "global", mas só usuários autenticados o enxergam. | Esclarecer na documentação de produto. |
| D-08 | O contador de conquistas no HTML nasce como "0 / 6", mas o catálogo tem 7 (corrigido na primeira renderização). | Cosmético. |
| D-09 | O projeto remoto ainda tinha contas **anônimas** legadas (da versão anterior à autenticação), que não conseguem mais jogar, mas seus perfis com partidas aparecem no ranking. A remoção foi decidida pelo responsável e deve ser feita por [RUNBOOK.md](RUNBOOK.md) (item "Remover contas anônimas"). | Ruído no ranking antes do lançamento. |

### Resolvidas

| ID | Resolução |
|---|---|
| D-01 | O botão da tela de resultado repetia a mesma categoria, mas dizia "Jogar outra categoria". Agora diz **"Jogar novamente"**; escolher outra categoria continua sendo pelo "Continuar jornada". |
| D-02 | No modo online, enquanto o ranking e as estatísticas não chegavam (ou se falhassem), o painel mostrava dados simulados sob os rótulos "AO VIVO" e "Dados em tempo real". Agora mostra "—", "Carregando…" ou "indisponível no momento" (ver DASH-02). Coberto por `ui.mjs`. |
| D-03 | Ctrl/Cmd/Alt + letra durante a partida virava jogada e tinha o padrão do navegador bloqueado (Ctrl+R não recarregava). Agora essas combinações são ignoradas pelo jogo (ver GAME-03). Coberto por `ui.mjs`; não testado em navegador real. |
| D-04 | A tela exibia "×1/×2/×3" e "+2× PONTOS", mas os pontos vinham de uma tabela por dificuldade (40/90/150) sem relação com o multiplicador. A regra mudou: os pontos agora **são multiplicados** pelo multiplicador da dificuldade (RN-09). Os rótulos passaram a ser verdadeiros. |

## 9. Pendente de validação humana

1. Decisões de produto de ROAD-01 (presença) e ROAD-02 (recompensas reais), com seus parâmetros.
2. Navegadores a suportar (NFR-07) e metas de desempenho e disponibilidade (NFR-09).
3. Se quer que a leitura "quem joga todo dia mantém a pontuação" valha também para o modo local.

## 10. Rastreabilidade com a especificação original da forca

A especificação genérica do jogo (RF01–RF11, RN01–RN12) está coberta assim:

| Original | Coberto por |
|---|---|
| RF01 Iniciar partida · RF02 Palavra oculta | GAME-02, GAME-10 |
| RF03 Informar letra | GAME-03 |
| RF04 Acertos · RF05 Erros | GAME-04, GAME-05 |
| RF06 Repetidas | GAME-06 |
| RF07 Vitória · RF08 Derrota | GAME-07, GAME-08, GAME-09 |
| RF09 Letras usadas · RF10 Erros | GAME-10 |
| RF11 Desenhar a forca | GAME-05: **desvio** — o progresso é a transformação Bruce Banner → Hulk em SVG de 6 estágios, não uma forca. A especificação permitia outra representação desde que respeitasse a progressão. |
| RN01 a RN12 | RN-01 a RN-08 (a equivalência de maiúsculas e minúsculas está em RN-02) |
