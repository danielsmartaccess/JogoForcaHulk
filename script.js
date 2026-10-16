/* ============================================================================
   FORCA GAMA — jornada do jogador
   CONFIGURAÇÃO → PERFIL → PARTIDA → PROGRESSÃO → INTERFACE → EVENTOS

   O HTML fornece a estrutura, o CSS transforma os estados em aparência e
   este arquivo coordena a interface. As regras de cada partida rodam em um
   "motor": no modo online (Supabase) o jogador entra com e-mail e senha, o
   servidor sorteia a palavra e calcula a pontuação; no modo local (só quando
   o servidor está inacessível) o mesmo contrato roda aqui, com o progresso no
   localStorage e ranking/atividade simulados.
   ============================================================================ */

// O catálogo é organizado por dificuldade e categoria para que novos temas
// possam ser acrescentados sem alterar a lógica central de uma tentativa.
const BANCO_DE_PALAVRAS = {
  facil: {
    geral: ['LIVRO', 'JANELA', 'PRAIA', 'AMIGO', 'MUNDO', 'FESTA'],
    tecnologia: ['ROBO', 'CHIP', 'WIFI', 'DRONE', 'LASER', 'PIXEL'],
    filmes: ['CENA', 'ATOR', 'TELA', 'HEROI', 'CINEMA', 'ROTEIRO'],
    musica: ['RITMO', 'NOTA', 'VIOLAO', 'BANDA', 'MELODIA', 'REPIQUE'],
    esportes: ['GOL', 'TIME', 'JOGO', 'CORRIDA', 'NADAR', 'TORCIDA'],
    gastronomia: ['BOLO', 'MASSA', 'PIZZA', 'TEMPERO', 'FRUTA', 'SABOR'],
    viagens: ['LUA', 'MARTE', 'SOL', 'COMETA', 'ORBITA', 'ESTRELA'],
    cultura: ['ARTE', 'LIVRO', 'DANCA', 'MUSEU', 'POEMA', 'TEATRO'],
    negocios: ['MARCA', 'VENDA', 'IDEIA', 'PLANO', 'VALOR', 'EQUIPE'],
    herois: ['HULK', 'THOR', 'FLASH', 'VISAO', 'PANTERA', 'VINGADOR'],
  },
  medio: {
    geral: ['CURIOSIDADE', 'DESCOBERTA', 'MEMORIA', 'ESTRATEGIA', 'CRIATIVIDADE'],
    tecnologia: ['ALGORITMO', 'PROGRAMA', 'SISTEMA', 'DADOS', 'MODELO', 'PREVISAO'],
    filmes: ['PERSONAGEM', 'DIRETOR', 'AVENTURA', 'BILHETERIA', 'FOTOGRAFIA'],
    musica: ['HARMONIA', 'SINFONIA', 'COMPOSITOR', 'INSTRUMENTO', 'IMPROVISO'],
    esportes: ['CAMPEONATO', 'MARATONA', 'GINASTICA', 'VELOCIDADE', 'EQUILIBRIO'],
    gastronomia: ['CULINARIA', 'FERMENTACAO', 'INGREDIENTE', 'CHOCOLATE', 'RECEITA'],
    viagens: ['JUPITER', 'SATURNO', 'GALAXIA', 'NEBULOSA', 'ASTEROIDE', 'METEORO'],
    cultura: ['PATRIMONIO', 'LITERATURA', 'EXPOSICAO', 'FOLCLORE', 'TRADICAO'],
    negocios: ['EMPREENDEDOR', 'PLANEJAMENTO', 'INVESTIMENTO', 'NEGOCIACAO', 'INOVACAO'],
    inteligenciaArtificial: ['INTELIGENCIA', 'APRENDIZADO', 'TREINAMENTO', 'PREVISAO', 'MODELO'],
    planetasGalaxias: ['JUPITER', 'SATURNO', 'GALAXIA', 'NEBULOSA', 'ASTEROIDE', 'METEORO'],
    cienciaGama: ['GAMA', 'LABORATORIO', 'EXPERIMENTO', 'RADIACAO', 'CIENTISTA', 'FURIA'],
  },
  dificil: {
    geral: ['INDEPENDENCIA', 'CONHECIMENTO', 'PERSISTENCIA', 'PENSAMENTO', 'TRANSFORMACAO'],
    tecnologia: ['CRIPTOGRAFIA', 'MICROPROCESSADOR', 'INTEROPERABILIDADE', 'CIBERSEGURANCA'],
    filmes: ['CINEMATOGRAFIA', 'ROTEIRISTA', 'DOCUMENTARIO', 'CONTINUIDADE'],
    musica: ['CONTRAPONTO', 'RESSONANCIA', 'ORQUESTRACAO', 'POLIRRITMIA'],
    esportes: ['PERIODIZACAO', 'PROPRIOCEPCAO', 'COORDENACAO', 'CONDICIONAMENTO'],
    gastronomia: ['CARAMELIZACAO', 'CONFEITARIA', 'GASTRONOMIA', 'EMULSIFICACAO'],
    viagens: ['ARQUEOLOGIA', 'BIODIVERSIDADE', 'CONTINENTE', 'CONSTELACAO'],
    cultura: ['RENASCIMENTO', 'ANTROPOLOGIA', 'ARQUITETURA', 'MANIFESTACAO'],
    negocios: ['SUSTENTABILIDADE', 'POSICIONAMENTO', 'TRANSFORMACAO', 'CRESCIMENTO'],
    programacaoAvancada: ['RECURSAO', 'ASSINCRONO', 'COMPILADOR', 'POLIMORFISMO', 'ENCAPSULAMENTO', 'FRAMEWORK'],
    fisicaQuantica: ['QUANTICA', 'PARTICULA', 'ELETRON', 'GRAVIDADE', 'RELATIVIDADE', 'ANTIMATERIA'],
    universoMarvel: ['VINGADORES', 'MULTIVERSO', 'INFINITO', 'ASGARDIANO', 'GUARDIOES', 'SENTINELA'],
  },
};

