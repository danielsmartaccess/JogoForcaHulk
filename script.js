/* ============================================================================
   FORCA GAMA — lógica do jogo
   ============================================================================
   Organização deste arquivo:
   1. Dados fixos (bancos de palavras, rótulos, configuração geral)
   2. Estado da partida (o que muda enquanto se joga)
   3. Referências aos elementos do DOM
   4. Funções de configuração (escolher dificuldade/categoria)
   5. Funções do fluxo da partida (iniciar, tentar letra, encerrar)
   6. Funções de renderização (traduzir o estado em tela)
   7. Funções utilitárias (confete, validação, sorteio)
   8. Ligação dos eventos (o que dispara cada função)
   Separar por essas responsabilidades é o que permite, por exemplo,
   trocar o banco de palavras sem precisar entender a lógica de vitória.
   ============================================================================ */


/* ----------------------------------------------------------------------------
   1. DADOS FIXOS
   ---------------------------------------------------------------------------- */

// Banco de palavras organizado por dificuldade → categoria → lista de
// palavras. A dificuldade influencia o tamanho/complexidade das palavras;
// o limite de erros permanece o mesmo (regra de negócio RN08: 6 erros)
// para não misturar "dificuldade de vocabulário" com "dificuldade de regra".
const BANCO_DE_PALAVRAS = {
  facil: {
    tecnologia: ['ROBO', 'CHIP', 'WIFI', 'DRONE', 'LASER', 'PIXEL'],
    espaco: ['LUA', 'MARTE', 'SOL', 'COMETA', 'ORBITA', 'ESTRELA'],
    herois: ['HULK', 'THOR', 'FLASH', 'VISAO', 'PANTERA', 'VINGADOR'],
  },
  medio: {
    inteligenciaArtificial: ['ALGORITMO', 'REDE', 'DADOS', 'MODELO', 'TREINO', 'PREVISAO'],
    planetasGalaxias: ['JUPITER', 'SATURNO', 'GALAXIA', 'NEBULOSA', 'ASTEROIDE', 'METEORO'],
    cienciaGama: ['GAMA', 'LABORATORIO', 'EXPERIMENTO', 'RADIACAO', 'CIENTISTA', 'FURIA'],
  },
  dificil: {
    programacaoAvancada: ['RECURSAO', 'ASSINCRONO', 'COMPILADOR', 'POLIMORFISMO', 'ENCAPSULAMENTO', 'FRAMEWORK'],
    fisicaQuantica: ['QUANTICA', 'PARTICULA', 'ELETRON', 'GRAVIDADE', 'RELATIVIDADE', 'ANTIMATERIA'],
    universoMarvel: ['VINGADORES', 'MULTIVERSO', 'INFINITO', 'ASGARDIANO', 'GUARDIOES', 'SENTINELA'],
  },
};

// Rótulos amigáveis para exibir no lugar das chaves em camelCase usadas
// como identificador interno de cada categoria (ex.: "cienciaGama" na tela
// aparece como "Ciência Gama"). Manter essa tradução em um único objeto
// evita duplicar texto solto em vários pontos do código.
const ROTULOS_DE_CATEGORIA = {
  tecnologia: 'Tecnologia',
  espaco: 'Exploração Espacial',
  herois: 'Heróis e Vingadores',
  inteligenciaArtificial: 'Inteligência Artificial',
  planetasGalaxias: 'Planetas e Galáxias',
  cienciaGama: 'Ciência Gama',
  programacaoAvancada: 'Programação Avançada',
  fisicaQuantica: 'Física Quântica',
  universoMarvel: 'Universo Marvel',
};

const ROTULOS_DE_DIFICULDADE = {
  facil: 'Fácil',
  medio: 'Médio',
  dificil: 'Difícil',
};

// Um texto de apoio para cada estágio da transformação (0 a 6 erros).
// O índice do array corresponde diretamente ao número de erros, então
// não é preciso nenhum "switch" para descobrir qual frase mostrar.
const ROTULOS_DE_ESTAGIO = [
  'Bruce Banner: calmo',
  'O pulso começa a acelerar...',
  'A pele está ganhando um tom verde',
  'Os músculos estão em expansão',
  'A camisa já não resiste mais',
  'Quase sem controle...',
  'HULK SMASH!! Transformação completa',
];

