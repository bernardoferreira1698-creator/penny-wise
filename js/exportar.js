/* Penny Wise: cópia de segurança de todos os movimentos, para Excel
   (.xlsx, via SheetJS) ou CSV. Valores em bruto (sem símbolo de euro
   nem formatação), para o ficheiro poder ser lido por outro programa
   ou reimportado mais tarde. */

(function () {
  var COLUNAS = [
    'Data', 'Tipo', 'Descrição', 'Valor', 'Categoria', 'Subcategoria',
    'Periodicidade', 'Inesperada', 'Repartir meses', 'Nota', 'Mês de referência'
  ];

  var TIPO_LABEL = { despesa: 'Despesa', rendimento: 'Rendimento', poupanca: 'Poupança' };

  function dataISO(data) {
    return data.getFullYear() + '-' + String(data.getMonth() + 1).padStart(2, '0') + '-' + String(data.getDate()).padStart(2, '0');
  }

  function linhaDoMovimento(m) {
    return {
      'Data': dataISO(m.data),
      'Tipo': TIPO_LABEL[m.tipo] || m.tipo,
      'Descrição': m.descricao,
      'Valor': m.valor,
      'Categoria': m.categoria || '',
      'Subcategoria': m.subcategoria || '',
      'Periodicidade': m.periodicidade || '',
      'Inesperada': m.inesperada ? 'Sim' : 'Não',
      'Repartir meses': m.repartirMeses || 1,
      'Nota': m.nota || '',
      'Mês de referência': m.mesReferencia
    };
  }

  function movimentosOrdenados(movimentos) {
    return movimentos.slice().sort(function (a, b) { return a.data - b.data; });
  }

  function nomeFicheiro(extensao) {
    var hoje = new Date();
    return 'penny-wise-' + dataISO(hoje) + '.' + extensao;
  }

  function descarregar(blob, nome) {
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = nome;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function exportarXlsx(movimentos) {
    var linhas = movimentosOrdenados(movimentos).map(linhaDoMovimento);
    var folha = XLSX.utils.json_to_sheet(linhas, { header: COLUNAS });
    var livro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(livro, folha, 'Movimentos');
    XLSX.writeFile(livro, nomeFicheiro('xlsx'));
  }

  /* Campo CSV: entre aspas sempre que tiver vírgulas, aspas ou
     quebras de linha, com as aspas internas duplicadas. */
  function campoCsv(valor) {
    var texto = valor === null || valor === undefined ? '' : String(valor);
    if (/[",\n]/.test(texto)) texto = '"' + texto.replace(/"/g, '""') + '"';
    return texto;
  }

  function exportarCsv(movimentos) {
    var linhas = movimentosOrdenados(movimentos).map(linhaDoMovimento);
    var texto = COLUNAS.map(campoCsv).join(',') + '\n' +
      linhas.map(function (linha) { return COLUNAS.map(function (c) { return campoCsv(linha[c]); }).join(','); }).join('\n');
    // BOM no início, para o Excel em português abrir os acentos bem.
    var blob = new Blob(['﻿' + texto], { type: 'text/csv;charset=utf-8;' });
    descarregar(blob, nomeFicheiro('csv'));
  }

  window.PennyExportar = { exportarXlsx: exportarXlsx, exportarCsv: exportarCsv };
})();
