-- ============================================================================
-- FORCA GAMA — autenticação real (e-mail e senha) e histórico privado
--
-- O que muda em relação à migration inicial:
--   1. O perfil (public.jogadores) passa a ser criado por TRIGGER no cadastro,
--      a partir do nome de exibição enviado em signUp({ options: { data } }).
--      Isso funciona mesmo com confirmação de e-mail ligada (sem sessão ainda).
--   2. Contas anônimas deixam de poder jogar (exigir_usuario).
--   3. registrar_jogador(text) sai; entra garantir_perfil() (idempotente,
--      recupera o perfil de contas antigas sem nome vindo do cliente).
--   4. O dono lê o próprio histórico em public.partidas, SEM acesso à coluna
--      da palavra secreta (grant por coluna + RLS).
--   5. partidas.modalidade prepara a tabela para outros jogos.
--
-- Senhas e e-mails ficam somente no Supabase Auth; nada disso é copiado para
-- as tabelas da aplicação.
-- ============================================================================

-- ---------------------------------------------------------------- modalidade
alter table public.partidas add column if not exists modalidade text not null default 'forca';
create index if not exists partidas_modalidade_idx on public.partidas (jogador_id, modalidade, finalizada_em desc);

-- --------------------------------------------------- identidade do requisitante
-- Contas anônimas (login anônimo) não têm e-mail nem recuperação: não jogam.
create or replace function interno.exigir_usuario() returns uuid
language plpgsql stable set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Autenticação necessária.' using errcode = '28000';
  end if;
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Crie uma conta para jogar.' using errcode = '28000';
  end if;
  return v_uid;
end;
$$;

-- --------------------------------------------------------- nome de exibição
-- Normaliza o texto vindo do cliente: espaços colapsados, 1 a 24 caracteres.
-- Nunca falha: texto vazio vira "Jogador" (um erro aqui bloquearia o cadastro).
create or replace function interno.nome_de_exibicao(p_bruto text) returns text
language sql immutable set search_path = '' as $$
  select coalesce(nullif(btrim(left(btrim(regexp_replace(coalesce(p_bruto, ''), '\s+', ' ', 'g')), 24)), ''), 'Jogador');
$$;

-- --------------------------------------------------- perfil criado no cadastro
-- SECURITY DEFINER + search_path vazio, como recomenda a documentação do
-- Supabase. Qualquer falha vira aviso: um trigger que lança erro derrubaria o
-- cadastro; o perfil é recuperado depois por public.garantir_perfil().
create or replace function interno.criar_jogador_no_cadastro() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(new.is_anonymous, false) then
    return new;
  end if;
  insert into public.jogadores (id, nome)
  values (new.id, interno.nome_de_exibicao(new.raw_user_meta_data ->> 'display_name'))
  on conflict (id) do nothing;
  return new;
exception when others then
  raise warning 'criar_jogador_no_cadastro falhou para %: %', new.id, sqlerrm;
  return new;
end;
$$;

drop trigger if exists criar_jogador_no_cadastro on auth.users;
create trigger criar_jogador_no_cadastro
  after insert on auth.users
  for each row execute function interno.criar_jogador_no_cadastro();

-- -------------------------------------------------------------- perfil (JSON)
-- Acrescenta a data da última partida concluída (derivada, sem coluna extra).
create or replace function interno.perfil_json(p_jogador_id uuid) returns jsonb
language sql stable set search_path = '' as $$
  select to_jsonb(j)
    || jsonb_build_object(
         'conquistas', coalesce((select jsonb_agg(jc.conquista_id order by jc.desbloqueada_em)
                                   from public.jogador_conquistas jc where jc.jogador_id = j.id), '[]'::jsonb),
         'recompensas', coalesce((select jsonb_agg(jr.recompensa_id || '-' || jr.variante order by jr.desbloqueada_em)
                                    from public.jogador_recompensas jr where jr.jogador_id = j.id), '[]'::jsonb),
         'ultima_partida_em', (select max(p.finalizada_em) from public.partidas p
                                where p.jogador_id = j.id and p.status in ('vitoria', 'derrota')))
  from public.jogadores j
  where j.id = p_jogador_id;
$$;

-- ------------------------------------------------------------ garantir_perfil
-- Cria o perfil se ainda não existir (conta anterior ao trigger ou falha dele)
-- e devolve o perfil. Idempotente; nunca sobrescreve um perfil existente.
drop function if exists public.registrar_jogador(text);

create function public.garantir_perfil() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := interno.exigir_usuario();
  v_nome text;
begin
  select interno.nome_de_exibicao(u.raw_user_meta_data ->> 'display_name')
    into v_nome
    from auth.users u
   where u.id = v_uid;

  insert into public.jogadores (id, nome)
  values (v_uid, coalesce(v_nome, 'Jogador'))
  on conflict (id) do nothing;

  update public.jogadores set visto_em = now() where id = v_uid;
  return interno.perfil_json(v_uid);
end;
$$;

-- Novas funções em public recebem EXECUTE para anon/authenticated por padrão
-- no Supabase; restringimos explicitamente.
revoke execute on function public.garantir_perfil() from public, anon, authenticated;
grant  execute on function public.garantir_perfil() to authenticated;
revoke execute on function interno.nome_de_exibicao(text), interno.criar_jogador_no_cadastro() from public, anon, authenticated;

-- ------------------------------------------------- histórico privado (partidas)
-- O dono lê as próprias partidas, mas NUNCA as colunas "palavra" e
-- "palavra_id" (revelariam a palavra de uma partida em andamento).
-- Escrita continua exclusiva das funções do jogo: sem INSERT/UPDATE/DELETE.
grant select (id, jogador_id, modalidade, categoria, dificuldade, status,
              letras_tentadas, erros, pontos, pontos_cognitivos, iniciada_em, finalizada_em)
  on public.partidas to authenticated;

drop policy if exists "jogador le o proprio historico" on public.partidas;
create policy "jogador le o proprio historico" on public.partidas
  for select to authenticated
  using ((select auth.uid()) = jogador_id);
