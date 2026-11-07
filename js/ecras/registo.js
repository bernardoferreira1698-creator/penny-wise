/* Ecrã Registo: criação e edição de movimentos (via ?id=... na URL),
   já ligados ao IndexedDB local (js/db.js), que sincroniza com o
   Supabase quando há conta e rede (js/sync.js). */

document.addEventListener('DOMContentLoaded', function () {
  var D = window.PennyDados;
  var MESES = D.MESES;
  var MAPA_TIPO = { 'Despesa': 'despesa', 'Rendimento': 'rendimento', 'Poupança': 'poupanca' };
  var MAPA_TIPO_INVERSO = { despesa: 'Despesa', rendimento: 'Rendimento', poupanca: 'Poupança' };

  var idEdicao = new URLSearchParams(window.location.search).get('id');

  var hoje = new Date();
  var estado = {
    dataSelecionada: new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()),
    mesCalendario: hoje.getMonth(),
    anoCalendario: hoje.getFullYear(),
    tipo: 'Despesa',
    categoria: null,
    periodicidade: 'Variável',
    mesConta: 'atual' // 'atual' ou 'seguinte'; só importa para Rendimento
  };

  function segmentado(containerId, aoEscolher) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.addEventListener('click', function (evento) {
      var botao = evento.target.closest('.seg__item');
      if (!botao) return;
      container.querySelectorAll('.seg__item').forEach(function (b) { b.classList.remove('is-active'); });
      botao.classList.add('is-active');
      if (aoEscolher) aoEscolher(botao.getAttribute('data-valor'), botao);
    });
  }

  function grupoCategorias(tipo) { return tipo === 'Rendimento' ? D.categoriasRendimento() : D.categoriasDespesa(); }

  var blocoMesConta = document.getElementById('bloco-mes-conta');
  function atualizarVisibilidadeMesConta() { blocoMesConta.hidden = estado.tipo !== 'Rendimento'; }
  segmentado('seg-mes-conta', function (valor) { estado.mesConta = valor; });

  segmentado('seg-tipo', function (valor) {
    var grupoAntigo = grupoCategorias(estado.tipo);
    estado.tipo = valor;
    atualizarVisibilidadeMesConta();
    var grupoNovo = grupoCategorias(estado.tipo);
    if (grupoNovo !== grupoAntigo) construirCategorias(grupoNovo);
  });

  /* Segmento Fixa/Variável com deslize suave: um "thumb" posicionado
     via JavaScript (para se ajustar à largura real de cada botão). */
  var segPeriodicidade = document.getElementById('seg-periodicidade');
  var thumbPeriodicidade = document.getElementById('seg-periodicidade-thumb');
  function moverThumb(botaoAtivo) {
    var rectContainer = segPeriodicidade.getBoundingClientRect();
    var rectBotao = botaoAtivo.getBoundingClientRect();
    thumbPeriodicidade.style.left = (rectBotao.left - rectContainer.left) + 'px';
    thumbPeriodicidade.style.width = rectBotao.width + 'px';
  }
  segmentado('seg-periodicidade', function (valor, botao) {
    estado.periodicidade = valor;
    moverThumb(botao);
  });
  requestAnimationFrame(function () {
    var ativo = segPeriodicidade.querySelector('.seg__item.is-active');
    thumbPeriodicidade.style.transition = 'none';
    moverThumb(ativo);
    requestAnimationFrame(function () { thumbPeriodicidade.style.transition = ''; });
  });
  window.addEventListener('resize', function () {
    var ativo = segPeriodicidade.querySelector('.seg__item.is-active');
    moverThumb(ativo);
  });

  /* Categorias: as mais usadas no histórico primeiro, com "Mais" a
     revelar as restantes. Muda de lista (despesa/rendimento) consoante
     o Tipo escolhido. Ao editar, mostra logo todas (sem "Mais"), para
     a categoria guardada estar sempre visível. */
  var catRow = document.getElementById('cat-row');
  var infoPorNome = {};

  function criarPill(nome, ativa) {
    var botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'cat-pill' + (ativa ? ' is-active' : '');
    botao.setAttribute('data-cat', nome);
    botao.setAttribute('data-per', infoPorNome[nome].periodicidade);
    botao.textContent = nome;
    return botao;
  }

  function construirCategorias(lista, categoriaPreferida) {
    infoPorNome = {};
    lista.forEach(function (c) { infoPorNome[c.nome] = c; });
    return PennyDB.categoriasMaisUsadas(lista).then(function (ordemUso) {
      catRow.innerHTML = '';
      var principais = idEdicao ? ordemUso : ordemUso.slice(0, 6);
      var restantes = idEdicao ? [] : ordemUso.slice(6);
      var categoriaAtiva = (categoriaPreferida && infoPorNome[categoriaPreferida]) ? categoriaPreferida : principais[0];
      estado.categoria = categoriaAtiva;

      /* A periodicidade por defeito segue a categoria escolhida (tal
         como acontece ao tocar numa pílula), mesmo quando é esta
         seleção inicial automática a escolher a categoria. */
      if (categoriaAtiva && !categoriaPreferida) {
        estado.periodicidade = infoPorNome[categoriaAtiva].periodicidade;
        segPeriodicidade.querySelectorAll('.seg__item').forEach(function (b) {
          var ativa = b.getAttribute('data-valor') === estado.periodicidade;
          b.classList.toggle('is-active', ativa);
          if (ativa) moverThumb(b);
        });
      }

      principais.forEach(function (nome) { catRow.appendChild(criarPill(nome, nome === categoriaAtiva)); });

      if (restantes.length) {
        var btnMais = document.createElement('button');
        btnMais.type = 'button';
        btnMais.className = 'cat-pill cat-pill--mais';
        btnMais.textContent = 'Mais';
        btnMais.addEventListener('click', function () {
          restantes.forEach(function (nome) { catRow.insertBefore(criarPill(nome, false), btnMais); });
          btnMais.remove();
        });
        catRow.appendChild(btnMais);
      }
    });
  }

  catRow.addEventListener('click', function (evento) {
    var botao = evento.target.closest('.cat-pill[data-cat]');
    if (!botao) return;
    catRow.querySelectorAll('.cat-pill[data-cat]').forEach(function (b) { b.classList.remove('is-active'); });
    botao.classList.add('is-active');
    estado.categoria = botao.getAttribute('data-cat');
    var periodicidadePadrao = botao.getAttribute('data-per');
    if (periodicidadePadrao) {
      estado.periodicidade = periodicidadePadrao;
      segPeriodicidade.querySelectorAll('.seg__item').forEach(function (b) {
        var ativa = b.getAttribute('data-valor') === periodicidadePadrao;
        b.classList.toggle('is-active', ativa);
        if (ativa) moverThumb(b);
      });
    }
  });

  function formatarDataEscolhida() {
    var d = estado.dataSelecionada;
    var sufixoAno = d.getFullYear() !== hoje.getFullYear() ? (' de ' + d.getFullYear()) : '';
    document.getElementById('data-escolhida').textContent =
      d.getDate() + ' de ' + MESES[d.getMonth()] + sufixoAno;
  }

  function renderCalendario() {
    document.getElementById('cal-titulo').textContent =
      MESES[estado.mesCalendario].charAt(0).toUpperCase() + MESES[estado.mesCalendario].slice(1) + ' ' + estado.anoCalendario;

    var container = document.getElementById('cal-dias');
    container.innerHTML = '';

    var primeiroDiaSemana = (new Date(estado.anoCalendario, estado.mesCalendario, 1).getDay() + 6) % 7;
    var numDias = new Date(estado.anoCalendario, estado.mesCalendario + 1, 0).getDate();

    for (var i = 0; i < primeiroDiaSemana; i++) {
      var vazio = document.createElement('button');
      vazio.type = 'button';
      vazio.className = 'cal-dia vazio';
      vazio.disabled = true;
      container.appendChild(vazio);
    }

    for (var dia = 1; dia <= numDias; dia++) {
      var botaoDia = document.createElement('button');
      botaoDia.type = 'button';
      botaoDia.className = 'cal-dia';
      botaoDia.textContent = String(dia);
      botaoDia.setAttribute('aria-label', dia + ' de ' + MESES[estado.mesCalendario]);

      var ehHoje = estado.anoCalendario === hoje.getFullYear() && estado.mesCalendario === hoje.getMonth() && dia === hoje.getDate();
      var ehSelecionado = estado.anoCalendario === estado.dataSelecionada.getFullYear() &&
        estado.mesCalendario === estado.dataSelecionada.getMonth() && dia === estado.dataSelecionada.getDate();

      if (ehHoje) botaoDia.classList.add('hoje');
      if (ehSelecionado) botaoDia.classList.add('selecionado');

      botaoDia.addEventListener('click', (function (d) {
        return function () {
          estado.dataSelecionada = new Date(estado.anoCalendario, estado.mesCalendario, d);
          formatarDataEscolhida();
          fecharCalendario();
        };
      })(dia));

      container.appendChild(botaoDia);
    }
  }

  var folha = document.getElementById('folha-calendario');
  function abrirCalendario() {
    estado.mesCalendario = estado.dataSelecionada.getMonth();
    estado.anoCalendario = estado.dataSelecionada.getFullYear();
    renderCalendario();
    folha.hidden = false;
  }
  function fecharCalendario() { folha.hidden = true; }

  document.getElementById('btn-abrir-calendario').addEventListener('click', abrirCalendario);
  document.getElementById('cal-fechar').addEventListener('click', fecharCalendario);
  document.getElementById('cal-hoje').addEventListener('click', function () {
    estado.dataSelecionada = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    estado.mesCalendario = hoje.getMonth();
    estado.anoCalendario = hoje.getFullYear();
    formatarDataEscolhida();
    fecharCalendario();
  });
  document.getElementById('cal-mes-anterior').addEventListener('click', function () {
    estado.mesCalendario--;
    if (estado.mesCalendario < 0) { estado.mesCalendario = 11; estado.anoCalendario--; }
    renderCalendario();
  });
  document.getElementById('cal-mes-seguinte').addEventListener('click', function () {
    estado.mesCalendario++;
    if (estado.mesCalendario > 11) { estado.mesCalendario = 0; estado.anoCalendario++; }
    renderCalendario();
  });
  folha.addEventListener('click', function (evento) {
    if (evento.target === folha) fecharCalendario();
  });

  /* Sugestões de descrição: dinâmicas, a partir do histórico,
     conforme o utilizador escreve. */
  var campoDescricao = document.getElementById('descricao');
  var caixaSugestoes = document.getElementById('sugestoes-descricao');

  function renderSugestoes() {
    PennyDB.sugerirDescricoes(campoDescricao.value, 5).then(function (resultados) {
      caixaSugestoes.innerHTML = '';
      if (!resultados.length) { caixaSugestoes.hidden = true; return; }
      resultados.forEach(function (m) {
        var botao = document.createElement('button');
        botao.type = 'button';
        botao.className = 'suggestion';
        botao.textContent = m.descricao;
        botao.addEventListener('click', function () {
          campoDescricao.value = m.descricao;
          caixaSugestoes.hidden = true;
          PennyDB.ultimaCategoriaPara(m.descricao).then(function (info) {
            if (!info) return;
            estado.categoria = info.categoria;
            estado.periodicidade = info.periodicidade;
            catRow.querySelectorAll('.cat-pill[data-cat]').forEach(function (b) {
              b.classList.toggle('is-active', b.getAttribute('data-cat') === info.categoria);
            });
            segPeriodicidade.querySelectorAll('.seg__item').forEach(function (b) {
              var ativa = b.getAttribute('data-valor') === info.periodicidade;
              b.classList.toggle('is-active', ativa);
              if (ativa) moverThumb(b);
            });
          });
        });
        caixaSugestoes.appendChild(botao);
      });
      caixaSugestoes.hidden = false;
    });
  }

  campoDescricao.addEventListener('input', renderSugestoes);
  campoDescricao.addEventListener('focus', renderSugestoes);
  document.addEventListener('click', function (evento) {
    if (!caixaSugestoes.contains(evento.target) && evento.target !== campoDescricao) caixaSugestoes.hidden = true;
  });

  /* Valor: cêntimos primeiro (como uma máquina de pagamentos), mas
     aceita contas simples tipo "47-11-12,5-11,5" (ver js/moeda.js). */
  var campoValor = PennyMoeda.ligarCampoCentimos(document.getElementById('valor'));

  formatarDataEscolhida();

  function calcularMesReferencia() {
    var d = estado.dataSelecionada;
    if (estado.tipo === 'Rendimento' && estado.mesConta === 'seguinte') {
      d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    }
    return PennyDB.calcularMesReferencia(d);
  }

  /* Modo de edição: carrega o movimento e pré-preenche tudo. */
  function prefillForm(m) {
    document.getElementById('registo-titulo-prefixo').textContent = 'Editar';
    document.getElementById('registo-botao-texto').textContent = 'Guardar alterações';
    document.title = 'Penny Wise: Editar movimento';
    document.getElementById('btn-apagar-movimento').hidden = false;
    document.getElementById('registo-fechar').setAttribute('href', 'movimentos.html');

    var tipoLabel = MAPA_TIPO_INVERSO[m.tipo] || 'Despesa';
    estado.tipo = tipoLabel;
    document.getElementById('seg-tipo').querySelectorAll('.seg__item').forEach(function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-valor') === tipoLabel);
    });
    atualizarVisibilidadeMesConta();

    estado.dataSelecionada = new Date(m.data.getFullYear(), m.data.getMonth(), m.data.getDate());
    formatarDataEscolhida();

    campoDescricao.value = m.descricao;
    campoValor.definirValor(Math.abs(m.valor));

    construirCategorias(grupoCategorias(tipoLabel), m.categoria).then(function () {
      estado.periodicidade = m.periodicidade;
      segPeriodicidade.querySelectorAll('.seg__item').forEach(function (b) {
        var ativa = b.getAttribute('data-valor') === m.periodicidade;
        b.classList.toggle('is-active', ativa);
        if (ativa) moverThumb(b);
      });
    });

    document.getElementById('inesperada').checked = !!m.inesperada;
    document.getElementById('notas').value = m.nota || '';

    if (tipoLabel === 'Rendimento' && m.mesReferencia) {
      var partes = m.mesReferencia.split('-');
      var chaveReferencia = Number(partes[0]) * 12 + (Number(partes[1]) - 1);
      var chaveData = m.data.getFullYear() * 12 + m.data.getMonth();
      estado.mesConta = chaveReferencia > chaveData ? 'seguinte' : 'atual';
      document.getElementById('seg-mes-conta').querySelectorAll('.seg__item').forEach(function (b) {
        b.classList.toggle('is-active', b.getAttribute('data-valor') === estado.mesConta);
      });
    }
  }

  if (idEdicao) {
    PennyDB.obter(idEdicao).then(function (m) {
      if (!m) { window.location.href = 'movimentos.html'; return; }
      prefillForm(m);
    });
  } else {
    construirCategorias(D.categoriasDespesa());
  }

  document.getElementById('form-registo').addEventListener('submit', function (evento) {
    evento.preventDefault();

    var valorEuros = campoValor.obterValor();
    var descricao = campoDescricao.value.trim();

    /* Campos obrigatórios: Data, Descrição, Valor e Categoria. A Data
       e a Categoria têm sempre um valor escolhido automaticamente,
       mas a verificação fica aqui à mesma, como rede de segurança. */
    var camposEmFalta = [];
    if (!estado.dataSelecionada) camposEmFalta.push('Data');
    if (!descricao) camposEmFalta.push('Descrição');
    if (!valorEuros) camposEmFalta.push('Valor');
    if (!estado.categoria) camposEmFalta.push('Categoria');

    if (camposEmFalta.length) {
      var listaCampos = camposEmFalta.length === 1
        ? camposEmFalta[0]
        : camposEmFalta.slice(0, -1).join(', ') + ' e ' + camposEmFalta[camposEmFalta.length - 1];
      PennyAlerta.mostrar('Não foi possível submeter, porque falta preencher ' + listaCampos + '.');
      return;
    }

    var sinal = estado.tipo === 'Rendimento' ? 1 : -1;
    var notaEscrita = document.getElementById('notas').value.trim();
    var expressao = campoValor.expressaoOriginal();
    var nota = expressao ? ('Conta: ' + expressao + (notaEscrita ? ' · ' + notaEscrita : '')) : notaEscrita;

    var dados = {
      data: estado.dataSelecionada,
      mesReferencia: calcularMesReferencia(),
      descricao: descricao,
      categoria: estado.categoria,
      periodicidade: estado.periodicidade,
      valor: Math.round(valorEuros * sinal * 100) / 100,
      tipo: MAPA_TIPO[estado.tipo] || 'despesa',
      inesperada: document.getElementById('inesperada').checked,
      nota: nota,
      incompleto: false // passar aqui pela validação acima já garante que está tudo preenchido
    };

    var botaoGuardar = document.querySelector('.save-row');
    botaoGuardar.disabled = true;

    var promessa = idEdicao ? PennyDB.atualizar(idEdicao, dados) : PennyDB.guardar(dados);
    promessa.then(function () {
      if (idEdicao && window.PennyAvisos) PennyAvisos.resolverPorMovimento(idEdicao);
      window.location.href = 'movimentos.html';
    }).catch(function () {
      botaoGuardar.disabled = false;
    });
  });

  document.getElementById('btn-apagar-movimento').addEventListener('click', function () {
    if (!idEdicao) return;
    if (!window.confirm('Apagar este movimento? Não é possível desfazer.')) return;
    PennyDB.apagar(idEdicao).then(function () {
      if (window.PennyAvisos) PennyAvisos.resolverPorMovimento(idEdicao);
      window.location.href = 'movimentos.html';
    });
  });
});
