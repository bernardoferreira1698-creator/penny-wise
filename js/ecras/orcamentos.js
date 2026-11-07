/* Ecrã Orçamentos: lista com o progresso de cada categoria e edição
   do valor do orçamento (um montante fixo ou uma percentagem do
   rendimento do mês). */

document.addEventListener('DOMContentLoaded', function () {
  var D = window.PennyDados;
  var hoje = D.hoje();
  var ano = hoje.getFullYear(), mes = hoje.getMonth();
  var nomeMes = D.MESES[mes];
  var detalhesMes = null; // calculado a partir dos movimentos reais, ver fundo do ficheiro

  document.getElementById('mes-orcamentos').textContent = nomeMes;

  function listaCategorias() {
    return D.categoriasDespesa().map(function (c) { return c.nome; })
      .filter(function (nome) { return D.valorOrcamento(nome, detalhesMes.rendimento) > 0; });
  }

  function gastoDaCategoria(nome) {
    var encontrada = detalhesMes.categorias.find(function (c) { return c.nome === nome; });
    return encontrada ? encontrada.valor : 0;
  }

  function render() {
    if (!detalhesMes) return;
    var categorias = listaCategorias().map(function (nome) {
      var gasto = gastoDaCategoria(nome);
      var orcamento = D.valorOrcamento(nome, detalhesMes.rendimento);
      return { nome: nome, gasto: gasto, orcamento: orcamento, pct: orcamento ? gasto / orcamento : 0 };
    }).sort(function (a, b) { return b.pct - a.pct; });

    var acimaDoLimite = categorias.filter(function (c) { return c.pct >= 1; }).length;
    document.getElementById('chips-orcamentos').innerHTML =
      '<span class="chip chip--warn">' + acimaDoLimite + ' acima do limite</span>' +
      '<span class="chip">Sugestão: média dos meses com histórico</span>';

    var lista = document.getElementById('lista-orcamentos');
    lista.innerHTML = '';
    categorias.forEach(function (c) {
      var item = document.createElement('button');
      item.type = 'button';
      item.className = 'orc-item';
      var pctTexto = PennyMoeda.arredondarPct(c.pct);
      item.innerHTML =
        '<div class="orc-item__linha"><span style="font-weight:500">' + c.nome + '</span>' +
        '<span><span style="font-weight:500">' + PennyMoeda.formatar(c.gasto) + '</span> <span class="muted2" style="font-size:13px">de ' + PennyMoeda.formatar(c.orcamento) + '</span></span></div>' +
        '<div class="bar-track"><div class="bar-fill' + (c.pct < 1 ? ' bar-fill--ok' : '') + '" style="width:0%" data-largura="' + PennyMoeda.larguraBarra(c.pct) + '"></div></div>' +
        (c.pct >= 1
          ? '<span class="warn-text" style="font-size:12px">' + pctTexto + '% · acima do limite</span>'
          : '<span class="muted2" style="font-size:12px">' + pctTexto + '%</span>');
      item.addEventListener('click', function () { abrirEdicao(c.nome); });
      lista.appendChild(item);
    });
    PennyMoeda.animarBarras(lista);
  }

  /* Sheet de edição. */
  var sheet = document.getElementById('sheet-editar-orcamento');
  var segTipo = document.getElementById('seg-tipo-orcamento');
  var campoValor = document.getElementById('valor-orcamento');
  var sufixo = document.getElementById('sufixo-orcamento');
  var categoriaAtual = null;

  function tipoAtual() { return segTipo.querySelector('.seg__item.is-active').getAttribute('data-tipo'); }

  function atualizarSufixo() {
    sufixo.textContent = tipoAtual() === 'percentagem' ? '%' : '€';
  }

  segTipo.addEventListener('click', function (evento) {
    var botao = evento.target.closest('.seg__item');
    if (!botao) return;
    segTipo.querySelectorAll('.seg__item').forEach(function (b) { b.classList.remove('is-active'); });
    botao.classList.add('is-active');
    atualizarSufixo();
  });

  function abrirEdicao(nomeCategoria) {
    categoriaAtual = nomeCategoria;
    document.getElementById('editar-orcamento-titulo').textContent = nomeCategoria;
    var personalizados = D.orcamentosPersonalizados();
    var def = personalizados[nomeCategoria];
    var tipo = def ? def.tipo : 'valor';
    segTipo.querySelectorAll('.seg__item').forEach(function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-tipo') === tipo);
    });
    atualizarSufixo();
    campoValor.value = def ? String(def.valor).replace('.', ',') : String(D.ORCAMENTOS_SUGERIDOS[nomeCategoria] || 0).replace('.', ',');
    document.getElementById('sugestao-orcamento').textContent =
      'Sugestão (média dos meses com histórico): ' + PennyMoeda.formatar(D.ORCAMENTOS_SUGERIDOS[nomeCategoria] || 0);
    sheet.hidden = false;
  }
  function fecharEdicao() { sheet.hidden = true; }
  sheet.addEventListener('click', function (evento) { if (evento.target === sheet) fecharEdicao(); });
  document.getElementById('btn-fechar-orcamento').addEventListener('click', fecharEdicao);

  document.getElementById('btn-repor-orcamento').addEventListener('click', function () {
    D.removerOrcamentoPersonalizado(categoriaAtual);
    fecharEdicao();
    render();
  });

  document.getElementById('btn-guardar-orcamento').addEventListener('click', function () {
    var valor = Number(campoValor.value.replace(',', '.'));
    if (!isFinite(valor) || valor < 0) { campoValor.focus(); return; }
    D.guardarOrcamentoPersonalizado(categoriaAtual, { tipo: tipoAtual(), valor: valor });
    fecharEdicao();
    render();
  });

  PennyDB.todos().then(function (movimentos) {
    detalhesMes = PennyCalculos.calcularMes(movimentos, ano, mes);
    render();
    if (window.pwPronto) window.pwPronto(1)();
  });
});
