-- ============================================================================
-- FORCA GAMA — esquema inicial
-- CATÁLOGOS → JOGADORES → PARTIDAS → PROGRESSÃO → SEGURANÇA → RPCs
--
-- Princípio: o servidor é a fonte da verdade. O navegador nunca recebe a
-- palavra secreta antes do fim da partida e não grava pontuação diretamente;
-- toda regra que altera o placar roda em funções SECURITY DEFINER.
-- ============================================================================

create schema if not exists interno;
revoke all on schema interno from public, anon, authenticated;

-- ---------------------------------------------------------------- catálogos
create table public.dificuldades (
  slug          text primary key,
  nome          text    not null,
  multiplicador integer not null check (multiplicador > 0),
  pontos        integer not null check (pontos >= 0),
  cognitivo     integer not null check (cognitivo >= 0),
  ordem         integer not null default 0
);

create table public.categorias (
  slug      text primary key,
  nome      text not null,
  icone     text not null,
  descricao text not null,
  ordem     integer not null default 0
);

create table public.palavras (
  id          bigint generated always as identity primary key,
  dificuldade text    not null references public.dificuldades (slug),
  categoria   text    not null references public.categorias (slug),
  palavra     text    not null check (palavra ~ '^[A-Z]{2,30}$'),
  ativa       boolean not null default true,
  criado_em   timestamptz not null default now(),
  unique (dificuldade, categoria, palavra)
);
create index palavras_sorteio_idx on public.palavras (dificuldade, categoria) where ativa;

-- Métricas válidas espelham colunas de public.jogadores avaliadas em interno.
create table public.conquistas (
  id        text primary key,
  nome      text    not null,
  descricao text    not null,
  icone     text    not null,
  metrica   text    not null check (metrica in ('letras_descobertas', 'vitorias', 'melhor_sequencia_letras', 'partidas_jogadas', 'vitorias_dificil')),
  meta      integer not null check (meta > 0),
  ordem     integer not null default 0
);

create table public.recompensas (
  id    text primary key,
  nome  text    not null,
  tipo  text    not null,
  grupo text    not null check (grupo in ('vitorias', 'sequencias')),
  meta  integer not null check (meta > 0),
  ordem integer not null default 0
);

-- ---------------------------------------------------------------- jogadores
-- Um jogador por usuário do Supabase Auth (inclusive login anônimo).
create table public.jogadores (
  id                        uuid primary key references auth.users (id) on delete cascade,
  nome                      text    not null check (char_length(btrim(nome)) between 1 and 24),
  dificuldade               text    not null default 'medio' references public.dificuldades (slug),
  categoria                 text    not null default 'geral' references public.categorias (slug),
  pontuacao                 integer not null default 0 check (pontuacao >= 0),
  nivel                     integer generated always as (pontuacao / 300 + 1) stored,
  partidas_jogadas          integer not null default 0,
  vitorias                  integer not null default 0,
  derrotas                  integer not null default 0,
  sequencia_vitorias        integer not null default 0,
  melhor_sequencia_vitorias integer not null default 0,
  sequencia_letras          integer not null default 0,
  melhor_sequencia_letras   integer not null default 0,
  letras_descobertas        integer not null default 0,
  vitorias_dificil          integer not null default 0,
  pontos_cognitivos         integer not null default 0,
  is_plus                   boolean not null default false,
  visto_em                  timestamptz not null default now(),
  criado_em                 timestamptz not null default now(),
  atualizado_em             timestamptz not null default now()
);
create index jogadores_ranking_idx on public.jogadores (pontuacao desc) where partidas_jogadas > 0;
create index jogadores_visto_em_idx on public.jogadores (visto_em desc);

create function interno.tocar_atualizado_em() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;
create trigger jogadores_atualizado_em before update on public.jogadores
  for each row execute function interno.tocar_atualizado_em();