const DIFICULDADES = {
  facil: { nome: 'Fácil', multiplicador: 1, pontos: 40, cognitivo: 5 },
  medio: { nome: 'Médio', multiplicador: 2, pontos: 90, cognitivo: 9 },
  dificil: { nome: 'Difícil', multiplicador: 3, pontos: 150, cognitivo: 14 },
};
const CATEGORIAS = {
  geral: { nome: 'Geral', icone: '✦', descricao: 'Um pouco de tudo' },
  tecnologia: { nome: 'Tecnologia', icone: '⌘', descricao: 'Invenções e ideias digitais' },
  filmes: { nome: 'Filmes', icone: '▣', descricao: 'Histórias da tela grande' },
  musica: { nome: 'Música', icone: '♫', descricao: 'Ritmos, sons e instrumentos' },
  esportes: { nome: 'Esportes', icone: '⚽', descricao: 'Jogo, movimento e competição' },
  gastronomia: { nome: 'Gastronomia', icone: '♨', descricao: 'Sabores e cozinha' },
  viagens: { nome: 'Viagens', icone: '⌖', descricao: 'Lugares e descobertas' },
  cultura: { nome: 'Cultura', icone: '◇', descricao: 'Arte, livros e tradições' },
  negocios: { nome: 'Negócios', icone: '↗', descricao: 'Ideias e empreendedorismo' },
  herois: { nome: 'Heróis e Vingadores', icone: '✦', descricao: 'Heróis que salvam o dia' },
  inteligenciaArtificial: { nome: 'Inteligência Artificial', icone: '⌘', descricao: 'Algoritmos e aprendizado' },
  planetasGalaxias: { nome: 'Planetas e Galáxias', icone: '☄', descricao: 'Uma viagem pelo universo' },
  cienciaGama: { nome: 'Ciência Gama', icone: '⚗', descricao: 'Experimentos e radiação' },
  programacaoAvancada: { nome: 'Programação Avançada', icone: '⌘', descricao: 'Conceitos para quem domina código' },
  fisicaQuantica: { nome: 'Física Quântica', icone: '⚛', descricao: 'O mundo em escala subatômica' },
  universoMarvel: { nome: 'Universo Marvel', icone: '✦', descricao: 'Personagens e mundos extraordinários' },
};
const ROTULOS_DE_ESTAGIO = ['Bruce Banner: calmo', 'O pulso começa a acelerar...', 'A pele está ganhando um tom verde', 'Os músculos estão em expansão', 'A camisa já não resiste mais', 'Quase sem controle...', 'HULK SMASH! Transformação completa'];
const CONFIG_RECOMPENSAS = {
  vitorias: [
    { id: 'primeiros-passos', meta: 5, nome: 'Primeiros passos', tipo: 'Selo da jornada' },
    { id: 'ritmo-certo', meta: 10, nome: 'Ritmo certo', tipo: 'Benefício básico' },
    { id: 'constancia', meta: 25, nome: 'Constância extraordinária', tipo: 'Benefício especial' },
    { id: 'lenda', meta: 50, nome: 'Lenda Gama', tipo: 'Benefício premium' },
  ],
  sequencias: [
    { id: 'sequencia-3', meta: 3, nome: 'Sequência em movimento', tipo: 'Benefício básico' },
    { id: 'sequencia-7', meta: 7, nome: 'Ritmo extraordinário', tipo: 'Benefício especial' },
    { id: 'sequencia-14', meta: 14, nome: 'Constância lendária', tipo: 'Benefício premium' },
  ],
};
const CONQUISTAS = [
  { id: 'primeiro-acerto', nome: 'Primeiro acerto', descricao: 'Descubra sua primeira letra.', icone: '🔎', libera: (p) => p.lettersFound >= 1 },
  { id: 'primeira-vitoria', nome: 'Primeira missão', descricao: 'Vença sua primeira partida.', icone: '🏅', libera: (p) => p.wins >= 1 },
  { id: 'cinco-letras', nome: 'Olho atento', descricao: 'Acerte 5 letras em sequência.', icone: '🎯', libera: (p) => p.bestLetterStreak >= 5 },
  { id: 'dez-vitorias', nome: 'Dez vitórias', descricao: 'Vença 10 partidas.', icone: '🔥', libera: (p) => p.wins >= 10 },
  { id: 'mestre-palavras', nome: 'Mestre das palavras', descricao: 'Descubra 100 letras.', icone: '🧠', libera: (p) => p.lettersFound >= 100 },
  { id: 'centenario', nome: 'Centenário', descricao: 'Jogue 100 partidas.', icone: '💯', libera: (p) => p.gamesPlayed >= 100 },
  { id: 'desafio-dificil', nome: 'Domínio Gama', descricao: 'Vença no nível Difícil.', icone: '🏆', libera: (p) => p.hardWins >= 1 },
];
const DADOS_MOCK = {
  online: 1284,
  categorias: { geral: 326, tecnologia: 214, filmes: 188, musica: 142, esportes: 205, gastronomia: 119, viagens: 96, cultura: 84, negocios: 71 },
  ranking: [{ nome: 'ANA', score: 9840 }, { nome: 'CARLOS', score: 9420 }, { nome: 'MARIA', score: 9110 }, { nome: 'DANIEL', score: 8970 }, { nome: 'LUCAS', score: 8620 }],
};
const CHAVE_PERFIL = 'forcaGama.player.v1';
const LIMITE_DE_ERROS = 6;
const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const CORES_DO_CONFETE = ['#5fd97a', '#94f2a5', '#f3a53d', '#e9f3ec'];

function criarPerfil(nome = '') {
  return { name: nome, difficulty: 'medio', category: 'geral', level: 1, score: 0, gamesPlayed: 0, wins: 0, losses: 0, winStreak: 0, bestWinStreak: 0, letterStreak: 0, bestLetterStreak: 0, lettersFound: 0, hardWins: 0, cognitiveScore: 0, achievements: [], rewards: [], isPlus: false };
}

// localStorage guarda texto; por isso convertemos o objeto para JSON. A
// leitura também tolera dados antigos ou corrompidos sem impedir o jogo.
function carregarPerfil() {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE_PERFIL));
    if (!salvo || typeof salvo !== 'object' || typeof salvo.name !== 'string') return null;
    return { ...criarPerfil(salvo.name), ...salvo,
      achievements: Array.isArray(salvo.achievements) ? salvo.achievements : [],
      rewards: Array.isArray(salvo.rewards) ? salvo.rewards : [] };
  } catch (erro) {
    console.warn('Não foi possível ler o progresso salvo.', erro);
    return null;
  }
}

// O servidor usa nomes em português/snake_case; a interface mantém o
// formato do perfil local para que as duas origens sejam intercambiáveis.
function perfilDoServidor(p) {
  return { name: p.nome, difficulty: p.dificuldade, category: p.categoria, level: p.nivel, score: p.pontuacao,
    gamesPlayed: p.partidas_jogadas, wins: p.vitorias, losses: p.derrotas, winStreak: p.sequencia_vitorias,
    bestWinStreak: p.melhor_sequencia_vitorias, letterStreak: p.sequencia_letras, bestLetterStreak: p.melhor_sequencia_letras,
    lettersFound: p.letras_descobertas, hardWins: p.vitorias_dificil, cognitiveScore: p.pontos_cognitivos,
    achievements: p.conquistas || [], rewards: p.recompensas || [], isPlus: p.is_plus };
}

let jogador = null;
let modoOnline = false;
let dadosOnline = { estatisticas: null, ranking: null };
// "rodada" identifica a partida atual e descarta respostas de partidas já abandonadas.
const estadoDaPartida = { difficulty: null, category: null, partidaId: null, rodada: 0, revelada: [], tried: new Set(), correct: new Set(), errors: 0, active: false, aguardando: false };
let iniciandoPartida = false;

// As referências ao DOM são coletadas uma vez; as funções de interface
// abaixo usam os mesmos elementos, mantendo a fonte de verdade no estado.
const $ = (id) => document.getElementById(id);
const telas = { carregando: $('tela-carregando'), autenticacao: $('tela-autenticacao'), identificacao: $('tela-identificacao'), painel: $('tela-painel'), partida: $('tela-partida'), resultado: $('tela-resultado') };
const refs = {
  form: $('form-identificacao'), nome: $('nome-jogador'), retorno: $('boas-vindas-retorno'), mensagemRetorno: $('mensagem-retorno'),
  opcoesDificuldade: $('opcoes-dificuldade'), blocoCategoria: $('bloco-categoria'), opcoesCategoria: $('opcoes-categoria'),
  figura: $('figura-hulk'), rotuloEstagio: $('rotulo-estagio'), erros: $('contador-erros'), status: $('mensagem-status'),
  palavra: $('area-palavra'), usadas: $('letras-usadas'), teclado: $('teclado-virtual'), modal: $('tela-modal'),
};
let ultimaPartida = null;

// No modo online o placar mora no servidor; aqui só sincronizamos preferências.
function salvarPerfil() {
  if (!jogador || modoOnline) return;
  try { localStorage.setItem(CHAVE_PERFIL, JSON.stringify(jogador)); }
  catch (erro) { console.warn('Não foi possível salvar o progresso neste navegador.', erro); }
}

function salvarPreferencias() {
  if (!jogador) return;
  if (!modoOnline) return salvarPerfil();
  ServicoOnline.salvarPreferencias(jogador)
    .catch((erro) => console.warn('Não foi possível sincronizar as preferências.', erro));
}

// Os textos de "dados simulados" só fazem sentido no modo local.
function aplicarRotulosDoModo() {
  const rotulos = modoOnline
    ? { sinal: '● ONLINE', dados: 'Dados em tempo real', posicao: 'Sua posição global:', etiqueta: 'Placar global', titulo: '🏆 Ranking global', selo: 'AO VIVO', nota: 'Top jogadores de todos os dispositivos.' }
    : { sinal: '● LOCAL', dados: 'Dados demonstrativos', posicao: 'Sua posição local:', etiqueta: 'Placar demonstrativo', titulo: '🏆 Ranking local', selo: 'SIMULADO', nota: 'Nomes e pontuações de demonstração; nenhum dado online.' };
  $('trocar-usuario-cabecalho').textContent = modoOnline ? 'Sair' : 'Trocar';
  $('sinal-modo').textContent = rotulos.sinal;
  $('rotulo-dados-online').textContent = rotulos.dados;
  $('rotulo-posicao').textContent = rotulos.posicao;
  $('etiqueta-ranking').textContent = rotulos.etiqueta;
  $('titulo-ranking').textContent = rotulos.titulo;
  $('selo-ranking').textContent = rotulos.selo;
  $('nota-ranking').textContent = rotulos.nota;
}

function mostrarTela(nome) {
  Object.entries(telas).forEach(([chave, tela]) => { tela.hidden = chave !== nome; });
  document.body.classList.toggle('em-partida', nome === 'partida');
  window.scrollTo(0, 0);
}

// Modo local: sem conta, o progresso fica só neste navegador. No modo online
// a entrada é feita pelos formulários de autenticação (enviarLogin/enviarCadastro).
function iniciarJornada(nome) {
  jogador = criarPerfil(nome.trim());
  salvarPerfil();
  mostrarPainel();
}

