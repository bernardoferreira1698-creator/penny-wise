/* Ecrã Categorias: lista (despesas/rendimentos) com edição de nome,
   periodicidade por defeito e subcategorias. As edições ficam em
   localStorage por agora; a partir da Fase 6 passam para a tabela
   categorias/subcategorias no Supabase. */

document.addEventListener('DOMContentLoaded', function () {
  var D = window.PennyDados;

  function renderLista(container, lista) {
    container.innerHTML = '';
    lista.forEach(function (c) {
      var linha = document.createElement('button');
      linha.type = 'button';
      linha.className = 'cat-linha';
      var subNota = c.subcategorias.length ? (' <span class="muted2" style="font-size:12px">· ' + c.subcategorias.length + ' subcategorias</span>') : '';
      linha.innerHTML =
        '<span style="font-size:15px; font-weight:500">' + c.nome + subNota + '</span>' +
        '<span class="cat-linha__periodicidade">' +
        '  <span class="' + (c.periodicidade === 'Fixa' ? 'warn-text' : 'muted') + '" style="font-size:12px">' + c.periodicidade + '</span>' +
        '  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>' +
        '</span>';
      linha.addEventListener('click', function () { abrirEdicao(c); });
      container.appendChild(linha);
    });
  }

  function render() {
    renderLista(document.getElementById('lista-despesas'), D.categoriasDespesa());
    renderLista(document.getElementById('lista-rendimentos'), D.categoriasRendimento());
  }

  var tabs = document.getElementById('tabs-categorias');
  var despesas = document.getElementById('lista-despesas');
  var rendimentos = document.getElementById('lista-rendimentos');
  function abaAtiva() { return tabs.querySelector('.tabs__item.is-active').getAttribute('data-aba'); }
  tabs.addEventListener('click', function (evento) {
    var botao = evento.target.closest('.tabs__item');
    if (!botao) return;
    tabs.querySelectorAll('.tabs__item').forEach(function (b) { b.classList.remove('is-active'); });
    botao.classList.add('is-active');
    var aba = botao.getAttribute('data-aba');
    despesas.hidden = aba !== 'despesas';
    rendimentos.hidden = aba !== 'rendimentos';
  });

  /* Sheet de edição. */
  var sheet = document.getElementById('sheet-editar-categoria');
  var campoNome = document.getElementById('nome-categoria');
  var segPer = document.getElementById('seg-periodicidade-categoria');
  var listaSub = document.getElementById('lista-subcategorias');
  var categoriaEmEdicao = null;
  var subcategoriasTemp = [];

  function renderSubcategorias() {
    listaSub.innerHTML = '';
    if (!subcategoriasTemp.length) {
      var vazio = document.createElement('span');
      vazio.className = 'muted';
      vazio.style.fontSize = '13px';
      vazio.textContent = 'Sem subcategorias.';
      listaSub.appendChild(vazio);
      return;
    }
    subcategoriasTemp.forEach(function (nome, indice) {
      var chip = document.createElement('span');
      chip.className = 'subcat-chip';
      chip.innerHTML = '<span>' + nome + '</span>';
      var remover = document.createElement('button');
      remover.type = 'button';
      remover.textContent = '×';
      remover.setAttribute('aria-label', 'Remover ' + nome);
      remover.addEventListener('click', function () { subcategoriasTemp.splice(indice, 1); renderSubcategorias(); });
      chip.appendChild(remover);
      listaSub.appendChild(chip);
    });
  }

  function abrirEdicao(categoria) {
    categoriaEmEdicao = categoria;
    document.querySelector('#sheet-editar-categoria .sheet-titulo').textContent = categoria ? 'Editar categoria' : 'Nova categoria';
    campoNome.value = categoria ? categoria.nome : '';
    var periodicidadeInicial = categoria ? categoria.periodicidade : 'Variável';
    segPer.querySelectorAll('.seg__item').forEach(function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-valor') === periodicidadeInicial);
    });
    subcategoriasTemp = categoria ? categoria.subcategorias.slice() : [];
    renderSubcategorias();
    sheet.hidden = false;
    campoNome.focus();
  }
  function fecharEdicao() { sheet.hidden = true; }

  segPer.addEventListener('click', function (evento) {
    var botao = evento.target.closest('.seg__item');
    if (!botao) return;
    segPer.querySelectorAll('.seg__item').forEach(function (b) { b.classList.remove('is-active'); });
    botao.classList.add('is-active');
  });

  document.getElementById('btn-add-subcategoria').addEventListener('click', function () {
    var campo = document.getElementById('nova-subcategoria');
    var nome = campo.value.trim();
    if (!nome) return;
    subcategoriasTemp.push(nome);
    campo.value = '';
    renderSubcategorias();
  });

  document.getElementById('btn-fechar-categoria').addEventListener('click', fecharEdicao);
  document.getElementById('btn-x-categoria').addEventListener('click', fecharEdicao);
  sheet.addEventListener('click', function (evento) { if (evento.target === sheet) fecharEdicao(); });

  document.getElementById('btn-guardar-categoria').addEventListener('click', function () {
    var novoNome = campoNome.value.trim();
    if (!novoNome) { campoNome.focus(); return; }
    var novaPeriodicidade = segPer.querySelector('.seg__item.is-active').getAttribute('data-valor');
    var dados = { nome: novoNome, periodicidade: novaPeriodicidade, subcategorias: subcategoriasTemp.slice() };
    if (categoriaEmEdicao) {
      D.guardarEdicaoCategoria(categoriaEmEdicao.chaveOriginal, dados);
      if (novoNome !== categoriaEmEdicao.nome) {
        D.renomearOrcamentoPersonalizado(categoriaEmEdicao.nome, novoNome);
        if (window.PennyDB) PennyDB.renomearCategoria(categoriaEmEdicao.nome, novoNome).then(render);
      }
    } else {
      D.criarCategoria(abaAtiva() === 'rendimentos' ? 'rendimentos' : 'despesas', dados);
    }
    fecharEdicao();
    render();
  });

  document.getElementById('btn-nova-categoria').addEventListener('click', function (evento) {
    evento.preventDefault();
    abrirEdicao(null);
  });

  render();
});
