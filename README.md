# Forca Gama — Jogo da Forca Bruce B

Jogo da forca temático (Bruce Banner → Hulk) em HTML/CSS/JS puro, com backend no
**Supabase** (projeto `dmcxzxkmxdhmufltlkel`): contas com e-mail e senha, progresso na nuvem,
ranking global real e regras de pontuação à prova de trapaça.

## Documentação

| Documento | Conteúdo |
|---|---|
| [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) | Objetivo, requisitos, regras de negócio e discrepâncias conhecidas |
| [docs/TESTING.md](docs/TESTING.md) | Como rodar os testes e o que eles cobrem |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Deploy do site e do banco, secrets, configuração do Dashboard, rollback |
| [docs/RUNBOOK.md](docs/RUNBOOK.md) | Operação: palavras, categorias, contas, backup, diagnóstico |
| [docs/SECURITY.md](docs/SECURITY.md) | Controle de acesso, segredos e regras de segurança |
| [CLAUDE.md](CLAUDE.md) | Instruções para agentes de IA que trabalham no repositório |

## Arquitetura

```text
Navegador (index.html + script.js)
   │  supabase-js (CDN) + chave publishable (config.js)
   ▼
Supabase
   ├─ Auth ............ e-mail e senha, com confirmação de e-mail
   ├─ PostgREST/RPC ... garantir_perfil, obter_perfil, iniciar_partida, tentar_letra,
   │                    obter_ranking, obter_estatisticas
   └─ Postgres ........ tabelas com RLS; regras em funções SECURITY DEFINER
```

**Princípio:** o servidor é a fonte da verdade. A palavra secreta é sorteada no banco e só
chega ao navegador quando a partida termina; cada letra é validada por `tentar_letra`; a
pontuação, conquistas e recompensas são calculadas no banco. O cliente só pode alterar
preferências (nome, dificuldade, categoria, Plus) — o placar é protegido por grants de coluna.

**Autenticação:** o cadastro envia o nome de exibição em `signUp({ options: { data } })`; um
**trigger** em `auth.users` cria o perfil (funciona mesmo antes de o e-mail ser confirmado).
`garantir_perfil()` recria o perfil de forma idempotente se ele não existir. A senha e o e-mail
ficam **somente** no Supabase Auth; nenhuma tabela da aplicação os copia. A sessão é guardada e
renovada pelo próprio supabase-js (a aplicação não mantém sessão paralela). Contas anônimas não
jogam.

**Modo local (fallback):** se a biblioteca não carregar, ou o servidor estiver fora do ar *e*
não houver sessão salva, o jogo continua com o motor local original (progresso no
`localStorage`, ranking simulado). Com sessão salva e servidor inacessível, o jogo oferece
"Tentar novamente" em vez de trocar para o modo local. Os dois motores têm o mesmo contrato
(`motorLocal` / `motorOnline` em `script.js`).

| Arquivo | Papel |
|---|---|
| `index.html`, `style.css` | Estrutura e visual (inclui telas de carregamento e autenticação) |
| `script.js` | Interface, autenticação (modo online) e motor local |
| `servico-supabase.js` | Camada fina de acesso ao Supabase (único cliente) |
| `config.js` | URL e chave **publishable** (pública por design) |
| `.env.example` | Variáveis dos **testes** (o site não lê `.env`) |
| `supabase/migrations/*` | Esquema, RLS, grants, trigger de perfil e RPCs |
| `supabase/consultas/jogadores_cadastrados.sql` | Consultas de leitura para o SQL Editor |
| `supabase/tests/*` | Testes SQL, ponta a ponta e de interface |
| `.github/workflows/*` | Publicação do site e aplicação das migrations |

### Modelo de dados

| Tabela | Conteúdo | Acesso do cliente (RLS) |
|---|---|---|
| `dificuldades`, `categorias`, `conquistas`, `recompensas` | Catálogos | Leitura pública |
| `palavras` | Banco de palavras | Nenhum (só via RPC) |
| `jogadores` | Perfil + progressão (1 por usuário do Auth; `id` = `auth.users.id`) | Lê o próprio; altera só nome, dificuldade, categoria e Plus. Sem INSERT/DELETE |
| `partidas` | Histórico (`modalidade`, categoria, dificuldade, resultado, pontos, letras) | Lê as próprias, **sem** as colunas `palavra`/`palavra_id`. Escrita só via RPC |
| `jogador_conquistas`, `jogador_recompensas` | Progressão | Lê as próprias |

`jogadores` reúne perfil e progressão do Forca Gama (nome de exibição, pontuação, nível,
sequências, conquistas). `partidas.modalidade` (padrão `forca`) prepara o histórico para novos
jogos; quando um segundo jogo existir, o passo natural é separar a progressão por modalidade.

## Desenvolvimento local

```powershell
npx supabase start     # Postgres + Auth + API + caixa de e-mail de teste (Docker)
npx supabase db reset  # recria o banco local aplicando as migrations
npx supabase stop
```

O `supabase/config.toml` liga a confirmação de e-mail e desliga login anônimo (como no projeto
remoto) e exige senha de 8+ caracteres (como a interface). As opções do remoto, como Site URL e
SMTP, são manuais: ver [DEPLOYMENT.md](docs/DEPLOYMENT.md). Para apontar o site ao ambiente local, troque
temporariamente `config.js` pela URL `http://127.0.0.1:54321` e a chave de `npx supabase status`,
e sirva a pasta na **porta 3000** (`http://127.0.0.1:3000`, a única na lista de redirecionamentos;
o Live Server do VS Code está configurado na 5501 e **não** serve para o fluxo de e-mail).

Testes (SQL, ponta a ponta e de interface): [docs/TESTING.md](docs/TESTING.md).

## Deploy e operação

- O **site** é estático (sem build) e vai para o GitHub Pages a cada push na `main` que altere os
  arquivos do jogo. As **migrations** novas são aplicadas ao mesclar na `main`. Detalhes,
  secrets e configuração manual do Dashboard: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
- Tarefas de operação (quem está cadastrado, novas palavras e categorias, mudar regra de
  pontuação, apagar conta por LGPD, backup): [docs/RUNBOOK.md](docs/RUNBOOK.md).

## Limitações conhecidas

- Sair no meio da partida não conta como derrota (regra herdada do modo local).
- Não há recuperação de senha nem login social ainda.
- O trigger nunca bloqueia um cadastro: se falhar, o perfil é criado no primeiro login por
  `garantir_perfil()`.
- Contas anônimas criadas antes desta versão (se existirem) deixam de poder jogar; o progresso
  delas não é migrado.
- O progresso do `localStorage` do modo local não é enviado à nuvem (aceitar pontuação do
  cliente abriria brecha para trapaça).
- O banco de palavras local (fallback) fica no `script.js`; o servidor pode ter palavras extras.
- Outras discrepâncias de comportamento: [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md), seção 8.
