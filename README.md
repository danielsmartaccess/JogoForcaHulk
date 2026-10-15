# Forca Gama — Jogo da Forca Broce B

Jogo da forca temático (Bruce Banner → Hulk) em HTML/CSS/JS puro, com backend no
**Supabase** (projeto `dmcxzxkmxdhmufltlkel`): perfil na nuvem, ranking global real,
contador de jogadores online e regras de pontuação à prova de trapaça.

## Arquitetura

```
Navegador (index.html + script.js)
   │  supabase-js (CDN) + chave publishable (config.js)
   ▼
Supabase
   ├─ Auth ............ login anônimo (o jogador só digita um apelido)
   ├─ PostgREST/RPC ... registrar_jogador, iniciar_partida, tentar_letra,
   │                    obter_perfil, obter_ranking, obter_estatisticas
   └─ Postgres ........ tabelas com RLS; regras em funções SECURITY DEFINER
```

**Princípio:** o servidor é a fonte da verdade. A palavra secreta é sorteada no banco e só
chega ao navegador quando a partida termina; cada letra é validada por `tentar_letra`; a
pontuação, conquistas e recompensas são calculadas no banco. O cliente só pode alterar
preferências (nome, dificuldade, categoria, Plus) — o placar é protegido por grants de coluna.

**Modo local (fallback):** se o CDN, a rede ou o Supabase falharem, o jogo continua com o
motor local original (progresso no `localStorage`, ranking simulado). Os dois motores têm o
mesmo contrato (`motorLocal` / `motorOnline` em `script.js`), então a interface é uma só.

| Arquivo | Papel |
|---|---|
| `index.html`, `style.css` | Estrutura e visual |
| `script.js` | Interface + motor local |
| `servico-supabase.js` | Camada fina de acesso ao Supabase |
| `config.js` | URL e chave **publishable** (pública por design) |
| `supabase/migrations/*_esquema_inicial.sql` | Tabelas, RLS, grants e RPCs |
| `supabase/migrations/*_catalogo_inicial.sql` | Dificuldades, 16 categorias, 179 palavras, conquistas, recompensas |
| `supabase/tests/regras_do_jogo.sql` | Testes SQL das regras e da segurança |
| `supabase/tests/e2e.mjs` | Teste ponta a ponta com supabase-js |

### Modelo de dados

| Tabela | Conteúdo | Acesso do cliente |
|---|---|---|
| `dificuldades`, `categorias`, `conquistas`, `recompensas` | Catálogos | Leitura pública |
| `palavras` | Banco de palavras | Nenhum (só via RPC) |
| `jogadores` | Perfil + estatísticas (1 por usuário Auth) | Lê o próprio; altera só preferências |
| `partidas` | Histórico, palavra, letras, status | Nenhum (só via RPC) |
| `jogador_conquistas`, `jogador_recompensas` | Progressão | Lê as próprias |

## Deploy do banco (uma vez)

Pré-requisitos: Node.js (o CLI roda via `npx`) e a **senha do banco** do projeto
(Dashboard → Project Settings → Database).

```powershell
npx supabase login                                   # abre o navegador
npx supabase link --project-ref dmcxzxkmxdhmufltlkel # pede a senha do banco
npx supabase db push                                 # aplica as migrations
```

Depois, **habilite o login anônimo** no dashboard:
Authentication → Sign In / Providers → **Allow anonymous sign-ins** → Save.
Sem isso o jogo funciona, mas cai no modo local.

> Recomendado em produção: ative CAPTCHA (Authentication → Attack Protection) para
> limitar criação automatizada de contas anônimas.

## Deploy do site

O Supabase não hospeda o front-end. O site é estático (sem build) e é publicado no
**GitHub Pages** pelo workflow `.github/workflows/publicar-site.yml`, a cada push na `main`.
Só `index.html`, `style.css`, `script.js`, `config.js` e `servico-supabase.js` vão para o ar.

Configuração única no repositório do GitHub:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. Push na `main` (ou **Actions → Publicar site → Run workflow**). A URL aparece no job.

Para outro host (Firebase Hosting, Netlify, Vercel), publique esses mesmos 5 arquivos.

### Migrations automáticas (opcional)

`.github/workflows/migrations-supabase.yml` aplica no projeto remoto as migrations novas
quando `supabase/migrations/**` muda na `main` (mostra uma prévia com `--dry-run` antes).
Crie dois secrets em **Settings → Secrets and variables → Actions**:

| Secret | Onde obter |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | https://supabase.com/dashboard/account/tokens |
| `SUPABASE_DB_PASSWORD` | Dashboard → Project Settings → Database (pode ser redefinida ali) |

Os nomes dos arquivos em `supabase/migrations/` precisam bater com as versões já registradas
no remoto (`20261015160450`, `20261015160526`); novas migrations: `npx supabase migration new <nome>`.

## Desenvolvimento local

```powershell
npx supabase start          # sobe Postgres + Auth + API em Docker
npx supabase db reset       # recria o banco local aplicando as migrations
npx supabase stop
```

Para apontar o front para o ambiente local, troque temporariamente `config.js` pela URL
`http://127.0.0.1:54321` e a chave publishable exibida por `npx supabase status`.

### Testes

```powershell
# Regras + segurança (rollback no final, não deixa dados)
docker exec -i supabase_db_jogo-da-forca-broce-b psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/regras_do_jogo.sql

# Ponta a ponta (em uma pasta com @supabase/supabase-js instalado)
$env:SUPABASE_URL="http://127.0.0.1:54321"; $env:SUPABASE_KEY="<publishable local>"; node supabase/tests/e2e.mjs
```

## Operação

- **Novas palavras** (sem deploy do site):
  `insert into public.palavras (dificuldade, categoria, palavra) values ('medio', 'geral', 'EXEMPLO');`
  Use só letras A–Z maiúsculas, sem acento.
- **Desativar uma palavra:** `update public.palavras set ativa = false where palavra = 'X';`
- **Nova categoria:** insira em `public.categorias` **e** adicione a entrada em `CATEGORIAS`
  no `script.js` (nome/ícone exibidos na interface).
- **Mudança de regra de pontuação:** altere em uma nova migration (`public.tentar_letra`)
  **e** em `aplicarFimDePartidaLocal` no `script.js`, para os dois modos ficarem iguais.

## Limitações conhecidas

- Sair no meio da partida não conta como derrota (regra herdada do modo local) — permite
  "fugir" de uma partida ruim sem perder a sequência de vitórias.
- Contas anônimas ficam presas ao navegador: limpar os dados do site ou "Trocar usuário"
  inicia uma jornada nova. Evolução natural: vincular e-mail/Google à conta anônima
  (`supabase.auth.updateUser` / `linkIdentity`).
- O banco de palavras local (fallback) continua no `script.js`; no modo online o servidor
  pode ter palavras adicionais que o cliente não conhece.
- Progresso salvo no `localStorage` antes desta versão não é migrado para a nuvem
  (importar pontuação enviada pelo cliente abriria brecha para trapaça).
