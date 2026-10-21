# Testes

Os testes ficam em `supabase/tests/` e rodam **localmente**, contra o Supabase local (Docker). Nenhum deles roda no CI: os workflows só fazem `node --check` nos arquivos JS e aplicam as migrations. Rode as três camadas antes de mesclar qualquer mudança em migrations ou na lógica do jogo.

> **Última execução completa: 2026-10-21**, no Windows com Docker Desktop e Supabase CLI via `npx`, contra o banco local recriado por `db reset` com as quatro migrations: SQL (60 verificações, todas ok), ponta a ponta (todas ok) e interface (todas ok). O `--env-file` também foi validado. O `db reset` avisa "no files matched pattern: supabase/seed.sql": é esperado (o catálogo entra por migration, não por seed).

## Camadas

| Camada | Arquivo | Cobre | Requisitos ([REQUIREMENTS.md](REQUIREMENTS.md)) |
|---|---|---|---|
| SQL | `regras_do_jogo.sql` | Trigger de perfil, `garantir_perfil`, regras da partida e pontuação, conquistas, RLS e grants (cliente não altera placar, não lê a palavra, não vê dados de outros), role `anon` sem acesso. Roda numa transação desfeita no fim. | AUTH-09, AUTH-10, GAME-02 a GAME-09, PROG-01, PROG-03 a PROG-05, DASH-02, DASH-05, RN-01 a RN-08, RN-17, NFR-01 |
| Ponta a ponta | `e2e.mjs` | `supabase-js` real: cadastro, e-mail de confirmação (caixa de teste), login, sessão persistente, logout, progressão, histórico, isolamento entre usuários, falha de rede. | AUTH-01 a AUTH-06, AUTH-09, PROG-04, PROG-06, PROG-07, DASH-02, NFR-01 |
| Interface | `ui.mjs` | `index.html` + `script.js` reais em jsdom contra o backend local: validações, fluxo de cadastro/login, partida completa, recarregar com sessão, sessão inválida, modo local. | AUTH-01 a AUTH-08, GAME-01 a GAME-03, GAME-07, GAME-11, PROG-06, PROG-07, DASH-01, LOCAL-01 a LOCAL-03 |

A camada de interface usa jsdom: valida fluxo e estados, **não** layout, CSS nem foco real. Faça também uma checagem manual no navegador.

## Pré-requisitos

- Docker Desktop em execução.
- Node 20.6 ou superior (usa `--env-file`; o ambiente de desenvolvimento tem Node 22).
- Supabase local: `npx supabase start` (baixa as imagens na primeira vez).

## Como rodar (PowerShell, na raiz do repositório)

```powershell
npx supabase start       # Postgres + Auth + API + caixa de e-mail de teste
npx supabase db reset    # recria o banco local aplicando as migrations
npx supabase status      # mostra a URL local e a chave publishable local
```

Copie `.env.example` para `.env` (ignorado pelo git) e preencha `SUPABASE_URL`, `SUPABASE_KEY` (chave publishable **local**) e `MAIL_URL`.

```powershell
# 1) Regras do jogo + RLS/grants (o redirecionador "<" não existe no PowerShell: use o pipe)
Get-Content supabase/tests/regras_do_jogo.sql -Raw | docker exec -i supabase_db_jogo-da-forca-broce-b psql -U postgres -v ON_ERROR_STOP=1

# 2) Dependências dos testes Node (na raiz; node_modules/ é ignorado pelo git)
npm install --no-save @supabase/supabase-js@2.117.2 jsdom

# 3) Ponta a ponta e interface (rodar da raiz: o ui.mjs lê node_modules relativo ao diretório atual)
node --env-file=.env supabase/tests/e2e.mjs
node --env-file=.env supabase/tests/ui.mjs .

npx supabase stop
```

O nome do container (`supabase_db_jogo-da-forca-broce-b`) vem de `project_id` em `supabase/config.toml`. Se o `project_id` mudar, ajuste o comando.

Para apontar o site ao ambiente local, troque temporariamente `config.js` pela URL `http://127.0.0.1:54321` e pela chave de `npx supabase status`, e sirva a pasta na **porta 3000** (a única, além de `localhost:3000`, na lista de redirecionamentos do `config.toml`). A porta 5501 do Live Server configurada em `.vscode/settings.json` **não** está na lista: o link do e-mail de confirmação seria recusado. Não commite o `config.js` alterado.

## Referências antigas nos comentários do `e2e.mjs`

Os comentários de `e2e.mjs` usam códigos `RF01`…`RF14` cuja origem não está no repositório e que colidem com a especificação original da forca. Correspondência com os IDs atuais:

| Comentário no e2e | ID atual |
|---|---|
| RF01 cadastro | AUTH-01, AUTH-02 |
| RF02 login | AUTH-03 |
| RF03 sessão persistente | AUTH-05 |
| RF04 logout | AUTH-06 |
| RF05 perfil | AUTH-09 |
| RF06/RF07 progressão e histórico | PROG-06, PROG-07 |
| RF09 isolamento entre jogadores | RN-17, NFR-01 |
| RF14 falha de rede | AUTH-08, GAME-13 |

(RF08 e RF10 a RF13 não aparecem nos arquivos.)

## Lacunas conhecidas

- Nenhum teste roda no CI; as migrations vão para produção após apenas um `--dry-run`.
- Sem teste em navegador real (layout, CSS, foco, responsividade).
- Sem teste para: teclado virtual, presença (`DASH-04`), modais, títulos de nível, sincronia entre abas (`AUTH-11`), concorrência de jogadas e a paridade entre as regras do servidor e as do modo local (a regra existe em dois lugares; o `ui.mjs` só confere que o modo local pontua, não o valor).
- Recompensas: o teste SQL só verifica que uma vitória não libera nenhuma; as metas por dificuldade (RN-12) não são verificadas.
- O `ui.mjs` joga no modo online usando o banco de palavras **local** do `script.js`: uma palavra nova só no servidor não quebra o jogo, mas um teste que dependa dela falharia.
- Dados de teste: contas `@teste.com` no Supabase local; nunca rode os testes contra o projeto remoto.
