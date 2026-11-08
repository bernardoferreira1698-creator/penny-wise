/* Ecrã Recorrentes: por confirmar (despesas devidas e ainda não
   tratadas este mês), próximas despesas (ainda não chegou o dia),
   rendimentos e anuais. Confirmar cria um movimento a sério
   (js/recorrentes.js + js/db.js); também dá para editar, apagar e
   criar recorrentes. */

document.addEventListener('DOMContentLoaded', function () {
  var D = window.PennyDados;
  var hoje = D.hoje();
  var anoAtual = hoje.getFullYear(), mesAtual = hoje.getMonth();
  var mesReferencia = anoAtual + '-' + String(mesAtual + 1).padStart(2, '0');

  var listaPorConfirmar = document.getElementById('lista-por-confirmar');
  var listaProximas = document.getElementById('lista-despesas-fixas');
  var listaRendimentos = document.getElementById('lista-rendimentos');
  var listaAnuais = document.getElementById('lista-subscricoes-anuais');

  /* Neste ecrã mostra-se sempre o valor positivo, mesmo para despesas
     (que na app, fora daqui, aparecem sempre a sair, com "−"): aqui o
     objetivo é dar uma noção geral dos valores fixos, não um extrato. */
  function formatarValor(r) {
    return PennyMoeda.formatar(Math.abs(r.valorPrevisto));
  }

  function porValorCrescente(a, b) { return Math.abs(a.valorPrevisto) - Math.abs(b.valorPrevisto); }

  function estaDevido(r) {
    return !r.diaPrevisto || r.diaPrevisto <= hoje.getDate();
  }

  function diaTexto(r) {
    if (!r.diaPrevisto) return 'dia por definir';
    var prefixoMes = r.frequencia === 'anual' ? (D.MESES[r.mesPrevisto].slice(0, 3) + ' ') : '';
    return prefixoMes + r.diaPrevisto;
  }

  /* Estado deste mês para uma despesa fixa que já não está em "Por
     confirmar" — ou já foi tratada (confirmada/dispensada), ou ainda
     não chegou o dia previsto. Mostra sempre algo, para a lista de
     "Despesas fixas" dar sempre a noção de todas as despesas fixas que
     existem, não só das que ainda faltam tratar este mês. */
  function subtituloDespesaFixa(r) {
    var confirmacao = PennyRecorrentes.estadoConfirmacao(r.id, mesReferencia);
    if (confirmacao && confirmacao.estado === 'confirmado') return r.categoria + ' · confirmada este mês';
    if (confirmacao && confirmacao.estado === 'ignorado') return r.categoria + ' · dispensada este mês';
    return r.categoria + ' · previsto a ' + diaTexto(r);
  }

  function subtituloAnual(r) {
    return r.categoria + ' · Renova em ' + D.MESES[r.mesPrevisto];
  }

  function linhaLista(r, subtitulo) {
    var linha = document.createElement('a');
    linha.href = '#';
    linha.className = 'glass-rows__row';
    linha.setAttribute('data-id', r.id);
    linha.innerHTML =
      '<div class="glass-rows__label"><span class="glass-rows__title">' + r.descricao + '</span>' +
      '<span class="glass-rows__sub">' + (subtitulo || (r.categoria + ' · ' + diaTexto(r))) + '</span></div>' +
      '<span class="glass-rows__value">' + formatarValor(r) + '</span>';
    linha.addEventListener('click', function (evento) { evento.preventDefault(); abrirEdicao(r); });
    return linha;
  }

  /* Um registo com dados inesperados (ex.: vindo de uma sincronização
     antiga) nunca deve impedir o resto da lista de aparecer — por isso
     cada item é construído à parte, e se um falhar, fica de fora em
     vez de travar tudo (ver também a nota em cada forEach abaixo). */
  function paraCadaComSeguranca(lista, fazer) {
    lista.forEach(function (r) {
      try { fazer(r); } catch (erro) { console.warn('Recorrente com dados inválidos, ignorado na lista:', r, erro); }
    });
  }

  function render() {
    var ativos = PennyRecorrentes.listar().filter(function (r) { return r.ativo; });
    var doMes = ativos.filter(function (r) { return r.frequencia !== 'anual' || r.mesPrevisto === mesAtual; });
    var despesasDoMes = doMes.filter(function (r) { return r.tipo === 'despesa'; });

    var porConfirmar = despesasDoMes.filter(function (r) {
      return !PennyRecorrentes.estadoConfirmacao(r.id, mesReferencia) && estaDevido(r);
    });
    /* Tudo o resto das despesas fixas deste mês: já confirmadas, já
       dispensadas, ou ainda não chegou o dia — para esta lista mostrar
       sempre TODAS as despesas fixas, não só as que estão por tratar. */
    var outrasDespesas = despesasDoMes.filter(function (r) { return porConfirmar.indexOf(r) < 0; });
    var rendimentosMensais = ativos.filter(function (r) { return r.tipo === 'rendimento' && r.frequencia === 'mensal'; });
    var anuais = ativos.filter(function (r) { return r.frequencia === 'anual'; });

    document.getElementById('bloco-por-confirmar').hidden = porConfirmar.length === 0;
    listaPorConfirmar.innerHTML = '';
    paraCadaComSeguranca(porConfirmar, function (r) {
      var card = document.createElement('div');
      card.className = 'card-light recorrente-pendente';
      card.innerHTML =
        '<div style="display:flex; justify-content:space-between; align-items:baseline">' +
        '  <div style="display:flex; flex-direction:column; gap:2px">' +
        '    <span style="font-size:17px; font-weight:600">' + r.descricao + '</span>' +
        '    <span style="font-size:12px; color:var(--card-muted2)">' + r.categoria + ' · ' + r.periodicidade + ' · previsto a ' + diaTexto(r) + '</span>' +
        '  </div>' +
        '  <div style="display:flex; align-items:center; gap:8px">' +
        '    <span style="font-size:20px; font-weight:600">' + formatarValor(r) + '</span>' +
        '    <button type="button" class="btn-lapis" data-acao="editar" data-id="' + r.id + '" aria-label="Editar">' +
        '      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9 M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z"/></svg>' +
        '    </button>' +
        '  </div>' +
        '</div>' +
        '<div class="grid-2" style="margin-top:12px">' +
        '  <button type="button" data-acao="descartar" data-id="' + r.id + '" style="font-family:inherit; height:44px; border-radius:999px; border:1px solid var(--line-light); background:transparent; color:var(--ink); font-size:14px; font-weight:500; cursor:pointer">Descartar</button>' +
        '  <button type="button" data-acao="confirmar" data-id="' + r.id + '" style="font-family:inherit; height:44px; border-radius:999px; border:0; background:var(--btn); color:var(--ink); font-size:14px; font-weight:600; cursor:pointer">Confirmar</button>' +
        '</div>';
      listaPorConfirmar.appendChild(card);
    });

    listaRendimentos.innerHTML = '';
    document.getElementById('sem-rendimentos').hidden = rendimentosMensais.length > 0;
    paraCadaComSeguranca(rendimentosMensais.slice().sort(porValorCrescente), function (r) { listaRendimentos.appendChild(linhaLista(r)); });
    document.getElementById('total-rendimentos').textContent =
      PennyMoeda.formatar(rendimentosMensais.reduce(function (s, r) { return s + Math.abs(r.valorPrevisto); }, 0));

    listaProximas.innerHTML = '';
    document.getElementById('sem-despesas').hidden = outrasDespesas.length > 0;
    paraCadaComSeguranca(outrasDespesas.slice().sort(porValorCrescente), function (r) { listaProximas.appendChild(linhaLista(r, subtituloDespesaFixa(r))); });
    document.getElementById('total-despesas-fixas').textContent =
      PennyMoeda.formatar(despesasDoMes.reduce(function (s, r) { return s + Math.abs(r.valorPrevisto); }, 0));

    listaAnuais.innerHTML = '';
    document.getElementById('sem-anuais').hidden = anuais.length > 0;
    paraCadaComSeguranca(anuais.slice().sort(porValorCrescente), function (r) { listaAnuais.appendChild(linhaLista(r, subtituloAnual(r))); });
    document.getElementById('media-subscricoes-anuais').textContent =
      PennyMoeda.formatar(anuais.reduce(function (s, r) { return s + Math.abs(r.valorPrevisto); }, 0) / 12) + '/mês';
  }

  listaPorConfirmar.addEventListener('click', function (evento) {
    var botao = evento.target.closest('button[data-acao]');
    if (!botao) return;
    var id = botao.getAttribute('data-id');
    var r = PennyRecorrentes.obter(id);
    if (!r) return;
    var acao = botao.getAttribute('data-acao');
    if (acao === 'editar') { abrirEdicao(r); return; }
    if (acao === 'descartar') { PennyRecorrentes.ignorar(id, mesReferencia); render(); return; }
    if (acao === 'confirmar') {
      var dia = r.diaPrevisto || hoje.getDate();
      var data = r.frequencia === 'anual' ? new Date(anoAtual, r.mesPrevisto, dia) : new Date(anoAtual, mesAtual, dia);
      PennyRecorrentes.confirmar(r, mesReferencia, r.valorPrevisto, data).then(render);
    }
  });

  /* Sheet de criar/editar. */
  var sheet = document.getElementById('sheet-editar-recorrente');
  var segTipo = document.getElementById('seg-tipo-recorrente');
  var segPeriodicidade = document.getElementById('seg-periodicidade-recorrente');
  var segFrequencia = document.getElementById('seg-frequencia-recorrente');
  var campoDescricao = document.getElementById('campo-descricao-recorrente');
  var campoValor = document.getElementById('campo-valor-recorrente');
  var campoCategoria = document.getElementById('campo-categoria-recorrente');
  var campoDia = document.getElementById('campo-dia-recorrente');
  var campoMes = document.getElementById('campo-mes-recorrente');
  var blocoMes = document.getElementById('bloco-mes-recorrente');
  var recorrenteEmEdicao = null;

  function tipoAtivo() { return segTipo.querySelector('.seg__item.is-active').getAttribute('data-valor'); }

  function popularCategorias(tipo, selecionada) {
    var lista = tipo === 'rendimento' ? D.categoriasRendimento() : D.categoriasDespesa();
    campoCategoria.innerHTML = '';
    lista.forEach(function (c) {
      var opt = document.createElement('option');
      opt.value = c.nome; opt.textContent = c.nome;
      campoCategoria.appendChild(opt);
    });
    if (selecionada) campoCategoria.value = selecionada;
  }

  function popularMeses(selecionado) {
    campoMes.innerHTML = '';
    D.MESES.forEach(function (nome, indice) {
      var opt = document.createElement('option');
      opt.value = indice; opt.textContent = nome.charAt(0).toUpperCase() + nome.slice(1);
      campoMes.appendChild(opt);
    });
    campoMes.value = selecionado != null ? selecionado : mesAtual;
  }

  segTipo.addEventListener('click', function (evento) {
    var botao = evento.target.closest('.seg__item');
    if (!botao) return;
    segTipo.querySelectorAll('.seg__item').forEach(function (b) { b.classList.remove('is-active'); });
    botao.classList.add('is-active');
    popularCategorias(botao.getAttribute('data-valor'));
  });
  segPeriodicidade.addEventListener('click', function (evento) {
    var botao = evento.target.closest('.seg__item');
    if (!botao) return;
    segPeriodicidade.querySelectorAll('.seg__item').forEach(function (b) { b.classList.remove('is-active'); });
    botao.classList.add('is-active');
  });
  segFrequencia.addEventListener('click', function (evento) {
    var botao = evento.target.closest('.seg__item');
    if (!botao) return;
    segFrequencia.querySelectorAll('.seg__item').forEach(function (b) { b.classList.remove('is-active'); });
    botao.classList.add('is-active');
    blocoMes.hidden = botao.getAttribute('data-valor') !== 'anual';
  });

  function abrirEdicao(r) {
    recorrenteEmEdicao = r;
    document.getElementById('titulo-editar-recorrente').textContent = r ? 'Editar recorrente' : 'Novo recorrente';
    document.getElementById('btn-apagar-recorrente').hidden = !r;

    var tipo = r ? r.tipo : 'despesa';
    segTipo.querySelectorAll('.seg__item').forEach(function (b) { b.classList.toggle('is-active', b.getAttribute('data-valor') === tipo); });
    popularCategorias(tipo, r ? r.categoria : null);

    campoDescricao.value = r ? r.descricao : '';
    campoValor.value = r ? String(r.valorPrevisto).replace('.', ',') : '';

    var periodicidade = r ? r.periodicidade : 'Fixa';
    segPeriodicidade.querySelectorAll('.seg__item').forEach(function (b) { b.classList.toggle('is-active', b.getAttribute('data-valor') === periodicidade); });

    var frequencia = r ? r.frequencia : 'mensal';
    segFrequencia.querySelectorAll('.seg__item').forEach(function (b) { b.classList.toggle('is-active', b.getAttribute('data-valor') === frequencia); });
    blocoMes.hidden = frequencia !== 'anual';

    campoDia.value = r && r.diaPrevisto ? r.diaPrevisto : '';
    popularMeses(r ? r.mesPrevisto : mesAtual);

    sheet.hidden = false;
  }
  function fecharEdicao() { sheet.hidden = true; }

  document.getElementById('btn-novo-recorrente').addEventListener('click', function (evento) {
    evento.preventDefault();
    abrirEdicao(null);
  });
  document.getElementById('btn-x-recorrente').addEventListener('click', fecharEdicao);
  sheet.addEventListener('click', function (evento) { if (evento.target === sheet) fecharEdicao(); });

  document.getElementById('btn-guardar-recorrente').addEventListener('click', function () {
    var descricao = campoDescricao.value.trim();
    var valor = Number(campoValor.value.replace(',', '.'));
    var emFalta = [];
    if (!descricao) emFalta.push('Descrição');
    if (!valor || !isFinite(valor) || valor <= 0) emFalta.push('Valor');
    if (emFalta.length) {
      PennyAlerta.mostrar('Não foi possível guardar, porque falta preencher ' +
        (emFalta.length === 1 ? emFalta[0] : emFalta.join(' e ')) + '.');
      return;
    }

    var frequencia = segFrequencia.querySelector('.seg__item.is-active').getAttribute('data-valor');
    var dados = {
      descricao: descricao,
      tipo: tipoAtivo(),
      categoria: campoCategoria.value,
      periodicidade: segPeriodicidade.querySelector('.seg__item.is-active').getAttribute('data-valor'),
      valorPrevisto: Math.round(valor * 100) / 100,
      frequencia: frequencia,
      diaPrevisto: campoDia.value ? Number(campoDia.value) : null,
      mesPrevisto: frequencia === 'anual' ? Number(campoMes.value) : null
    };

    if (recorrenteEmEdicao) PennyRecorrentes.atualizar(recorrenteEmEdicao.id, dados);
    else PennyRecorrentes.criar(dados);

    fecharEdicao();
    render();
    renderSugestoes();
  });

  document.getElementById('btn-apagar-recorrente').addEventListener('click', function () {
    if (!recorrenteEmEdicao) return;
    if (!window.confirm('Apagar este recorrente? Não é possível desfazer.')) return;
    PennyRecorrentes.remover(recorrenteEmEdicao.id);
    fecharEdicao();
    render();
    renderSugestoes();
  });

  /* Sugestões: a app repara sozinha quando uma despesa/rendimento
     Fixa se repete em vários meses e ainda não é um recorrente, e
     propõe criá-lo. Descartar uma sugestão não pergunta outra vez
     (fica numa lista local de sugestões recusadas). */
  var CHAVE_DESCARTADAS = 'pw_recorrentes_sugestoes_descartadas';
  var TODOS_MOVIMENTOS = [];
  var sugestoesAtuais = {};

  function lerDescartadas() {
    try { return JSON.parse(localStorage.getItem(CHAVE_DESCARTADAS) || '[]'); } catch (e) { return []; }
  }
  function descartarSugestao(chaveAlvo) {
    var lista = lerDescartadas();
    if (lista.indexOf(chaveAlvo) < 0) lista.push(chaveAlvo);
    localStorage.setItem(CHAVE_DESCARTADAS, JSON.stringify(lista));
  }

  function detetarSugestoes() {
    var descartadas = lerDescartadas();
    var existentes = PennyRecorrentes.listar().map(function (r) { return r.descricao.trim().toLowerCase(); });
    var grupos = {};
    TODOS_MOVIMENTOS.forEach(function (m) {
      if (m.periodicidade !== 'Fixa' || (m.tipo !== 'despesa' && m.tipo !== 'rendimento')) return;
      var chaveDescricao = m.descricao.trim().toLowerCase();
      var chave = m.categoria + '|' + chaveDescricao;
      if (!grupos[chave]) grupos[chave] = { meses: {}, ultima: m };
      grupos[chave].meses[m.mesReferencia] = true;
      if (m.data > grupos[chave].ultima.data) grupos[chave].ultima = m;
    });

    var sugestoes = [];
    Object.keys(grupos).forEach(function (chave) {
      var grupo = grupos[chave];
      var nMeses = Object.keys(grupo.meses).length;
      var chaveDescricao = grupo.ultima.descricao.trim().toLowerCase();
      if (nMeses < 2) return;
      if (existentes.indexOf(chaveDescricao) >= 0) return;
      if (descartadas.indexOf(chave) >= 0) return;
      sugestoes.push({
        chave: chave, nMeses: nMeses,
        descricao: grupo.ultima.descricao, categoria: grupo.ultima.categoria,
        tipo: grupo.ultima.tipo, valorPrevisto: Math.abs(grupo.ultima.valor),
        diaPrevisto: grupo.ultima.data.getDate()
      });
    });
    sugestoes.sort(function (a, b) { return b.nMeses - a.nMeses; });
    return sugestoes;
  }

  function renderSugestoes() {
    var sugestoes = detetarSugestoes();
    sugestoesAtuais = {};
    sugestoes.forEach(function (s) { sugestoesAtuais[s.chave] = s; });

    var bloco = document.getElementById('bloco-sugestoes');
    var lista = document.getElementById('lista-sugestoes');
    bloco.hidden = sugestoes.length === 0;
    lista.innerHTML = '';
    sugestoes.forEach(function (s) {
      var card = document.createElement('div');
      card.className = 'glass';
      card.style.cssText = 'padding:12px 14px; display:flex; flex-direction:column; gap:8px';
      card.innerHTML =
        '<div style="display:flex; justify-content:space-between; gap:10px">' +
        '<span style="font-size:14px; font-weight:500">' + s.descricao + '</span>' +
        '<span style="font-size:14px; font-weight:500">' + PennyMoeda.formatar(s.valorPrevisto) + '</span></div>' +
        '<span class="muted2" style="font-size:12px">' + s.categoria + ' · aparece em ' + s.nMeses + ' meses</span>' +
        '<div class="grid-2">' +
        '  <button type="button" data-acao="descartar-sugestao" data-chave="' + s.chave + '" style="font-family:inherit; height:40px; border-radius:999px; border:1px solid var(--linha); background:transparent; color:var(--text); font-size:13px; font-weight:500; cursor:pointer">Descartar</button>' +
        '  <button type="button" data-acao="aceitar-sugestao" data-chave="' + s.chave + '" style="font-family:inherit; height:40px; border-radius:999px; border:0; background:var(--prim-solid); color:#fff; font-size:13px; font-weight:600; cursor:pointer">Aceitar</button>' +
        '</div>';
      lista.appendChild(card);
    });
  }

  document.getElementById('lista-sugestoes').addEventListener('click', function (evento) {
    var botao = evento.target.closest('button[data-acao]');
    if (!botao) return;
    var chave = botao.getAttribute('data-chave');
    var s = sugestoesAtuais[chave];
    if (!s) return;
    if (botao.getAttribute('data-acao') === 'descartar-sugestao') {
      descartarSugestao(chave);
    } else {
      PennyRecorrentes.criar({
        descricao: s.descricao, tipo: s.tipo, categoria: s.categoria, periodicidade: 'Fixa',
        valorPrevisto: s.valorPrevisto, frequencia: 'mensal', diaPrevisto: s.diaPrevisto, mesPrevisto: null
      });
    }
    render();
    renderSugestoes();
  });

  PennyDB.todos().then(function (movimentos) {
    TODOS_MOVIMENTOS = movimentos;
    render();
    renderSugestoes();
  });
});
