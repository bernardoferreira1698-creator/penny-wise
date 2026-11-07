/* Ecrã Movimentos: lista agrupada por dia e os 3 filtros (Categoria,
   Fixa ou Variável, Inesperadas), cumulativos entre si. As escolhas
   de Categoria e de Fixa/Variável ficam guardadas (localStorage) e
   aplicam-se sempre que se volta a este ecrã. */

document.addEventListener('DOMContentLoaded', function () {
  var D = window.PennyDados;
  var DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

  var CHAVE_CATEGORIAS = 'pw_filtro_categorias';
  var CHAVE_PERIODICIDADE = 'pw_filtro_periodicidade';
  var CHAVE_INESPERADAS = 'pw_filtro_inesperadas';

  var TODAS_CATEGORIAS = D.categoriasDespesa().map(function (c) { return c.nome; })
    .concat(D.categoriasRendimento().map(function (c) { return c.nome; }))
    .sort(function (a, b) { return a.localeCompare(b, 'pt'); });

  function lerLista(chave) {
    try { return JSON.parse(localStorage.getItem(chave) || '[]'); } catch (e) { return []; }
  }

  var estado = {
    categorias: lerLista(CHAVE_CATEGORIAS), // vazio = todas
    periodicidade: lerLista(CHAVE_PERIODICIDADE), // vazio = ambas (Fixa e Variável)
    inesperadas: localStorage.getItem(CHAVE_INESPERADAS) === '1',
    busca: ''
  };

  var TODOS_MOVIMENTOS = [];

  /* Mês a mostrar: começa sempre no mês atual a sério, e só deixa
     recuar até ao primeiro mês com movimentos registados (ver
     PennyDB.primeiroMesComDados). */
  var hoje = D.hoje();
  var mesSelecionado = { ano: hoje.getFullYear(), mes: hoje.getMonth() };
  var limiteAntigo = null; // {ano, mes} do primeiro mês com movimentos; null = sem histórico nenhum ainda

  function mesReferenciaSelecionada() {
    return mesSelecionado.ano + '-' + String(mesSelecionado.mes + 1).padStart(2, '0');
  }

  function podeRecuarMes() {
    if (!limiteAntigo) return false;
    return (mesSelecionado.ano * 12 + mesSelecionado.mes) > (limiteAntigo.ano * 12 + limiteAntigo.mes);
  }

  function atualizarCabecalhoMes() {
    var nomeMes = D.MESES[mesSelecionado.mes];
    document.getElementById('movimentos-mes-nome').textContent = nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1) + ',';
    document.getElementById('movimentos-mes-titulo').textContent = D.mesAnoLabel(mesSelecionado.ano, mesSelecionado.mes);
    document.getElementById('movimentos-mes-anterior').style.visibility = podeRecuarMes() ? 'visible' : 'hidden';
  }

  document.getElementById('movimentos-mes-anterior').addEventListener('click', function () {
    if (!podeRecuarMes()) return;
    mesSelecionado.mes--;
    if (mesSelecionado.mes < 0) { mesSelecionado.mes = 11; mesSelecionado.ano--; }
    atualizarCabecalhoMes();
    render();
  });
  document.getElementById('movimentos-mes-seguinte').addEventListener('click', function () {
    mesSelecionado.mes++;
    if (mesSelecionado.mes > 11) { mesSelecionado.mes = 0; mesSelecionado.ano++; }
    atualizarCabecalhoMes();
    render();
  });
  atualizarCabecalhoMes();

  function formatarDataCompleta(data) {
    var nomeDia = DIAS_SEMANA[data.getDay()];
    nomeDia = nomeDia.charAt(0).toUpperCase() + nomeDia.slice(1);
    return nomeDia + ', ' + data.getDate() + ' de ' + D.MESES[data.getMonth()];
  }

  function passaNosFiltros(m) {
    if (m.mesReferencia !== mesReferenciaSelecionada()) return false;
    if (estado.categorias.length && estado.categorias.indexOf(m.categoria) < 0) return false;
    if (estado.periodicidade.length && estado.periodicidade.indexOf(m.periodicidade) < 0) return false;
    if (estado.inesperadas && !m.inesperada) return false;
    if (estado.busca && m.descricao.toLowerCase().indexOf(estado.busca) < 0) return false;
    return true;
  }

  function render() {
    var filtrados = TODOS_MOVIMENTOS.filter(passaNosFiltros);
    document.getElementById('total-movimentos').textContent = filtrados.length + ' movimentos';

    var lista = document.getElementById('lista-movimentos');
    lista.innerHTML = '';
    document.getElementById('sem-resultados').hidden = filtrados.length > 0;

    var porDia = [];
    var indicePorDia = {};
    filtrados.forEach(function (m) {
      var chave = m.data.toDateString();
      if (!(chave in indicePorDia)) {
        indicePorDia[chave] = porDia.length;
        porDia.push({ data: m.data, movimentos: [] });
      }
      porDia[indicePorDia[chave]].movimentos.push(m);
    });

    porDia.forEach(function (grupo) {
      var total = grupo.movimentos.reduce(function (soma, m) { return soma + m.valor; }, 0);
      var cabecalho = document.createElement('div');
      cabecalho.className = 'dia-cabecalho';
      cabecalho.innerHTML =
        '<span class="eyebrow" style="padding:0">' + formatarDataCompleta(grupo.data) + '</span>' +
        '<span class="muted2" style="font-size:13px">' + PennyMoeda.formatar(total) + '</span>';
      lista.appendChild(cabecalho);

      var caixa = document.createElement('div');
      caixa.className = 'glass glass-rows';
      grupo.movimentos.forEach(function (m) {
        var linha = document.createElement('a');
        linha.href = 'registo.html?id=' + encodeURIComponent(m.id);
        linha.className = 'glass-rows__row';
        var subtitulo = m.tipo === 'poupanca' ? 'Poupança' : (m.incompleto ? 'Por confirmar' : (m.categoria + ' · ' + m.periodicidade));
        linha.innerHTML =
          '<div class="glass-rows__label"><span class="glass-rows__title">' + m.descricao + '</span>' +
          '<span class="glass-rows__sub">' + subtitulo + '</span></div>' +
          '<span class="glass-rows__value">' + PennyMoeda.formatar(m.valor) + '</span>';
        caixa.appendChild(linha);
      });
      lista.appendChild(caixa);
    });
  }

  /* Pesquisa */
  document.getElementById('busca').addEventListener('input', function () {
    estado.busca = this.value.trim().toLowerCase();
    render();
  });

  /* Inesperadas: filtro simples, sem menu. */
  var btnInesperadas = document.getElementById('btn-filtro-inesperadas');
  function pintarInesperadas() { btnInesperadas.classList.toggle('is-active', estado.inesperadas); }
  pintarInesperadas();
  btnInesperadas.addEventListener('click', function () {
    estado.inesperadas = !estado.inesperadas;
    localStorage.setItem(CHAVE_INESPERADAS, estado.inesperadas ? '1' : '0');
    pintarInesperadas();
    render();
  });

  /* Menu genérico de seleção múltipla, usado para Categoria e para
     Fixa/Variável. */
  function construirMenu(opcoes) {
    var sheet = document.getElementById(opcoes.sheetId);
    var container = document.getElementById(opcoes.opcoesId);
    var selecaoTemporaria = estado[opcoes.chaveEstado].slice();

    function renderOpcoes() {
      container.innerHTML = '';
      opcoes.lista.forEach(function (nome) {
        var ativa = selecaoTemporaria.indexOf(nome) >= 0;
        var botao = document.createElement('button');
        botao.type = 'button';
        botao.className = 'sheet-opcao' + (ativa ? ' is-selecionada' : '');
        botao.innerHTML = '<span>' + nome + '</span><span class="sheet-check"></span>';
        botao.addEventListener('click', function () {
          var indice = selecaoTemporaria.indexOf(nome);
          if (indice >= 0) selecaoTemporaria.splice(indice, 1);
          else selecaoTemporaria.push(nome);
          renderOpcoes();
        });
        container.appendChild(botao);
      });
    }

    function abrir() {
      selecaoTemporaria = estado[opcoes.chaveEstado].slice();
      renderOpcoes();
      sheet.hidden = false;
    }
    function fechar() { sheet.hidden = true; }

    document.getElementById(opcoes.botaoAbrirId).addEventListener('click', abrir);
    sheet.addEventListener('click', function (evento) { if (evento.target === sheet) fechar(); });
    if (opcoes.botaoFecharId) document.getElementById(opcoes.botaoFecharId).addEventListener('click', fechar);
    document.getElementById(opcoes.botaoLimparId).addEventListener('click', function () {
      selecaoTemporaria = opcoes.limparPara ? opcoes.limparPara.slice() : [];
      renderOpcoes();
    });
    document.getElementById(opcoes.botaoGuardarId).addEventListener('click', function () {
      estado[opcoes.chaveEstado] = selecaoTemporaria.slice();
      localStorage.setItem(opcoes.chave, JSON.stringify(estado[opcoes.chaveEstado]));
      pintarBotaoFiltro(opcoes.botaoFiltroId, opcoes.chaveEstado, opcoes.totalPossivel);
      fechar();
      render();
    });
  }

  function pintarBotaoFiltro(botaoId, chaveEstado, totalPossivel) {
    var botao = document.getElementById(botaoId);
    var selecionados = estado[chaveEstado].length;
    botao.classList.toggle('is-active', selecionados > 0 && selecionados < totalPossivel);
  }

  construirMenu({
    sheetId: 'sheet-categoria', opcoesId: 'opcoes-categoria', botaoAbrirId: 'btn-filtro-categoria',
    botaoFecharId: 'btn-fechar-categoria',
    botaoLimparId: 'btn-limpar-categoria', botaoGuardarId: 'btn-guardar-categoria', botaoFiltroId: 'btn-filtro-categoria',
    chaveEstado: 'categorias', chave: CHAVE_CATEGORIAS, lista: TODAS_CATEGORIAS, limparPara: [], totalPossivel: TODAS_CATEGORIAS.length
  });

  construirMenu({
    sheetId: 'sheet-periodicidade', opcoesId: 'opcoes-periodicidade', botaoAbrirId: 'btn-filtro-periodicidade',
    botaoFecharId: 'btn-fechar-periodicidade',
    botaoLimparId: 'btn-limpar-periodicidade', botaoGuardarId: 'btn-guardar-periodicidade', botaoFiltroId: 'btn-filtro-periodicidade',
    chaveEstado: 'periodicidade', chave: CHAVE_PERIODICIDADE, lista: ['Fixa', 'Variável'], limparPara: [], totalPossivel: 2
  });

  pintarBotaoFiltro('btn-filtro-categoria', 'categorias', TODAS_CATEGORIAS.length);
  pintarBotaoFiltro('btn-filtro-periodicidade', 'periodicidade', 2);

  /* "Limpar": repõe os três filtros e a pesquisa de uma vez. */
  document.getElementById('btn-limpar-filtros').addEventListener('click', function () {
    estado.categorias = [];
    estado.periodicidade = [];
    estado.inesperadas = false;
    estado.busca = '';
    localStorage.setItem(CHAVE_CATEGORIAS, '[]');
    localStorage.setItem(CHAVE_PERIODICIDADE, '[]');
    localStorage.setItem(CHAVE_INESPERADAS, '0');
    document.getElementById('busca').value = '';
    pintarInesperadas();
    pintarBotaoFiltro('btn-filtro-categoria', 'categorias', TODAS_CATEGORIAS.length);
    pintarBotaoFiltro('btn-filtro-periodicidade', 'periodicidade', 2);
    render();
  });

  Promise.all([PennyDB.todos(), PennyDB.primeiroMesComDados()]).then(function (resultados) {
    TODOS_MOVIMENTOS = resultados[0];
    limiteAntigo = resultados[1];
    atualizarCabecalhoMes();
    render();
  });
});