function mostrarIdentificacao() {
  mostrarTela('identificacao');
  $('cabecalho-jogador').hidden = true;
  refs.retorno.hidden = !jogador;
  refs.form.hidden = Boolean(jogador);
  if (jogador) refs.mensagemRetorno.textContent = `Olá, ${jogador.name}! Sua jornada está salva.`;
  else refs.nome.focus();
}

/* ----------------------------------------------------------------------------
   AUTENTICAÇÃO (modo online)
   Fluxo: carregando → (sessão válida?) → painel | login/cadastro.
   Senhas nunca passam por aqui além do envio ao Supabase Auth; nada é gravado
   no localStorage pela aplicação (a sessão é do próprio supabase-js).
   ---------------------------------------------------------------------------- */
const TAMANHO_MINIMO_SENHA = 8;
const TAMANHO_MAXIMO_SENHA = 72; // limite do bcrypt usado pelo Supabase Auth
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
let geracaoSessao = 0;       // muda a cada entrada/saída; descarta respostas atrasadas
let abrindoSessao = null;    // promessa em andamento: junta chamadas concorrentes
let inicializando = true;    // durante a partida da página, quem decide é inicializar()
let enviandoFormulario = false;
let temporizadorDoAviso = null;

// Registra só o que ajuda a diagnosticar (nome, código e status): nunca e-mail, senha ou tokens.
function registrarErro(contexto, erro) {
  console.warn(`[${contexto}]`, erro?.name || 'Erro', erro?.code || '', erro?.status || '', erro?.message || '');
}

// O PostgREST devolve falhas de rede como objeto simples (sem código), por isso
// também reconhecemos pela mensagem.
function erroDeRede(erro) {
  return erro instanceof TypeError || ['AbortError', 'TimeoutError', 'AuthRetryableFetchError'].includes(erro?.name) || erro?.status === 0
    || (!erro?.code && /fetch|network|timeout|abort/i.test(erro?.message || ''));
}

function erroDeSessao(erro) {
  return erro?.status === 401 || ['28000', 'PGRST301', 'PGRST303'].includes(erro?.code)
    || erro?.name === 'AuthSessionMissingError' || /\bJWT\b/.test(erro?.message || '');
}

// Mensagens para o jogador: claras, sem detalhes técnicos e sem revelar se um e-mail existe.
function traduzirErroDeAutenticacao(erro, contexto) {
  if (erroDeRede(erro)) return 'Não foi possível conectar ao servidor. Verifique sua internet e tente de novo.';
  switch (erro?.code) {
    case 'invalid_credentials': return 'E-mail ou senha incorretos.';
    case 'email_not_confirmed': return 'Confirme seu e-mail antes de entrar: procure a mensagem de confirmação na caixa de entrada (e no spam).';
    case 'weak_password': return `Escolha uma senha mais forte, com pelo menos ${TAMANHO_MINIMO_SENHA} caracteres.`;
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
    case 'over_sms_send_rate_limit': return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.';
    case 'email_address_invalid': return 'Este endereço de e-mail não é aceito. Confira se digitou corretamente.';
    case 'signup_disabled': return 'Novos cadastros estão desativados no momento.';
    case 'user_already_exists':
    case 'email_exists': return 'Não foi possível criar a conta com estes dados. Se você já tem conta, use "Entrar".';
    default: return contexto === 'cadastro'
      ? 'Não foi possível criar a conta agora. Tente novamente em instantes.'
      : 'Não foi possível entrar agora. Tente novamente em instantes.';
  }
}

function validarEmailESenha(email, senha) {
  if (!email) return { campo: 'email', mensagem: 'Informe seu e-mail.' };
  if (!REGEX_EMAIL.test(email)) return { campo: 'email', mensagem: 'Informe um e-mail válido, como nome@exemplo.com.' };
  if (!senha) return { campo: 'senha', mensagem: 'Informe sua senha.' };
  return null;
}

function validarCadastro({ nome, email, senha, confirmacao }) {
  if (!nome) return { campo: 'nome', mensagem: 'Informe um nome de exibição.' };
  if ([...nome].length > 24) return { campo: 'nome', mensagem: 'O nome de exibição pode ter até 24 caracteres.' };
  const problema = validarEmailESenha(email, senha);
  if (problema) return problema;
  if (senha.length < TAMANHO_MINIMO_SENHA) return { campo: 'senha', mensagem: `A senha precisa ter pelo menos ${TAMANHO_MINIMO_SENHA} caracteres.` };
  if (senha.length > TAMANHO_MAXIMO_SENHA) return { campo: 'senha', mensagem: `A senha pode ter no máximo ${TAMANHO_MAXIMO_SENHA} caracteres.` };
  if (senha !== confirmacao) return { campo: 'confirmacao', mensagem: 'A confirmação não é igual à senha.' };
  return null;
}

// Aviso global (fora dos formulários): some sozinho depois de alguns segundos.
function mostrarAviso(texto) {
  const aviso = $('aviso-global');
  window.clearTimeout(temporizadorDoAviso);
  aviso.textContent = texto;
  aviso.hidden = !texto;
  if (texto) temporizadorDoAviso = window.setTimeout(() => { aviso.hidden = true; }, 9000);
}

function limparErrosDoFormulario(form) {
  form.querySelectorAll('input').forEach((campo) => campo.removeAttribute('aria-invalid'));
  const erro = form.querySelector('.erro-auth');
  erro.hidden = true;
  erro.textContent = '';
}

// "problema" = { campo?, mensagem }; o campo recebe foco e marcação de erro.
function mostrarErroDoFormulario(form, problema) {
  limparErrosDoFormulario(form);
  const erro = form.querySelector('.erro-auth');
  erro.textContent = problema.mensagem;
  erro.hidden = false;
  const campo = problema.campo && form.querySelector(`[name="${problema.campo}"]`);
  if (campo) {
    campo.setAttribute('aria-invalid', 'true');
    campo.focus();
  }
}

function alternarEnvio(form, enviando, textoEnviando) {
  const botao = form.querySelector('button[type="submit"]');
  if (enviando) {
    botao.dataset.rotulo = botao.innerHTML;
    botao.textContent = textoEnviando;
  } else if (botao.dataset.rotulo) {
    botao.innerHTML = botao.dataset.rotulo;
  }
  botao.disabled = enviando;
  form.setAttribute('aria-busy', String(enviando));
}

function selecionarAba(aba) {
  const entrando = aba === 'entrar';
  $('aba-entrar').classList.toggle('selecionada', entrando);
  $('aba-entrar').setAttribute('aria-selected', String(entrando));
  $('aba-cadastro').classList.toggle('selecionada', !entrando);
  $('aba-cadastro').setAttribute('aria-selected', String(!entrando));
  $('form-login').hidden = !entrando;
  $('form-cadastro').hidden = entrando;
  $('titulo-autenticacao').textContent = entrando ? 'Entre para continuar' : 'Crie sua conta';
  limparErrosDoFormulario($('form-login'));
  limparErrosDoFormulario($('form-cadastro'));
}

function mostrarCarregando(texto, comAcoes = false) {
  mostrarTela('carregando');
  $('cabecalho-jogador').hidden = true;
  $('texto-carregando').textContent = texto;
  $('indicador-carregando').hidden = comAcoes;
  $('acoes-carregando').hidden = !comAcoes;
  if (comAcoes) $('botao-tentar-novamente').focus();
}

function mostrarAutenticacao(mensagemDeErro = '') {
  mostrarTela('autenticacao');
  $('cabecalho-jogador').hidden = true;
  selecionarAba('entrar');
  if (mensagemDeErro) mostrarErroDoFormulario($('form-login'), { mensagem: mensagemDeErro });
}

// Ponto único de entrada quando não há jogador: conta (online) ou apelido (local).
function mostrarEntrada() {
  if (modoOnline) mostrarAutenticacao();
  else mostrarIdentificacao();
}

// Descarta tudo que é privado e está em memória. Os dados salvos no servidor permanecem.
function limparEstadoPrivado() {
  geracaoSessao += 1;
  jogador = null;
  dadosOnline = { estatisticas: null, ranking: null };
  ultimaPartida = null;
  Object.assign(estadoDaPartida, { active: false, aguardando: false, partidaId: null, revelada: [], rodada: estadoDaPartida.rodada + 1 });
  ['form-login', 'form-cadastro'].forEach((id) => $(id).reset());
  $('aviso-confirmacao').hidden = true;
  refs.opcoesCategoria.replaceChildren();
  $('lista-ranking').replaceChildren();
  $('lista-conquistas').replaceChildren();
  refs.modal.hidden = true;
  ['nome-cabecalho', 'nome-painel', 'streak-cabecalho'].forEach((id) => { $(id).textContent = ''; });
}

