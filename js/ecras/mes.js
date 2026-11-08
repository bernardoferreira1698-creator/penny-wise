/* Ecrã Análise do mês: navegação por mês (sem limites, como em
   Movimentos) e todas as categorias com despesas nesse mês, a partir
   dos movimentos reais (js/calculos.js). Os orçamentos usados para
   destacar "acima do orçamento" continuam a ser os de exemplo
   (js/dados-mock.js) até à Fase 6. */

document.addEventListener('DOMContentLoaded', function () {
  var D = window.PennyDados;
  var barraFixasVariaveis = document.getElementById('barra-fixas-variaveis');
  var primeiraRenderizacaoDaBarra = true;
  var TODOS_MOVIMENTOS = [];

  var hoje = D.hoje();
  var mesAtual = { ano: hoje.getFullYear(), mes: hoje.getMonth() };
  var limiteAntigo = null; // {ano, mes} do primeiro mês com movimentos; null = sem histórico nenhum ainda

  function podeRecuar() {
    if (!limiteAntigo) return false;
    return (mesAtual.ano * 12 + mesAtual.mes) > (limiteAntigo.ano * 12 + limiteAntigo.mes);
  }
  function podeAvancar() {
    return (mesAtual.ano * 12 + mesAtual.mes) < (hoje.getFullYear() * 12 + hoje.getMonth());
  }

  function atualizarTitulo() {
    document.getElementById('mes-titulo').textContent = D.mesAnoLabel(mesAtual.ano, mesAtual.mes);
    document.getElementById('mes-anterior').style.visibility = podeRecuar() ? 'visible' : 'hidden';
    document.getElementById('mes-seguinte').style.visibility = podeAvancar() ? 'visible' : 'hidden';
  }

  function render() {
    var detalhes = PennyCalculos.calcularMes(TODOS_MOVIMENTOS, mesAtual.ano, mesAtual.mes);
    var nomeMes = D.MESES[mesAtual.mes].charAt(0).toUpperCase() + D.MESES[mesAtual.mes].slice(1);

    if (!detalhes.temDados) {
      document.getElementById('frase-principal').innerHTML = '<span class="muted">' + nomeMes + ' ainda não tem movimentos registados.</span>';
      barraFixasVariaveis.innerHTML = '';
      primeiraRenderizacaoDaBarra = true;
      document.getElementById('legenda-fixas-variaveis').innerHTML = '';
      document.getElementById('lista-categorias').innerHTML = '';
      return;
    }

    var pct = PennyMoeda.arredondarPct(detalhes.pctPoupada);
    document.getElementById('frase-principal').innerHTML = detalhes.sobrou < 0
      ? '<span class="muted">' + nomeMes + ' ultrapassou</span><br>' +
        '<span class="muted">em</span> ' + PennyMoeda.formatar(Math.abs(detalhes.sobrou)) + ' <span class="muted">o orçamento,</span><br>' +
        '<span class="warn-text">' + Math.abs(pct) + '%</span> <span class="muted">a mais do que ganhaste.</span>'
      : '<span class="muted">' + nomeMes + ' deixou</span><br>' +
        PennyMoeda.formatar(detalhes.sobrou) + ' <span class="muted">livres,</span><br>' +
        '<span class="warn-text">' + pct + '%</span> <span class="muted">do que ganhaste.</span>';

    var totalDespesas = detalhes.despesasFixas + detalhes.despesasVariaveis;
    var pctFixas = totalDespesas ? PennyMoeda.arredondarPct(detalhes.despesasFixas / totalDespesas) : 0;

    /* Ao abrir o ecrã, a divisão já aparece na posição certa, sem
       animação. Ao mudar de mês, os dois elementos mantêm-se no DOM e
       só a largura muda, o que faz a divisão deslizar suavemente
       (transition já definida no CSS) em vez de voltar a crescer do
       zero. */
    if (!barraFixasVariaveis.firstChild) {
      barraFixasVariaveis.innerHTML =
        '<div style="background:var(--bar-h)"></div><div style="background:var(--text)"></div>';
    }
    var divFixas = barraFixasVariaveis.children[0];
    var divVariaveis = barraFixasVariaveis.children[1];
    if (primeiraRenderizacaoDaBarra) {
      divFixas.style.transition = 'none';
      divVariaveis.style.transition = 'none';
    }
    divFixas.style.width = pctFixas + '%';
    divVariaveis.style.width = (100 - pctFixas) + '%';
    if (primeiraRenderizacaoDaBarra) {
      void barraFixasVariaveis.offsetWidth; // força o browser a aplicar a largura sem animação antes de repor a transition
      divFixas.style.transition = '';
      divVariaveis.style.transition = '';
      primeiraRenderizacaoDaBarra = false;
    }

    document.getElementById('legenda-fixas-variaveis').innerHTML =
      '<span><span class="warn-text">Fixas</span> ' + PennyMoeda.formatar(detalhes.despesasFixas) + '</span>' +
      '<span>Variáveis ' + PennyMoeda.formatar(detalhes.despesasVariaveis) + ' <span class="muted">· Rendimento ' + PennyMoeda.formatar(detalhes.rendimento) + '</span></span>';

    var lista = document.getElementById('lista-categorias');
    lista.innerHTML = '';
    detalhes.categorias.forEach(function (c) {
      var item = document.createElement('button');
      item.type = 'button';
      item.className = 'cat-item';
      item.style.cssText = 'width:100%; text-align:left; background:none; border:0; padding:0; font-family:inherit; cursor:pointer; color:inherit';
      var acimaDoOrcamento = D.valorOrcamento(c.nome, detalhes.rendimento) && c.valor > D.valorOrcamento(c.nome, detalhes.rendimento);
      /* A barra representa sempre 0-100% do rendimento: cresce com o
         peso da categoria e para em 100% de preenchimento, nunca
         "transborda", mesmo que a categoria pese mais do que isso. */
      item.innerHTML =
        '<div class="cat-item__linha"><span>' + c.nome + ' <span class="muted" style="font-size:12px; font-weight:400">' + PennyMoeda.arredondarPct(c.pct) + '%</span></span>' +
        '<span style="font-weight:500">' + PennyMoeda.formatar(c.valor) + '</span></div>' +
        '<div class="bar-track"><div class="bar-fill' + (acimaDoOrcamento ? '' : ' bar-fill--ok') + '" style="width:0%" data-largura="' + PennyMoeda.larguraBarra(c.pct) + '"></div></div>' +
        (acimaDoOrcamento ? '<span class="warn-text" style="font-size:12px">acima do orçamento habitual</span>' : '');
      item.addEventListener('click', function () { abrirDetalheCategoria(c.nome, c.valor); });
      lista.appendChild(item);
    });
    PennyMoeda.animarBarras(lista);
  }

  /* Pop-up com todas as despesas que compõem o total de uma categoria
     neste mês — incluindo as parcelas de pagamentos repartidos (ex.:
     Spotify) e os movimentos criados ao confirmar um Recorrente, já
     que estes são movimentos reais como quaisquer outros. */
  var sheetDetalhe = document.getElementById('sheet-detalhe-categoria');
  function mesReferenciaAtual() { return mesAtual.ano + '-' + String(mesAtual.mes + 1).padStart(2, '0'); }

  function abrirDetalheCategoria(nomeCategoria, totalCategoria) {
    var chave = mesReferenciaAtual();
    var despesas = PennyCalculos.expandirRepartidos(TODOS_MOVIMENTOS)
      .filter(function (m) { return m.tipo === 'despesa' && m.categoria === nomeCategoria && m.mesReferencia === chave; })
      .sort(function (a, b) { return b.data - a.data; });

    document.getElementById('titulo-detalhe-categoria').textContent = nomeCategoria;
    document.getElementById('resumo-detalhe-categoria').textContent =
      despesas.length + (despesas.length === 1 ? ' despesa · ' : ' despesas · ') + PennyMoeda.formatar(totalCategoria) + ' no total';

    var lista = document.getElementById('lista-detalhe-categoria');
    lista.innerHTML = '';
    despesas.forEach(function (m) {
      var linha = document.createElement('div');
      linha.style.cssText = 'display:flex; justify-content:space-between; align-items:baseline; gap:10px; padding:10px 0; border-bottom:1px solid var(--sheet-linha, rgba(0,0,0,0.08))';
      var repartido = m.repartirMeses > 1 ? ' <span class="muted2" style="font-size:11px">· repartido</span>' : '';
      linha.innerHTML =
        '<div style="display:flex; flex-direction:column; gap:2px; min-width:0">' +
        '<span style="font-size:14px; font-weight:500; color:var(--sheet-ink)">' + m.descricao + '</span>' +
        '<span class="muted2" style="font-size:12px">' + m.data.getDate() + ' ' + D.MESES[m.data.getMonth()].slice(0, 3) + repartido + '</span></div>' +
        '<span style="font-size:14px; font-weight:500; color:var(--sheet-ink); flex:none">' + PennyMoeda.formatar(m.valor) + '</span>';
      lista.appendChild(linha);
    });

    sheetDetalhe.hidden = false;
  }
  function fecharDetalheCategoria() { sheetDetalhe.hidden = true; }
  document.getElementById('btn-fechar-detalhe-categoria').addEventListener('click', fecharDetalheCategoria);
  sheetDetalhe.addEventListener('click', function (evento) { if (evento.target === sheetDetalhe) fecharDetalheCategoria(); });

  document.getElementById('mes-anterior').addEventListener('click', function () {
    if (!podeRecuar()) return;
    mesAtual.mes--;
    if (mesAtual.mes < 0) { mesAtual.mes = 11; mesAtual.ano--; }
    atualizarTitulo();
    render();
  });
  document.getElementById('mes-seguinte').addEventListener('click', function () {
    if (!podeAvancar()) return;
    mesAtual.mes++;
    if (mesAtual.mes > 11) { mesAtual.mes = 0; mesAtual.ano++; }
    atualizarTitulo();
    render();
  });
  atualizarTitulo();

  /* Também chamada depois de gravar/apagar um movimento no popup de
     Registo, para atualizar este mês sem recarregar a página. */
  function carregarDados() {
    return Promise.all([PennyDB.todos(), PennyDB.primeiroMesComDados()]).then(function (resultados) {
      TODOS_MOVIMENTOS = resultados[0];
      limiteAntigo = resultados[1];
      atualizarTitulo();
      render();
    });
  }
  window.PennyAoRegistar = carregarDados;

  carregarDados().then(function () {
    if (window.pwPronto) window.pwPronto(1)();
  });
});
