/* Penny Wise: camada local dos movimentos, em IndexedDB (funciona
   sem rede). Cada movimento guarda "pendenteSync" (ainda não chegou
   ao Supabase) e "apagado" (marcado para apagar, mas ainda não
   confirmado no servidor); a sincronização a sério está em
   js/sync.js. Enquanto não há conta ligada (Fase 2) ou sem rede, a
   app continua a funcionar perfeitamente só com isto. */

(function () {
  var NOME_BD = 'penny-wise';
  var VERSAO_BD = 1;
  var LOJA = 'movimentos';
  var promessaBD = null;

  function abrir() {
    if (promessaBD) return promessaBD;
    promessaBD = new Promise(function (resolve, reject) {
      var pedido = indexedDB.open(NOME_BD, VERSAO_BD);
      pedido.onupgradeneeded = function () {
        var bd = pedido.result;
        if (!bd.objectStoreNames.contains(LOJA)) {
          var loja = bd.createObjectStore(LOJA, { keyPath: 'id' });
          loja.createIndex('porData', 'data', { unique: false });
        }
      };
      pedido.onsuccess = function () { resolve(pedido.result); };
      pedido.onerror = function () { reject(pedido.error); };
    });
    return promessaBD;
  }

  /* Fecha a ligação ao IndexedDB antes de sair para outra página, a
     seguir a uma gravação grande (ex.: importação do Excel). Sem
     isto, a ligação desta página por vezes ainda andava a demorar a
     fechar quando a página seguinte abria a sua própria ligação, e os
     dados acabados de guardar apareciam em branco até a app ser
     reaberta de raiz. */
  function fechar() {
    if (!promessaBD) return Promise.resolve();
    return promessaBD.then(function (bd) { bd.close(); }).then(function () {
      promessaBD = null;
    }, function () { promessaBD = null; });
  }

  /* Quantas gravações (readwrite) estão a meio neste preciso momento.
     js/nav.js usa isto para nunca mudar de ecrã a meio de uma
     gravação por terminar (ver aguardarEscritas): nalguns sítios da
     app uma ação (ex.: dispensar um Aviso) já parece concluída no
     ecrã antes de a gravação real no IndexedDB ter terminado — sem
     esperar por ela, sair do ecrã nesse instante podia fazer a
     página seguinte ler os dados ainda sem essa alteração. */
  var escritasAtivas = 0;

  function comLoja(modo, fazer) {
    if (modo === 'readwrite') escritasAtivas++;
    return abrir().then(function (bd) {
      return new Promise(function (resolve, reject) {
        var tx = bd.transaction(LOJA, modo);
        var loja = tx.objectStore(LOJA);
        var resultado = fazer(loja);
        tx.oncomplete = function () { if (modo === 'readwrite') escritasAtivas--; resolve(resultado); };
        tx.onerror = function () { if (modo === 'readwrite') escritasAtivas--; reject(tx.error); };
      });
    }, function (erro) {
      if (modo === 'readwrite') escritasAtivas--;
      throw erro;
    });
  }

  /* Resolve assim que não houver nenhuma gravação a meio (no máximo
     1,5s de espera, para nunca prender a navegação indefinidamente
     se algo correr mal). */
  function aguardarEscritas() {
    if (!escritasAtivas) return Promise.resolve();
    return new Promise(function (resolve) {
      var tempoLimite = setTimeout(function () { clearInterval(intervalo); resolve(); }, 1500);
      var intervalo = setInterval(function () {
        if (!escritasAtivas) { clearInterval(intervalo); clearTimeout(tempoLimite); resolve(); }
      }, 20);
    });
  }

  function pedidoParaPromessa(pedido) {
    return new Promise(function (resolve, reject) {
      pedido.onsuccess = function () { resolve(pedido.result); };
      pedido.onerror = function () { reject(pedido.error); };
    });
  }

  function gerarId() {
    return crypto.randomUUID();
  }

  function calcularMesReferencia(data) {
    return data.getFullYear() + '-' + String(data.getMonth() + 1).padStart(2, '0');
  }

  /* Todos os movimentos não apagados, mais recentes primeiro. */
  function todos() {
    return abrir().then(function (bd) {
      var tx = bd.transaction(LOJA, 'readonly');
      return pedidoParaPromessa(tx.objectStore(LOJA).getAll());
    }).then(function (lista) {
      return lista.filter(function (m) { return !m.apagado; })
        .sort(function (a, b) { return b.data - a.data; });
    });
  }

  function obter(id) {
    return abrir().then(function (bd) {
      var tx = bd.transaction(LOJA, 'readonly');
      return pedidoParaPromessa(tx.objectStore(LOJA).get(id));
    });
  }

  /* Cria um movimento novo. "dados" segue a forma vinda do ecrã de
     Registo (ver js/ecras/registo.js). */
  function guardar(dados) {
    var agora = new Date();
    var movimento = Object.assign({
      id: gerarId(),
      mesReferencia: dados.mesReferencia || calcularMesReferencia(dados.data),
      criadoEm: agora,
      atualizadoEm: agora,
      apagado: false,
      pendenteSync: true
    }, dados);
    return comLoja('readwrite', function (loja) { loja.put(movimento); }).then(function () {
      if (window.PennySync) window.PennySync.sincronizar();
      return movimento;
    });
  }

  /* Guarda muitos movimentos de uma vez (ex.: importação do Excel),
     numa única transação e com uma só sincronização no fim, em vez de
     uma por movimento. */
  function guardarVarios(listaDados) {
    var agora = new Date();
    var movimentos = listaDados.map(function (dados) {
      return Object.assign({
        id: gerarId(),
        mesReferencia: dados.mesReferencia || calcularMesReferencia(dados.data),
        criadoEm: agora,
        atualizadoEm: agora,
        apagado: false,
        pendenteSync: true
      }, dados);
    });
    return comLoja('readwrite', function (loja) {
      movimentos.forEach(function (m) { loja.put(m); });
    }).then(function () {
      if (window.PennySync) window.PennySync.sincronizar();
      return movimentos;
    });
  }

  function atualizar(id, alteracoes) {
    return obter(id).then(function (atual) {
      if (!atual) throw new Error('Movimento não encontrado.');
      var movimento = Object.assign({}, atual, alteracoes, { atualizadoEm: new Date(), pendenteSync: true });
      if (alteracoes.data && !alteracoes.mesReferencia) movimento.mesReferencia = calcularMesReferencia(alteracoes.data);
      return comLoja('readwrite', function (loja) { loja.put(movimento); }).then(function () {
        if (window.PennySync) window.PennySync.sincronizar();
        return movimento;
      });
    });
  }

  /* Apaga: marca como apagado (e por sincronizar), para a remoção
     chegar também ao Supabase; só desaparece de vez do IndexedDB
     depois de confirmado no servidor (ver js/sync.js). Sem conta
     ligada, remove-se logo a seguir, não há nada para sincronizar. */
  function apagar(id) {
    return obter(id).then(function (atual) {
      if (!atual) return;
      var semSupabase = !window.PennySupabase || !window.PennySupabase.configurado();
      if (semSupabase) {
        return comLoja('readwrite', function (loja) { loja.delete(id); });
      }
      var movimento = Object.assign({}, atual, { apagado: true, pendenteSync: true, atualizadoEm: new Date() });
      return comLoja('readwrite', function (loja) { loja.put(movimento); }).then(function () {
        if (window.PennySync) window.PennySync.sincronizar();
      });
    });
  }

  /* Usadas só pelo js/sync.js. */
  function marcarSincronizado(id) {
    return obter(id).then(function (atual) {
      if (!atual) return;
      var movimento = Object.assign({}, atual, { pendenteSync: false });
      return comLoja('readwrite', function (loja) { loja.put(movimento); });
    });
  }
  function remover(id) {
    return comLoja('readwrite', function (loja) { loja.delete(id); });
  }
  /* Apaga TODOS os movimentos locais (usado ao terminar sessão, para
     o próximo utilizador a entrar neste aparelho não herdar dados de
     outra conta). */
  function limparTudo() {
    return comLoja('readwrite', function (loja) { loja.clear(); });
  }

  /* Ao renomear uma categoria (ver js/ecras/categorias.js), atualiza
     também todos os movimentos já guardados com o nome antigo: sem
     isto, essas despesas/rendimentos "desapareciam" das somas em
     Análise do mês e Orçamentos (ficavam guardados com um nome que
     já não existe em lado nenhum da lista). */
  function renomearCategoria(categoriaAntiga, categoriaNova) {
    if (categoriaAntiga === categoriaNova) return Promise.resolve();
    return todos().then(function (lista) {
      var afetados = lista.filter(function (m) { return m.categoria === categoriaAntiga; });
      if (!afetados.length) return;
      var agora = new Date();
      return comLoja('readwrite', function (loja) {
        afetados.forEach(function (m) {
          loja.put(Object.assign({}, m, { categoria: categoriaNova, atualizadoEm: agora, pendenteSync: true }));
        });
      });
    }).then(function () {
      if (window.PennySync) window.PennySync.sincronizar();
    });
  }
  function pendentes() {
    return abrir().then(function (bd) {
      var tx = bd.transaction(LOJA, 'readonly');
      return pedidoParaPromessa(tx.objectStore(LOJA).getAll());
    }).then(function (lista) { return lista.filter(function (m) { return m.pendenteSync; }); });
  }
  /* Insere movimentos vindos do servidor (primeira sincronização
     num dispositivo novo), sem os marcar como por sincronizar. */
  function inserirDoServidor(lista) {
    return comLoja('readwrite', function (loja) {
      lista.forEach(function (m) { loja.put(Object.assign({}, m, { pendenteSync: false, apagado: false })); });
    });
  }

  /* Mês (ano + mês, 0-indexado) do movimento mais antigo registado,
     para a navegação por mês/ano (Mês, Ano, Movimentos) não deixar
     recuar para antes de começares a registar despesas. null se ainda
     não houver nenhum movimento. */
  function primeiroMesComDados() {
    return todos().then(function (lista) {
      if (!lista.length) return null;
      var menor = lista.reduce(function (m, atual) {
        return (!m || atual.mesReferencia < m) ? atual.mesReferencia : m;
      }, null);
      var partes = menor.split('-');
      return { ano: Number(partes[0]), mes: Number(partes[1]) - 1 };
    });
  }

  function ultimosMovimentos(n) {
    return todos().then(function (lista) {
      return lista.filter(function (m) { return m.tipo === 'despesa' || m.tipo === 'rendimento'; }).slice(0, n || 5);
    });
  }

  function categoriasMaisUsadas(listaCategorias) {
    return todos().then(function (lista) {
      var contagem = {};
      lista.forEach(function (m) {
        if (m.tipo !== 'despesa') return;
        contagem[m.categoria] = (contagem[m.categoria] || 0) + 1;
      });
      var nomes = listaCategorias.map(function (c) { return c.nome; });
      return nomes.slice().sort(function (a, b) { return (contagem[b] || 0) - (contagem[a] || 0); });
    });
  }

  function sugerirDescricoes(textoParcial, limite) {
    return todos().then(function (lista) {
      var texto = (textoParcial || '').trim().toLowerCase();
      var vistos = {};
      if (!texto) {
        var recentes = [];
        lista.forEach(function (m) {
          if (m.tipo !== 'despesa' || vistos[m.descricao]) return;
          vistos[m.descricao] = true;
          recentes.push(m);
        });
        return recentes.slice(0, limite || 3);
      }
      var comecaPor = [], contem = [];
      lista.forEach(function (m) {
        if (m.tipo !== 'despesa' || vistos[m.descricao]) return;
        var desc = m.descricao.toLowerCase();
        if (desc.indexOf(texto) === 0) { comecaPor.push(m); vistos[m.descricao] = true; }
        else if (desc.indexOf(texto) > -1) { contem.push(m); vistos[m.descricao] = true; }
      });
      return comecaPor.concat(contem).slice(0, limite || 5);
    });
  }

  function ultimaCategoriaPara(descricao) {
    return todos().then(function (lista) {
      var m = lista.find(function (m) { return m.descricao === descricao; });
      return m ? { categoria: m.categoria, periodicidade: m.periodicidade } : null;
    });
  }

  window.PennyDB = {
    todos: todos, obter: obter, guardar: guardar, guardarVarios: guardarVarios, atualizar: atualizar, apagar: apagar,
    marcarSincronizado: marcarSincronizado, remover: remover, limparTudo: limparTudo, renomearCategoria: renomearCategoria,
    pendentes: pendentes, inserirDoServidor: inserirDoServidor,
    ultimosMovimentos: ultimosMovimentos, categoriasMaisUsadas: categoriasMaisUsadas,
    sugerirDescricoes: sugerirDescricoes, ultimaCategoriaPara: ultimaCategoriaPara,
    calcularMesReferencia: calcularMesReferencia, primeiroMesComDados: primeiroMesComDados,
    fechar: fechar, aguardarEscritas: aguardarEscritas
  };
})();
