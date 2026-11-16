/* Ecrã Importar Excel: escolher o ficheiro, mostrar as correções e os
   dois totais, e guardar tudo (js/db.js) ao confirmar. */

document.addEventListener('DOMContentLoaded', function () {
  var resultado = null;
  var deteccaoGenerica = null; // colunas detetadas, à espera de confirmação (ver iniciarMapeamentoGenerico)

  var campoFicheiro = document.getElementById('campo-ficheiro');
  var botaoEscolher = document.getElementById('botao-escolher-ficheiro');
  var botaoImportar = document.getElementById('botao-importar');
  var erro = document.getElementById('erro-importacao');
  var nomeFicheiroEl = document.getElementById('nome-ficheiro');
  var resumoFicheiroEl = document.getElementById('resumo-ficheiro');
  var botaoComecarDoZero = document.getElementById('botao-comecar-do-zero');
  var blocoMapeamento = document.getElementById('bloco-mapeamento');
  var blocoResultadoGenerico = document.getElementById('bloco-resultado-generico');

  /* Quem está a começar a gerir as finanças pela primeira vez não tem
     nenhum Excel para importar — não deve ser obrigado a arranjar um
     só para poder usar a app. */
  if (botaoComecarDoZero) {
    botaoComecarDoZero.addEventListener('click', function () {
      window.location.href = 'inicio.html';
    });
  }

  function mostrarErro(mensagem) {
    nomeFicheiroEl.textContent = 'Escolher ficheiro';
    resumoFicheiroEl.textContent = 'Financas_2026.xlsx, ou um .csv/.xlsx de outra app';
    erro.textContent = mensagem;
    erro.hidden = false;
    document.getElementById('bloco-resultado').hidden = true;
    blocoResultadoGenerico.hidden = true;
    blocoMapeamento.hidden = true;
    botaoImportar.disabled = true;
    botaoImportar.textContent = 'Escolhe um ficheiro primeiro';
  }

  function linhaCorrecao(container, titulo, sub, icone) {
    var div = document.createElement('div');
    div.className = 'correcao';
    var svg = icone === 'aviso'
      ? '<svg class="correcao__check warn-text" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 9v4 M12 17h.01 M10.3 3.9L2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>'
      : '<svg class="correcao__check" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';
    div.innerHTML = svg +
      '<div class="correcao__texto"><span class="correcao__titulo">' + titulo + '</span>' +
      (sub ? '<span class="correcao__sub">' + sub + '</span>' : '') + '</div>';
    container.appendChild(div);
    return div;
  }

  /* Correções que são uma adivinhação (categoria), não uma certeza
     (ao contrário da correção de "Nigh Out", que é só um erro
     ortográfico, ou da repartição do Spotify, que é só uma conta):
     deixam o utilizador escolher, por correção, entre aceitar ou
     rejeitar. Rejeitar marca essas despesas como incompletas (ver
     js/importar-excel.js: aplicarCorrecao) para irem para Avisos em
     vez de ficarem com uma categoria que pode estar errada. */
  function linhaCorrecaoOpcional(container, itens, tituloAceite, subAceite, tituloRejeitado, subRejeitado) {
    var div = linhaCorrecao(container, tituloAceite, subAceite);
    div.classList.add('correcao--opcional');

    var opcoes = document.createElement('div');
    opcoes.className = 'correcao__opcoes';
    opcoes.innerHTML =
      '<button type="button" class="is-active" data-valor="aceitar">Aceitar</button>' +
      '<button type="button" data-valor="rejeitar">Rejeitar</button>';
    div.appendChild(opcoes);

    var titulo = div.querySelector('.correcao__titulo');
    var sub = div.querySelector('.correcao__sub');

    opcoes.addEventListener('click', function (evento) {
      var botao = evento.target.closest('button');
      if (!botao) return;
      var aceitar = botao.getAttribute('data-valor') === 'aceitar';
      opcoes.querySelectorAll('button').forEach(function (b) { b.classList.toggle('is-active', b === botao); });

      PennyImportarExcel.aplicarCorrecao(itens, aceitar);
      titulo.textContent = aceitar ? tituloAceite : tituloRejeitado;
      if (sub) sub.textContent = aceitar ? subAceite : subRejeitado;

      if (resultado && resultado.mesesImportados) {
        resultado.totalPennyWise = PennyImportarExcel.recalcularTotalPennyWise(resultado.movimentos, resultado.mesesImportados);
        document.getElementById('total-pw').textContent = PennyMoeda.formatar(resultado.totalPennyWise);
      }
    });
  }

  function mostrarResultado(nomeFicheiro, r) {
    erro.hidden = true;
    nomeFicheiroEl.textContent = nomeFicheiro;
    resumoFicheiroEl.textContent = r.movimentos.length + ' movimentos a importar';

    var lista = document.getElementById('lista-correcoes');
    lista.innerHTML = '';
    if (r.correcoes.feriasTransportes.contagem > 0) {
      linhaCorrecaoOpcional(lista, r.correcoes.feriasTransportes.itens,
        PennyMoeda.formatar(r.correcoes.feriasTransportes.total) + ' marcados como Férias passam para Transportes', null,
        r.correcoes.feriasTransportes.contagem + (r.correcoes.feriasTransportes.contagem === 1 ? ' despesa marcada como Férias vai para Avisos' : ' despesas marcadas como Férias vão para Avisos'),
        'Para escolheres a categoria certa de cada uma');
    }
    if (r.correcoes.nighOut > 0) {
      linhaCorrecao(lista, '"Nigh Out" passa a "Saídas à Noite"');
    }
    if (r.correcoes.semPeriodicidade.contagem > 0) {
      linhaCorrecaoOpcional(lista, r.correcoes.semPeriodicidade.itens,
        r.correcoes.semPeriodicidade.contagem + ' movimentos sem categoria ou periodicidade passam a contar',
        PennyMoeda.formatar(r.correcoes.semPeriodicidade.total) + ' que o Excel não somava',
        r.correcoes.semPeriodicidade.contagem + (r.correcoes.semPeriodicidade.contagem === 1 ? ' movimento sem categoria vai para Avisos' : ' movimentos sem categoria vão para Avisos'),
        'Para escolheres a categoria certa de cada um');
    }
    if (r.correcoes.spotify) {
      linhaCorrecao(lista, 'Spotify anual repartido por 12 meses',
        PennyMoeda.formatar(r.correcoes.spotify.valor) + ' · ' + PennyMoeda.formatar(r.correcoes.spotify.parcela) + ' por mês');
    }

    var blocoRevisao = document.getElementById('bloco-revisao');
    var listaRevisao = document.getElementById('lista-revisao');
    listaRevisao.innerHTML = '';
    if (r.paraRever.length) {
      r.paraRever.forEach(function (item) {
        linhaCorrecao(listaRevisao, item.descricao, item.folha.replace(/^\d+\s/, '') + ' · sem valor no ficheiro, vai para Avisos', 'aviso');
      });
      blocoRevisao.hidden = false;
    } else {
      blocoRevisao.hidden = true;
    }

    document.getElementById('total-excel').textContent = PennyMoeda.formatar(r.totalExcel);
    document.getElementById('total-pw').textContent = PennyMoeda.formatar(r.totalPennyWise);
    document.getElementById('bloco-resultado').hidden = false;

    botaoImportar.disabled = false;
    botaoImportar.textContent = 'Importar e começar';
  }

  botaoEscolher.addEventListener('click', function () { campoFicheiro.click(); });

  /* Um ficheiro só: se tiver alguma das folhas "01 janeiro" a "12
     dezembro", é o formato específico do Finanças_2026.xlsx (ver
     js/importar-excel.js); senão, é uma tabela qualquer de outra app
     (CSV ou Excel de uma folha só), e segue o importador genérico
     (ver js/importar-generico.js). Um botão só, a app decide sozinha. */
  campoFicheiro.addEventListener('change', function () {
    var ficheiro = campoFicheiro.files[0];
    if (!ficheiro) return;

    erro.hidden = true;
    nomeFicheiroEl.textContent = 'A processar...';
    resumoFicheiroEl.textContent = ficheiro.name;
    document.getElementById('bloco-resultado').hidden = true;
    blocoResultadoGenerico.hidden = true;
    blocoMapeamento.hidden = true;
    botaoImportar.disabled = true;
    botaoImportar.textContent = 'A processar...';

    /* Um .csv é texto simples (normalmente em UTF-8) — lê-lo como
       ArrayBuffer e deixar o SheetJS interpretar os bytes em bruto
       troca os acentos (ex.: "Café" vira "CafÃ©"). Um .xlsx/.xls é um
       ficheiro binário à parte, onde isso não acontece. */
    var ehCsv = /\.csv$/i.test(ficheiro.name);
    var leitor = new FileReader();
    leitor.onload = function () {
      try {
        var wb = ehCsv
          ? XLSX.read(leitor.result, { type: 'string', cellDates: true })
          : XLSX.read(leitor.result, { type: 'array', cellDates: true });
        var ehFormatoEspecifico = !ehCsv && PennyImportarExcel.NOMES_FOLHAS_MES.some(function (nome) {
          return wb.SheetNames.indexOf(nome) >= 0;
        });

        if (ehFormatoEspecifico) {
          resultado = PennyImportarExcel.importar(leitor.result);
          mostrarResultado(ficheiro.name, resultado);
        } else {
          resultado = null;
          iniciarMapeamentoGenerico(ficheiro.name, wb);
        }
      } catch (e) {
        console.error('Erro a importar o ficheiro:', e);
        resultado = null;
        mostrarErro('Não consegui ler este ficheiro. Confirma que é um .xlsx, .xls ou .csv com uma tabela de movimentos.');
      }
    };
    leitor.onerror = function () { mostrarErro('Não consegui abrir este ficheiro.'); };
    if (ehCsv) leitor.readAsText(ficheiro, 'UTF-8'); else leitor.readAsArrayBuffer(ficheiro);
  });

  /* Mostra o passo de confirmar colunas, já com as melhores adivinhas
     escolhidas a partir dos nomes das colunas do ficheiro (ver
     js/importar-generico.js: melhorColuna). */
  function iniciarMapeamentoGenerico(nomeFicheiro, wb) {
    var deteccao = PennyImportarGenerico.detetar(wb);
    if (!deteccao.linhasDados.length) {
      mostrarErro('Não encontrei nenhuma linha de dados neste ficheiro.');
      return;
    }
    deteccaoGenerica = deteccao;

    function preencherSelect(id, incluirNenhuma, valorSugerido) {
      var select = document.getElementById(id);
      select.innerHTML = '';
      if (incluirNenhuma) {
        var optNenhuma = document.createElement('option');
        optNenhuma.value = '';
        optNenhuma.textContent = 'Nenhuma';
        select.appendChild(optNenhuma);
      }
      deteccao.cabecalhos.forEach(function (cabecalho, indice) {
        var opt = document.createElement('option');
        opt.value = String(indice);
        opt.textContent = cabecalho || ('Coluna ' + (indice + 1));
        select.appendChild(opt);
      });
      select.value = (valorSugerido !== null && valorSugerido !== undefined) ? String(valorSugerido) : '';
    }

    preencherSelect('mapa-data', false, deteccao.sugestao.data || 0);
    preencherSelect('mapa-descricao', false, deteccao.sugestao.descricao || 0);
    preencherSelect('mapa-valor-despesa', true, deteccao.sugestao.valorDespesa);
    preencherSelect('mapa-valor-rendimento', true, deteccao.sugestao.valorRendimento);
    preencherSelect('mapa-categoria', true, deteccao.sugestao.categoria);

    nomeFicheiroEl.textContent = nomeFicheiro;
    resumoFicheiroEl.textContent = deteccao.linhasDados.length + ' linhas encontradas';
    blocoMapeamento.hidden = false;
    botaoImportar.textContent = 'Escolhe um ficheiro primeiro';
  }

  function valorDoMapa(id) {
    var valor = document.getElementById(id).value;
    return valor === '' ? null : Number(valor);
  }

  document.getElementById('botao-confirmar-mapeamento').addEventListener('click', function () {
    var mapeamento = {
      data: valorDoMapa('mapa-data'),
      descricao: valorDoMapa('mapa-descricao'),
      valorDespesa: valorDoMapa('mapa-valor-despesa'),
      valorRendimento: valorDoMapa('mapa-valor-rendimento'),
      categoria: valorDoMapa('mapa-categoria')
    };

    if (mapeamento.valorDespesa === null && mapeamento.valorRendimento === null) {
      mostrarErro('Escolhe pelo menos uma coluna de valor (despesa ou rendimento).');
      return;
    }

    /* Categorias já existentes na conta (sem distinguir acentos ou
       maiúsculas), para reaproveitar em vez de criar outra vez. */
    var D = window.PennyDados;
    var categoriasConhecidas = { despesas: {}, rendimentos: {} };
    D.categoriasDespesa().forEach(function (c) { categoriasConhecidas.despesas[PennyImportarGenerico.normalizar(c.nome)] = c.nome; });
    D.categoriasRendimento().forEach(function (c) { categoriasConhecidas.rendimentos[PennyImportarGenerico.normalizar(c.nome)] = c.nome; });

    resultado = PennyImportarGenerico.importar(deteccaoGenerica.linhasDados, mapeamento, categoriasConhecidas);
    mostrarResultadoGenerico(resultado);
  });

  function mostrarResultadoGenerico(r) {
    erro.hidden = true;
    blocoMapeamento.hidden = true;
    resumoFicheiroEl.textContent = r.movimentos.length + ' movimentos a importar';

    var listaCategoriasNovas = document.getElementById('lista-categorias-novas');
    listaCategoriasNovas.innerHTML = '';
    document.getElementById('sem-categorias-novas').hidden = r.novasCategorias.length > 0;
    r.novasCategorias.forEach(function (nc) {
      var linha = document.createElement('div');
      linha.className = 'glass-rows__row';
      linha.innerHTML =
        '<div class="glass-rows__label"><span class="glass-rows__title">' + nc.nome + '</span>' +
        '<span class="glass-rows__sub">' + (nc.tipo === 'despesa' ? 'Despesa' : 'Rendimento') + ' · categoria nova</span></div>';
      listaCategoriasNovas.appendChild(linha);
    });

    var blocoIgnoradas = document.getElementById('bloco-ignoradas-generico');
    if (r.paraRever.length) {
      document.getElementById('resumo-ignoradas-generico').textContent =
        r.paraRever.length + (r.paraRever.length === 1 ? ' linha ignorada.' : ' linhas ignoradas.');
      blocoIgnoradas.hidden = false;
    } else {
      blocoIgnoradas.hidden = true;
    }

    document.getElementById('total-generico').textContent = PennyMoeda.formatar(r.total);
    blocoResultadoGenerico.hidden = false;

    if (r.movimentos.length) {
      botaoImportar.disabled = false;
      botaoImportar.textContent = 'Importar e começar';
    } else {
      botaoImportar.disabled = true;
      botaoImportar.textContent = 'Nenhum movimento para importar';
    }
  }

  /* Duplicados: mesma data (dia/mês/ano), descrição e valor que um
     movimento já guardado. Serve tanto para importares o mesmo
     documento outra vez, como um documento diferente com despesas
     repetidas. */
  function chaveDuplicado(m) {
    return [m.data.getFullYear(), m.data.getMonth(), m.data.getDate(), m.descricao.trim().toLowerCase(), Math.round(m.valor * 100)].join('|');
  }
  function encontrarDuplicados(novos, existentes) {
    var chavesExistentes = {};
    existentes.forEach(function (m) { chavesExistentes[chaveDuplicado(m)] = true; });
    var indices = [];
    novos.forEach(function (m, indice) { if (chavesExistentes[chaveDuplicado(m)]) indices.push(indice); });
    return indices;
  }

  function formatarDataCurta(data) {
    return data.getDate() + '/' + (data.getMonth() + 1) + '/' + data.getFullYear();
  }

  var sheetDuplicados = document.getElementById('sheet-duplicados');
  var listaDuplicados = document.getElementById('lista-duplicados');

  function pedirResolucaoDuplicados(movimentos, indicesDuplicados) {
    return new Promise(function (resolve) {
      listaDuplicados.innerHTML = '';
      indicesDuplicados.forEach(function (indice) {
        var m = movimentos[indice];
        var linha = document.createElement('div');
        linha.className = 'glass';
        linha.style.cssText = 'padding:12px 14px; display:flex; flex-direction:column; gap:8px';
        linha.innerHTML =
          '<div style="display:flex; justify-content:space-between; gap:10px">' +
          '<span style="font-size:14px; font-weight:500">' + m.descricao + '</span>' +
          '<span style="font-size:14px; font-weight:500">' + PennyMoeda.formatar(m.valor) + '</span></div>' +
          '<span class="muted2" style="font-size:12px">' + formatarDataCurta(m.data) + ' · ' + m.categoria + '</span>' +
          '<div class="seg" data-indice="' + indice + '">' +
          '  <button type="button" class="seg__item is-active" data-valor="descartar">Descartar</button>' +
          '  <button type="button" class="seg__item" data-valor="manter">Manter</button>' +
          '</div>';
        listaDuplicados.appendChild(linha);
      });

      function definirTodos(valor) {
        listaDuplicados.querySelectorAll('.seg').forEach(function (seg) {
          seg.querySelectorAll('.seg__item').forEach(function (b) {
            b.classList.toggle('is-active', b.getAttribute('data-valor') === valor);
          });
        });
      }

      listaDuplicados.onclick = function (evento) {
        var botao = evento.target.closest('.seg__item');
        if (!botao) return;
        botao.parentElement.querySelectorAll('.seg__item').forEach(function (b) { b.classList.remove('is-active'); });
        botao.classList.add('is-active');
      };
      document.getElementById('btn-aceitar-todos-duplicados').onclick = function () { definirTodos('manter'); };
      document.getElementById('btn-descartar-todos-duplicados').onclick = function () { definirTodos('descartar'); };
      document.getElementById('btn-x-duplicados').onclick = function () { definirTodos('descartar'); confirmarEscolha(); };

      function confirmarEscolha() {
        var indicesParaDescartar = {};
        listaDuplicados.querySelectorAll('.seg').forEach(function (seg) {
          var ativo = seg.querySelector('.seg__item.is-active');
          if (ativo && ativo.getAttribute('data-valor') === 'descartar') {
            indicesParaDescartar[seg.getAttribute('data-indice')] = true;
          }
        });
        sheetDuplicados.hidden = true;
        resolve(movimentos.filter(function (m, indice) { return !indicesParaDescartar[indice]; }));
      }
      document.getElementById('btn-confirmar-duplicados').onclick = confirmarEscolha;

      sheetDuplicados.hidden = false;
    });
  }

  function prosseguirImportacao(movimentosParaGuardar, existentes) {
    botaoImportar.disabled = true;
    botaoImportar.textContent = 'A importar...';

    /* Importação genérica (ver js/importar-generico.js): cria agora as
       categorias novas que o ficheiro trazia — só agora, ao confirmar
       mesmo a importação, para não ficarem categorias vazias criadas
       se o utilizador tivesse desistido a meio. As linhas sem data,
       descrição ou valor já foram só contadas e ignoradas (mostrarResultadoGenerico),
       não há rascunhos para criar aqui. */
    if (resultado.generico) {
      (resultado.novasCategorias || []).forEach(function (nc) {
        window.PennyDados.criarCategoria(nc.tipo === 'despesa' ? 'despesas' : 'rendimentos', { nome: nc.nome, periodicidade: 'Variável' });
      });
    }

    /* As linhas sem valor do Excel específico ficam gravadas como
       movimentos incompletos (valor 0, já com a categoria do Excel),
       para dares em Avisos → Editar e só faltar preencher o valor —
       em vez de se perderem. Aqui não há valor para comparar, por
       isso evita-se duplicar só pela mesma data + descrição (ex.:
       importar o mesmo ficheiro duas vezes não deve criar o mesmo
       "por rever" outra vez). */
    var rascunhos = [];
    if (!resultado.generico) {
      var chavesExistentes = {};
      (existentes || []).forEach(function (m) {
        chavesExistentes[[m.data.getFullYear(), m.data.getMonth(), m.data.getDate(), m.descricao.trim().toLowerCase()].join('|')] = true;
      });
      rascunhos = resultado.paraRever.filter(function (item) {
        var chave = [item.data.getFullYear(), item.data.getMonth(), item.data.getDate(), item.descricao.trim().toLowerCase()].join('|');
        return !chavesExistentes[chave];
      }).map(function (item) {
        return {
          data: item.data, mesReferencia: item.mesReferencia, descricao: item.descricao,
          categoria: item.categoria, periodicidade: item.periodicidade,
          valor: 0, tipo: 'despesa', inesperada: false,
          nota: 'Importado de ' + item.folha.replace(/^\d+\s/, '') + ', sem valor no ficheiro.',
          incompleto: true
        };
      });
    }

    Promise.all([
      movimentosParaGuardar.length ? PennyDB.guardarVarios(movimentosParaGuardar) : Promise.resolve([]),
      rascunhos.length ? PennyDB.guardarVarios(rascunhos) : Promise.resolve([])
    ]).then(function (resultados) {
      var movimentosGuardados = resultados[0];
      var movimentosRascunho = resultados[1];
      var avisos = [];

      /* Correções de categoria que rejeitaste (ver js/importar-excel.js:
         aplicarCorrecao) chegam aqui já marcadas como incompletas, com
         um valor real por guardar na mesma — por isso só pedem um
         Aviso, nunca se perdem como os rascunhos sem valor abaixo. */
      movimentosGuardados.forEach(function (m) {
        if (!m.incompleto) return;
        avisos.push({
          tipo: 'categoria-por-confirmar',
          titulo: m.descricao,
          detalhe: m.nota || 'Categoria por confirmar',
          movimentoId: m.id
        });
      });

      if (movimentosRascunho.length) {
        movimentosRascunho.forEach(function (m) {
          avisos.push({
            tipo: 'movimento-incompleto',
            titulo: m.descricao,
            detalhe: m.categoria + ' · falta o valor',
            movimentoId: m.id
          });
        });
      }

      if (avisos.length) PennyAvisos.adicionar(avisos);
      return (window.PennyDB.fechar ? window.PennyDB.fechar() : Promise.resolve()).then(function () {
        window.location.href = 'inicio.html';
      });
    }).catch(function (e) {
      console.error('Erro a guardar os movimentos importados:', e);
      botaoImportar.disabled = false;
      botaoImportar.textContent = 'Importar e começar';
      erro.textContent = 'Houve um problema a guardar os movimentos. Tenta outra vez.';
      erro.hidden = false;
    });
  }

  botaoImportar.addEventListener('click', function () {
    if (!resultado || (!resultado.movimentos.length && !resultado.paraRever.length)) return;
    botaoImportar.disabled = true;
    botaoImportar.textContent = 'A verificar duplicados...';

    PennyDB.todos().then(function (existentes) {
      var indicesDuplicados = encontrarDuplicados(resultado.movimentos, existentes);
      if (!indicesDuplicados.length) { prosseguirImportacao(resultado.movimentos, existentes); return; }
      pedirResolucaoDuplicados(resultado.movimentos, indicesDuplicados).then(function (movimentosParaGuardar) {
        prosseguirImportacao(movimentosParaGuardar, existentes);
      });
    });
  });
});
