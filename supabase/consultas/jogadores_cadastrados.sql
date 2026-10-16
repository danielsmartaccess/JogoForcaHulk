-- ============================================================================
-- Quem está cadastrado no Forca Gama (somente leitura).
-- Rodar no Dashboard → SQL Editor (precisa do papel postgres, que lê auth.users),
-- ou: psql "$DB_URL" -f supabase/consultas/jogadores_cadastrados.sql
-- Os jogadores são anônimos (só apelido): não há e-mail para listar.
-- ============================================================================

-- 1) Resumo geral
select
  (select count(*) from auth.users)                                              as contas_auth,
  (select count(*) from public.jogadores)                                        as jogadores,
  (select count(*) from public.jogadores where partidas_jogadas > 0)             as jogadores_que_jogaram,
  (select count(*) from public.jogadores where visto_em > now() - interval '5 minutes') as online_agora,
  (select count(*) from public.jogadores where criado_em > now() - interval '24 hours') as novos_24h,
  (select count(*) from public.partidas)                                         as partidas_total;

-- 2) Jogadores cadastrados, do mais recente ao mais antigo
select
  j.nome,
  j.nivel,
  j.pontuacao,
  j.partidas_jogadas  as partidas,
  j.vitorias,
  j.derrotas,
  j.melhor_sequencia_vitorias as melhor_sequencia,
  j.is_plus           as interesse_plus,
  j.criado_em at time zone 'America/Sao_Paulo' as cadastrado_em,
  j.visto_em at time zone 'America/Sao_Paulo'  as visto_por_ultimo,
  case when j.visto_em > now() - interval '5 minutes' then 'online' else '' end as situacao,
  u.is_anonymous      as conta_anonima,
  u.id                as user_id
from public.jogadores j
join auth.users u on u.id = j.id
order by j.criado_em desc;

-- 3) Ranking (quem já jogou)
select
  rank() over (order by pontuacao desc) as posicao,
  nome, pontuacao, nivel, vitorias, partidas_jogadas
from public.jogadores
where partidas_jogadas > 0
order by pontuacao desc, nome
limit 20;

-- 4) Contas de login sem jogador (abriram o site mas não informaram o nome)
select
  u.id as user_id,
  u.is_anonymous                               as anonima,
  u.created_at at time zone 'America/Sao_Paulo'  as criada_em,
  u.last_sign_in_at at time zone 'America/Sao_Paulo' as ultimo_login
from auth.users u
left join public.jogadores j on j.id = u.id
where j.id is null
order by u.created_at desc;

-- 5) Atividade por categoria nos últimos 7 dias
select
  p.categoria,
  count(*)                                         as partidas,
  count(distinct p.jogador_id)                     as jogadores,
  count(*) filter (where p.status = 'vitoria')     as vitorias,
  count(*) filter (where p.status = 'derrota')     as derrotas,
  count(*) filter (where p.status = 'abandonada')  as abandonadas
from public.partidas p
where p.iniciada_em > now() - interval '7 days'
group by p.categoria
order by partidas desc;
