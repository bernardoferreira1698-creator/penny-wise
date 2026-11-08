/* Popup de novo/editar movimento: o mesmo formulário que antes vivia
   em registo.html, mas agora aberto como um popup flutuante centrado
   em cima do ecrã atual (em vez de navegar para uma página à parte).
   Isto evita que o ecrã de onde se veio "esqueça" onde estava — ex.:
   o mês selecionado em Movimentos — só porque se foi editar ou criar
   um movimento. Chamado a partir de qualquer ecrã via:
     PennyRegistoPopup.abrir({ id: 'xyz' })              // editar
     PennyRegistoPopup.abrir({})                          // novo
   Ambas aceitam ainda `aoGuardar` e `aoApagar` (funções, opcionais),
   chamadas depois de gravar/apagar com sucesso, para o ecrã por trás
   atualizar a sua própria lista sem precisar de recarregar a página. */

(function () {
  var HTML =
    '<div class="modal-fundo" id="rp-fundo">' +
      '<form class="modal-corpo" id="rp-form">' +
        '<div class="topbar">' +
          '<p class="display" style="font-size:26px; letter-spacing:-1.1px; margin:0"><span class="dim" style="color:var(--card-muted)" id="rp-titulo-prefixo">Novo</span> <span id="rp-titulo-sufixo">movimento</span></p>' +
          '<button type="button" class="registo-fecho" aria-label="Fechar" id="rp-fechar">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text)" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12 M18 6L6 18"/></svg>' +
          '</button>' +
        '</div>' +

        '<div class="seg" id="rp-seg-tipo" role="radiogroup" aria-label="Tipo de movimento">' +
          '<button type="button" class="seg__item is-active" data-valor="Despesa">Despesa</button>' +
          '<button type="button" class="seg__item" data-valor="Rendimento">Rendimento</button>' +
          '<button type="button" class="seg__item" data-valor="Poupança">Poupança</button>' +
        '</div>' +

        '<button type="button" id="rp-abrir-calendario" class="field" style="height:54px">' +
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--prim-solid)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16v14H4z M4 10h16 M8 3v4 M16 3v4"/></svg>' +
          '<span style="flex:1; font-size:16px; font-weight:500; text-align:left; color:var(--text)" id="rp-data-escolhida"></span>' +
          '<span style="font-size:13px; color:var(--muted)">Alterar</span>' +
        '</button>' +

        '<div id="rp-bloco-mes-conta" hidden>' +
          '<span class="field__label" style="display:block; margin-bottom:6px">A que mês conta este rendimento</span>' +
          '<div class="seg" id="rp-seg-mes-conta" role="radiogroup" aria-label="A que mês conta">' +
            '<button type="button" class="seg__item is-active" data-valor="atual">Este mês</button>' +
            '<button type="button" class="seg__item" data-valor="seguinte">Mês seguinte</button>' +
          '</div>' +
        '</div>' +

        '<div class="stack">' +
          '<div class="field">' +
            '<label for="rp-descricao" class="field__label">Descrição</label>' +
            '<input id="rp-descricao" class="field__input" placeholder="Ex.: Almoço" autocomplete="off">' +
          '</div>' +
          '<div class="suggestions" id="rp-sugestoes-descricao" hidden></div>' +
        '</div>' +

        '<div class="field field--xl">' +
          '<label for="rp-valor" class="field__label">Valor</label>' +
          '<input id="rp-valor" class="field__value" inputmode="numeric" placeholder="0,00" autocomplete="off">' +
          '<span class="field__suffix">€</span>' +
        '</div>' +

        '<div class="cat-row" id="rp-cat-row"></div>' +

        '<div style="display:flex; gap:8px; align-items:center">' +
          '<div class="seg seg--deslizante" id="rp-seg-periodicidade" style="flex:1" role="radiogroup" aria-label="Periodicidade">' +
            '<span class="seg__thumb" id="rp-seg-periodicidade-thumb"></span>' +
            '<button type="button" class="seg__item is-active" data-valor="Variável">Variável</button>' +
            '<button type="button" class="seg__item" data-valor="Fixa">Fixa</button>' +
          '</div>' +
          '<label class="checkbox-pill">' +
            '<input type="checkbox" id="rp-inesperada">' +
            'Inesperada' +
          '</label>' +
        '</div>' +

        '<div class="field-plain">' +
          '<label for="rp-notas" class="field__label" style="color:var(--card-muted2)">Notas</label>' +
          '<input id="rp-notas" class="field-plain__input" placeholder="Opcional">' +
        '</div>' +

        '<button type="submit" class="save-row">' +
          '<span id="rp-botao-texto">Guardar</span>' +
          '<span class="save-row__icon">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>' +
          '</span>' +
        '</button>' +

        '<button type="button" id="rp-apagar-movimento" class="btn-outline" hidden>Apagar movimento</button>' +
      '</form>' +

      '<div id="rp-folha-calendario" class="folha-calendario" hidden>' +
        '<div class="folha-calendario__corpo">' +
          '<div class="topbar">' +
            '<button type="button" id="rp-cal-mes-anterior" aria-label="Mês anterior" style="width:44px; height:44px; border-radius:22px; border:0; background:var(--ink); display:flex; align-items:center; justify-content:center">' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text)" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>' +
            '</button>' +
            '<span id="rp-cal-titulo" style="font-size:22px; font-weight:500; letter-spacing:-0.6px">Novembro 2026</span>' +
            '<button type="button" id="rp-cal-mes-seguinte" aria-label="Mês seguinte" style="width:44px; height:44px; border-radius:22px; border:0; background:var(--ink); display:flex; align-items:center; justify-content:center">' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text)" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>' +
            '</button>' +
          '</div>' +
          '<div class="cal-grid">' +
            '<span class="cal-cabecalho">S</span><span class="cal-cabecalho">T</span><span class="cal-cabecalho">Q</span>' +
            '<span class="cal-cabecalho">Q</span><span class="cal-cabecalho">S</span><span class="cal-cabecalho">S</span><span class="cal-cabecalho">D</span>' +
          '</div>' +
          '<div class="cal-grid" id="rp-cal-dias"></div>' +
          '<div style="display:flex; gap:10px">' +
            '<button type="button" id="rp-cal-hoje" style="font-family:inherit; flex:1; height:50px; border-radius:999px; border:1px solid var(--line-light); background:transparent; color:var(--ink); font-size:15px; font-weight:500">Hoje</button>' +
            '<button type="button" id="rp-cal-fechar" style="font-family:inherit; flex:1; height:50px; border-radius:999px; border:0; background:var(--ink); color:var(--text); font-size:15px; font-weight:500">Fechar</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

  function abrir(opcoes) {
    opcoes = opcoes || {};
    var idEdicao = opcoes.id || null;
    var aoGuardar = opcoes.aoGuardar || function () {};
    var aoApagar = opcoes.aoApagar || function () {};

    // Só pode haver um popup aberto de cada vez.
    var existente = document.getElementById('rp-fundo');
    if (existente) existente.remove();

    var pedaco = document.createElement('div');
    pedaco.innerHTML = HTML;
    var fundo = pedaco.firstChild;
    document.body.appendChild(fundo);

    var listenersGlobais = []; // {alvo, evento, fn} — removidos ao fechar
    function ouvirGlobal(alvo, evento, fn) {
      alvo.addEventListener(evento, fn);
      listenersGlobais.push({ alvo: alvo, evento: evento, fn: fn });
    }

    function fechar() {
      listenersGlobais.forEach(function (l) { l.alvo.removeEventListener(l.evento, l.fn); });
      fundo.remove();
    }

    var D = window.PennyDados;
    var MESES = D.MESES;
    var MAPA_TIPO = { 'Despesa': 'despesa', 'Rendimento': 'rendimento', 'Poupança': 'poupanca' };
    var MAPA_TIPO_INVERSO = { despesa: 'Despesa', rendimento: 'Rendimento', poupanca: 'Poupança' };

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

    var blocoMesConta = document.getElementById('rp-bloco-mes-conta');
    function atualizarVisibilidadeMesConta() { blocoMesConta.hidden = estado.tipo !== 'Rendimento'; }
    segmentado('rp-seg-mes-conta', function (valor) { estado.mesConta = valor; });

    segmentado('rp-seg-tipo', function (valor) {
      var grupoAntigo = grupoCategorias(estado.tipo);
      estado.tipo = valor;
      atualizarVisibilidadeMesConta();
      var grupoNovo = grupoCategorias(estado.tipo);
      if (grupoNovo !== grupoAntigo) construirCategorias(grupoNovo);
    });

    /* Segmento Fixa/Variável com deslize suave: um "thumb" posicionado
       via JavaScript (para se ajustar à largura real de cada botão). */
    var segPeriodicidade = document.getElementById('rp-seg-periodicidade');
    var thumbPeriodicidade = document.getElementById('rp-seg-periodicidade-thumb');
    function moverThumb(botaoAtivo) {
      var rectContainer = segPeriodicidade.getBoundingClientRect();
      var rectBotao = botaoAtivo.getBoundingClientRect();
      thumbPeriodicidade.style.left = (rectBotao.left - rectContainer.left) + 'px';
      thumbPeriodicidade.style.width = rectBotao.width + 'px';
    }
    segmentado('rp-seg-periodicidade', function (valor, botao) {
      estado.periodicidade = valor;
      moverThumb(botao);
    });
    requestAnimationFrame(function () {
      var ativo = segPeriodicidade.querySelector('.seg__item.is-active');
      thumbPeriodicidade.style.transition = 'none';
      moverThumb(ativo);
      requestAnimationFrame(function () { thumbPeriodicidade.style.transition = ''; });
    });
    ouvirGlobal(window, 'resize', function () {
      var ativo = segPeriodicidade.querySelector('.seg__item.is-active');
      moverThumb(ativo);
    });

    /* Categorias: as mais usadas no histórico primeiro, com "Mais" a
       revelar as restantes. Muda de lista (despesa/rendimento) consoante
       o Tipo escolhido. Ao editar, mostra logo todas (sem "Mais"), para
       a categoria guardada estar sempre visível. */
    var catRow = document.getElementById('rp-cat-row');
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
      document.getElementById('rp-data-escolhida').textContent =
        d.getDate() + ' de ' + MESES[d.getMonth()] + sufixoAno;
    }

    function podeAvancarCalendario() {
      return (estado.anoCalendario * 12 + estado.mesCalendario) < (hoje.getFullYear() * 12 + hoje.getMonth());
    }

    function renderCalendario() {
      document.getElementById('rp-cal-titulo').textContent =
        MESES[estado.mesCalendario].charAt(0).toUpperCase() + MESES[estado.mesCalendario].slice(1) + ' ' + estado.anoCalendario;
      document.getElementById('rp-cal-mes-seguinte').style.visibility = podeAvancarCalendario() ? 'visible' : 'hidden';

      var container = document.getElementById('rp-cal-dias');
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

    var folha = document.getElementById('rp-folha-calendario');
    function abrirCalendario() {
      estado.mesCalendario = estado.dataSelecionada.getMonth();
      estado.anoCalendario = estado.dataSelecionada.getFullYear();
      renderCalendario();
      folha.hidden = false;
    }
    function fecharCalendario() { folha.hidden = true; }

    document.getElementById('rp-abrir-calendario').addEventListener('click', abrirCalendario);
    document.getElementById('rp-cal-fechar').addEventListener('click', fecharCalendario);
    document.getElementById('rp-cal-hoje').addEventListener('click', function () {
      estado.dataSelecionada = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
      estado.mesCalendario = hoje.getMonth();
      estado.anoCalendario = hoje.getFullYear();
      formatarDataEscolhida();
      fecharCalendario();
    });
    document.getElementById('rp-cal-mes-anterior').addEventListener('click', function () {
      estado.mesCalendario--;
      if (estado.mesCalendario < 0) { estado.mesCalendario = 11; estado.anoCalendario--; }
      renderCalendario();
    });
    document.getElementById('rp-cal-mes-seguinte').addEventListener('click', function () {
      if (!podeAvancarCalendario()) return;
      estado.mesCalendario++;
      if (estado.mesCalendario > 11) { estado.mesCalendario = 0; estado.anoCalendario++; }
      renderCalendario();
    });
    folha.addEventListener('click', function (evento) {
      if (evento.target === folha) fecharCalendario();
    });

    /* Sugestões de descrição: dinâmicas, a partir do histórico,
       conforme o utilizador escreve. */
    var campoDescricao = document.getElementById('rp-descricao');
    var caixaSugestoes = document.getElementById('rp-sugestoes-descricao');

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
    ouvirGlobal(document, 'click', function (evento) {
      if (!caixaSugestoes.contains(evento.target) && evento.target !== campoDescricao) caixaSugestoes.hidden = true;
    });

    /* Valor: cêntimos primeiro (como uma máquina de pagamentos), mas
       aceita contas simples tipo "47-11-12,5-11,5" (ver js/moeda.js). */
    var campoValor = PennyMoeda.ligarCampoCentimos(document.getElementById('rp-valor'));

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
      document.getElementById('rp-titulo-prefixo').textContent = 'Editar';
      document.getElementById('rp-botao-texto').textContent = 'Guardar alterações';
      document.getElementById('rp-apagar-movimento').hidden = false;

      var tipoLabel = MAPA_TIPO_INVERSO[m.tipo] || 'Despesa';
      estado.tipo = tipoLabel;
      document.getElementById('rp-seg-tipo').querySelectorAll('.seg__item').forEach(function (b) {
        b.classList.toggle('is-active', b.getAttribute('data-valor') === tipoLabel);
      });
      atualizarVisibilidadeMesConta();

      estado.dataSelecionada = new Date(m.data.getFullYear(), m.data.getMonth(), m.data.getDate());
      formatarDataEscolhida();

      campoDescricao.value = m.descricao;
      campoValor.definirValor(Math.abs(m.valor));

      construirCategorias(grupoCategorias(tipoLabel), m.categoria).then(function () {
        if (!m.periodicidade) return;
        estado.periodicidade = m.periodicidade;
        segPeriodicidade.querySelectorAll('.seg__item').forEach(function (b) {
          var ativa = b.getAttribute('data-valor') === m.periodicidade;
          b.classList.toggle('is-active', ativa);
          if (ativa) moverThumb(b);
        });
      });

      document.getElementById('rp-inesperada').checked = !!m.inesperada;
      document.getElementById('rp-notas').value = m.nota || '';

      if (tipoLabel === 'Rendimento' && m.mesReferencia) {
        var partes = m.mesReferencia.split('-');
        var chaveReferencia = Number(partes[0]) * 12 + (Number(partes[1]) - 1);
        var chaveData = m.data.getFullYear() * 12 + m.data.getMonth();
        estado.mesConta = chaveReferencia > chaveData ? 'seguinte' : 'atual';
        document.getElementById('rp-seg-mes-conta').querySelectorAll('.seg__item').forEach(function (b) {
          b.classList.toggle('is-active', b.getAttribute('data-valor') === estado.mesConta);
        });
      }
    }

    if (idEdicao) {
      PennyDB.obter(idEdicao).then(function (m) {
        if (!m) { fechar(); return; }
        prefillForm(m);
      });
    } else {
      construirCategorias(D.categoriasDespesa());
    }

    document.getElementById('rp-form').addEventListener('submit', function (evento) {
      evento.preventDefault();

      var valorEuros = campoValor.obterValor();
      var descricao = campoDescricao.value.trim();

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
      var notaEscrita = document.getElementById('rp-notas').value.trim();
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
        inesperada: document.getElementById('rp-inesperada').checked,
        nota: nota,
        incompleto: false
      };

      var botaoGuardar = fundo.querySelector('.save-row');
      botaoGuardar.disabled = true;

      var promessa = idEdicao ? PennyDB.atualizar(idEdicao, dados) : PennyDB.guardar(dados);
      promessa.then(function (resultado) {
        if (idEdicao && window.PennyAvisos) PennyAvisos.resolverPorMovimento(idEdicao);
        fechar();
        aoGuardar(resultado);
      }).catch(function () {
        botaoGuardar.disabled = false;
      });
    });

    document.getElementById('rp-apagar-movimento').addEventListener('click', function () {
      if (!idEdicao) return;
      if (!window.confirm('Apagar este movimento? Não é possível desfazer.')) return;
      PennyDB.apagar(idEdicao).then(function () {
        if (window.PennyAvisos) PennyAvisos.resolverPorMovimento(idEdicao);
        fechar();
        aoApagar();
      });
    });

    document.getElementById('rp-fechar').addEventListener('click', fechar);
    fundo.addEventListener('click', function (evento) {
      if (evento.target === fundo) fechar();
    });
  }

  window.PennyRegistoPopup = { abrir: abrir };
})();
