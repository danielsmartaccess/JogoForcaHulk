# Forca Gama — Jogo da Forca Broce B

Jogo da forca temático (Bruce Banner → Hulk) em HTML/CSS/JS puro, com backend no
**Supabase** (projeto `dmcxzxkmxdhmufltlkel`): contas com e-mail e senha, progresso na nuvem,
ranking global real e regras de pontuação à prova de trapaça.

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

## Deploy do banco

O workflow `.github/workflows/migrations-supabase.yml` aplica as migrations novas ao mesclar na
`main`. Manualmente:

```powershell
npx supabase login
npx supabase link --project-ref dmcxzxkmxdhmufltlkel   # pede a senha do banco
npx supabase db push
```

### Configuração manual no Supabase (Dashboard)

1. **Authentication → URL Configuration:**
   *Site URL* = `https://danielsmartaccess.github.io/JogoForcaHulk/` e adicione a mesma URL em
   *Redirect URLs*. Sem isso o link do e-mail de confirmação aponta para `localhost`.
2. **Authentication → Sign In / Providers:** mantenha **Email** ligado com *Confirm email*;
   **desligue** *Allow anonymous sign-ins* (o jogo não usa mais e as RPCs já recusam anônimos).
3. **Authentication → Attack Protection:** ative o CAPTCHA e revise o tamanho mínimo da senha
   (a interface exige 8 caracteres).
4. **E-mail em produção:** o servidor de e-mail padrão do Supabase tem limite baixo (poucos
   e-mails por hora) e é só para testes. Configure um SMTP próprio em
   *Authentication → Emails → SMTP Settings* antes de abrir o jogo ao público.
5. Opcional: personalize o modelo do e-mail *Confirm signup* em português.

## Deploy do site

O site é estático (sem build) e é publicado no **GitHub Pages** pelo workflow
`.github/workflows/publicar-site.yml` a cada push na `main`. Só `index.html`, `style.css`,
`script.js`, `config.js` e `servico-supabase.js` vão para o ar.

Configuração única: **Settings → Pages → Source: GitHub Actions**.

Secrets do workflow de migrations (**Settings → Secrets and variables → Actions**):
`SUPABASE_ACCESS_TOKEN` (https://supabase.com/dashboard/account/tokens) e
`SUPABASE_DB_PASSWORD` (Project Settings → Database). Nunca vão para o frontend.

## Desenvolvimento local e testes

```powershell
npx supabase start     # Postgres + Auth + API + caixa de e-mail de teste (Docker)
npx supabase db reset  # recria o banco local aplicando as migrations
npx supabase stop
```

O `supabase/config.toml` liga a confirmação de e-mail, desliga login anônimo e exige senha de 8+
caracteres, espelhando o projeto remoto. Para apontar o site ao ambiente local, troque
temporariamente `config.js` pela URL `http://127.0.0.1:54321` e a chave de `npx supabase status`
(e sirva a pasta em `http://127.0.0.1:3000`, que está na lista de redirecionamentos).

Três camadas de teste (copie `.env.example` para `.env` ou exporte as variáveis):

```powershell
# 1) Regras do jogo + RLS/grants (SQL; desfaz tudo no final)
docker exec -i supabase_db_jogo-da-forca-broce-b psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/regras_do_jogo.sql

# 2) Ponta a ponta com o supabase-js real: cadastro, e-mail de confirmação, login, sessão,
#    logout, progressão, isolamento entre usuários, falha de rede
npm i @supabase/supabase-js@2.117.2 jsdom      # em uma pasta de trabalho
node supabase/tests/e2e.mjs

# 3) Interface: executa index.html + script.js em jsdom contra o backend local
node supabase/tests/ui.mjs .
```

> Os testes de interface usam jsdom: validam fluxo e estados, mas **não** layout, CSS nem foco
> real. Faça também uma checagem manual no navegador.

## Operação

- **Quem está cadastrado:** rode `supabase/consultas/jogadores_cadastrados.sql` no SQL Editor.
- **Novas palavras** (sem deploy do site):
  `insert into public.palavras (dificuldade, categoria, palavra) values ('medio', 'geral', 'EXEMPLO');`
  Use só letras A–Z maiúsculas, sem acento. Desativar: `update public.palavras set ativa = false where palavra = 'X';`
- **Nova categoria:** insira em `public.categorias` **e** adicione a entrada em `CATEGORIAS` no `script.js`.
- **Regra de pontuação:** altere em nova migration (`public.tentar_letra`) **e** em
  `aplicarFimDePartidaLocal` no `script.js`, para os dois modos ficarem iguais.
- **Apagar uma conta (LGPD):** exclua o usuário em *Authentication → Users*; o perfil, as partidas
  e a progressão são removidos em cascata.

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
