# CLAUDE.md — Forca Gama

Instruções para agentes de IA que trabalham neste repositório. O perfil geral do responsável fica no `CLAUDE.md` global dele; aqui só há o que é específico do projeto.

## O projeto

Jogo da forca temático (Bruce Banner → Hulk), HTML/CSS/JS puro **sem build e sem dependências npm**, com backend no Supabase (Auth por e-mail e senha, Postgres com RLS, regras em funções SQL). Site no GitHub Pages. Objetivo de negócio, requisitos e regras: [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md). Visão geral e arquitetura: [README.md](README.md).

| Documento | Para quê |
|---|---|
| [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) | O que o sistema faz hoje (requisitos, regras, discrepâncias) e o roadmap declarado |
| [docs/TESTING.md](docs/TESTING.md) | Como rodar os testes e o que eles cobrem |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | CI/CD, secrets, configuração do Dashboard, rollback |
| [docs/RUNBOOK.md](docs/RUNBOOK.md) | Tarefas de operação, backup, diagnóstico |
| [docs/SECURITY.md](docs/SECURITY.md) | Modelo de acesso e regras de segurança |

Planejados (ainda não existem): `docs/ARCHITECTURE.md`, `docs/DATA_PRIVACY.md`, `docs/TECH_DEBT.md`, `docs/adr/`.

## Comandos

```powershell
npx supabase start | stop | status | db reset     # ambiente local (Docker)
Get-ChildItem *.js | ForEach-Object { node --check $_.FullName }   # checagem de sintaxe, como no CI
```

Testes (SQL, ponta a ponta, interface): ver [docs/TESTING.md](docs/TESTING.md). Não há linter nem formatador configurados. O ambiente do responsável é Windows/PowerShell.

## Convenções observadas

- Domínio e comentários em **português**; textos da interface em pt-BR. O perfil no JS usa nomes em inglês (`name`, `score`), e `perfilDoServidor` converte do português/snake_case do banco.
- Comentários explicam o **porquê** (restrições, decisões não óbvias), não o que o código faz.
- Dois motores com o mesmo contrato: `motorOnline` (Supabase) e `motorLocal` (fallback). A interface não sabe qual roda.
- Migrations em `supabase/migrations/` com timestamp; novas funções sempre com `set search_path = ''` e `EXECUTE` revogado de `public`/`anon` antes de conceder a `authenticated`.

## Invariantes (não quebrar)

1. **Servidor autoritativo:** a palavra secreta nunca vai ao navegador antes do fim da partida; o cliente nunca grava pontuação.
2. **Migrations já aplicadas são imutáveis.** Mudança de schema ou regra = nova migration.
3. **A regra de pontuação existe em dois lugares:** `public.tentar_letra` e `aplicarFimDePartidaLocal` (e a de recompensas em `interno.avaliar_progressao` e `verificarConquistasERecompensas`). Altere os dois e os testes.
4. **Contrato de erro:** o cliente decide por código e texto do erro (`22023` + "encerrada" em `processarTentativaDeLetra`). Mudou a mensagem no SQL, mude o tratamento no `script.js`.
5. **Nunca `innerHTML` com texto digitado por usuário** (use `textContent`).
6. **Nenhum segredo** no frontend ou no repositório: só URL e chave publishable. Ver [docs/SECURITY.md](docs/SECURITY.md).

## Documentação viva

Cada informação tem **uma fonte principal**; os outros documentos apontam para ela.

| Informação | Fonte principal |
|---|---|
| Schema, permissões e regras no banco | `supabase/migrations/` |
| Variáveis dos testes | `.env.example` |
| Configuração do Supabase local | `supabase/config.toml` |
| Requisitos, regras de negócio, discrepâncias | `docs/REQUIREMENTS.md` |
| Comandos de teste e cobertura | `docs/TESTING.md` |
| Deploy, secrets, configuração do Dashboard | `docs/DEPLOYMENT.md` |
| Procedimentos de operação | `docs/RUNBOOK.md` |
| Acesso a dados e segurança | `docs/SECURITY.md` |

Regras ao mudar o código:

1. Mudou o comportamento do jogo, da conta ou do ranking: atualize o requisito e a regra em `docs/REQUIREMENTS.md` (e o teste que o cobre) na mesma mudança.
2. Mudou o schema ou uma permissão: nova migration + atualizar `docs/SECURITY.md` se mudar o acesso.
3. Mudou um comando, uma porta ou um pré-requisito: atualizar `docs/TESTING.md` ou o README.
4. Mudou algo no Dashboard do Supabase ou no CI: atualizar `docs/DEPLOYMENT.md` com a data.
5. Decisão arquitetural relevante: registrar em `docs/adr/` (quando existir).
6. Informação não confirmada vira "requer validação"; **nunca invente** requisitos, regras ou decisões.
7. Confira links e caminhos dos documentos que você tocou.
8. Não declare que testes passaram sem tê-los executado; diga o que foi executado e o que não foi.

## Definição de pronto

Sintaxe dos `.js` verificada · testes relevantes executados (ou a lacuna declarada) · documentação do que mudou atualizada · nenhum segredo adicionado · PR com descrição do que mudou e por quê.

## Decisões do responsável

- **Sem CAPTCHA** (não implementar nem recomendar).
- Arquivos de documentação em `docs/` com **nomes em inglês**, conteúdo em português. Sem `CONTRIBUTING.md` (não há colaboradores previstos). Dívida técnica em arquivo (`docs/TECH_DEBT.md`), não em issues.
- O repositório é **público**: não registre nele estado de credenciais, vulnerabilidades abertas nem dados pessoais.
- O jogo será aberto ao público em breve; o controlador dos dados (LGPD) é a Just Go.
- Ações destrutivas ou que afetem produção (Supabase remoto, GitHub) só com autorização explícita do responsável.
