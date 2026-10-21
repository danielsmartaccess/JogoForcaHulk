# Decisões de arquitetura (ADRs)

Registro curto das decisões que moldam o Forca Gama: contexto, decisão, alternativas e consequências. Crie um ADR novo quando uma decisão for difícil de reverter ou explicar só pelo código. Não edite um ADR aceito: crie outro que o **substitua** e marque o antigo como "Substituída por …".

| ADR | Decisão | Status |
|---|---|---|
| [0001](0001-servidor-como-fonte-da-verdade.md) | O servidor é a fonte da verdade (regras em funções SQL) | Aceita |
| [0002](0002-autenticacao-por-email-e-senha.md) | Autenticação por e-mail e senha, com perfil criado por trigger | Aceita |
| [0003](0003-front-end-estatico-com-modo-local.md) | Front-end estático sem build, com modo local de fallback | Aceita |
| [0004](0004-chave-publishable-no-front-end.md) | Chave publishable no front-end; proteção por RLS e funções | Aceita |
| [0005](0005-sem-captcha-no-cadastro.md) | Sem CAPTCHA no cadastro | Aceita |
| [0006](0006-pontuacao-multiplicada-pela-dificuldade.md) | Pontuação multiplicada pela dificuldade | Aceita |

Os ADRs 0001 a 0004 são **registros retroativos** (2026-10-21): o contexto e os motivos foram extraídos do README original, dos comentários das migrations e do código, e aguardam confirmação do responsável. Os ADRs 0005 e 0006 registram decisões tomadas pelo responsável em 2026-10-21.

## Modelo

```markdown
# ADR NNNN: título

- **Status:** Proposta | Aceita | Substituída por NNNN
- **Data:** AAAA-MM-DD

## Contexto
## Decisão
## Alternativas consideradas
## Consequências
```