// Sessão inválida ou expirada: limpa memória e volta ao login. O signOut local
// apenas remove o token vencido guardado pelo supabase-js.
function encerrarSessaoLocal(mensagem) {
  limparEstadoPrivado();
  ServicoOnline.sair().then(({ error }) => { if (error) registrarErro('limpar sessão', error); })
    .catch((erro) => registrarErro('limpar sessão', erro));
  mostrarAutenticacao(mensagem);
}

async function sairDaConta() {
  const botoes = [$('trocar-usuario-cabecalho'), $('botao-sair-carregando')];
  botoes.forEach((botao) => { botao.disabled = true; });
  try {
    const { error } = await ServicoOnline.sair();
    if (error) throw error;
    limparEstadoPrivado();
    mostrarAviso('');
    mostrarAutenticacao();
  } catch (erro) {
    registrarErro('sair', erro);
    mostrarAviso('Não foi possível encerrar a sessão agora. Verifique sua conexão e tente de novo.');
  } finally {
    botoes.forEach((botao) => { botao.disabled = false; });
  }
}

// Carrega (ou cria, de forma idempotente) o perfil e abre o painel. Nunca lança
// erro: falhas viram tela com "Tentar novamente", sem trocar dados por valores iniciais.
function abrirSessao() {
  if (abrindoSessao) return abrindoSessao;
  const geracao = geracaoSessao;
  abrindoSessao = (async () => {
    mostrarCarregando('Carregando sua jornada…');
    try {
      const perfil = await ServicoOnline.garantirPerfil();
      if (geracao !== geracaoSessao) return;
      jogador = perfilDoServidor(perfil);
      mostrarAviso('');
      mostrarPainel();
    } catch (erro) {
      registrarErro('carregar perfil', erro);
      if (geracao !== geracaoSessao) return;
      if (erroDeSessao(erro)) return encerrarSessaoLocal('Sua sessão expirou. Entre novamente.');
      mostrarCarregando(erroDeRede(erro)
        ? 'Sem conexão com o servidor. Não foi possível carregar sua jornada.'
        : 'Não foi possível carregar sua jornada agora.', true);
    }
  })().finally(() => { abrindoSessao = null; });
  return abrindoSessao;
}

// Recupera a sessão persistida (inclusive a vinda do link de confirmação do e-mail).
async function verificarSessao() {
  mostrarCarregando('Verificando sua sessão…');
  try {
    const sessao = await ServicoOnline.obterSessao();
    if (sessao) await abrirSessao();
    else mostrarAutenticacao();
  } catch (erro) {
    registrarErro('recuperar sessão', erro);
    mostrarCarregando('Não foi possível verificar sua sessão. Verifique sua conexão.', true);
  }
}

// Eventos do Supabase Auth. Sem await/chamadas ao cliente aqui dentro (risco de
// deadlock documentado): o trabalho é agendado para depois do callback.
function tratarMudancaDeSessao(evento, sessao) {
  window.setTimeout(() => {
    if (!modoOnline) return;
    if (evento === 'SIGNED_OUT' && jogador) {
      encerrarSessaoLocal('Sua sessão terminou. Entre novamente para continuar.');
    } else if (evento === 'SIGNED_IN' && sessao && !jogador && !abrindoSessao && !inicializando && !enviandoFormulario) {
      // Ex.: e-mail confirmado ou login feito em outra aba.
      abrirSessao();
    }
  }, 0);
}

async function enviarLogin(evento) {
  evento.preventDefault();
  const form = $('form-login');
  const email = $('login-email').value.trim();
  const senha = $('login-senha').value;
  const problema = validarEmailESenha(email, senha);
  if (problema) return mostrarErroDoFormulario(form, problema);
  limparErrosDoFormulario(form);
  enviandoFormulario = true;
  alternarEnvio(form, true, 'Entrando…');
  try {
    const { error } = await ServicoOnline.entrar(email, senha);
    if (error) throw error;
    form.reset();
    await abrirSessao();
  } catch (erro) {
    registrarErro('login', erro);
    mostrarErroDoFormulario(form, { mensagem: traduzirErroDeAutenticacao(erro, 'login') });
  } finally {
    enviandoFormulario = false;
    alternarEnvio(form, false);
  }
}

async function enviarCadastro(evento) {
  evento.preventDefault();
  const form = $('form-cadastro');
  const dados = {
    nome: $('cadastro-nome').value.trim().replace(/\s+/g, ' '),
    email: $('cadastro-email').value.trim(),
    senha: $('cadastro-senha').value,
    confirmacao: $('cadastro-confirmacao').value,
  };
  const problema = validarCadastro(dados);
  if (problema) return mostrarErroDoFormulario(form, problema);
  limparErrosDoFormulario(form);
  enviandoFormulario = true;
  alternarEnvio(form, true, 'Criando conta…');
  try {
    const { data, error } = await ServicoOnline.cadastrar(dados);
    if (error) throw error;
    form.reset();
    if (data.session) {
      await abrirSessao(); // confirmação de e-mail desligada no projeto: já há sessão
    } else {
      mostrarConfirmacaoPendente(dados.email);
    }
  } catch (erro) {
    registrarErro('cadastro', erro);
    mostrarErroDoFormulario(form, { mensagem: traduzirErroDeAutenticacao(erro, 'cadastro') });
  } finally {
    enviandoFormulario = false;
    alternarEnvio(form, false);
  }
}

// Mesma mensagem para e-mail novo ou já cadastrado: não revela se a conta existe.
function mostrarConfirmacaoPendente(email) {
  selecionarAba('entrar');
  $('login-email').value = email;
  const aviso = $('aviso-confirmacao');
  aviso.textContent = `Enviamos uma mensagem para ${email}. Abra o link de confirmação (confira também o spam) e depois entre aqui. Se você já tinha conta com este e-mail, é só entrar.`;
  aviso.hidden = false;
  $('login-senha').focus();
}

// A resposta da última letra se perdeu depois de o servidor encerrar a partida: busca o progresso real.
async function sincronizarPartidaEncerrada() {
  estadoDaPartida.active = false;
  try {
    jogador = perfilDoServidor(await ServicoOnline.obterPerfil());
  } catch (erro) {
    registrarErro('sincronizar partida encerrada', erro);
  }
  mostrarAviso('Essa partida já havia sido encerrada no servidor. Seu progresso foi sincronizado.');
  mostrarPainel();
}