// RN08: limite máximo de erros é uma regra de negócio fixa do jogo,
// independente da dificuldade escolhida — por isso vive como constante
// e não como parte da configuração de dificuldade.
const LIMITE_DE_ERROS = 6;

// Cores usadas para sortear os pedaços de confete da tela de vitória.
// Os tons vêm diretamente da paleta definida no style.css (verde-gama,
// verde-gama-forte, âmbar-risco), para que a comemoração pareça parte
// do mesmo console, e não um efeito genérico colado por cima.
const CORES_DO_CONFETE = ['#5fd97a', '#94f2a5', '#f3a53d', '#e9f3ec'];


/* ----------------------------------------------------------------------------
   2. ESTADO DA PARTIDA
   Um único objeto concentra tudo o que muda durante o jogo. Isso evita
   ter várias variáveis globais soltas e torna explícito o que precisa
   ser reiniciado em iniciarPartida() (RN12 — nova partida reinicia tudo).
   ---------------------------------------------------------------------------- */
const estadoDaPartida = {
  dificuldade: null,
  categoria: null,
  palavraSecreta: '',
  letrasTentadas: new Set(),
  letrasCorretas: new Set(),
  erros: 0,
  partidaAtiva: false,
};


/* ----------------------------------------------------------------------------
   3. REFERÊNCIAS AO DOM
   Buscar todos os elementos uma única vez, no carregamento do script, e
   reutilizar essas referências é mais eficiente do que chamar
   document.getElementById repetidamente dentro de cada função.
   ---------------------------------------------------------------------------- */
const telaConfiguracao = document.getElementById('tela-configuracao');
const blocoCategoria = document.getElementById('bloco-categoria');
const opcoesDificuldade = document.getElementById('opcoes-dificuldade');
const opcoesCategoria = document.getElementById('opcoes-categoria');

const telaPartida = document.getElementById('tela-partida');
const figuraHulk = document.getElementById('figura-hulk');
const rotuloEstagio = document.getElementById('rotulo-estagio');
const contadorErros = document.getElementById('contador-erros');
const mensagemStatus = document.getElementById('mensagem-status');
const areaPalavra = document.getElementById('area-palavra');
const letrasUsadasContainer = document.getElementById('letras-usadas');
const tecladoVirtual = document.getElementById('teclado-virtual');
const botaoNovaPartida = document.getElementById('botao-nova-partida');

const telaVitoria = document.getElementById('tela-vitoria');
const camadaConfete = document.getElementById('camada-confete');
const palavraReveladaVitoria = document.getElementById('palavra-revelada-vitoria');
const botaoJogarNovamente = document.getElementById('botao-jogar-novamente');


/* ----------------------------------------------------------------------------
   4. CONFIGURAÇÃO (dificuldade e categoria)
   ---------------------------------------------------------------------------- */

/*
 * Função: selecionarDificuldade
 * Objetivo: guardar a dificuldade escolhida e, a partir dela, gerar os
 * botões de categoria correspondentes (cada dificuldade tem seu próprio
 * conjunto de três categorias).
 * Parâmetros: dificuldade (string: 'facil' | 'medio' | 'dificil').
 * Retorno: nenhum.
 */
function selecionarDificuldade(dificuldade) {
  estadoDaPartida.dificuldade = dificuldade;

  // Destaca visualmente o botão escolhido entre os três de dificuldade.
  document.querySelectorAll('#opcoes-dificuldade .botao-opcao').forEach((botao) => {
    botao.classList.toggle('selecionada', botao.dataset.dificuldade === dificuldade);
  });

  gerarOpcoesDeCategoria(dificuldade);
  blocoCategoria.hidden = false;
}

/*
 * Função: gerarOpcoesDeCategoria
 * Objetivo: criar, dinamicamente, um botão para cada categoria disponível
 * na dificuldade escolhida. Gerar por código (em vez de escrever no HTML)
 * evita repetir mark-up quase idêntico nove vezes (3 dificuldades x 3
 * categorias) e garante que a lista de botões sempre reflita o banco de
 * palavras definido no topo do arquivo.
 * Parâmetros: dificuldade (string).
 * Retorno: nenhum.
 */
