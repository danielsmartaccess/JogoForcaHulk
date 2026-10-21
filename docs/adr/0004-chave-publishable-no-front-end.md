# ADR 0004: Chave publishable no front-end; proteção por RLS e funções

- **Status:** Aceita (registro retroativo, a confirmar)
- **Data:** 2026-10-21 (decisão tomada com o backend, 2026-10-15)

## Contexto

O site é estático e roda no navegador, então tudo o que ele carrega é público. O Supabase oferece uma chave "publishable", desenhada para ficar no cliente, e chaves privilegiadas (secret / `service_role`) que nunca podem sair do servidor.

## Decisão

O front-end carrega apenas a URL do projeto e a chave publishable (`config.js`). O acesso real é controlado por RLS, grants mínimos e funções `SECURITY DEFINER`. Segredos (token de acesso e senha do banco) existem só como secrets do GitHub Actions, para o deploy das migrations. O `.env` dos testes é ignorado pelo git.

## Alternativas consideradas

Nenhuma alternativa foi registrada no projeto original. *Requer confirmação do responsável.*

## Consequências

- A segurança depende de manter as políticas e grants corretos: cada mudança de schema deve ser revista ([SECURITY.md](../SECURITY.md)) e conferida no Supabase Advisor.
- Qualquer pessoa pode chamar as RPCs com a chave pública; por isso as RPCs validam tudo no servidor e exigem usuário autenticado.
- O repositório é público: nenhum segredo pode ser versionado.
