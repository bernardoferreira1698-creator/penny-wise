/* Penny Wise: sincronização entre o IndexedDB local (js/db.js) e o
   Supabase. Só faz alguma coisa quando há conta ligada (Fase 2
   configurada) e sessão iniciada; sem isso, ou sem rede, a app
   continua a funcionar só com os dados locais. */

(function () {
  var A_SINCRONIZAR = false;
  var PEDIDO_NOVO = false;
  var ULTIMO_ERRO = null;
  var ULTIMA_VEZ_COM_SUCESSO = null;

  /* "AAAA-MM-DD" a partir dos componentes LOCAIS da data, nunca de
     toISOString() (que passa primeiro para UTC): com Lisboa em hora
     de verão, a meia-noite local vira "23h do dia anterior" em UTC,
     e qualquer movimento sincronizado ficava com a data trocada para
     o dia de antes, quase 7 meses por ano. */
  function dataLocalISO(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function linhaParaSupabase(m, utilizador) {
    return {
      id: m.id,
      utilizador: utilizador,
      tipo: m.tipo,
      data: dataLocalISO(m.data),
      mes_referencia: m.mesReferencia,
      descricao: m.descricao,
      valor: m.valor,
      valor_total: m.valorTotal || null,
      categoria: m.categoria,
      subcategoria: m.subcategoria || null,
      periodicidade: m.periodicidade,
      inesperada: !!m.inesperada,
      repartir_meses: m.repartirMeses || 1,
      nota: m.nota || null,
      objetivo: m.objetivo || null,
      criado_em: (m.criadoEm instanceof Date ? m.criadoEm : new Date(m.criadoEm)).toISOString()
    };
  }

  function linhaDoSupabase(r) {
    return {
      id: r.id, tipo: r.tipo, data: new Date(r.data + 'T00:00:00'), mesReferencia: r.mes_referencia,
      descricao: r.descricao, valor: Number(r.valor), valorTotal: r.valor_total ? Number(r.valor_total) : undefined,
      categoria: r.categoria, subcategoria: r.subcategoria || undefined, periodicidade: r.periodicidade,
      inesperada: !!r.inesperada, repartirMeses: r.repartir_meses || 1, nota: r.nota || '',
      objetivo: r.objetivo || undefined,
      criadoEm: new Date(r.criado_em), atualizadoEm: new Date(r.criado_em)
    };
  }

  /* Um só pedido para apagar e um só para guardar (upsert aceita uma
     lista), em vez de um pedido por movimento: depois de uma
     importação grande (ex.: 535 linhas), isto evita 535 viagens de
     rede seguidas, uma a uma. */
  function empurrarPendentes(cliente, utilizador) {
    return window.PennyDB.pendentes().then(function (pendentes) {
      var apagar = pendentes.filter(function (m) { return m.apagado; });
      var guardar = pendentes.filter(function (m) { return !m.apagado; });

      var promessaApagar = apagar.length
        ? cliente.from('movimentos').delete().in('id', apagar.map(function (m) { return m.id; })).then(function (r) {
            if (r.error) throw r.error;
            return Promise.all(apagar.map(function (m) { return window.PennyDB.remover(m.id); }));
          })
        : Promise.resolve();

      var promessaGuardar = guardar.length
        ? cliente.from('movimentos').upsert(guardar.map(function (m) { return linhaParaSupabase(m, utilizador); })).then(function (r) {
            if (r.error) throw r.error;
            return Promise.all(guardar.map(function (m) { return window.PennyDB.marcarSincronizado(m.id); }));
          })
        : Promise.resolve();

      return Promise.all([promessaApagar, promessaGuardar]);
    });
  }

  /* Primeira sincronização num dispositivo novo: se ainda não há
     nada localmente, traz o que já existir no servidor. */
  function puxarSeVazio(cliente, utilizador) {
    return window.PennyDB.todos().then(function (locais) {
      if (locais.length) return;
      return cliente.from('movimentos').select('*').eq('utilizador', utilizador).then(function (r) {
        if (r.error || !r.data || !r.data.length) return;
        return window.PennyDB.inserirDoServidor(r.data.map(linhaDoSupabase));
      });
    });
  }

  /* Recorrentes, Objetivos, Orçamentos personalizados, Categorias e
     Dicas guardadas: cada módulo trata do seu próprio envio/receção
     (ver js/recorrentes.js, js/objetivos.js, js/dados-mock.js,
     js/dicas-engine.js); isto só os chama, um a um, para uma falha
     num não travar os outros. */
  function sincronizarOutrosDados(cliente, utilizador) {
    var tarefas = [];
    if (window.PennyObjetivos) tarefas.push(window.PennyObjetivos.sincronizar(cliente, utilizador));
    if (window.PennyRecorrentes) tarefas.push(window.PennyRecorrentes.sincronizar(cliente, utilizador));
    if (window.PennyDados && window.PennyDados.sincronizarOrcamentos) tarefas.push(window.PennyDados.sincronizarOrcamentos(cliente, utilizador));
    if (window.PennyDados && window.PennyDados.sincronizarCategorias) tarefas.push(window.PennyDados.sincronizarCategorias(cliente, utilizador));
    if (window.PennyDicas && window.PennyDicas.sincronizarGuardadas) tarefas.push(window.PennyDicas.sincronizarGuardadas(cliente, utilizador));
    return Promise.all(tarefas.map(function (p) { return p.catch(function (erro) { console.warn('Falhou um dos outros dados a sincronizar:', erro); }); }));
  }

  function sincronizar() {
    if (A_SINCRONIZAR) { PEDIDO_NOVO = true; return Promise.resolve(); }
    if (!window.PennySupabase || !window.PennySupabase.configurado() || !navigator.onLine) return Promise.resolve();

    A_SINCRONIZAR = true;
    return window.PennySupabase.sessaoAtual().then(function (sessao) {
      if (!sessao) return;
      var cliente = window.PennySupabase.cliente;
      var utilizador = sessao.user.id;
      return puxarSeVazio(cliente, utilizador).then(function () {
        return empurrarPendentes(cliente, utilizador);
      }).then(function () {
        return sincronizarOutrosDados(cliente, utilizador);
      });
    }).then(function () {
      ULTIMO_ERRO = null;
      ULTIMA_VEZ_COM_SUCESSO = new Date();
    }).catch(function (erro) {
      ULTIMO_ERRO = erro;
      console.warn('Sincronização falhou, tenta-se outra vez mais tarde:', erro);
    }).then(function () {
      A_SINCRONIZAR = false;
      if (PEDIDO_NOVO) { PEDIDO_NOVO = false; sincronizar(); }
    });
  }

  /* Estado para mostrar em Definições (ver js/ecras/definicoes.js):
     quantos movimentos ainda não chegaram ao Supabase, e se a última
     tentativa falhou. */
  function estado() {
    return window.PennyDB.pendentes().then(function (pendentes) {
      return {
        configurado: !!(window.PennySupabase && window.PennySupabase.configurado()),
        pendentes: pendentes.length,
        erro: ULTIMO_ERRO ? (ULTIMO_ERRO.message || 'Falha ao sincronizar.') : null,
        ultimaVezComSucesso: ULTIMA_VEZ_COM_SUCESSO
      };
    });
  }

  window.addEventListener('online', sincronizar);
  document.addEventListener('DOMContentLoaded', sincronizar);

  window.PennySync = { sincronizar: sincronizar, estado: estado };
})();
