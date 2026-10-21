# ADR 0006: Pontuação multiplicada pela dificuldade

- **Status:** Aceita
- **Data:** 2026-10-21 (decisão do responsável do produto)

## Contexto

A interface mostrava "×1", "×2" e "×3" nos níveis de dificuldade e "+2× PONTOS" na partida, mas os pontos vinham de uma base por dificuldade (40, 90 e 150) sem relação com o multiplicador, que só reduzia as metas de recompensa. O rótulo prometia uma regra que o sistema não aplicava (discrepância D-04 em [REQUIREMENTS.md](../REQUIREMENTS.md)).

## Decisão

Uma base única de 40 pontos, escalada pelo multiplicador da dificuldade, mantendo a lógica de níveis do jogador (nível = pontuação ÷ 300 + 1):

- vitória: `(40 + 5 × letras distintas acertadas) × multiplicador`;
- derrota: `round(20% × 40 × multiplicador)`.

Aplicada no banco (migration `20261021150000_pontos_multiplicados`) e no modo local (`aplicarFimDePartidaLocal`). Pontos cognitivos e metas de recompensa não mudam.

## Alternativas consideradas

- Corrigir só os rótulos, mantendo 40/90/150: chegou a ser implementada e foi descartada pelo responsável, que pediu que os pontos fossem de fato multiplicados.
- Multiplicar a tabela antiga (40/90/150 × multiplicador): não adotada; uma vitória no Difícil passaria de 450 pontos e distorceria a progressão de nível (300 pontos por nível).

## Consequências

- Os valores por partida mudam e o rótulo passa a ser verdadeiro; a regra entra em produção quando a migration for mesclada na `main`.
- Partidas já concluídas mantêm os pontos recebidos, então o ranking mistura as duas regras para quem já jogou.
- A regra continua duplicada entre SQL e `script.js`; os testes SQL conferem Difícil ×3, Médio ×2 e a derrota, mas não há teste automático de paridade com o modo local ([TECH_DEBT.md](../TECH_DEBT.md)).