function gerarOpcoesDeCategoria(dificuldade) {
  opcoesCategoria.innerHTML = '';

  const categoriasDisponiveis = Object.keys(BANCO_DE_PALAVRAS[dificuldade]);

  categoriasDisponiveis.forEach((chaveCategoria) => {
    const botao = document.createElement('button');
    botao.className = 'botao-opcao';
    botao.dataset.categoria = chaveCategoria;
    botao.textContent = ROTULOS_DE_CATEGORIA[chaveCategoria];
    botao.addEventListener('click', () => iniciarPartida(dificuldade, chaveCategoria));
    opcoesCategoria.appendChild(botao);
  });
}


/* ----------------------------------------------------------------------------
   5. FLUXO DA PARTIDA
   ---------------------------------------------------------------------------- */

/*
 * Função: iniciarPartida
 * Objetivo: cumprir o RF01 — criar uma partida nova e zerada a partir da
 * dificuldade e categoria escolhidas: sorteia a palavra, limpa tentativas
 * e erros anteriores, e troca a tela de configuração pela tela de jogo.
 * Parâmetros: dificuldade (string), categoria (string).
 * Retorno: nenhum.
 */
function iniciarPartida(dificuldade, categoria) {
  const palavrasDaCategoria = BANCO_DE_PALAVRAS[dificuldade][categoria];

  estadoDaPartida.dificuldade = dificuldade;
  estadoDaPartida.categoria = categoria;
  estadoDaPartida.palavraSecreta = sortearPalavra(palavrasDaCategoria);
  estadoDaPartida.letrasTentadas = new Set();
  estadoDaPartida.letrasCorretas = new Set();
  estadoDaPartida.erros = 0;
  estadoDaPartida.partidaAtiva = true;

  telaConfiguracao.hidden = true;
  telaVitoria.hidden = true;
  telaPartida.hidden = false;

  criarTecladoVirtual();
  atualizarEstagioDaTransformacao();
  renderizarPalavra();
  renderizarLetrasUsadas();

  mensagemStatus.textContent =
    `Partida iniciada! Dificuldade: ${ROTULOS_DE_DIFICULDADE[dificuldade]} — ` +
    `Categoria: ${ROTULOS_DE_CATEGORIA[categoria]}.`;
}

/*
 * Função: processarTentativaDeLetra
 * Objetivo: ponto único de entrada para QUALQUER tentativa de letra,
 * seja ela vinda do teclado físico ou do teclado virtual na tela. Isso
 * garante que as duas formas de entrada (RF03) sigam exatamente as
 * mesmas regras de validação, acerto, erro e repetição.
 * Parâmetros: letraDigitada (string, idealmente de um único caractere).
 * Retorno: nenhum.
 */
function processarTentativaDeLetra(letraDigitada) {
  // RF07/RF08/RN11: depois de vencer ou perder, nenhuma nova tentativa
  // pode alterar o estado da partida.
  if (!estadoDaPartida.partidaAtiva) {
    return;
  }

  const letra = normalizarLetra(letraDigitada);

  // RN03: só letras de A a Z contam como tentativa válida.
  if (!letraEhValida(letra)) {
    mensagemStatus.textContent = 'Entrada inválida: utilize apenas uma letra de A a Z.';
    return;
  }

  // RF06/RN07: uma letra já tentada não pode gerar nova penalidade nem
  // ser contabilizada de novo.
  if (estadoDaPartida.letrasTentadas.has(letra)) {
    mensagemStatus.textContent = `A letra "${letra}" já foi utilizada.`;
    return;
  }

  estadoDaPartida.letrasTentadas.add(letra);

  const acertou = estadoDaPartida.palavraSecreta.includes(letra);

  if (acertou) {
    // RF04/RN05: a letra é revelada em TODAS as posições em que aparece.
    // Isso é automático aqui porque renderizarPalavra() sempre percorre
    // a palavra inteira comparando contra o conjunto de letras corretas,
    // em vez de marcar manualmente "uma ocorrência por vez".
    estadoDaPartida.letrasCorretas.add(letra);
    mensagemStatus.textContent = `Acertou! A letra "${letra}" está na palavra.`;
  } else {
    // RF05/RN06: cada erro soma 1 ao contador e avança um estágio na
    // transformação — o equivalente, neste jogo, a desenhar mais uma
    // parte da forca tradicional.
    estadoDaPartida.erros += 1;
    mensagemStatus.textContent = `A letra "${letra}" não está na palavra.`;
  }

  marcarTeclaComoUsada(letra, acertou);
  atualizarEstagioDaTransformacao();
  renderizarPalavra();
  renderizarLetrasUsadas();
  contadorErros.textContent = estadoDaPartida.erros;

  verificarFimDaPartida();
}

