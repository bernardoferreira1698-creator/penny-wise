/* Penny Wise: objetivos de poupança, guardados em localStorage e
   sincronizados com a tabela "objetivos" do Supabase (ver sincronizar(),
   chamada por js/sync.js). Cada objetivo: {id, nome, valorAlvo, dataAlvo
   (AAAA-MM ou null), sugerido}. O valor atual de um objetivo não se
   guarda aqui: é sempre a soma das transferências (movimentos tipo
   "poupanca" com objetivo === id), para nunca poder desalinhar-se dos
   movimentos reais. */

(function () {
  var CHAVE = 'pw_objetivos';
  var CHAVE_SUGESTAO_DISPENSADA = 'pw_objetivo_sugestao_dispensada';

  function listar() {
    try { return JSON.parse(localStorage.getItem(CHAVE) || '[]'); } catch (e) { return []; }
  }
  function guardarLista(lista) { localStorage.setItem(CHAVE, JSON.stringify(lista)); }

  /* UUID a sério (não um prefixo "obj_..."): a coluna movimentos.objetivo
     no Supabase é do tipo uuid, por isso o id tem de ser compatível
     desde já, mesmo sem a sincronização dos objetivos em si (ver
     js/sync.js, que já guarda este campo ao sincronizar movimentos). */
  function gerarId() {
    return (crypto.randomUUID ? crypto.randomUUID() : 'obj_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10));
  }

  function obter(id) {
    return listar().find(function (o) { return o.id === id; }) || null;
  }

  function pedirSincronizacao() { if (window.PennySync) window.PennySync.sincronizar(); }

  /* Apaga no Supabase de imediato (melhor esforço: se estiver offline,
     fica por apagar lá até o objetivo ser criado de novo por engano —
     limitação aceite, dado não haver controlo de versões nestas
     tabelas pequenas). */
  function apagarRemoto(id) {
    if (!window.PennySupabase || !PennySupabase.configurado()) return;
    PennySupabase.sessaoAtual().then(function (sessao) {
      if (!sessao) return;
      return PennySupabase.cliente.from('objetivos').delete().eq('id', id).eq('utilizador', sessao.user.id);
    }).catch(function () {});
  }

  function criar(dados) {
    var lista = listar();
    var objetivo = Object.assign({ id: gerarId(), sugerido: false }, dados);
    lista.push(objetivo);
    guardarLista(lista);
    pedirSincronizacao();
    return objetivo;
  }

  function atualizar(id, alteracoes) {
    var lista = listar();
    var indice = lista.findIndex(function (o) { return o.id === id; });
    if (indice < 0) return null;
    lista[indice] = Object.assign({}, lista[indice], alteracoes);
    guardarLista(lista);
    pedirSincronizacao();
    return lista[indice];
  }

  function remover(id) {
    var objetivo = obter(id);
    guardarLista(listar().filter(function (o) { return o.id !== id; }));
    if (objetivo && objetivo.sugerido) localStorage.setItem(CHAVE_SUGESTAO_DISPENSADA, '1');
    apagarRemoto(id);
  }

  /* Garante que existe o objetivo sugerido (Fundo de emergência), a
     partir do momento em que há despesas fixas suficientes para o
     calcular — a não ser que o utilizador já o tenha apagado antes. */
  function garantirSugestaoFundoEmergencia(mediaDespesasFixas) {
    if (!mediaDespesasFixas) return;
    if (localStorage.getItem(CHAVE_SUGESTAO_DISPENSADA) === '1') return;
    var lista = listar();
    if (lista.some(function (o) { return o.sugerido; })) return;
    criar({
      nome: 'Fundo de emergência', sugerido: true,
      valorAlvo: Math.round(mediaDespesasFixas * 3 * 100) / 100, dataAlvo: null
    });
  }

  /* Soma das transferências (movimentos tipo "poupanca") ligadas a
     este objetivo. */
  function valorAtual(objetivoId, movimentos) {
    return movimentos.filter(function (m) { return m.tipo === 'poupanca' && m.objetivo === objetivoId; })
      .reduce(function (s, m) { return s + Math.abs(m.valor); }, 0);
  }

  function transferir(objetivoId, nomeObjetivo, valor, data) {
    return window.PennyDB.guardar({
      tipo: 'poupanca', objetivo: objetivoId, valor: Math.round(Math.abs(valor) * 100) / 100, data: data,
      descricao: 'Transferência: ' + nomeObjetivo, categoria: null, periodicidade: null,
      inesperada: false, nota: '', incompleto: false
    });
  }

  function paraSupabase(o, utilizador) {
    return {
      id: o.id, utilizador: utilizador, nome: o.nome, valor_alvo: o.valorAlvo,
      data_alvo: o.dataAlvo ? (o.dataAlvo + '-01') : null, sugerido: !!o.sugerido
    };
  }
  function doSupabase(r) {
    return { id: r.id, nome: r.nome, valorAlvo: Number(r.valor_alvo), dataAlvo: r.data_alvo ? r.data_alvo.slice(0, 7) : null, sugerido: !!r.sugerido };
  }

  /* Chamada por js/sync.js: envia os objetivos locais (upsert, não
     perde nada que já exista no servidor) e traz os que só existam no
     servidor (ex.: criados noutro aparelho) para esta lista local. Não
     substitui nem apaga objetivos já existentes aqui, para nunca
     perder uma edição feita neste aparelho ainda por enviar. */
  function sincronizar(cliente, utilizador) {
    var locais = listar();
    var push = locais.length
      ? cliente.from('objetivos').upsert(locais.map(function (o) { return paraSupabase(o, utilizador); })).then(function (r) { if (r.error) throw r.error; })
      : Promise.resolve();
    return push.then(function () {
      return cliente.from('objetivos').select('*').eq('utilizador', utilizador);
    }).then(function (r) {
      if (r.error) throw r.error;
      var idsLocais = {};
      locais.forEach(function (o) { idsLocais[o.id] = true; });
      var mudou = false;
      (r.data || []).forEach(function (linha) {
        if (!idsLocais[linha.id]) { locais.push(doSupabase(linha)); mudou = true; }
      });
      if (mudou) guardarLista(locais);
    });
  }

  window.PennyObjetivos = {
    listar: listar, obter: obter, criar: criar, atualizar: atualizar, remover: remover,
    garantirSugestaoFundoEmergencia: garantirSugestaoFundoEmergencia,
    valorAtual: valorAtual, transferir: transferir, sincronizar: sincronizar
  };
})();
