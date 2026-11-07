/* Penny Wise: recorrentes (despesas/rendimentos previsíveis, mensais
   ou anuais) e as suas confirmações por mês, guardados em localStorage
   e sincronizados com as tabelas recorrentes/recorrentes_confirmacoes
   do Supabase (ver sincronizar(), chamada por js/sync.js). Confirmar um
   recorrente cria um movimento a sério (js/db.js). */

(function () {
  var CHAVE_RECORRENTES = 'pw_recorrentes';
  var CHAVE_CONFIRMACOES = 'pw_recorrentes_confirmacoes';

  function listar() {
    try { return JSON.parse(localStorage.getItem(CHAVE_RECORRENTES) || '[]'); } catch (e) { return []; }
  }
  function guardarLista(lista) { localStorage.setItem(CHAVE_RECORRENTES, JSON.stringify(lista)); }

  function obter(id) { return listar().find(function (r) { return r.id === id; }) || null; }

  /* dados: { descricao, tipo: 'despesa'|'rendimento', categoria,
     periodicidade: 'Fixa'|'Variável', valorPrevisto, frequencia:
     'mensal'|'anual', diaPrevisto (1-31), mesPrevisto (0-11, só para
     anuais), repartirMeses (opcional, para anuais tipo Spotify) */
  /* UUID a sério, não um prefixo "rc_...": a tabela recorrentes no
     Supabase tem o id como uuid, e recorrentes_confirmacoes.recorrente
     refere-se a ele. */
  function gerarId() {
    return (crypto.randomUUID ? crypto.randomUUID() : 'rc_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10));
  }

  function pedirSincronizacao() { if (window.PennySync) window.PennySync.sincronizar(); }

  function apagarRemoto(id) {
    if (!window.PennySupabase || !PennySupabase.configurado()) return;
    PennySupabase.sessaoAtual().then(function (sessao) {
      if (!sessao) return;
      // Apaga em cascata as confirmações desse recorrente (ver schema.sql).
      return PennySupabase.cliente.from('recorrentes').delete().eq('id', id).eq('utilizador', sessao.user.id);
    }).catch(function () {});
  }

  function criar(dados) {
    var lista = listar();
    var recorrente = Object.assign({
      id: gerarId(),
      ativo: true, repartirMeses: 1
    }, dados);
    lista.push(recorrente);
    guardarLista(lista);
    pedirSincronizacao();
    return recorrente;
  }

  function atualizar(id, alteracoes) {
    var lista = listar();
    var recorrente = lista.find(function (r) { return r.id === id; });
    if (recorrente) Object.assign(recorrente, alteracoes);
    guardarLista(lista);
    pedirSincronizacao();
    return recorrente;
  }

  function remover(id) {
    guardarLista(listar().filter(function (r) { return r.id !== id; }));
    apagarRemoto(id);
  }

  function lerConfirmacoes() {
    try { return JSON.parse(localStorage.getItem(CHAVE_CONFIRMACOES) || '{}'); } catch (e) { return {}; }
  }
  function guardarConfirmacoes(obj) { localStorage.setItem(CHAVE_CONFIRMACOES, JSON.stringify(obj)); }
  function chave(recorrenteId, mesReferencia) { return recorrenteId + '@' + mesReferencia; }

  /* null = ainda por confirmar; senão { estado: 'confirmado'|'ignorado', movimentoId } */
  function estadoConfirmacao(recorrenteId, mesReferencia) {
    return lerConfirmacoes()[chave(recorrenteId, mesReferencia)] || null;
  }

  function confirmar(recorrente, mesReferencia, valor, data) {
    var sinal = recorrente.tipo === 'rendimento' ? 1 : -1;
    return window.PennyDB.guardar({
      data: data, mesReferencia: mesReferencia, descricao: recorrente.descricao,
      categoria: recorrente.categoria, periodicidade: recorrente.periodicidade || 'Fixa',
      valor: Math.round(Math.abs(valor) * sinal * 100) / 100,
      tipo: recorrente.tipo, inesperada: false, nota: '', repartirMeses: recorrente.repartirMeses || 1
    }).then(function (movimento) {
      var confirmacoes = lerConfirmacoes();
      confirmacoes[chave(recorrente.id, mesReferencia)] = { estado: 'confirmado', movimentoId: movimento.id };
      guardarConfirmacoes(confirmacoes);
      pedirSincronizacao();
      return movimento;
    });
  }

  function ignorar(recorrenteId, mesReferencia) {
    var confirmacoes = lerConfirmacoes();
    confirmacoes[chave(recorrenteId, mesReferencia)] = { estado: 'ignorado' };
    guardarConfirmacoes(confirmacoes);
    pedirSincronizacao();
  }

  /* Desfaz uma confirmação (volta a "por confirmar") e apaga o
     movimento que tinha sido criado, se houver. */
  function desfazer(recorrenteId, mesReferencia) {
    var confirmacoes = lerConfirmacoes();
    var k = chave(recorrenteId, mesReferencia);
    var estado = confirmacoes[k];
    delete confirmacoes[k];
    guardarConfirmacoes(confirmacoes);
    pedirSincronizacao();
    if (estado && estado.movimentoId) return window.PennyDB.apagar(estado.movimentoId);
    return Promise.resolve();
  }

  function paraSupabaseRecorrente(r, utilizador) {
    return {
      id: r.id, utilizador: utilizador, descricao: r.descricao, valor_previsto: r.valorPrevisto,
      tipo: r.tipo, categoria: r.categoria || null, subcategoria: r.subcategoria || null,
      periodicidade: r.periodicidade || null, frequencia: r.frequencia,
      dia_previsto: (r.diaPrevisto === 0 || r.diaPrevisto) ? r.diaPrevisto : null,
      mes_previsto: (r.mesPrevisto === 0 || r.mesPrevisto) ? r.mesPrevisto : null,
      repartir_meses: r.repartirMeses || 1, ativo: r.ativo !== false
    };
  }
  function doSupabaseRecorrente(l) {
    return {
      id: l.id, descricao: l.descricao, valorPrevisto: Number(l.valor_previsto), tipo: l.tipo,
      categoria: l.categoria || undefined, subcategoria: l.subcategoria || undefined,
      periodicidade: l.periodicidade || undefined, frequencia: l.frequencia,
      diaPrevisto: (l.dia_previsto === 0 || l.dia_previsto) ? l.dia_previsto : undefined,
      mesPrevisto: (l.mes_previsto === 0 || l.mes_previsto) ? l.mes_previsto : undefined,
      repartirMeses: l.repartir_meses || 1, ativo: l.ativo !== false
    };
  }

  /* Chamada por js/sync.js. Mesma lógica aditiva dos objetivos (ver
     js/objetivos.js): envia tudo o que há aqui, traz o que só existe
     no servidor, nunca apaga nem sobrepõe o que já está neste
     aparelho. As confirmações só se enviam/recebem para recorrentes já
     conhecidos dos dois lados (a tabela exige a referência a existir). */
  function sincronizar(cliente, utilizador) {
    var locais = listar();
    var idsLocais = {};
    locais.forEach(function (r) { idsLocais[r.id] = true; });

    var pushRecorrentes = locais.length
      ? cliente.from('recorrentes').upsert(locais.map(function (r) { return paraSupabaseRecorrente(r, utilizador); })).then(function (r) { if (r.error) throw r.error; })
      : Promise.resolve();

    return pushRecorrentes.then(function () {
      return cliente.from('recorrentes').select('*').eq('utilizador', utilizador);
    }).then(function (r) {
      if (r.error) throw r.error;
      var mudouRecorrentes = false;
      (r.data || []).forEach(function (linha) {
        if (!idsLocais[linha.id]) { locais.push(doSupabaseRecorrente(linha)); idsLocais[linha.id] = true; mudouRecorrentes = true; }
      });
      if (mudouRecorrentes) guardarLista(locais);

      var confirmacoes = lerConfirmacoes();
      var linhasConfirmacoes = Object.keys(confirmacoes).map(function (k) {
        var partes = k.split('@');
        var recorrenteId = partes[0], mesReferencia = partes[1];
        if (!idsLocais[recorrenteId]) return null;
        var v = confirmacoes[k];
        return { recorrente: recorrenteId, mes_referencia: mesReferencia, estado: v.estado, movimento_gerado: v.movimentoId || null };
      }).filter(Boolean);

      var pushConfirmacoes = linhasConfirmacoes.length
        ? cliente.from('recorrentes_confirmacoes').upsert(linhasConfirmacoes, { onConflict: 'recorrente,mes_referencia' }).then(function (r2) { if (r2.error) throw r2.error; })
        : Promise.resolve();

      return pushConfirmacoes.then(function () {
        return cliente.from('recorrentes_confirmacoes').select('*');
      }).then(function (r2) {
        if (r2.error) throw r2.error;
        var mudouConfirmacoes = false;
        (r2.data || []).forEach(function (linha) {
          var k = chave(linha.recorrente, linha.mes_referencia);
          if (!confirmacoes[k]) {
            confirmacoes[k] = { estado: linha.estado, movimentoId: linha.movimento_gerado || undefined };
            mudouConfirmacoes = true;
          }
        });
        if (mudouConfirmacoes) guardarConfirmacoes(confirmacoes);
      });
    });
  }

  window.PennyRecorrentes = {
    listar: listar, obter: obter, criar: criar, atualizar: atualizar, remover: remover,
    estadoConfirmacao: estadoConfirmacao, confirmar: confirmar, ignorar: ignorar, desfazer: desfazer,
    sincronizar: sincronizar
  };
})();
