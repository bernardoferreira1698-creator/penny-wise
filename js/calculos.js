/* Penny Wise: fórmulas da secção "Cálculos" do prompt, a partir dos
   movimentos reais. Módulo puro (sem DOM): recebe sempre a lista de
   movimentos (de js/db.js) e devolve números prontos a mostrar. Todos
   os cálculos usam o mês de referência do movimento, não a data. */

(function () {
  function soma(lista) { return lista.reduce(function (s, m) { return s + Math.abs(m.valor); }, 0); }

  function mesReferenciaDe(ano, mes) { return ano + '-' + String(mes + 1).padStart(2, '0'); }

  /* Um pagamento repartido (repartirMeses > 1, ex.: Spotify anual)
     conta uma parcela em cada um dos meses seguintes ao mês de
     referência, não o valor todo de uma vez. Isto só afeta os
     cálculos: em Movimentos continua a aparecer o valor e a data
     reais (ver js/ecras/movimentos.js). */
  function expandirRepartidos(movimentos) {
    var expandido = [];
    movimentos.forEach(function (m) {
      var n = m.repartirMeses || 1;
      if (n <= 1) { expandido.push(m); return; }
      var partes = m.mesReferencia.split('-');
      var anoBase = Number(partes[0]), mesBase = Number(partes[1]) - 1;
      var sinal = m.valor < 0 ? -1 : 1;
      var totalAbs = Math.abs(m.valor);
      /* Parcela = diferença entre acumulados arredondados (em vez de
         arredondar sempre a mesma fração), para a soma das parcelas
         dar sempre o valor exato do pagamento, cêntimo a cêntimo (ex.:
         33,98 € ÷ 12 não perde 2 cêntimos ao longo do ano). */
      var acumuladoAnterior = 0;
      for (var i = 0; i < n; i++) {
        var acumuladoAtual = Math.round((totalAbs * (i + 1) / n) * 100) / 100;
        var parcela = Math.round((acumuladoAtual - acumuladoAnterior) * 100) / 100;
        acumuladoAnterior = acumuladoAtual;

        var total = mesBase + i;
        var anoAlvo = anoBase + Math.floor(total / 12);
        var mesAlvo = ((total % 12) + 12) % 12;
        expandido.push(Object.assign({}, m, { valor: parcela * sinal, mesReferencia: mesReferenciaDe(anoAlvo, mesAlvo) }));
      }
    });
    return expandido;
  }

  /* Indicadores de um mês (ver tabela "Por mês" do prompt). Movimentos
     incompletos (sem valor, ou com a categoria ainda por confirmar
     depois de uma importação — ver js/importar-excel.js) ficam de
     fora de todas as contas até seres tu a confirmá-los em Avisos,
     para nunca entrarem com um valor a mais nem com uma categoria que
     ainda não escolheste. */
  function calcularMes(movimentos, ano, mes) {
    var chave = mesReferenciaDe(ano, mes);
    var doMes = expandirRepartidos(movimentos).filter(function (m) { return m.mesReferencia === chave && !m.incompleto; });

    var rendimentos = doMes.filter(function (m) { return m.tipo === 'rendimento'; });
    var despesas = doMes.filter(function (m) { return m.tipo === 'despesa'; });
    var poupancas = doMes.filter(function (m) { return m.tipo === 'poupanca'; });

    var rendimento = soma(rendimentos);
    var despesasFixas = soma(despesas.filter(function (m) { return m.periodicidade === 'Fixa'; }));
    var despesasVariaveis = soma(despesas.filter(function (m) { return m.periodicidade === 'Variável'; }));
    var sobrou = rendimento - despesasFixas - despesasVariaveis;
    var inesperadas = soma(despesas.filter(function (m) { return m.inesperada; }));
    var poupadoDeFacto = soma(poupancas);

    var porCategoria = {};
    despesas.forEach(function (m) {
      porCategoria[m.categoria] = (porCategoria[m.categoria] || 0) + Math.abs(m.valor);
    });
    var categorias = Object.keys(porCategoria).map(function (nome) {
      var valor = porCategoria[nome];
      return { nome: nome, valor: valor, pct: rendimento ? valor / rendimento : 0 };
    }).sort(function (a, b) { return b.valor - a.valor; });

    return {
      ano: ano, mes: mes,
      rendimento: rendimento, despesasFixas: despesasFixas, despesasVariaveis: despesasVariaveis,
      sobrou: sobrou, pctPoupada: rendimento ? sobrou / rendimento : 0,
      categorias: categorias, inesperadas: inesperadas,
      poupadoDeFacto: poupadoDeFacto, porGuardar: sobrou - poupadoDeFacto,
      temDados: doMes.length > 0
    };
  }

  /* Uma categoria específica num mês, com o total repartido pelas
     subcategorias (ex.: Habitação -> Renda, Água, ...). Movimentos
     sem subcategoria (registados à mão, fora da importação) entram
     em "Outros". */
  function calcularCategoriaDoMes(movimentos, ano, mes, nomeCategoria) {
    var chave = mesReferenciaDe(ano, mes);
    var doMes = expandirRepartidos(movimentos).filter(function (m) {
      return m.tipo === 'despesa' && m.categoria === nomeCategoria && m.mesReferencia === chave;
    });

    var porSub = {};
    doMes.forEach(function (m) {
      var nome = m.subcategoria || 'Outros';
      porSub[nome] = (porSub[nome] || 0) + Math.abs(m.valor);
    });
    var subcategorias = Object.keys(porSub).map(function (nome) {
      return { nome: nome, valor: Math.round(porSub[nome] * 100) / 100 };
    }).sort(function (a, b) { return a.valor - b.valor; });

    return { ano: ano, mes: mes, total: soma(doMes), temDados: doMes.length > 0, subcategorias: subcategorias };
  }

  /* (atual − anterior) ÷ anterior; sem percentagem se o mês anterior
     for 0 (ver prompt). */
  function calcularVariacao(atual, anterior) {
    if (!anterior) return null;
    return (atual - anterior) / anterior;
  }

  /* Indicadores do ano (ver "Por ano" do prompt): todos os 12 meses,
     total, média mensal (só sobre os meses com movimentos), % poupada
     do ano, melhor e pior mês. */
  function calcularAno(movimentos, ano) {
    var porMes = [];
    for (var mes = 0; mes < 12; mes++) porMes.push(calcularMes(movimentos, ano, mes));

    var comDados = porMes.filter(function (m) { return m.temDados; });
    var total = comDados.reduce(function (s, m) { return s + m.sobrou; }, 0);
    var totalRendimento = comDados.reduce(function (s, m) { return s + m.rendimento; }, 0);
    var mediaMensal = comDados.length ? total / comDados.length : 0;
    var pctPoupadaAno = totalRendimento ? total / totalRendimento : 0;

    var melhorMes = comDados.reduce(function (m, atual) { return (!m || atual.sobrou > m.sobrou) ? atual : m; }, null);
    var piorMes = comDados.reduce(function (m, atual) { return (!m || atual.sobrou < m.sobrou) ? atual : m; }, null);

    return {
      ano: ano, porMes: porMes, total: total, totalRendimento: totalRendimento,
      mediaMensal: mediaMensal, pctPoupadaAno: pctPoupadaAno,
      melhorMes: melhorMes, piorMes: piorMes, mesesComDados: comDados.length
    };
  }

  window.PennyCalculos = {
    calcularMes: calcularMes, calcularAno: calcularAno, calcularVariacao: calcularVariacao,
    expandirRepartidos: expandirRepartidos, calcularCategoriaDoMes: calcularCategoriaDoMes
  };
})();
