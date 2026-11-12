/* Ecrã Resumos mensais: os 4 números do mês (sempre um mês já
   fechado, nunca o atual) e 2 a 3 dicas, com uma frase concreta com
   os valores reais do utilizador. Navegação limitada entre o
   primeiro mês com movimentos e o último mês já fechado. */

document.addEventListener('DOMContentLoaded', function () {
  var D = window.PennyDados;
  var TODOS_MOVIMENTOS = [];
  var TODAS_DICAS = [];

  function mesAnteriorDe(ano, mes) {
    var total = ano * 12 + mes - 1;
    return { ano: Math.floor(total / 12), mes: ((total % 12) + 12) % 12 };
  }

  /* Categoria Variável (com orçamento definido) que mais subiu face
     ao mês anterior: despesas Fixas como Habitação ou Serviços não
     são o que esta secção quer destacar. As categorias de calcularMes
     não trazem periodicidade (são só nome/valor/pct), por isso
     cruza-se com a lista de categorias para saber quais são
     Variáveis. */
  function maiorSubida(ano, mes) {
    var atual = PennyCalculos.calcularMes(TODOS_MOVIMENTOS, ano, mes);
    if (!atual.temDados || !atual.categorias.length) return null;
    var periodicidadePorNome = {};
    D.categoriasDespesa().forEach(function (c) { periodicidadePorNome[c.nome] = c.periodicidade; });
    var candidatas = atual.categorias.filter(function (c) {
      return periodicidadePorNome[c.nome] === 'Variável' && D.ORCAMENTOS_SUGERIDOS[c.nome];
    });
    if (!candidatas.length) return null;
    var mesAntes = mesAnteriorDe(ano, mes);
    var anterior = PennyCalculos.calcularMes(TODOS_MOVIMENTOS, mesAntes.ano, mesAntes.mes);
    if (!anterior.temDados) return candidatas[0];
    var mapaAnterior = {};
    anterior.categorias.forEach(function (c) { mapaAnterior[c.nome] = c.valor; });
    var melhorCategoria = null, melhorSubida = -Infinity;
    candidatas.forEach(function (c) {
      var antes = mapaAnterior[c.nome] || 0;
      var subida = c.valor - antes;
      if (subida > melhorSubida) { melhorSubida = subida; melhorCategoria = c; }
    });
    return melhorCategoria;
  }

  function render(s) {
    var detalhes = PennyCalculos.calcularMes(TODOS_MOVIMENTOS, s.ano, s.mes);
    var nomeMes = D.MESES[s.mes].charAt(0).toUpperCase() + D.MESES[s.mes].slice(1);
    var proximoMes = D.MESES[(s.mes + 1) % 12];

    document.getElementById('rotulo-proximo-mes').textContent = 'Para ' + proximoMes;

    if (!detalhes.temDados) {
      document.getElementById('frase-resumo').innerHTML = '<span class="muted">' + nomeMes + ' ainda não tem resumo.</span>';
      document.getElementById('grelha-resumo').innerHTML = '';
      document.getElementById('dicas-resumo').innerHTML = '';
      return;
    }

    document.getElementById('frase-resumo').innerHTML =
      '<span class="muted">' + nomeMes + ' fechou</span><br><span class="muted">com</span> ' + PennyMoeda.formatar(detalhes.sobrou) + '<br><span class="muted">de margem.</span>';

    var subida = maiorSubida(s.ano, s.mes);
    document.getElementById('grelha-resumo').innerHTML =
      '<div class="stat-pill"><span class="stat-pill__label">Rendimento</span><span class="stat-pill__value">' + PennyMoeda.formatar(detalhes.rendimento) + '</span></div>' +
      '<div class="stat-pill"><span class="stat-pill__label">Despesas</span><span class="stat-pill__value">' + PennyMoeda.formatar(detalhes.despesasFixas + detalhes.despesasVariaveis) + '</span></div>' +
      '<div class="stat-pill"><span class="stat-pill__label">Poupado</span><span class="stat-pill__value warn-text">' + PennyMoeda.arredondarPct(detalhes.pctPoupada) + '%</span></div>' +
      '<div class="stat-pill"><span class="stat-pill__label">Maior subida</span><span class="stat-pill__value warn-text">' + (subida ? subida.nome : '—') + '</span></div>';

    /* Frase concreta com os valores reais do utilizador (ver prompt:
       "transfere 156 €, 10% do rendimento"), seguida de 2 dicas
       escolhidas pelos gatilhos reais deste mês. */
    var transferencia = Math.round(detalhes.rendimento * 0.1);
    var calculo = PennyDicas.calcularGatilhos(TODOS_MOVIMENTOS, s.ano, s.mes);
    var escolhidas = PennyDicas.escolherParaTi(TODAS_DICAS, calculo, 2);

    var cartoes =
      '<div class="card-light" style="margin-bottom:10px">' +
      '  <span class="card-light__blob" style="right:-60px; bottom:-90px"></span>' +
      '  <span class="card-light__eyebrow">Pagar-te primeiro</span>' +
      '  <span class="card-light__text"><span class="dim">No dia em que recebes,</span> transfere ' + PennyMoeda.formatar(transferencia) + ' <span class="dim">(10% do rendimento) antes de gastar o resto.</span></span>' +
      '</div>';

    escolhidas.forEach(function (item) {
      var byline = item.dica.autor + (item.dica.livro ? (' · ' + item.dica.livro) : '');
      cartoes +=
        '<div class="glass" style="padding:18px 20px; display:flex; flex-direction:column; gap:8px; margin-bottom:10px">' +
        '  <span class="muted" style="font-size:12px">' + byline + '</span>' +
        '  <span style="font-size:18px; line-height:1.22; font-weight:500">' + item.dica.texto + '</span>' +
        '</div>';
    });

    document.getElementById('dicas-resumo').innerHTML = cartoes;
  }

  Promise.all([PennyDB.todos(), PennyDicas.carregar(), PennyDB.primeiroMesComDados()]).then(function (resultados) {
    TODOS_MOVIMENTOS = resultados[0];
    TODAS_DICAS = resultados[1];

    var hoje = D.hoje();
    var limiteRecente = mesAnteriorDe(hoje.getFullYear(), hoje.getMonth()); // o resumo é sempre de um mês já fechado

    /* Marca este resumo (o mais recente disponível) como visto, para
       a bolinha de aviso em Mais desaparecer — só volta a aparecer
       quando passar a existir um resumo mais recente do que este. */
    localStorage.setItem('pw_resumo_visto', limiteRecente.ano + '-' + String(limiteRecente.mes + 1).padStart(2, '0'));

    var limiteAntigo = resultados[2] || limiteRecente;
    if (limiteAntigo.ano * 12 + limiteAntigo.mes > limiteRecente.ano * 12 + limiteRecente.mes) limiteAntigo = limiteRecente;

    var controlador = PennyMesNav.criar({
      anoInicial: limiteRecente.ano,
      mesInicial: limiteRecente.mes,
      limiteAntigo: limiteAntigo,
      limiteRecente: limiteRecente,
      aoMudar: render
    });

    PennyMesNav.ligarBotoes(controlador, {
      anterior: document.getElementById('mes-anterior'),
      seguinte: document.getElementById('mes-seguinte'),
      rotulo: document.getElementById('mes-titulo')
    });

    render(controlador.estado());
    if (window.pwPronto) window.pwPronto(1)();
  });
});
