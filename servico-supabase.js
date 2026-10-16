/* ============================================================================
   FORCA GAMA — integração com o Supabase
   Camada fina sobre o supabase-js: autenticação por e-mail e senha e chamadas
   às funções do banco. As regras de pontuação vivem em supabase/migrations;
   aqui só há transporte. Existe um único cliente, criado em iniciar().
   Se o backend estiver inacessível e não houver sessão salva, o jogo segue
   no modo local.

   A sessão é guardada e renovada pelo próprio supabase-js (persistSession,
   autoRefreshToken e detectSessionInUrl, todos ativos por padrão). Nada de
   sessão paralela no localStorage da aplicação.
   ============================================================================ */

const ServicoOnline = (() => {
  const TEMPO_LIMITE_MS = 8000;
  let cliente = null;

  // Lança o erro original do Supabase (com .code/.status) para a interface
  // traduzir; erros de rede chegam como TypeError/AbortError.
  async function chamar(funcao, parametros) {
    const { data, error } = await cliente.rpc(funcao, parametros).abortSignal(AbortSignal.timeout(TEMPO_LIMITE_MS));
    if (error) throw error;
    return data;
  }

  async function idDoUsuario() {
    const { data } = await cliente.auth.getSession();
    return data.session?.user?.id || null;
  }

  return {
    // Cria o único cliente. Não faz chamadas de rede: false só se a biblioteca ou a
    // configuração não estiverem presentes (o jogo segue no modo local).
    iniciar() {
      const config = window.FORCA_CONFIG;
      if (!window.supabase?.createClient || !config?.supabaseUrl || !config?.supabaseChave) return false;
      cliente = window.supabase.createClient(config.supabaseUrl, config.supabaseChave);
      return true;
    },
    // O servidor está acessível? Qualquer resposta dele conta (até um erro de JWT
    // vencido); falhas de rede e tempo esgotado chegam sem código de erro.
    async testarConexao() {
      try {
        const { error } = await cliente.from('dificuldades').select('slug').limit(1).abortSignal(AbortSignal.timeout(TEMPO_LIMITE_MS));
        return !error || Boolean(error.code);
      } catch (erro) {
        console.warn('Servidor inacessível.', erro?.name || erro);
        return false;
      }
    },

    // ----------------------------------------------------------- autenticação
    async obterSessao() {
      const { data, error } = await cliente.auth.getSession();
      if (error) throw error;
      return data.session;
    },
    // O callback NÃO deve fazer chamadas ao Supabase de forma síncrona dentro
    // dele (risco de deadlock documentado); quem usa agenda o trabalho com setTimeout.
    aoMudarSessao(callback) {
      const { data } = cliente.auth.onAuthStateChange(callback);
      return () => data.subscription.unsubscribe();
    },
    // Devolve { data, error }; sem sessão em data quando a confirmação de e-mail está ligada.
    cadastrar({ nome, email, senha }) {
      return cliente.auth.signUp({
        email,
        password: senha,
        options: {
          data: { display_name: nome },
          emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
        },
      });
    },
    entrar(email, senha) {
      return cliente.auth.signInWithPassword({ email, password: senha });
    },
    // scope "local": encerra só este dispositivo, sem derrubar outras sessões da conta.
    sair() {
      return cliente.auth.signOut({ scope: 'local' });
    },

    // ----------------------------------------------------------------- dados
    garantirPerfil: () => chamar('garantir_perfil'),
    obterPerfil: () => chamar('obter_perfil'),
    iniciarPartida: (dificuldade, categoria) => chamar('iniciar_partida', { p_dificuldade: dificuldade, p_categoria: categoria }),
    tentarLetra: (partidaId, letra) => chamar('tentar_letra', { p_partida_id: partidaId, p_letra: letra }),
    obterRanking: (limite = 10) => chamar('obter_ranking', { p_limite: limite }),
    obterEstatisticas: () => chamar('obter_estatisticas'),
    // Só preferências: o placar é protegido por grants de coluna no banco.
    async salvarPreferencias({ difficulty, category, isPlus }) {
      const id = await idDoUsuario();
      if (!id) return;
      const { error } = await cliente.from('jogadores')
        .update({ dificuldade: difficulty, categoria: category, is_plus: isPlus })
        .eq('id', id);
      if (error) throw error;
    },
    // Histórico das últimas partidas concluídas. A RLS limita ao dono e o grant
    // por coluna impede a leitura da palavra secreta.
    async obterHistorico(limite = 5) {
      const { data, error } = await cliente.from('partidas')
        .select('id, modalidade, categoria, dificuldade, status, erros, pontos, finalizada_em')
        .in('status', ['vitoria', 'derrota'])
        .order('finalizada_em', { ascending: false })
        .limit(limite)
        .abortSignal(AbortSignal.timeout(TEMPO_LIMITE_MS));
      if (error) throw error;
      return data;
    },
  };
})();