/*
 * Função: verificarFimDaPartida
 * Objetivo: decidir, depois de cada tentativa, se a partida deve ser
 * encerrada por vitória (RF07/RN09) ou derrota (RF08/RN10).
 * Parâmetros: nenhum.
 * Retorno: nenhum.
 */
function verificarFimDaPartida() {
  const todasAsLetrasForamDescobertas = [...estadoDaPartida.palavraSecreta].every(
    (letra) => estadoDaPartida.letrasCorretas.has(letra)
  );

  if (todasAsLetrasForamDescobertas) {
    encerrarPartida(true);
    return;
  }

  if (estadoDaPartida.erros >= LIMITE_DE_ERROS) {
    encerrarPartida(false);
  }
}

/*
 * Função: encerrarPartida
 * Objetivo: aplicar as consequências comuns a vitória e derrota —
 * desativar a partida e bloquear o teclado — e então mostrar o feedback
 * específico de cada caso (confete na vitória, palavra revelada na
 * derrota).
 * Parâmetros: jogadorVenceu (boolean).
 * Retorno: nenhum.
 */
function encerrarPartida(jogadorVenceu) {
  estadoDaPartida.partidaAtiva = false;
  desabilitarTecladoVirtual();

  // Mostra todas as letras da palavra, mesmo as não descobertas — tanto
  // na vitória (confirmação) quanto na derrota (RF08: revelar a palavra).
  renderizarPalavra();

  if (jogadorVenceu) {
    mensagemStatus.textContent = 'Você descobriu a palavra a tempo!';
    mostrarTelaDeVitoria();
  } else {
    mensagemStatus.textContent = 'O Hulk assumiu o controle. Fim de jogo.';
  }
}


/* ----------------------------------------------------------------------------
   6. RENDERIZAÇÃO (estado → tela)
   Cada função abaixo lê o estadoDaPartida e atualiza uma parte específica
   da interface. Mantê-las pequenas e focadas facilita testar e corrigir
   cada pedaço da tela isoladamente.
   ---------------------------------------------------------------------------- */

/*
 * Função: renderizarPalavra
 * Objetivo: desenhar as lacunas da palavra secreta (RF02), revelando
 * apenas as letras já descobertas — ou a palavra inteira, caso a
 * partida já tenha terminado.
 * Parâmetros: nenhum.
 * Retorno: nenhum.
 */
function renderizarPalavra() {
  areaPalavra.innerHTML = '';

  [...estadoDaPartida.palavraSecreta].forEach((letra) => {
    const celula = document.createElement('span');
    celula.className = 'celula-letra';

    const deveMostrarLetra =
      estadoDaPartida.letrasCorretas.has(letra) || !estadoDaPartida.partidaAtiva;

    celula.textContent = deveMostrarLetra ? letra : '';
    areaPalavra.appendChild(celula);
  });
}

/*
 * Função: renderizarLetrasUsadas
 * Objetivo: listar as letras já tentadas (RF09), diferenciando acertos
 * de erros por cor (ver .chip-correta/.chip-errada no CSS).
 * Parâmetros: nenhum.
 * Retorno: nenhum.
 */
function renderizarLetrasUsadas() {
  letrasUsadasContainer.innerHTML = '';

  // Ordenar alfabeticamente deixa a lista previsível e fácil de ler,
  // em vez de crescer na ordem aleatória em que o jogador tentou as letras.
  const letrasEmOrdem = [...estadoDaPartida.letrasTentadas].sort();

  letrasEmOrdem.forEach((letra) => {
    const chip = document.createElement('span');
    const acertou = estadoDaPartida.letrasCorretas.has(letra);
    chip.className = `chip-letra ${acertou ? 'chip-correta' : 'chip-errada'}`;
    chip.textContent = letra;
    letrasUsadasContainer.appendChild(chip);
  });
}