-- ----------------------------------------------------------------- partidas
create table public.partidas (
  id                uuid primary key default gen_random_uuid(),
  jogador_id        uuid    not null references public.jogadores (id) on delete cascade,
  dificuldade       text    not null references public.dificuldades (slug),
  categoria         text    not null references public.categorias (slug),
  palavra_id        bigint  references public.palavras (id) on delete set null,
  palavra           text    not null,
  letras_tentadas   text[]  not null default '{}',
  letras_corretas   text[]  not null default '{}',
  erros             integer not null default 0 check (erros between 0 and 6),
  status            text    not null default 'em_andamento' check (status in ('em_andamento', 'vitoria', 'derrota', 'abandonada')),
  pontos            integer not null default 0,
  pontos_cognitivos integer not null default 0,
  iniciada_em       timestamptz not null default now(),
  finalizada_em     timestamptz
);
-- Garante no máximo uma partida aberta por jogador.
create unique index partidas_uma_aberta_idx on public.partidas (jogador_id) where status = 'em_andamento';
create index partidas_jogador_idx on public.partidas (jogador_id, iniciada_em desc);
create index partidas_atividade_idx on public.partidas (iniciada_em desc, categoria);

-- --------------------------------------------------------------- progressão
create table public.jogador_conquistas (
  jogador_id      uuid not null references public.jogadores (id) on delete cascade,
  conquista_id    text not null references public.conquistas (id),
  desbloqueada_em timestamptz not null default now(),
  primary key (jogador_id, conquista_id)
);

-- 'base' quando conquistada no Fácil; 'evolucao' no Médio/Difícil.
create table public.jogador_recompensas (
  jogador_id      uuid not null references public.jogadores (id) on delete cascade,
  recompensa_id   text not null references public.recompensas (id),
  variante        text not null check (variante in ('base', 'evolucao')),
  desbloqueada_em timestamptz not null default now(),
  primary key (jogador_id, recompensa_id, variante)
);

-- ---------------------------------------------------------------- segurança
-- O Supabase concede tudo a anon/authenticated por padrão; partimos do zero
-- e liberamos apenas o necessário.
revoke all on all tables in schema public from anon, authenticated;

alter table public.dificuldades        enable row level security;
alter table public.categorias          enable row level security;
alter table public.palavras            enable row level security;
alter table public.conquistas          enable row level security;
alter table public.recompensas         enable row level security;
alter table public.jogadores           enable row level security;
alter table public.partidas            enable row level security;
alter table public.jogador_conquistas  enable row level security;
alter table public.jogador_recompensas enable row level security;

-- Catálogos públicos (palavras ficam fora: só as funções as leem).
grant select on public.dificuldades, public.categorias, public.conquistas, public.recompensas to anon, authenticated;
create policy "catalogo legivel" on public.dificuldades for select to anon, authenticated using (true);
create policy "catalogo legivel" on public.categorias   for select to anon, authenticated using (true);
create policy "catalogo legivel" on public.conquistas   for select to anon, authenticated using (true);
create policy "catalogo legivel" on public.recompensas  for select to anon, authenticated using (true);

-- Jogador lê o próprio perfil e altera só preferências (nunca o placar).
grant select on public.jogadores to authenticated;
grant update (nome, dificuldade, categoria, is_plus) on public.jogadores to authenticated;
create policy "jogador le o proprio perfil" on public.jogadores for select to authenticated
  using ((select auth.uid()) = id);
create policy "jogador altera as proprias preferencias" on public.jogadores for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

grant select on public.jogador_conquistas, public.jogador_recompensas to authenticated;
create policy "jogador le as proprias conquistas" on public.jogador_conquistas for select to authenticated
  using ((select auth.uid()) = jogador_id);
create policy "jogador le as proprias recompensas" on public.jogador_recompensas for select to authenticated
  using ((select auth.uid()) = jogador_id);

-- public.partidas e public.palavras: sem policies e sem grants → acesso só via RPC.

-- ----------------------------------------------------------- regras internas
create function interno.exigir_usuario() returns uuid
language plpgsql stable set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Autenticação necessária.' using errcode = '28000';
  end if;
  return v_uid;
end;
$$;