// Últimas partidas concluídas, lidas direto da tabela (RLS: só as do próprio jogador).
async function preencherHistorico() {
  const alvo = $('historico-partidas');
  if (!alvo) return;
  const geracao = geracaoSessao;
  alvo.textContent = 'Carregando…';
  try {
    const partidas = await ServicoOnline.obterHistorico(5);
    if (geracao !== geracaoSessao || !alvo.isConnected) return;
    if (!partidas.length) {
      alvo.textContent = 'Você ainda não concluiu nenhuma partida.';
      return;
    }
    const lista = document.createElement('ul');
    lista.className = 'historico-partidas';
    partidas.forEach((partida) => {
      const item = document.createElement('li');
      const quando = new Date(partida.finalizada_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      const resultado = document.createElement('b');
      resultado.className = partida.status;
      resultado.textContent = partida.status === 'vitoria' ? 'Vitória' : 'Derrota';
      const detalhe = document.createElement('span');
      detalhe.textContent = `${CATEGORIAS[partida.categoria]?.nome || partida.categoria} · ${DIFICULDADES[partida.dificuldade]?.nome || partida.dificuldade} · +${partida.pontos} pts · ${quando}`;
      item.append(resultado, detalhe);
      lista.appendChild(item);
    });
    alvo.replaceChildren(lista);
  } catch (erro) {
    registrarErro('carregar histórico', erro);
    alvo.textContent = 'Não foi possível carregar o histórico agora.';
  }
}

function mostrarPainel() {
  if (!jogador) return mostrarEntrada();
  mostrarTela('painel');
  $('cabecalho-jogador').hidden = false;
  $('nome-cabecalho').textContent = jogador.name;
  $('nome-painel').textContent = jogador.name;
  $('streak-cabecalho').textContent = jogador.winStreak;
  jogador.difficulty = DIFICULDADES[jogador.difficulty] ? jogador.difficulty : 'medio';
  const categoria = categoriasDisponiveis(jogador.difficulty).includes(jogador.category) ? jogador.category : 'geral';
  jogador.category = categoria;
  selecionarDificuldade(jogador.difficulty, false);
  atualizarPainel();
  salvarPerfil();
  carregarDadosOnline();
}

// Busca ranking e atividade reais sem bloquear a tela; ao chegar, redesenha.
async function carregarDadosOnline() {
  if (!modoOnline) return;
  const geracao = geracaoSessao;
  try {
    const [estatisticas, ranking] = await Promise.all([ServicoOnline.obterEstatisticas(), ServicoOnline.obterRanking(10)]);
    if (geracao !== geracaoSessao) return; // houve saída/troca de conta no meio da busca
    dadosOnline = { estatisticas, ranking };
    if (jogador && !telas.painel.hidden) {
      gerarOpcoesDeCategoria(jogador.difficulty);
      atualizarPainel();
    }
  } catch (erro) {
    registrarErro('carregar ranking e atividade', erro);
    if (erroDeSessao(erro) && geracao === geracaoSessao) encerrarSessaoLocal('Sua sessão expirou. Entre novamente.');
  }
}

function categoriasDisponiveis(dificuldade) {
  const doServidor = dadosOnline.estatisticas?.palavras?.[dificuldade];
  if (modoOnline && doServidor) return Object.keys(CATEGORIAS).filter((chave) => doServidor[chave] > 0);
  return Object.keys(BANCO_DE_PALAVRAS[dificuldade]);
}

function resumoDaCategoria(dificuldade, chave) {
  const estat = dadosOnline.estatisticas;
  if (modoOnline && estat) {
    const palavras = estat.palavras?.[dificuldade]?.[chave] || 0;
    const jogando = estat.online_por_categoria?.[chave] || 0;
    const media = estat.media_por_categoria?.[chave];
    return {
      texto: `${palavras} palavras · ${jogando} jogando agora${media !== undefined ? ` · média ${media} pts` : ''}`,
      acessivel: `${palavras} palavras. ${jogando} jogando agora.`,
    };
  }
  const palavras = BANCO_DE_PALAVRAS[dificuldade][chave]?.length || 0;
  const online = DADOS_MOCK.categorias[chave] || 48 + chave.length * 7;
  return {
    texto: `${palavras} palavras · ${online} jogadores · média ${210 + chave.length * 19} pts · rank #${12 + chave.length * 3} (mock)`,
    acessivel: `${palavras} palavras. Dados de atividade simulados.`,
  };
}

function selecionarDificuldade(dificuldade, salvar = true) {
  if (!DIFICULDADES[dificuldade]) return;
  jogador.difficulty = dificuldade;
  refs.opcoesDificuldade.querySelectorAll('[data-dificuldade]').forEach((botao) => {
    const selecionado = botao.dataset.dificuldade === dificuldade;
    botao.classList.toggle('selecionada', selecionado);
    botao.setAttribute('aria-pressed', String(selecionado));
  });
  gerarOpcoesDeCategoria(dificuldade);
  refs.blocoCategoria.hidden = false;
  if (salvar) salvarPreferencias();
}

function gerarOpcoesDeCategoria(dificuldade) {
  refs.opcoesCategoria.replaceChildren();
  categoriasDisponiveis(dificuldade).forEach((chave) => {
    const item = CATEGORIAS[chave];
    const resumo = resumoDaCategoria(dificuldade, chave);
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = `cartao-categoria${jogador.category === chave ? ' selecionada' : ''}`;
    botao.dataset.categoria = chave;
    botao.innerHTML = `<span class="categoria-icone" aria-hidden="true">${item.icone}</span><span class="categoria-dados"><b>${item.nome}</b><small>${item.descricao}</small><small class="categoria-mock">${resumo.texto}</small></span><span class="categoria-seta" aria-hidden="true">→</span>`;
    botao.setAttribute('aria-label', `${item.nome}. ${item.descricao}. ${resumo.acessivel}`);
    botao.addEventListener('click', () => iniciarPartida(dificuldade, chave));
    refs.opcoesCategoria.appendChild(botao);
  });
}

function atualizarPainel() {
  jogador.level = Math.floor(jogador.score / 300) + 1;
  $('nivel-jogador').textContent = jogador.level;
  $('pontuacao-jogador').textContent = jogador.score.toLocaleString('pt-BR');
  $('vitorias-jogador').textContent = jogador.wins;
  $('streak-jogador').textContent = jogador.winStreak;
  $('streak-cabecalho').textContent = jogador.winStreak;
  $('pontos-cognitivos').textContent = `${jogador.cognitiveScore} pontos de treino`;
  $('subtitulo-painel').textContent = modoOnline && jogador.gamesPlayed > 0
    ? `Bem-vindo de volta! Você já jogou ${jogador.gamesPlayed} ${jogador.gamesPlayed === 1 ? 'partida' : 'partidas'} e venceu ${jogador.wins}. Mantenha sua sequência viva.`
    : 'Escolha um desafio e mantenha sua sequência viva.';
  const dentroDoNivel = jogador.score % 300;
  $('progresso-nivel-texto').textContent = `${dentroDoNivel} / 300 XP`;
  $('progresso-nivel').style.width = `${(dentroDoNivel / 300) * 100}%`;
  $('progresso-nivel').parentElement.setAttribute('aria-valuenow', String(Math.round(dentroDoNivel / 3)));
  const atividade = jogador.cognitiveScore % 100;
  $('progresso-cognitivo').style.width = `${atividade}%`;
  $('progresso-cognitivo').parentElement.setAttribute('aria-valuenow', String(atividade));
  const jornada = jogador.level >= 12 ? ['🏆', 'Lenda Gama'] : jogador.level >= 8 ? ['✨', 'Brilho Gama'] : jogador.level >= 5 ? ['🌳', 'Árvore forte'] : jogador.level >= 3 ? ['🌿', 'Em crescimento'] : ['🌱', 'Semente'];
  $('avatar-jornada').textContent = jornada[0];
  $('rotulo-jornada').textContent = jornada[1];
  const jogandoAgora = atividadeAtual();
  $('online-geral').textContent = jogandoAgora.geral.toLocaleString('pt-BR');
  $('online-categoria').textContent = jogandoAgora.categoria.toLocaleString('pt-BR');
  const voce = listaDoRanking().find((pessoa) => pessoa.atual);
  $('posicao-ranking').textContent = voce ? `#${voce.posicao}` : '—';
  renderizarRanking();
  renderizarConquistas();
}

function atividadeAtual() {
  const estat = dadosOnline.estatisticas;
  if (modoOnline && estat) return { geral: estat.online, categoria: estat.online_por_categoria?.[jogador.category] || 0 };
  return { geral: DADOS_MOCK.online, categoria: DADOS_MOCK.categorias[jogador.category] || 48 + jogador.category.length * 7 };
}

// Mesmo formato para as duas origens: { posicao, nome, score, atual }.
function listaDoRanking() {
  if (modoOnline && dadosOnline.ranking) {
    return dadosOnline.ranking.map((linha) => ({ posicao: linha.posicao, nome: linha.nome.toLocaleUpperCase('pt-BR'), score: linha.pontuacao, atual: linha.eh_voce }));
  }
  return [...DADOS_MOCK.ranking, { nome: jogador.name.toLocaleUpperCase('pt-BR'), score: jogador.score, atual: true }]
    .sort((a, b) => b.score - a.score)
    .map((pessoa, indice) => ({ ...pessoa, posicao: indice + 1 }));
}

// No painel cabem 5 linhas; se você estiver fora do top 5, aparece no lugar da última.
function renderizarRanking() {
  const completo = listaDoRanking();
  const ranking = completo.slice(0, 5);
  const voce = completo.find((pessoa) => pessoa.atual);
  if (voce && !ranking.includes(voce)) ranking[ranking.length - 1] = voce;
  const lista = $('lista-ranking');
  lista.replaceChildren();
  ranking.forEach((pessoa) => {
    const item = document.createElement('li');
    if (pessoa.atual) item.className = 'jogador-atual';
    const colocacao = document.createElement('span');
    const nome = document.createElement('b');
    const pontos = document.createElement('strong');
    colocacao.textContent = String(pessoa.posicao).padStart(2, '0');
    nome.textContent = pessoa.nome;
    pontos.textContent = pessoa.score.toLocaleString('pt-BR');
    item.append(colocacao, nome, pontos);
    if (pessoa.atual) {
      const atual = document.createElement('small');
      atual.textContent = 'VOCÊ';
      item.appendChild(atual);
    }
    lista.appendChild(item);
  });
}

function renderizarConquistas() {
  const lista = $('lista-conquistas');
  lista.replaceChildren();
  CONQUISTAS.slice(0, 3).forEach((conquista) => {
    const liberada = jogador.achievements.includes(conquista.id);
    const item = document.createElement('div');
    item.className = `conquista-mini${liberada ? ' liberada' : ''}`;
    item.innerHTML = `<span>${liberada ? conquista.icone : '🔒'}</span><div><b>${conquista.nome}</b><small>${conquista.descricao}</small></div>`;
    lista.appendChild(item);
  });
  $('contador-conquistas').textContent = `${jogador.achievements.length} / ${CONQUISTAS.length}`;
}

// Os dois motores têm o mesmo contrato e devolvem o mesmo formato das RPCs
// iniciar_partida/tentar_letra do Supabase. A interface não sabe qual roda.
const motorLocal = {
  palavra: '',
  corretas: new Set(),
  erros: 0,
  async iniciarPartida(dificuldade, categoria) {
    this.palavra = sortearPalavra(BANCO_DE_PALAVRAS[dificuldade][categoria]);
    this.corretas = new Set();
    this.erros = 0;
    return { partida_id: null, tamanho: this.palavra.length };
  },
  async tentarLetra(_partidaId, letra) {
    const acertou = this.palavra.includes(letra);
    const posicoes = [...this.palavra].flatMap((caractere, indice) => (caractere === letra ? [indice] : []));
    if (acertou) {
      this.corretas.add(letra);
      jogador.letterStreak += 1;
      jogador.bestLetterStreak = Math.max(jogador.bestLetterStreak, jogador.letterStreak);
    } else {
      this.erros += 1;
      jogador.letterStreak = 0;
    }
    const venceu = [...this.palavra].every((caractere) => this.corretas.has(caractere));
    const encerrada = venceu || this.erros >= LIMITE_DE_ERROS;
    const resultado = { repetida: false, letra, acertou, posicoes, erros: this.erros, encerrada, venceu,
      palavra: encerrada ? this.palavra : null, pontos: 0, pontos_cognitivos: 0, novidades: [] };
    if (encerrada) Object.assign(resultado, aplicarFimDePartidaLocal(venceu, this.corretas.size, estadoDaPartida.difficulty));
    salvarPerfil();
    return resultado;
  },
};

const motorOnline = {
  iniciarPartida: (dificuldade, categoria) => ServicoOnline.iniciarPartida(dificuldade, categoria),
  async tentarLetra(partidaId, letra) {
    const resultado = await ServicoOnline.tentarLetra(partidaId, letra);
    if (resultado.jogador) jogador = perfilDoServidor(resultado.jogador);
    return resultado;
  },
};

const motor = () => (modoOnline ? motorOnline : motorLocal);

async function iniciarPartida(dificuldade, categoria) {
  if (!DIFICULDADES[dificuldade] || !CATEGORIAS[categoria] || iniciandoPartida) return;
  iniciandoPartida = true;
  let partida;
  try {
    partida = await motor().iniciarPartida(dificuldade, categoria);
  } catch (erro) {
    registrarErro('iniciar partida', erro);
    if (modoOnline && erroDeSessao(erro)) return encerrarSessaoLocal('Sua sessão expirou. Entre novamente.');
    $('dica-desafio').textContent = 'Não foi possível iniciar a partida. Verifique sua conexão e tente de novo.';
    return;
  } finally {
    iniciandoPartida = false;
  }
  estadoDaPartida.difficulty = dificuldade;
  estadoDaPartida.category = categoria;
  estadoDaPartida.partidaId = partida.partida_id;
  estadoDaPartida.rodada += 1;
  estadoDaPartida.revelada = Array(partida.tamanho).fill('');
  estadoDaPartida.tried = new Set();
  estadoDaPartida.correct = new Set();
  estadoDaPartida.errors = 0;
  estadoDaPartida.active = true;
  estadoDaPartida.aguardando = false;
  jogador.difficulty = dificuldade;
  jogador.category = categoria;
  salvarPerfil();
  $('categoria-partida').textContent = CATEGORIAS[categoria].nome;
  $('dificuldade-partida').textContent = DIFICULDADES[dificuldade].nome;
  $('streak-partida').textContent = jogador.winStreak;
  $('nivel-partida').textContent = jogador.level;
  $('multiplicador-partida').textContent = `${DIFICULDADES[dificuldade].multiplicador}×`;
  mostrarTela('partida');
  $('streak-letras').textContent = `🔥 ${jogador.letterStreak} ${jogador.letterStreak === 1 ? 'seguida' : 'seguidas'}`;
  criarTecladoVirtual();
  atualizarEstagioDaTransformacao();
  atualizarProgressoPalavra();
  renderizarPalavra();
  renderizarLetrasUsadas();
  refs.erros.textContent = '0';
  refs.status.textContent = `Partida iniciada: ${DIFICULDADES[dificuldade].nome}, categoria ${CATEGORIAS[categoria].nome}.`;
}

// Esta única função recebe entradas do teclado físico e virtual, aplica as
// mesmas validações e atualiza o estado. "aguardando" impede duas letras ao
// mesmo tempo enquanto o servidor responde.
async function processarTentativaDeLetra(entrada) {
  if (!estadoDaPartida.active || estadoDaPartida.aguardando) return;
  const letra = normalizarLetra(entrada);
  if (!letraEhValida(letra)) return;
  if (estadoDaPartida.tried.has(letra)) {
    refs.status.textContent = `A letra ${letra} já foi utilizada.`;
    return;
  }
  const rodada = estadoDaPartida.rodada;
  estadoDaPartida.aguardando = true;
  let resultado;
  try {
    resultado = await motor().tentarLetra(estadoDaPartida.partidaId, letra);
  } catch (erro) {
    registrarErro('enviar letra', erro);
    if (rodada !== estadoDaPartida.rodada) return;
    if (modoOnline && erroDeSessao(erro)) return encerrarSessaoLocal('Sua sessão expirou. Entre novamente.');
    // A resposta da última letra pode ter se perdido depois de o servidor encerrar a partida.
    if (modoOnline && erro?.code === '22023' && /encerrada/i.test(erro.message || '')) return sincronizarPartidaEncerrada();
    refs.status.textContent = `Falha de conexão. A letra ${letra} não foi registrada; tente novamente.`;
    return;
  } finally {
    estadoDaPartida.aguardando = false;
  }
  if (rodada !== estadoDaPartida.rodada || !estadoDaPartida.active || resultado.repetida) return;

  estadoDaPartida.tried.add(letra);
  if (resultado.acertou) {
    estadoDaPartida.correct.add(letra);
    resultado.posicoes.forEach((indice) => { estadoDaPartida.revelada[indice] = letra; });
    refs.status.textContent = `Acertou! ${letra} aparece na palavra.`;
  } else {
    refs.status.textContent = `A letra ${letra} não aparece na palavra. Sua sequência de letras recomeçou.`;
  }
  estadoDaPartida.errors = resultado.erros;
  marcarTeclaComoUsada(letra, resultado.acertou);
  atualizarEstagioDaTransformacao();
  atualizarProgressoPalavra();
  renderizarPalavra();
  renderizarLetrasUsadas();
  $('streak-letras').textContent = `🔥 ${jogador.letterStreak} ${jogador.letterStreak === 1 ? 'seguida' : 'seguidas'}`;
  refs.erros.textContent = String(estadoDaPartida.errors);
  if (resultado.encerrada) mostrarResultado(resultado);
}

// Regra de pontuação do modo local. No modo online a mesma regra roda em
// public.tentar_letra (supabase/migrations) — mantenha as duas alinhadas.
function aplicarFimDePartidaLocal(venceu, acertos, slugDificuldade) {
  const dificuldade = DIFICULDADES[slugDificuldade];
  const pontos = venceu ? (dificuldade.pontos + acertos * 5) : Math.round(dificuldade.pontos * 0.2);
  const pontosCognitivos = dificuldade.cognitivo + acertos + (venceu ? 5 : 0);
  jogador.gamesPlayed += 1;
  jogador.score += pontos;
  jogador.cognitiveScore += pontosCognitivos;
  jogador.lettersFound += acertos;
  if (venceu) {
    jogador.wins += 1;
    jogador.winStreak += 1;
    jogador.bestWinStreak = Math.max(jogador.bestWinStreak, jogador.winStreak);
    if (slugDificuldade === 'dificil') jogador.hardWins += 1;
  } else {
    jogador.losses += 1;
    jogador.winStreak = 0;
  }
  jogador.level = Math.floor(jogador.score / 300) + 1;
  const novidades = verificarConquistasERecompensas(dificuldade.multiplicador);
  return { pontos, pontos_cognitivos: pontosCognitivos, novidades };
}

function mostrarResultado(resultado) {
  estadoDaPartida.active = false;
  desabilitarTecladoVirtual();
  estadoDaPartida.revelada = [...resultado.palavra];
  renderizarPalavra();
  ultimaPartida = { dificuldade: estadoDaPartida.difficulty, categoria: estadoDaPartida.category };
  $('etiqueta-resultado').textContent = resultado.venceu ? 'Contenção bem-sucedida' : 'Relatório da missão';
  $('titulo-resultado').textContent = resultado.venceu ? 'Missão cumprida!' : 'A missão terminou';
  $('palavra-revelada-resultado').textContent = `A palavra era: ${resultado.palavra}`;
  $('pontos-resultado').textContent = `+${resultado.pontos}`;
  $('cognitivo-resultado').textContent = `+${resultado.pontos_cognitivos}`;
  $('sequencia-resultado').textContent = String(jogador.winStreak);
  $('novidades-resultado').innerHTML = resultado.novidades.length
    ? resultado.novidades.map((item) => `<p>🏆 ${item}</p>`).join('')
    : '<p>Seu progresso foi atualizado. Mais um passo na jornada! 🌱</p>';
  $('anuncio-mock').hidden = jogador.isPlus;
  mostrarTela('resultado');
  if (resultado.venceu) dispararConfete();
}

function verificarConquistasERecompensas(fatorDificuldade) {
  const novidades = [];
  CONQUISTAS.forEach((conquista) => {
    if (!jogador.achievements.includes(conquista.id) && conquista.libera(jogador)) {
      jogador.achievements.push(conquista.id);
      novidades.push(`Conquista desbloqueada: ${conquista.nome}`);
    }
  });
  CONFIG_RECOMPENSAS.vitorias.forEach((recompensa) => {
    const id = `${recompensa.id}-${fatorDificuldade >= 2 ? 'evolucao' : 'base'}`;
    const meta = Math.ceil(recompensa.meta / fatorDificuldade);
    if (jogador.wins >= meta && !jogador.rewards.includes(id)) {
      jogador.rewards.push(id);
      novidades.push(`Oportuni Clube (simulado): ${recompensa.nome}`);
    }
  });
  CONFIG_RECOMPENSAS.sequencias.forEach((recompensa) => {
    const meta = fatorDificuldade >= 2 ? Math.max(2, recompensa.meta - (fatorDificuldade - 1)) : recompensa.meta;
    const id = `${recompensa.id}-${fatorDificuldade >= 2 ? 'evolucao' : 'base'}`;
    if (jogador.winStreak >= meta && !jogador.rewards.includes(id)) {
      jogador.rewards.push(id);
      novidades.push(`Oportuni Clube (simulado): ${recompensa.nome}`);
    }
  });
  return novidades;
}

function atualizarEstagioDaTransformacao() {
  refs.figura.dataset.estagio = String(estadoDaPartida.errors);
  refs.rotuloEstagio.textContent = ROTULOS_DE_ESTAGIO[estadoDaPartida.errors];
}

function atualizarProgressoPalavra() {
  const total = estadoDaPartida.revelada.length || 1;
  const reveladas = estadoDaPartida.revelada.filter(Boolean).length;
  const valor = Math.round((reveladas / total) * 100);
  $('progresso-palavra').style.width = `${valor}%`;
  $('progresso-palavra-texto').textContent = `${valor}%`;
  $('progresso-palavra').parentElement.setAttribute('aria-valuenow', String(valor));
}

function renderizarPalavra() {
  refs.palavra.replaceChildren();
  // Só existem aqui as letras já reveladas; a palavra inteira chega no fim.
  estadoDaPartida.revelada.forEach((letra) => {
    const celula = document.createElement('span');
    celula.className = 'celula-letra';
    celula.textContent = letra;
    celula.setAttribute('aria-label', celula.textContent || 'letra oculta');
    refs.palavra.appendChild(celula);
  });
}

function renderizarLetrasUsadas() {
  refs.usadas.replaceChildren();
  [...estadoDaPartida.tried].sort().forEach((letra) => {
    const chip = document.createElement('span');
    chip.className = `chip-letra ${estadoDaPartida.correct.has(letra) ? 'chip-correta' : 'chip-errada'}`;
    chip.textContent = letra;
    refs.usadas.appendChild(chip);
  });
}

// QWERTY tradicional em três fileiras; o laço evita 26 elementos duplicados.
function criarTecladoVirtual() {
  refs.teclado.replaceChildren();
  ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'].forEach((linha) => {
    const fileira = document.createElement('div');
    fileira.className = 'fileira-teclado';
    [...linha].forEach((letra) => {
      const botao = document.createElement('button');
      botao.className = 'tecla-virtual';
      botao.type = 'button';
      botao.textContent = letra;
      botao.dataset.letra = letra;
      botao.setAttribute('aria-label', `Tentar letra ${letra}`);
      botao.addEventListener('click', () => processarTentativaDeLetra(letra));
      fileira.appendChild(botao);
    });
    refs.teclado.appendChild(fileira);
  });
}

