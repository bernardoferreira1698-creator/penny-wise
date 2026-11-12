/* Ecrã Início: mês atual real, últimos 5 movimentos, resumo de
   orçamentos e guardar a dica do dia. Usa os dados de exemplo de
   js/dados-mock.js (substituídos por dados reais a partir da Fase 3/4). */

document.addEventListener('DOMContentLoaded', function () {
  var D = window.PennyDados;
  var MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

  var hoje = D.hoje();
  document.getElementById('mes-atual').textContent = D.mesAnoLabel(hoje.getFullYear(), hoje.getMonth());
  var pronto = window.pwPronto ? window.pwPronto(2) : function () {};

  /* Cabeçalho ("Este mês sobraram X€", rendimento/despesas, % e
     variação), calculado a partir dos movimentos reais. Também chamada
     depois de gravar/apagar um movimento no popup de Registo (ver
     window.PennyAoRegistar, no fundo do ficheiro), por isso limpa
     sempre os contentores antes de os voltar a preencher. */
  function recarregarCabecalhoEOrcamentos() {
    return PennyDB.todos().then(function (movimentos) {
    document.getElementById('resumo-orcamentos').innerHTML = '';
    var atual = PennyCalculos.calcularMes(movimentos, hoje.getFullYear(), hoje.getMonth());
    var dataAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    var anterior = PennyCalculos.calcularMes(movimentos, dataAnterior.getFullYear(), dataAnterior.getMonth());

    document.getElementById('valor-sobra').textContent = PennyMoeda.formatar(atual.sobrou);
    document.getElementById('valor-rendimento').textContent = PennyMoeda.formatar(atual.rendimento);
    document.getElementById('valor-despesas').textContent = PennyMoeda.formatar(atual.despesasFixas + atual.despesasVariaveis);
    document.getElementById('chip-percentagem').textContent = PennyMoeda.arredondarPct(atual.pctPoupada) + '% do rendimento';

    var variacao = PennyCalculos.calcularVariacao(atual.sobrou, anterior.sobrou);
    var chipVariacao = document.getElementById('chip-variacao');
    if (variacao === null) {
      chipVariacao.hidden = true;
    } else if (anterior.sobrou < 0) {
      /* "Percentagem de variação" não tem leitura sensata quando se
         parte de um mês com défice (dividir por um valor negativo
         inverte o sinal, dando algo como "-2094%" para uma melhoria
         real): mostra-se antes a diferença em euros. */
      var diferenca = atual.sobrou - anterior.sobrou;
      chipVariacao.textContent = (diferenca < 0 ? '−' : '+') + PennyMoeda.formatar(Math.abs(diferenca)) + ' vs ' + D.MESES[dataAnterior.getMonth()];
    } else {
      var pctVariacao = PennyMoeda.arredondarPct(Math.abs(variacao));
      chipVariacao.textContent = (variacao < 0 ? '−' : '+') + pctVariacao + '% vs ' + D.MESES[dataAnterior.getMonth()];
    }

    /* Resumo de orçamentos: as categorias mais perto (ou acima) do
       limite, a partir das despesas reais deste mês (não aparece
       nada para uma categoria sem despesas este mês). */
    var container = document.getElementById('resumo-orcamentos');
    var categoriasOrcamento = atual.categorias.map(function (c) {
      var orcamento = D.valorOrcamento(c.nome, atual.rendimento);
      return { nome: c.nome, gasto: c.valor, orcamento: orcamento, pct: orcamento ? c.valor / orcamento : 0 };
    }).filter(function (c) { return c.orcamento > 0; })
      .sort(function (a, b) { return b.pct - a.pct; }).slice(0, 4);

    if (!categoriasOrcamento.length) {
      var vazioOrcamentos = document.createElement('p');
      vazioOrcamentos.className = 'muted';
      vazioOrcamentos.style.cssText = 'text-align:center; padding:12px 0; font-size:14px';
      vazioOrcamentos.textContent = 'Ainda não há despesas este mês.';
      container.appendChild(vazioOrcamentos);
      pronto();
      return;
    }

    categoriasOrcamento.forEach(function (c) {
      var acimaDoLimite = c.pct >= 1;
      var linha = document.createElement('div');
      linha.className = 'cat-item';
      linha.innerHTML =
        '<div class="cat-item__linha"><span>' + c.nome + '</span>' +
        '<span>' + PennyMoeda.formatar(c.gasto) + ' <span class="muted2" style="font-size:12px">de ' + PennyMoeda.formatar(c.orcamento) + '</span></span></div>' +
        '<div class="bar-track"><div class="' + (acimaDoLimite ? 'bar-fill' : 'bar-fill bar-fill--ok') + '" style="width:0%" data-largura="' + PennyMoeda.larguraBarra(c.pct) + '"></div></div>' +
        (acimaDoLimite ? '<span class="warn-text" style="font-size:12px">' + PennyMoeda.arredondarPct(c.pct) + '% · acima do limite</span>' : '<span class="muted2" style="font-size:12px">' + PennyMoeda.arredondarPct(c.pct) + '%</span>');
      container.appendChild(linha);
    });
    PennyMoeda.animarBarras(container);
    pronto();
    });
  }
  recarregarCabecalhoEOrcamentos();

  /* Últimos movimentos (5 mais recentes). Também chamada a partir de
     window.PennyAoRegistar — limpa a lista antes de a preencher. */
  var listaMovimentos = document.getElementById('lista-ultimos-movimentos');
  function recarregarUltimosMovimentos() {
    return PennyDB.ultimosMovimentos(5).then(function (lista) {
    listaMovimentos.innerHTML = '';
    if (!lista.length) {
      var vazio = document.createElement('p');
      vazio.className = 'muted';
      vazio.style.cssText = 'text-align:center; padding:12px 0; font-size:14px';
      vazio.textContent = 'Ainda não há movimentos registados.';
      listaMovimentos.appendChild(vazio);
      pronto();
      return;
    }
    lista.forEach(function (m) {
      var linha = document.createElement('div');
      linha.className = 'mov-linha';
      var rotuloData = m.data.getDate() + ' ' + MESES_ABREV[m.data.getMonth()];
      var categoriaRotulo = m.incompleto ? 'Por confirmar' : m.categoria;
      linha.innerHTML =
        '<div class="mov-linha__nome"><span>' + m.descricao + '</span><span>' + categoriaRotulo + ' · ' + rotuloData + '</span></div>' +
        '<span class="mov-linha__valor">' + PennyMoeda.formatar(m.valor) + '</span>';
      listaMovimentos.appendChild(linha);
    });
    pronto();
    });
  }
  recarregarUltimosMovimentos();

  window.PennyAoRegistar = function () {
    recarregarCabecalhoEOrcamentos();
    recarregarUltimosMovimentos();
  };

  /* Dica do dia: muda uma vez por dia, não repete em 30 dias, segue a
     mesma ordem de prioridade de gatilhos do ecrã Dicas. */
  var cartaoDica = document.getElementById('cartao-dica-dia');
  var btnGuardar = document.getElementById('btn-guardar-dica-dia');
  var idDica = null;

  function pintarBotao() {
    var guardada = idDica && PennyDicas.estaGuardada(idDica);
    var svg = btnGuardar.querySelector('svg');
    svg.setAttribute('fill', guardada ? 'var(--dot)' : 'none');
    svg.setAttribute('stroke', guardada ? 'var(--dot)' : 'var(--card-muted2)');
  }
  btnGuardar.addEventListener('click', function (evento) {
    evento.preventDefault();
    if (!idDica) return;
    PennyDicas.alternarGuardada(idDica);
    pintarBotao();
  });

  Promise.all([PennyDB.todos(), PennyDicas.carregar()]).then(function (resultados) {
    var movimentos = resultados[0], dicas = resultados[1];
    var calculo = PennyDicas.calcularGatilhos(movimentos, hoje.getFullYear(), hoje.getMonth());
    var escolha = PennyDicas.escolherDicaDoDia(dicas, calculo);
    if (!escolha) return;

    idDica = escolha.dica.id;
    document.getElementById('texto-dica-dia').textContent = escolha.dica.texto;
    var byline = escolha.dica.autor + (escolha.dica.livro ? (' · ' + escolha.dica.livro) : '');
    document.getElementById('byline-dica-dia').textContent = byline;
    cartaoDica.hidden = false;
    pintarBotao();
  });
});
