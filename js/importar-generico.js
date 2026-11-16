/* Penny Wise: importação genérica de uma tabela (CSV ou Excel de uma
   só folha) vinda de outra app — ao contrário de js/importar-excel.js,
   que só entende o formato específico do Finanças_2026.xlsx (uma
   folha por mês). Módulo puro (sem DOM): recebe a folha já lida pelo
   SheetJS e um mapeamento de colunas escolhido pelo utilizador, e
   devolve os movimentos prontos a guardar.

   As categorias do ficheiro passam a ser as categorias da conta: uma
   que já exista (mesmo nome, sem distinguir acentos/maiúsculas) é
   reaproveitada; uma nova é criada (ver js/dados-mock.js:
   criarCategoria), nunca forçada a encaixar nalguma categoria já
   existente que não tenha mesmo a ver. */

(function () {
  function normalizar(texto) {
    return (texto || '').toString().trim().toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  var ALIASES = {
    data: ['data', 'date', 'dia'],
    descricao: ['descricao', 'nome', 'description', 'memo', 'detalhes', 'details', 'estabelecimento', 'descrição'],
    valorDespesa: ['despesa', 'valor', 'amount', 'debito', 'saida', 'montante', 'débito', 'saída'],
    valorRendimento: ['receita', 'rendimento', 'credito', 'income', 'entrada', 'crédito'],
    categoria: ['categoria', 'category']
  };

  function melhorColuna(cabecalhos, chave) {
    var aliases = ALIASES[chave];
    for (var i = 0; i < cabecalhos.length; i++) {
      if (aliases.indexOf(normalizar(cabecalhos[i])) >= 0) return i;
    }
    return null;
  }

  /* Primeira folha do ficheiro, ignorando linhas em branco ou que
     comecem por "#" (cabeçalhos/comentários de exportação, como os da
     Moneyboard: "#Despesas de...", "#Conta"...) até encontrar a linha
     de cabeçalhos a sério. */
  function detetar(wb) {
    var sheet = wb.Sheets[wb.SheetNames[0]];
    var linhas = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });

    function temConteudo(linha) {
      return linha.some(function (c) { return (c || '').toString().trim() !== ''; });
    }

    var indiceCabecalho = 0;
    for (var i = 0; i < linhas.length; i++) {
      var primeiraCelula = (linhas[i][0] || '').toString().trim();
      if (temConteudo(linhas[i]) && primeiraCelula.indexOf('#') !== 0) { indiceCabecalho = i; break; }
    }

    var cabecalhos = (linhas[indiceCabecalho] || []).map(function (c) { return (c || '').toString().trim(); });
    var linhasDados = linhas.slice(indiceCabecalho + 1).filter(temConteudo);

    return {
      cabecalhos: cabecalhos,
      linhasDados: linhasDados,
      sugestao: {
        data: melhorColuna(cabecalhos, 'data'),
        descricao: melhorColuna(cabecalhos, 'descricao'),
        valorDespesa: melhorColuna(cabecalhos, 'valorDespesa'),
        valorRendimento: melhorColuna(cabecalhos, 'valorRendimento'),
        categoria: melhorColuna(cabecalhos, 'categoria')
      }
    };
  }

  /* "0,6 €", "1.234,56 €", "-3,5", "150" -> 0.6, 1234.56, -3.5, 150
     (formato PT-PT: vírgula é a casa decimal, ponto é milhares). */
  function paraNumero(texto) {
    if (texto === null || texto === undefined || texto === '') return null;
    var limpo = String(texto).replace(/[^\d,.\-]/g, '');
    if (!limpo) return null;
    if (limpo.indexOf(',') > -1) limpo = limpo.replace(/\./g, '').replace(',', '.');
    var n = Number(limpo);
    return isFinite(n) ? n : null;
  }

  /* "16/11/26", "16/11/2026" ou "2026-11-16" -> Date. */
  function paraData(texto) {
    if (!texto) return null;
    var t = String(texto).trim();
    var partesBarra = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (partesBarra) {
      var ano = Number(partesBarra[3]);
      if (ano < 100) ano += 2000;
      var d = new Date(ano, Number(partesBarra[2]) - 1, Number(partesBarra[1]));
      return isNaN(d.getTime()) ? null : d;
    }
    var partesTraco = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (partesTraco) {
      var d2 = new Date(Number(partesTraco[1]), Number(partesTraco[2]) - 1, Number(partesTraco[3]));
      return isNaN(d2.getTime()) ? null : d2;
    }
    var d3 = new Date(t);
    return isNaN(d3.getTime()) ? null : d3;
  }

  function mesReferenciaDe(data) {
    return data.getFullYear() + '-' + String(data.getMonth() + 1).padStart(2, '0');
  }

  /* mapeamento: { data, descricao, valorDespesa, valorRendimento, categoria }
     — cada um é o índice da coluna, ou null quando não escolhida.
     categoriasConhecidas: { despesas: {nomeNormalizado: nomeReal}, rendimentos: {...} },
     a partir das categorias já existentes na conta (ver js/dados-mock.js). */
  function importar(linhasDados, mapeamento, categoriasConhecidas) {
    var movimentos = [];
    var paraRever = [];
    var novasCategorias = [];
    var categoriasJaMarcadas = {};

    function categoriaFinal(tipo, nomeOriginal) {
      if (!nomeOriginal) return tipo === 'despesa' ? 'Diversos' : 'Outros';
      var grupo = tipo === 'despesa' ? categoriasConhecidas.despesas : categoriasConhecidas.rendimentos;
      var chave = normalizar(nomeOriginal);
      if (grupo[chave]) return grupo[chave];
      var chaveMarcada = tipo + '|' + chave;
      if (!categoriasJaMarcadas[chaveMarcada]) {
        categoriasJaMarcadas[chaveMarcada] = true;
        novasCategorias.push({ tipo: tipo, nome: nomeOriginal.trim() });
      }
      return nomeOriginal.trim();
    }

    linhasDados.forEach(function (linha) {
      var data = mapeamento.data != null ? paraData(linha[mapeamento.data]) : null;
      var valorDespesaBruto = mapeamento.valorDespesa != null ? paraNumero(linha[mapeamento.valorDespesa]) : null;
      var valorRendimentoBruto = mapeamento.valorRendimento != null ? paraNumero(linha[mapeamento.valorRendimento]) : null;
      var categoriaBruta = mapeamento.categoria != null ? String(linha[mapeamento.categoria] || '').trim() : '';
      // Sem nome próprio (ex.: "Salário" na Moneyboard não tem "Nome"
      // preenchido, só a Categoria) -> usa a categoria como descrição,
      // em vez de perder a linha por falta de texto.
      var descricao = (mapeamento.descricao != null ? String(linha[mapeamento.descricao] || '').trim() : '') || categoriaBruta;

      var tipo, valor;
      if (valorRendimentoBruto) {
        // Colunas separadas (ex.: Moneyboard): esta linha tem valor na
        // coluna de rendimento, por isso é um rendimento.
        tipo = 'rendimento'; valor = Math.abs(valorRendimentoBruto);
      } else if (valorDespesaBruto !== null && valorDespesaBruto !== 0) {
        // Coluna única com sinal, ou coluna dedicada a despesas.
        tipo = valorDespesaBruto < 0 ? 'rendimento' : 'despesa';
        valor = Math.abs(valorDespesaBruto);
      } else {
        valor = null;
      }

      if (!data || !descricao || valor === null) {
        paraRever.push({ descricao: descricao, data: data, valor: valor });
        return;
      }

      var categoria = categoriaFinal(tipo, categoriaBruta);
      movimentos.push({
        data: data, mesReferencia: mesReferenciaDe(data), descricao: descricao,
        categoria: categoria, periodicidade: 'Variável',
        valor: tipo === 'rendimento' ? valor : -valor,
        tipo: tipo, inesperada: false, nota: '', incompleto: false
      });
    });

    return {
      movimentos: movimentos,
      paraRever: paraRever,
      novasCategorias: novasCategorias,
      total: Math.round(movimentos.reduce(function (s, m) { return s + m.valor; }, 0) * 100) / 100,
      generico: true
    };
  }

  window.PennyImportarGenerico = { detetar: detetar, importar: importar, normalizar: normalizar };
})();