function marcarTeclaComoUsada(letra, acertou) {
  const botao = refs.teclado.querySelector(`[data-letra="${letra}"]`);
  if (!botao) return;
  botao.disabled = true;
  botao.classList.add(acertou ? 'tecla-correta' : 'tecla-errada');
  botao.setAttribute('aria-label', `${letra}, ${acertou ? 'letra correta' : 'letra incorreta'}`);
}

function desabilitarTecladoVirtual() {
  refs.teclado.querySelectorAll('button').forEach((botao) => { botao.disabled = true; });
}

function normalizarLetra(texto) { return String(texto || '').toUpperCase(); }
function letraEhValida(letra) { return /^[A-Z]$/.test(letra); }
function sortearPalavra(lista) { return lista[Math.floor(Math.random() * lista.length)]; }

function dispararConfete() {
  const camada = document.createElement('div');
  camada.className = 'camada-confete';
  camada.setAttribute('aria-hidden', 'true');
  for (let indice = 0; indice < 48; indice += 1) {
    const particula = document.createElement('span');
    particula.className = 'particula-confete';
    particula.style.left = `${Math.random() * 100}%`;
    particula.style.backgroundColor = CORES_DO_CONFETE[Math.floor(Math.random() * CORES_DO_CONFETE.length)];
    particula.style.animationDelay = `${Math.random()}s`;
    camada.appendChild(particula);
  }
  $('tela-resultado').appendChild(camada);
  window.setTimeout(() => camada.remove(), 4000);
}

