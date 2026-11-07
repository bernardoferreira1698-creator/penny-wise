/* Penny Wise: leitura do Financas_2026.xlsx (ou de um ficheiro no
   mesmo formato) e todas as correções da secção "Importação do
   Excel" do prompt. Módulo puro (sem DOM): recebe um ArrayBuffer e
   devolve os movimentos prontos a guardar, mais a lista do que não
   deu para importar e os totais para comparação.

   Nota: lê TODAS as linhas com dados de cada folha mensal, mesmo as
   que ficam fora do intervalo das fórmulas SUMIF da própria folha —
   o ficheiro de exemplo tem folhas (agosto, setembro) em que alguém
   foi acrescentando movimentos depois de construir as fórmulas, sem
   alargar o intervalo, e a app não deve herdar esse esquecimento. */

(function () {
  var NOMES_FOLHAS_MES = [
    '01 janeiro', '02 fevereiro', '03 março', '04 abril', '05 maio', '06 junho',
    '07 julho', '08 agosto', '09 setembro', '10 outubro', '11 novembro', '12 dezembro'
  ];

  var PERIODICIDADE_PADRAO_DESPESA = {
    'Habitação': 'Fixa', 'Serviços': 'Fixa', 'Supermercado': 'Variável', 'Restaurantes': 'Variável',
    'Transportes': 'Variável', 'Combustível': 'Variável', 'Portagens': 'Variável', 'Saídas à Noite': 'Variável',
    'Roupa': 'Variável', 'Saúde': 'Variável', 'Tabaco': 'Variável', 'Férias': 'Variável', 'Diversos': 'Variável'
  };

  function categoriaDespesaPorDescricao(desc) {
    var d = (desc || '').toLowerCase();
    if (d.indexOf('portagens') > -1) return 'Portagens';
    if (d.indexOf('parque') > -1) return 'Diversos';
    if (d.indexOf('uber') > -1) return 'Transportes';
    return 'Diversos';
  }

  function rendimentoPorDescricao(desc) {
    var d = (desc || '').toLowerCase();
    if (d.indexOf('ordenado') === 0) return { categoria: 'Ordenado', periodicidade: 'Fixa' };
    if (d.indexOf('subsídio') === 0 || d.indexOf('subsidio') === 0) return { categoria: 'Subsídio de alimentação', periodicidade: 'Fixa' };
    if (d.indexOf('cheques') === 0) return { categoria: 'Cheques combustível', periodicidade: 'Fixa' };
    if (d.indexOf('freelance') === 0) return { categoria: 'Freelance', periodicidade: 'Variável' };
    return { categoria: 'Outros', periodicidade: 'Variável' };
  }

  /* Avalia a fórmula de uma célula de Valor (ex.: "77.85-35-35") em
     vez de confiar no último resultado que o Excel tinha guardado —
     só aceita dígitos e operadores simples (+ - * / . parênteses);
     qualquer outra coisa é recusada, nunca executada. */
  function avaliarFormula(formula) {
    if (typeof formula !== 'string' || !/^[0-9+\-*/.() \s]+$/.test(formula)) return null;
    try {
      var resultado = Function('"use strict"; return (' + formula + ');')();
      return (typeof resultado === 'number' && isFinite(resultado)) ? resultado : null;
    } catch (e) { return null; }
  }

  /* O valor de cada movimento é sempre calculado pela app: se a
     célula tem fórmula, resolve-a aqui (ver avaliarFormula); só usa o
     valor já calculado que vinha no ficheiro como última hipótese, se
     a fórmula não for deste formato simples. Nunca confia em contas
     ou totais já feitos no Excel (ver nota no topo do ficheiro). */
  function obterValorCelula(celula) {
    if (!celula) return null;
    if (celula.f) {
      var calculado = avaliarFormula(celula.f);
      if (calculado !== null) return calculado;
    }
    return (typeof celula.v === 'number') ? celula.v : null;
  }

  function subcategoriaHabitacao(desc) {
    var d = (desc || '').toLowerCase();
    if (d.indexOf('renda') > -1) return 'Renda';
    if (d.indexOf('água') > -1 || d.indexOf('agua') > -1) return 'Água';
    if (d.indexOf('luz') > -1) return 'Eletricidade';
    if (d.indexOf('internet') > -1) return 'Internet';
    if (d.indexOf('limpeza') > -1 || d.indexOf('empregada') > -1) return 'Limpeza';
    return 'Outros';
  }

  /* Uma linha da folha (já com os valores das células) -> um
     movimento pronto a guardar, ou null se for para a lista de
     revisão (sem valor). */
  function processarLinha(mesReferencia, data, descricao, valorBruto, categoriaBruta, periodicidadeBruta, formula, correcoes) {
    var valor = Number(valorBruto);
    var categoria, tipo, periodicidade;

    if (!categoriaBruta) {
      categoria = categoriaDespesaPorDescricao(descricao);
      tipo = 'despesa';
      correcoes.semPeriodicidade.contagem++;
      correcoes.semPeriodicidade.total += Math.abs(valor);
    } else if (categoriaBruta === 'Rendimento') {
      tipo = 'rendimento';
      categoria = rendimentoPorDescricao(descricao).categoria;
    } else if (categoriaBruta === 'Nigh Out') {
      categoria = 'Saídas à Noite';
      tipo = 'despesa';
      correcoes.nighOut++;
    } else if (categoriaBruta === 'Férias') {
      // Nas folhas mensais a categoria já vem como Transportes; isto é
      // só uma rede de segurança caso apareça "Férias" numa delas.
      categoria = 'Transportes';
      tipo = 'despesa';
      correcoes.feriasTransportes += Math.abs(valor);
    } else {
      categoria = categoriaBruta;
      tipo = 'despesa';
    }

    if (!periodicidadeBruta) {
      if (tipo === 'rendimento') {
        periodicidade = rendimentoPorDescricao(descricao).periodicidade;
      } else {
        periodicidade = PERIODICIDADE_PADRAO_DESPESA[categoria] || 'Variável';
      }
    } else {
      periodicidade = periodicidadeBruta;
    }

    var subcategoria = categoria === 'Habitação' ? subcategoriaHabitacao(descricao) : undefined;
    var ehSpotifyAnual = /spotify/i.test(descricao) && /anual/i.test(descricao);
    if (ehSpotifyAnual) correcoes.spotify = { descricao: descricao, valor: Math.abs(valor), parcela: Math.round((Math.abs(valor) / 12) * 100) / 100 };

    return {
      data: data, mesReferencia: mesReferencia, descricao: descricao, categoria: categoria,
      subcategoria: subcategoria, periodicidade: periodicidade,
      valor: tipo === 'rendimento' ? Math.abs(valor) : -Math.abs(valor),
      tipo: tipo, inesperada: false,
      nota: formula || '',
      repartirMeses: ehSpotifyAnual ? 12 : 1
    };
  }

  /* O ano de cada folha não vem escrito em lado nenhum (só "01
     janeiro" a "12 dezembro") — infere-se pela data mais frequente
     entre os movimentos dessa folha, para o ficheiro poder ser de
     qualquer ano (este ano, ou um ficheiro antigo). A data isolada do
     "ordenado de fim de mês anterior" (ex.: 29 de dezembro numa folha
     de janeiro) fica sempre em minoria, por isso não baralha a conta. */
  function inferirAnoDaFolha(sheet, intervalo, anoPorOmissao) {
    var contagem = {};
    for (var r = 4; r <= intervalo.e.r + 1; r++) {
      var celula = sheet['B' + r];
      if (celula && celula.v instanceof Date) {
        var ano = celula.v.getFullYear();
        contagem[ano] = (contagem[ano] || 0) + 1;
      }
    }
    var melhorAno = null, melhorContagem = 0;
    Object.keys(contagem).forEach(function (anoTexto) {
      if (contagem[anoTexto] > melhorContagem) { melhorContagem = contagem[anoTexto]; melhorAno = Number(anoTexto); }
    });
    return melhorAno || anoPorOmissao;
  }

  /* O único caso de data "fora do mês da folha" que atravessa uma
     virada de ano é o ordenado de fim de dezembro, numa folha de
     janeiro — e o ficheiro guarda-o com o mesmo ano da folha (em vez
     do ano anterior), o que o fazia parecer no futuro (e aparecer no
     topo de "Últimos movimentos") em vez de no passado. Só se corrige
     este caso; qualquer outro mês diferente do da folha (ex.: um
     pagamento a cair já no mês seguinte) fica com a data tal como
     vem no ficheiro. */
  function corrigirDataDoMovimento(dataBruta, indiceMes, anoFolha) {
    if (!dataBruta) return new Date(anoFolha, indiceMes, 1);
    var mes = dataBruta.getMonth(), dia = dataBruta.getDate(), ano = dataBruta.getFullYear();
    if (indiceMes === 0 && mes === 11 && ano === anoFolha) ano = anoFolha - 1;
    return new Date(ano, mes, dia);
  }

  function importar(arrayBuffer) {
    var anoPorOmissao = new Date().getFullYear();
    var wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });

    var correcoes = { nighOut: 0, feriasTransportes: 0, semPeriodicidade: { contagem: 0, total: 0 }, spotify: null };
    var movimentos = [];
    var paraRever = [];
    var mesesImportados = []; // chaves "AAAA-MM" das folhas que tinham dados a sério
    var sobrouExcelPorMes = {};

    NOMES_FOLHAS_MES.forEach(function (nomeFolha, indiceMes) {
      var sheet = wb.Sheets[nomeFolha];
      if (!sheet || !sheet['!ref']) return;
      var intervalo = XLSX.utils.decode_range(sheet['!ref']);
      var ano = inferirAnoDaFolha(sheet, intervalo, anoPorOmissao);
      var mesReferencia = ano + '-' + String(indiceMes + 1).padStart(2, '0');
      var tinhaLinhas = false;
      var rendimentoExcel = 0, despesasExcel = 0;

      for (var r = 4; r <= intervalo.e.r + 1; r++) {
        var cB = sheet['B' + r], cC = sheet['C' + r], cD = sheet['D' + r], cE = sheet['E' + r], cF = sheet['F' + r];
        if (!cC && !cD) continue;
        tinhaLinhas = true;

        var descricao = cC ? String(cC.v) : '';
        var data = corrigirDataDoMovimento((cB && cB.v instanceof Date) ? cB.v : null, indiceMes, ano);
        var valorBruto = obterValorCelula(cD);
        var categoriaBruta = cE ? cE.v : null;
        var periodicidadeBruta = cF ? cF.v : null;

        if (valorBruto === null) {
          /* Sem valor, não dá para importar o movimento — mas guarda-se
             na mesma a categoria/periodicidade já conhecidas (quando
             existem), para o ecrã Avisos poder abrir isto já com a
             categoria do Excel escolhida, faltando só o utilizador
             preencher o valor. */
          var categoriaRevisao = categoriaBruta
            ? (categoriaBruta === 'Nigh Out' ? 'Saídas à Noite' : categoriaBruta)
            : categoriaDespesaPorDescricao(descricao);
          var periodicidadeRevisao = periodicidadeBruta || PERIODICIDADE_PADRAO_DESPESA[categoriaRevisao] || 'Variável';
          paraRever.push({
            folha: nomeFolha, descricao: descricao, data: data, mesReferencia: mesReferencia,
            categoria: categoriaRevisao, periodicidade: periodicidadeRevisao
          });
          continue;
        }

        var formula = cD.f || null;

        /* Para comparar com "o que o Excel contava", sem confiar em
           nenhuma conta já feita no ficheiro: reproduz aqui, só a
           partir destas células em bruto, a mesma regra que as
           fórmulas SUMIF da folha usavam (categoria e periodicidade
           já preenchidas). */
        var contavaNoExcel = !!categoriaBruta && (categoriaBruta === 'Rendimento' || !!periodicidadeBruta);
        if (contavaNoExcel) {
          if (categoriaBruta === 'Rendimento') rendimentoExcel += Math.abs(valorBruto);
          else despesasExcel += Math.abs(valorBruto);
        }

        movimentos.push(processarLinha(mesReferencia, data, descricao, valorBruto, categoriaBruta, periodicidadeBruta, formula, correcoes));
      }
      if (tinhaLinhas) {
        mesesImportados.push({ ano: ano, mes: indiceMes });
        sobrouExcelPorMes[mesReferencia] = rendimentoExcel - despesasExcel;
      }
    });

    var totalExcel = mesesImportados.reduce(function (s, m) {
      return s + sobrouExcelPorMes[m.ano + '-' + String(m.mes + 1).padStart(2, '0')];
    }, 0);

    /* O total "Penny Wise" cobre só os meses que o ficheiro trazia a
       sério (ex.: janeiro a outubro), não o ano inteiro — mesmo que o
       Spotify repartido deixe um eco de despesa nos meses seguintes
       (ver js/calculos.js), esse eco não é "um mês com movimentos". */
    var totalPennyWise = mesesImportados.reduce(function (soma, m) {
      return soma + window.PennyCalculos.calcularMes(movimentos, m.ano, m.mes).sobrou;
    }, 0);

    return {
      movimentos: movimentos,
      paraRever: paraRever,
      correcoes: correcoes,
      totalExcel: Math.round(totalExcel * 100) / 100,
      totalPennyWise: Math.round(totalPennyWise * 100) / 100
    };
  }

  window.PennyImportarExcel = { importar: importar };
})();