-- Perfil no formato consumido pelo front-end (conquistas e recompensas como ids).
create function interno.perfil_json(p_jogador_id uuid) returns jsonb
language sql stable set search_path = '' as $$
  select to_jsonb(j)
    || jsonb_build_object(
         'conquistas', coalesce((select jsonb_agg(jc.conquista_id order by jc.desbloqueada_em)
                                   from public.jogador_conquistas jc where jc.jogador_id = j.id), '[]'::jsonb),
         'recompensas', coalesce((select jsonb_agg(jr.recompensa_id || '-' || jr.variante order by jr.desbloqueada_em)
                                    from public.jogador_recompensas jr where jr.jogador_id = j.id), '[]'::jsonb))
  from public.jogadores j
  where j.id = p_jogador_id;
$$;

-- Mesmas regras do modo local: metas de vitória caem com o multiplicador e
-- metas de sequência ficam mais curtas no Médio e no Difícil.
create function interno.avaliar_progressao(p_jogador public.jogadores, p_fator integer) returns text[]
language plpgsql set search_path = '' as $$
declare
  v_variante   text := case when p_fator >= 2 then 'evolucao' else 'base' end;
  v_conquistas text[];
  v_recompensas text[];
begin
  with novas as (
    insert into public.jogador_conquistas (jogador_id, conquista_id)
    select p_jogador.id, c.id
      from public.conquistas c
     where case c.metrica
             when 'letras_descobertas'      then p_jogador.letras_descobertas
             when 'vitorias'                then p_jogador.vitorias
             when 'melhor_sequencia_letras' then p_jogador.melhor_sequencia_letras
             when 'partidas_jogadas'        then p_jogador.partidas_jogadas
             when 'vitorias_dificil'        then p_jogador.vitorias_dificil
           end >= c.meta
    on conflict do nothing
    returning conquista_id
  )
  select coalesce(array_agg('Conquista desbloqueada: ' || c.nome order by c.ordem), '{}')
    into v_conquistas
    from novas n join public.conquistas c on c.id = n.conquista_id;

  with novas as (
    insert into public.jogador_recompensas (jogador_id, recompensa_id, variante)
    select p_jogador.id, r.id, v_variante
      from public.recompensas r
     where (r.grupo = 'vitorias'   and p_jogador.vitorias >= ceil(r.meta::numeric / p_fator))
        or (r.grupo = 'sequencias' and p_jogador.sequencia_vitorias >=
              case when p_fator >= 2 then greatest(2, r.meta - (p_fator - 1)) else r.meta end)
    on conflict do nothing
    returning recompensa_id
  )
  select coalesce(array_agg('Oportuni Clube (simulado): ' || r.nome order by r.grupo desc, r.ordem), '{}')
    into v_recompensas
    from novas n join public.recompensas r on r.id = n.recompensa_id;

  return v_conquistas || v_recompensas;
end;
$$;