function abrirModal(tipo) {
  const titulo = $('titulo-modal');
  const conteudo = $('conteudo-modal');
  const conteudos = {
    recompensas: () => {
      titulo.textContent = 'Oportuni Clube';
      const todas = [...CONFIG_RECOMPENSAS.vitorias, ...CONFIG_RECOMPENSAS.sequencias];
      conteudo.innerHTML = `<p class="texto-secundario">Benefícios demonstrativos, sem parceiros ou resgate real.</p><div class="modal-lista">${todas.map((r) => {
        const desbloqueada = jogador.rewards.some((id) => id.startsWith(r.id));
        return `<article class="item-modal ${desbloqueada ? 'desbloqueado' : ''}"><span>${desbloqueada ? '🎁' : '🔒'}</span><div><b>${r.nome}</b><small>${r.tipo} · ${desbloqueada ? 'desbloqueado' : `${r.meta} ${r.id.startsWith('sequencia') ? 'vitórias seguidas' : 'vitórias'}`}</small></div></article>`;
      }).join('')}</div><p class="nota-demo">As metas podem ser alcançadas antes em Médio e Difícil, com recompensas de maior peso.</p>`;
    },
    apoio: () => {
      titulo.textContent = 'Apoie o projeto';
      conteudo.innerHTML = `<p>Ajude a manter os jogos gratuitos e a jornada em evolução.</p><div class="qr-placeholder" aria-label="Espaço reservado para QR Code">QR<br><small>ESPAÇO RESERVADO</small></div><p class="nota-demo">Nenhuma cobrança ou QR Code de pagamento ativo.</p>`;
      const botaoPlus = document.createElement('button');
      botaoPlus.type = 'button';
      botaoPlus.className = 'botao-primario';
      botaoPlus.textContent = '✨ Conhecer Conta Plus';
      botaoPlus.addEventListener('click', () => abrirModal('plus'));
      conteudo.appendChild(botaoPlus);
    },
    plus: () => {
      titulo.textContent = '✨ Conta Plus';
      conteudo.innerHTML = `<p>Uma ideia para apoiar o projeto e ampliar sua experiência.</p><ul class="lista-beneficios"><li>Jogar sem anúncios demonstrativos</li><li>Benefícios especiais no Oportuni Clube</li><li>Acesso antecipado a categorias</li><li>Estatísticas avançadas da jornada</li></ul><p class="nota-demo">Conceito visual. Sem pagamento ou assinatura ativa.</p>`;
      const botaoPreferencia = document.createElement('button');
      botaoPreferencia.type = 'button';
      botaoPreferencia.className = 'botao-primario';
      botaoPreferencia.textContent = jogador.isPlus ? 'Desativar preferência Plus' : 'Marcar interesse em Plus';
      botaoPreferencia.addEventListener('click', () => { jogador.isPlus = !jogador.isPlus; salvarPreferencias(); abrirModal('plus'); });
      conteudo.appendChild(botaoPreferencia);
    },
    progresso: () => {
      titulo.textContent = 'Seu progresso';
      conteudo.innerHTML = `<div class="metricas metricas-modal"><div><strong>${jogador.gamesPlayed}</strong><span>PARTIDAS</span></div><div><strong>${jogador.wins}</strong><span>VITÓRIAS</span></div><div><strong>${jogador.bestWinStreak}</strong><span>MELHOR SEQUÊNCIA</span></div></div><p>Você descobriu ${jogador.lettersFound} letras e acumulou ${jogador.cognitiveScore} pontos de atividade cognitiva.</p>${modoOnline ? '<h4 class="titulo-bloco">Últimas partidas</h4><div id="historico-partidas"></div>' : ''}`;
      if (modoOnline) preencherHistorico();
    },
    conquistas: () => {
      titulo.textContent = 'Suas conquistas';
      conteudo.innerHTML = `<div class="modal-lista">${CONQUISTAS.map((c) => { const ok = jogador.achievements.includes(c.id); return `<article class="item-modal ${ok ? 'desbloqueado' : ''}"><span>${ok ? c.icone : '🔒'}</span><div><b>${c.nome}</b><small>${c.descricao}</small></div></article>`; }).join('')}</div>`;
    },
    ranking: () => {
      const estat = modoOnline ? dadosOnline.estatisticas : null;
      titulo.textContent = modoOnline ? 'Ranking global' : 'Ranking local';
      conteudo.innerHTML = estat
        ? `<p class="texto-secundario">Top 10 entre ${estat.total_jogadores.toLocaleString('pt-BR')} jogadores.</p><ol class="lista-ranking ranking-modal"></ol><p class="nota-demo">${estat.online.toLocaleString('pt-BR')} jogando nos últimos 5 minutos.</p>`
        : `<p class="texto-secundario">Placares de demonstração, sem conexão ou competição online.</p><ol class="lista-ranking ranking-modal"></ol><p class="nota-demo">${DADOS_MOCK.online.toLocaleString('pt-BR')} jogadores estimados (mock).</p>`;
      const lista = conteudo.querySelector('ol');
      listaDoRanking().forEach((pessoa) => {
        const linha = document.createElement('li');
        const lugar = document.createElement('span');
        const nome = document.createElement('b');
        const pontos = document.createElement('strong');
        if (pessoa.atual) linha.classList.add('jogador-atual');
        lugar.textContent = String(pessoa.posicao).padStart(2, '0');
        nome.textContent = `${pessoa.nome}${pessoa.atual ? ' · VOCÊ' : ''}`;
        pontos.textContent = pessoa.score.toLocaleString('pt-BR');
        linha.append(lugar, nome, pontos);
        lista.appendChild(linha);
      });
    },
  };
  (conteudos[tipo] || conteudos.recompensas)();
  refs.modal.hidden = false;
  $('fechar-modal').focus();
}

