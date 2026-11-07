/* Penny Wise: avisos (situações por rever manualmente) — ex.: linhas
   de uma importação sem valor, ou outros dados por confirmar. Fica em
   localStorage, por agora: é uma lista pequena e só deste aparelho,
   não precisa de sincronizar com o Supabase. */

(function () {
  var CHAVE = 'pw_avisos';

  function listar() {
    try { return JSON.parse(localStorage.getItem(CHAVE) || '[]'); } catch (e) { return []; }
  }

  function guardarLista(lista) {
    localStorage.setItem(CHAVE, JSON.stringify(lista));
  }

  /* itens: [{ tipo, titulo, detalhe, movimentoId }]. Quando o aviso
     tem movimentoId (ex.: uma linha de importação sem valor, que ficou
     gravada como movimento incompleto), "Editar" no ecrã Avisos abre
     esse movimento no Registo. */
  function adicionar(itens) {
    var atual = listar();
    itens.forEach(function (item) {
      atual.push({
        id: 'av_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7),
        tipo: item.tipo,
        titulo: item.titulo,
        detalhe: item.detalhe || '',
        movimentoId: item.movimentoId || null,
        resolvido: false,
        criadoEm: new Date().toISOString()
      });
    });
    guardarLista(atual);
  }

  /* Dispensar um aviso de movimento incompleto apaga também o
     movimento (volta a ficar como estava antes de importar: por
     fazer, não um rascunho a 0€ perdido na lista). */
  function remover(id) {
    var lista = listar();
    var aviso = lista.find(function (a) { return a.id === id; });
    guardarLista(lista.filter(function (a) { return a.id !== id; }));
    if (aviso && aviso.movimentoId && window.PennyDB) {
      window.PennyDB.apagar(aviso.movimentoId);
    }
  }

  /* Quando o movimento ligado a um aviso é guardado com sucesso
     (editado no Registo), o aviso fica resolvido sozinho. */
  function resolverPorMovimento(movimentoId) {
    guardarLista(listar().filter(function (a) { return a.movimentoId !== movimentoId; }));
  }

  function pendentes() {
    return listar().filter(function (a) { return !a.resolvido; });
  }

  function contarPendentes() {
    return pendentes().length;
  }

  window.PennyAvisos = {
    listar: listar, adicionar: adicionar, remover: remover, resolverPorMovimento: resolverPorMovimento,
    pendentes: pendentes, contarPendentes: contarPendentes
  };
})();