/*
 * Função: atualizarEstagioDaTransformacao
 * Objetivo: refletir o número atual de erros na figura do Hulk (RF11).
 * Como cada estágio visual já está definido no CSS via seletor de
 * atributo ([data-estagio="N"]), esta função só precisa trocar um
 * número — toda a mudança de cores e tamanhos acontece sozinha.
 * Parâmetros: nenhum.
 * Retorno: nenhum.
 */
function atualizarEstagioDaTransformacao() {
  figuraHulk.dataset.estagio = String(estadoDaPartida.erros);
  rotuloEstagio.textContent = ROTULOS_DE_ESTAGIO[estadoDaPartida.erros];
}

/*
 * Função: criarTecladoVirtual
 * Objetivo: montar os 26 botões de letra em um laço, evitando escrever
 * manualmente cada botão no HTML. Chamada a cada nova partida para que
 * o teclado volte sempre ao estado "zerado" (nenhuma letra usada).
 * Parâmetros: nenhum.
 * Retorno: nenhum.
 */
function criarTecladoVirtual() {
  tecladoVirtual.innerHTML = '';

  const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  [...alfabeto].forEach((letra) => {
    const botao = document.createElement('button');
    botao.className = 'tecla-virtual';
    botao.type = 'button';
    botao.textContent = letra;
    botao.dataset.letra = letra;
    botao.addEventListener('click', () => processarTentativaDeLetra(letra));
    tecladoVirtual.appendChild(botao);
  });
}

/*
 * Função: marcarTeclaComoUsada
 * Objetivo: desabilitar, no teclado virtual, o botão correspondente à
 * letra recém-tentada e sinalizar visualmente se foi acerto ou erro.
 * Isso reforça para o jogador, só de olhar o teclado, quais letras já
 * não podem mais ser tentadas — redundante com a validação em
 * processarTentativaDeLetra, mas é justamente essa redundância que
 * evita depender só da lógica interna para uma informação visual.
 * Parâmetros: letra (string), acertou (boolean).
 * Retorno: nenhum.
 */
function marcarTeclaComoUsada(letra, acertou) {
  const botao = tecladoVirtual.querySelector(`[data-letra="${letra}"]`);
  if (!botao) return;

  botao.disabled = true;
  botao.classList.add(acertou ? 'tecla-correta' : 'tecla-errada');
}

/*
 * Função: desabilitarTecladoVirtual
 * Objetivo: bloquear TODAS as teclas ao final da partida (RF07/RF08),
 * independentemente de já terem sido usadas ou não.
 * Parâmetros: nenhum.
 * Retorno: nenhum.
 */
function desabilitarTecladoVirtual() {
  tecladoVirtual.querySelectorAll('.tecla-virtual').forEach((botao) => {
    botao.disabled = true;
  });
}

/*
 * Função: mostrarTelaDeVitoria
 * Objetivo: exibir o overlay de vitória com a palavra revelada e
 * disparar a animação de confete — o "visual de festa" pedido para o
 * momento em que o jogador vence a partida.
 * Parâmetros: nenhum.
 * Retorno: nenhum.
 */
function mostrarTelaDeVitoria() {
  palavraReveladaVitoria.textContent = `A palavra era: ${estadoDaPartida.palavraSecreta}`;
  telaVitoria.hidden = false;
  dispararConfete();
}

/*
 * Função: voltarParaConfiguracao
 * Objetivo: cumprir o RN12 (nova partida reinicia tudo) levando o
 * jogador de volta à tela de escolha de dificuldade/categoria, em vez
 * de simplesmente repetir a última configuração escolhida — assim o
 * "piloto" permite testar livremente combinações diferentes.
 * Parâmetros: nenhum.
 * Retorno: nenhum.
 */