// Eventos ficam concentrados ao final. O teclado físico só atua dentro de
// uma partida; controles e navegação mantêm seu comportamento normal.
refs.form.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const nome = refs.nome.value.trim();
  if (!nome) return;
  const botao = refs.form.querySelector('button[type="submit"]');
  botao.disabled = true;
  try {
    await inicializacao;
    await iniciarJornada(nome);
  } finally {
    botao.disabled = false;
  }
});
$('botao-continuar').addEventListener('click', mostrarPainel);
$('form-login').addEventListener('submit', enviarLogin);
$('form-cadastro').addEventListener('submit', enviarCadastro);
$('aba-entrar').addEventListener('click', () => selecionarAba('entrar'));
$('aba-cadastro').addEventListener('click', () => selecionarAba('cadastro'));
$('botao-tentar-novamente').addEventListener('click', verificarSessao);
$('botao-sair-carregando').addEventListener('click', sairDaConta);
// Modo local: apaga o perfil deste navegador. No modo online, o botão do
// cabeçalho encerra a sessão (os dados continuam salvos na conta).
function trocarUsuario() {
  jogador = null;
  try { localStorage.removeItem(CHAVE_PERFIL); } catch (erro) { console.warn('Não foi possível limpar o perfil salvo.', erro); }
  mostrarIdentificacao();
}
$('botao-trocar-usuario').addEventListener('click', trocarUsuario);
$('trocar-usuario-cabecalho').addEventListener('click', () => (modoOnline ? sairDaConta() : trocarUsuario()));
refs.opcoesDificuldade.addEventListener('click', (evento) => {
  const botao = evento.target.closest('[data-dificuldade]');
  if (botao) selecionarDificuldade(botao.dataset.dificuldade);
});
document.addEventListener('keydown', (evento) => {
  if (evento.key === 'Escape' && !refs.modal.hidden) refs.modal.hidden = true;
  if (estadoDaPartida.active && evento.key.length === 1 && /[a-z]/i.test(evento.key)) {
    evento.preventDefault();
    processarTentativaDeLetra(evento.key);
  }
});
$('botao-sair-partida').addEventListener('click', () => { estadoDaPartida.active = false; mostrarPainel(); });
$('botao-voltar-painel').addEventListener('click', mostrarPainel);
$('botao-revanche').addEventListener('click', () => {
  if (ultimaPartida) iniciarPartida(ultimaPartida.dificuldade, ultimaPartida.categoria);
  else mostrarPainel();
});
$('fechar-modal').addEventListener('click', () => { refs.modal.hidden = true; });
refs.modal.addEventListener('click', (evento) => { if (evento.target === refs.modal) refs.modal.hidden = true; });
document.querySelectorAll('[data-abrir]').forEach((botao) => botao.addEventListener('click', () => abrirModal(botao.dataset.abrir)));
document.querySelectorAll('[data-modal]').forEach((botao) => botao.addEventListener('click', () => abrirModal(botao.dataset.modal)));

// Decide o modo de operação. Sem a biblioteca, ou com o servidor fora do ar e
// nenhuma sessão salva, o jogo segue no modo local. Com sessão salva e servidor
// inacessível, NÃO trocamos para o modo local: mostramos "Tentar novamente", para
// o jogador não criar um progresso paralelo por engano.
// A tela de carregamento fica visível até sabermos se há sessão válida, para que
// quem já está logado nunca veja o formulário de login "piscar".
async function inicializar() {
  mostrarCarregando('Conectando…');
  modoOnline = typeof ServicoOnline !== 'undefined' && ServicoOnline.iniciar();
  if (modoOnline) {
    ServicoOnline.aoMudarSessao(tratarMudancaDeSessao);
    if (!await ServicoOnline.testarConexao()) {
      let sessaoSalva = null;
      try { sessaoSalva = await ServicoOnline.obterSessao(); } catch (erro) { registrarErro('ler sessão salva', erro); }
      modoOnline = Boolean(sessaoSalva);
    }
  }
  aplicarRotulosDoModo();
  if (!modoOnline) {
    jogador = carregarPerfil();
    $('texto-identificacao').textContent = 'Sem conexão com o servidor: você está no modo offline e seu progresso fica só neste navegador.';
    inicializando = false;
    return mostrarIdentificacao();
  }
  await verificarSessao();
  inicializando = false;
}

const inicializacao = inicializar();

// Mantém o jogador contado como "online" enquanto a aba estiver visível.
const INTERVALO_PRESENCA_MS = 120000;
window.setInterval(() => {
  if (!modoOnline || !jogador || document.hidden) return;
  ServicoOnline.obterPerfil().catch((erro) => registrarErro('atualizar presença', erro));
}, INTERVALO_PRESENCA_MS);