-- ------------------------------------------------------------- RPCs públicas
create function public.registrar_jogador(p_nome text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := interno.exigir_usuario();
begin
  insert into public.jogadores (id, nome) values (v_uid, btrim(p_nome))
  on conflict (id) do update set nome = excluded.nome, visto_em = now();
  return interno.perfil_json(v_uid);
end;
$$;

-- Também funciona como "heartbeat" de presença para o contador de online.
create function public.obter_perfil() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := interno.exigir_usuario();
begin
  update public.jogadores set visto_em = now() where id = v_uid;
  return interno.perfil_json(v_uid);
end;
$$;

create function public.iniciar_partida(p_dificuldade text, p_categoria text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid        uuid := interno.exigir_usuario();
  v_palavra_id bigint;
  v_palavra    text;
  v_partida_id uuid;
begin
  if not exists (select 1 from public.jogadores where id = v_uid) then
    raise exception 'Perfil não encontrado. Registre um nome primeiro.' using errcode = 'P0002';
  end if;

  select p.id, p.palavra into v_palavra_id, v_palavra
    from public.palavras p
   where p.dificuldade = p_dificuldade and p.categoria = p_categoria and p.ativa
   order by random()
   limit 1;
  if v_palavra is null then
    raise exception 'Não há palavras para %/%.', p_dificuldade, p_categoria using errcode = '22023';
  end if;

  -- Sair no meio da partida não conta como derrota (mesma regra do modo local).
  update public.partidas set status = 'abandonada', finalizada_em = now()
   where jogador_id = v_uid and status = 'em_andamento';

  insert into public.partidas (jogador_id, dificuldade, categoria, palavra_id, palavra)
  values (v_uid, p_dificuldade, p_categoria, v_palavra_id, v_palavra)
  returning id into v_partida_id;

  update public.jogadores
     set dificuldade = p_dificuldade, categoria = p_categoria, visto_em = now()
   where id = v_uid;

  return jsonb_build_object('partida_id', v_partida_id, 'tamanho', char_length(v_palavra),
                            'dificuldade', p_dificuldade, 'categoria', p_categoria);
end;
$$;

create function public.tentar_letra(p_partida_id uuid, p_letra text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid        uuid := interno.exigir_usuario();
  v_letra      text := upper(btrim(coalesce(p_letra, '')));
  v_partida    public.partidas;
  v_jogador    public.jogadores;
  v_dif        public.dificuldades;
  v_acertou    boolean;
  v_venceu     boolean := false;
  v_encerrada  boolean := false;
  v_posicoes   integer[];
  v_acertos    integer;
  v_pontos     integer := 0;
  v_cognitivos integer := 0;
  v_novidades  text[] := '{}';
begin
  if v_letra !~ '^[A-Z]$' then
    raise exception 'Letra inválida.' using errcode = '22023';
  end if;

  -- FOR UPDATE serializa cliques rápidos na mesma partida.
  select * into v_partida from public.partidas
   where id = p_partida_id and jogador_id = v_uid
   for update;
  if not found then
    raise exception 'Partida não encontrada.' using errcode = 'P0002';
  end if;
  if v_partida.status <> 'em_andamento' then
    raise exception 'Esta partida já foi encerrada.' using errcode = '22023';
  end if;

  if v_letra = any (v_partida.letras_tentadas) then
    return jsonb_build_object('repetida', true, 'letra', v_letra, 'erros', v_partida.erros, 'status', v_partida.status);
  end if;

  v_acertou := strpos(v_partida.palavra, v_letra) > 0;
  select coalesce(array_agg(i - 1 order by i), '{}') into v_posicoes
    from generate_series(1, char_length(v_partida.palavra)) as i
   where substr(v_partida.palavra, i, 1) = v_letra;

  update public.partidas
     set letras_tentadas = letras_tentadas || v_letra,
         letras_corretas = case when v_acertou then letras_corretas || v_letra else letras_corretas end,
         erros           = erros + case when v_acertou then 0 else 1 end
   where id = v_partida.id
  returning * into v_partida;

  update public.jogadores
     set sequencia_letras        = case when v_acertou then sequencia_letras + 1 else 0 end,
         melhor_sequencia_letras = greatest(melhor_sequencia_letras, case when v_acertou then sequencia_letras + 1 else 0 end),
         visto_em                = now()
   where id = v_uid;

  v_venceu := not exists (
    select 1 from regexp_split_to_table(v_partida.palavra, '') as l (letra)
     where not (l.letra = any (v_partida.letras_corretas)));
  v_encerrada := v_venceu or v_partida.erros >= 6;

  if v_encerrada then
    select * into v_dif from public.dificuldades where slug = v_partida.dificuldade;
    v_acertos    := cardinality(v_partida.letras_corretas);
    v_pontos     := case when v_venceu then v_dif.pontos + v_acertos * 5 else round(v_dif.pontos * 0.2)::integer end;
    v_cognitivos := v_dif.cognitivo + v_acertos + case when v_venceu then 5 else 0 end;

    update public.partidas
       set status = case when v_venceu then 'vitoria' else 'derrota' end,
           pontos = v_pontos, pontos_cognitivos = v_cognitivos, finalizada_em = now()
     where id = v_partida.id
    returning * into v_partida;

    update public.jogadores
       set partidas_jogadas          = partidas_jogadas + 1,
           pontuacao                 = pontuacao + v_pontos,
           pontos_cognitivos         = pontos_cognitivos + v_cognitivos,
           letras_descobertas        = letras_descobertas + v_acertos,
           vitorias                  = vitorias + v_venceu::integer,
           derrotas                  = derrotas + (not v_venceu)::integer,
           sequencia_vitorias        = case when v_venceu then sequencia_vitorias + 1 else 0 end,
           melhor_sequencia_vitorias = greatest(melhor_sequencia_vitorias, case when v_venceu then sequencia_vitorias + 1 else 0 end),
           vitorias_dificil          = vitorias_dificil + (v_venceu and v_partida.dificuldade = 'dificil')::integer
     where id = v_uid
    returning * into v_jogador;

    v_novidades := interno.avaliar_progressao(v_jogador, v_dif.multiplicador);
  end if;

  return jsonb_build_object(
    'repetida',          false,
    'letra',             v_letra,
    'acertou',           v_acertou,
    'posicoes',          to_jsonb(v_posicoes),
    'erros',             v_partida.erros,
    'status',            v_partida.status,
    'encerrada',         v_encerrada,
    'venceu',            v_venceu,
    'palavra',           case when v_encerrada then v_partida.palavra end,
    'pontos',            v_pontos,
    'pontos_cognitivos', v_cognitivos,
    'novidades',         to_jsonb(v_novidades),
    'jogador',           interno.perfil_json(v_uid));
end;
$$;

-- Ranking público expõe só apelido, pontos e nível.
create function public.obter_ranking(p_limite integer default 10)
returns table (posicao bigint, nome text, pontuacao integer, nivel integer, eh_voce boolean)
language sql stable security definer set search_path = '' as $$
  with classificacao as (
    select j.id, j.nome, j.pontuacao, j.nivel,
           rank() over (order by j.pontuacao desc) as posicao
      from public.jogadores j
     where j.partidas_jogadas > 0 or j.id = auth.uid()
  )
  select c.posicao, c.nome, c.pontuacao, c.nivel, c.id = auth.uid()
    from classificacao c
   where c.posicao <= least(greatest(coalesce(p_limite, 10), 1), 50) or c.id = auth.uid()
   order by c.posicao, c.nome;
$$;

-- Indicadores reais que substituem os mocks do painel.
create function public.obter_estatisticas() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'online', (select count(*) from public.jogadores where visto_em > now() - interval '5 minutes'),
    'total_jogadores', (select count(*) from public.jogadores where partidas_jogadas > 0),
    'online_por_categoria', coalesce((
       select jsonb_object_agg(categoria, total) from (
         select categoria, count(distinct jogador_id) as total
           from public.partidas where iniciada_em > now() - interval '15 minutes'
          group by categoria) t), '{}'::jsonb),
    'media_por_categoria', coalesce((
       select jsonb_object_agg(categoria, media) from (
         select categoria, round(avg(pontos))::integer as media
           from public.partidas
          where status in ('vitoria', 'derrota') and finalizada_em > now() - interval '30 days'
          group by categoria) t), '{}'::jsonb),
    'palavras', coalesce((
       select jsonb_object_agg(dificuldade, categorias) from (
         select dificuldade, jsonb_object_agg(categoria, total) as categorias from (
           select dificuldade, categoria, count(*) as total
             from public.palavras where ativa
            group by dificuldade, categoria) c
          group by dificuldade) d), '{}'::jsonb));
$$;

-- Funções são executáveis por PUBLIC no Postgres; restringimos explicitamente.
revoke execute on all functions in schema public  from public, anon, authenticated;
revoke execute on all functions in schema interno from public, anon, authenticated;
grant execute on function
  public.registrar_jogador(text),
  public.obter_perfil(),
  public.iniciar_partida(text, text),
  public.tentar_letra(uuid, text),
  public.obter_ranking(integer),
  public.obter_estatisticas()
to authenticated;