function voltarParaConfiguracao() {
  telaPartida.hidden = true;
  telaVitoria.hidden = true;
  telaConfiguracao.hidden = false;
  blocoCategoria.hidden = true;
  camadaConfete.innerHTML = '';

  document.querySelectorAll('#opcoes-dificuldade .botao-opcao').forEach((botao) => {
    botao.classList.remove('selecionada');
  });

  mensagemStatus.textContent = 'Escolha a dificuldade para começar.';
}


/* ----------------------------------------------------------------------------
   7. UTILITÁRIOS
   ---------------------------------------------------------------------------- */

/*
 * Função: normalizarLetra
 * Objetivo: cumprir a RN04 (maiúsculas e minúsculas são equivalentes),
 * convertendo qualquer entrada para maiúscula antes de qualquer
 * comparação com a palavra secreta.
 * Parâmetros: texto (string).
 * Retorno: string em caixa alta.
 */
function normalizarLetra(texto) {
  return (texto || '').toUpperCase();
}

/*
 * Função: letraEhValida
 * Objetivo: verificar a RN02/RN03 — a tentativa precisa ser exatamente
 * uma letra de A a Z (sem números, espaços, acentos ou símbolos).
 * Parâmetros: letra (string).
 * Retorno: boolean.
 */
function letraEhValida(letra) {
  return /^[A-Z]$/.test(letra);
}

/*
 * Função: sortearPalavra
 * Objetivo: escolher, aleatoriamente, uma palavra dentro da lista da
 * categoria selecionada (RN01: cada partida tem uma única palavra secreta).
 * Parâmetros: listaDePalavras (array de strings).
 * Retorno: string — a palavra sorteada.
 */
function sortearPalavra(listaDePalavras) {
  const indiceAleatorio = Math.floor(Math.random() * listaDePalavras.length);
  return listaDePalavras[indiceAleatorio];
}

/*
 * Função: dispararConfete
 * Objetivo: gerar várias partículas de confete com posição horizontal,
 * cor e velocidade de queda aleatórias, puramente em HTML/CSS/JS (sem
 * nenhuma biblioteca externa de animação).
 * Parâmetros: nenhum.
 * Retorno: nenhum.
 */
function dispararConfete() {
  camadaConfete.innerHTML = '';

  const QUANTIDADE_DE_PARTICULAS = 90;

  for (let i = 0; i < QUANTIDADE_DE_PARTICULAS; i += 1) {
    const particula = document.createElement('span');
    particula.className = 'particula-confete';

    const posicaoHorizontal = Math.random() * 100; // em % da largura
    const duracaoDaQueda = 2 + Math.random() * 2; // entre 2s e 4s
    const atraso = Math.random() * 1.5; // começa em momentos diferentes
    const cor = CORES_DO_CONFETE[Math.floor(Math.random() * CORES_DO_CONFETE.length)];

    particula.style.left = `${posicaoHorizontal}%`;
    particula.style.backgroundColor = cor;
    particula.style.animationDuration = `${duracaoDaQueda}s`;
    particula.style.animationDelay = `${atraso}s`;

    camadaConfete.appendChild(particula);
  }
}


/* ----------------------------------------------------------------------------
   8. LIGAÇÃO DOS EVENTOS
   Concentrar os addEventListener no final do arquivo dá uma visão geral
   rápida de "o que reage a quê", sem precisar procurar listeners
   espalhados entre as funções de lógica.
   ---------------------------------------------------------------------------- */

// Clique em um dos três botões fixos de dificuldade.
document.querySelectorAll('#opcoes-dificuldade .botao-opcao').forEach((botao) => {
  botao.addEventListener('click', () => selecionarDificuldade(botao.dataset.dificuldade));
});

// Entrada pelo teclado físico — RF03. Só reage a teclas de uma única
// letra; qualquer outra tecla (Tab, Enter, setas, etc.) é simplesmente
// ignorada aqui, sem precisar de tratamento especial.
document.addEventListener('keydown', (evento) => {
  if (evento.key.length === 1 && /[a-zA-Z]/.test(evento.key)) {
    processarTentativaDeLetra(evento.key);
  }
});

botaoNovaPartida.addEventListener('click', voltarParaConfiguracao);
botaoJogarNovamente.addEventListener('click', voltarParaConfiguracao);
