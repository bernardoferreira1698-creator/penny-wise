/* Penny Wise: motor de dicas. Carrega dados/dicas.json, calcula os
   gatilhos do mês a partir dos movimentos reais (js/calculos.js) e
   escolhe as dicas "Para ti" pela ordem de prioridade descrita no
   prompt. Módulo puro (sem DOM, sem IndexedDB): quem o chama passa
   sempre a lista de movimentos já carregada. */

(function () {
  var TEMA_LABEL = {
    'pagar-te-primeiro': 'Hábitos de poupança',
    'habitos': 'Hábitos de poupança',
    'orcamento': 'Orçamento e planeamento',
    'subscricoes': 'Para diminuir despesas fixas',
    'pequenos-gastos': 'Pequenos gastos',
    'compras-por-impulso': 'Compras por impulso',
    'gastar-com-consciencia': 'Gastar com consciência',
    'fundo-de-emergencia': 'Fundo de emergência',
    'rendimento': 'Para aumentar rendimentos',
    'longo-prazo': 'Pensar a longo prazo',
    'mentalidade': 'Mentalidade financeira',
    'aproveitar': 'Aproveitar sem culpa'
  };
  var ORDEM_TEMAS = Object.keys(TEMA_LABEL).filter(function (t, i, arr) {
    return arr.indexOf(t) === i;
  });

  var cache = null;
  function carregar() {
    if (cache) return cache;
    cache = fetch('dados/dicas.json').then(function (res) { return res.json(); }).catch(function () {
      // Sem rede/servidor: um pequeno conjunto de recurso para a app não ficar vazia.
      return [
        { id: 'd001', texto: 'Guarda pelo menos 1 em cada 10 euros que ganhas.', autor: 'George S. Clason', livro: 'O Homem Mais Rico da Babilónia', tema: 'pagar-te-primeiro', gatilhos: ['poupanca_baixa', 'geral'] }
      ];
    });
    return cache;
  }

  function mesAnteriorDe(ano, mes, n) {
    var total = ano * 12 + mes - (n || 1);
    return { ano: Math.floor(total / 12), mes: ((total % 12) + 12) % 12 };
  }

  /* Média de uma categoria nos "n" meses anteriores (só conta os
     meses que já têm dados), para o gatilho cat:<Categoria> ("30%
     acima da média dos 3 meses anteriores", ver prompt). */
  function mediaCategoriaMesesAnteriores(movimentos, ano, mes, nomeCategoria, n) {
    var valores = [];
    for (var i = 1; i <= n; i++) {
      var alvo = mesAnteriorDe(ano, mes, i);
      var detalhes = PennyCalculos.calcularMes(movimentos, alvo.ano, alvo.mes);
      if (!detalhes.temDados) continue;
      var categoria = detalhes.categorias.find(function (c) { return c.nome === nomeCategoria; });
      valores.push(categoria ? categoria.valor : 0);
    }
    return valores.length ? valores.reduce(function (s, v) { return s + v; }, 0) / valores.length : 0;
  }

  /* Gatilhos do mês, pela ordem de prioridade do prompt, a partir dos
     movimentos reais (js/calculos.js). "movimentos" é a lista
     completa (js/db.js), já carregada por quem chama. */
  function calcularGatilhos(movimentos, ano, mes) {
    var D = window.PennyDados;
    var detalhes = PennyCalculos.calcularMes(movimentos, ano, mes);
    var gatilhos = [];
    var motivos = {};

    if (!detalhes.temDados) return { gatilhos: ['geral'], motivos: motivos };

    if (detalhes.sobrou < 0) gatilhos.push('mes_negativo');

    var categoriasAcima = [];
    detalhes.categorias.forEach(function (c) {
      var media = mediaCategoriaMesesAnteriores(movimentos, ano, mes, c.nome, 3);
      if (media && c.valor >= media * 1.3) categoriasAcima.push({ categoria: c, media: media });
    });
    categoriasAcima.forEach(function (item) {
      gatilhos.push('cat:' + item.categoria.nome);
      motivos['cat:' + item.categoria.nome] = item.categoria.nome + ' +' + PennyMoeda.arredondarPct(item.categoria.valor / item.media - 1) + '% face à média';
    });
    if (categoriasAcima.length) { gatilhos.push('categoria_acima'); motivos['categoria_acima'] = categoriasAcima[0].categoria.nome + ' acima da média'; }

    var algumOrcamento80 = detalhes.categorias.some(function (c) {
      var orcamento = D.valorOrcamento(c.nome, detalhes.rendimento);
      return orcamento && c.valor >= orcamento * 0.8;
    });
    if (algumOrcamento80) { gatilhos.push('orcamento_80'); motivos['orcamento_80'] = 'Há orçamentos perto do limite'; }

    if (detalhes.pctPoupada < 0.10) { gatilhos.push('poupanca_baixa'); motivos['poupanca_baixa'] = 'Poupaste ' + PennyMoeda.arredondarPct(detalhes.pctPoupada) + '% este mês'; }

    var chaveMes = ano + '-' + String(mes + 1).padStart(2, '0');
    var movimentosDoMes = movimentos.filter(function (m) { return m.tipo === 'despesa' && m.mesReferencia === chaveMes; });
    var totalInesperadas = movimentosDoMes.filter(function (m) { return m.inesperada; }).reduce(function (s, m) { return s + Math.abs(m.valor); }, 0);
    var totalDespesasAmostra = movimentosDoMes.reduce(function (s, m) { return s + Math.abs(m.valor); }, 0);
    if (totalDespesasAmostra && totalInesperadas / totalDespesasAmostra > 0.10) { gatilhos.push('inesperadas'); motivos['inesperadas'] = 'Despesas inesperadas acima de 10%'; }

    var pequenos = movimentosDoMes.filter(function (m) { return Math.abs(m.valor) < 5; }).length;
    if (pequenos > 15) { gatilhos.push('pequenos_gastos'); motivos['pequenos_gastos'] = 'Mais de 15 pequenas despesas este mês'; }

    var mesAnterior = mesAnteriorDe(ano, mes, 1);
    var anterior = PennyCalculos.calcularMes(movimentos, mesAnterior.ano, mesAnterior.mes);
    if (anterior.temDados) {
      var servicosAtual = (detalhes.categorias.find(function (c) { return c.nome === 'Serviços'; }) || {}).valor || 0;
      var servicosAntes = (anterior.categorias.find(function (c) { return c.nome === 'Serviços'; }) || {}).valor || 0;
      if (servicosAtual > servicosAntes) { gatilhos.push('servicos_subir'); motivos['servicos_subir'] = 'Serviços subiu face ao mês anterior'; }
    }

    if (detalhes.pctPoupada >= 0.20) { gatilhos.push('poupanca_alta'); motivos['poupanca_alta'] = 'Poupaste ' + PennyMoeda.arredondarPct(detalhes.pctPoupada) + '% este mês'; }

    gatilhos.push('geral');
    return { gatilhos: gatilhos, motivos: motivos };
  }

  function escolherParaTi(dicas, calculo, limite) {
    var escolhidas = [];
    var usadas = {};
    calculo.gatilhos.forEach(function (gatilho) {
      if (escolhidas.length >= limite) return;
      dicas.forEach(function (dica) {
        if (escolhidas.length >= limite) return;
        if (usadas[dica.id]) return;
        if (dica.gatilhos && dica.gatilhos.indexOf(gatilho) >= 0) {
          usadas[dica.id] = true;
          escolhidas.push({ dica: dica, motivo: calculo.motivos[gatilho] || null, gatilho: gatilho });
        }
      });
    });
    return escolhidas;
  }

  function agruparPorTema(dicas) {
    /* Vários temas partilham o mesmo rótulo (ex.: "pagar-te-primeiro"
       e "habitos" são ambos "Hábitos de poupança"), por isso agrupa-se
       pelo rótulo final, não pela chave do tema, para não haver
       cabeçalhos repetidos. */
    var grupos = {};
    var ordemRotulos = [];
    dicas.forEach(function (d) {
      var tema = d.tema || 'mentalidade';
      var rotulo = TEMA_LABEL[tema] || tema;
      if (!grupos[rotulo]) { grupos[rotulo] = []; ordemRotulos.push(rotulo); }
      grupos[rotulo].push(d);
    });
    var ordemPreferida = ORDEM_TEMAS.map(function (t) { return TEMA_LABEL[t]; })
      .filter(function (r, i, arr) { return arr.indexOf(r) === i; });
    return ordemPreferida.filter(function (r) { return grupos[r]; }).map(function (r) {
      return { rotulo: r, dicas: grupos[r] };
    });
  }

  /* Dica do dia (Início): muda uma vez por dia e não repete nenhuma
     dica mostrada nos últimos 30 dias. O histórico guarda-se em
     localStorage (ainda não sincronizado com o Supabase, tal como
     js/recorrentes.js e js/objetivos.js). */
  var CHAVE_DICA_DIA = 'pw_dica_dia_historico';

  function lerHistoricoDicaDia() {
    try { return JSON.parse(localStorage.getItem(CHAVE_DICA_DIA) || '[]'); } catch (e) { return []; }
  }
  function guardarHistoricoDicaDia(lista) {
    localStorage.setItem(CHAVE_DICA_DIA, JSON.stringify(lista.slice(-60)));
  }
  function hojeISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function escolherDicaDoDia(dicas, calculo) {
    if (!dicas.length) return null;
    var chaveHoje = hojeISO();
    var historico = lerHistoricoDicaDia();

    var jaEscolhidaHoje = historico.find(function (h) { return h.data === chaveHoje; });
    if (jaEscolhidaHoje) {
      var dicaGuardada = dicas.find(function (d) { return d.id === jaEscolhidaHoje.dicaId; });
      if (dicaGuardada) return { dica: dicaGuardada, motivo: jaEscolhidaHoje.motivo || null };
    }

    var limite = new Date();
    limite.setDate(limite.getDate() - 30);
    var limiteISO = limite.getFullYear() + '-' + String(limite.getMonth() + 1).padStart(2, '0') + '-' + String(limite.getDate()).padStart(2, '0');
    var usadosRecentes = historico.filter(function (h) { return h.data >= limiteISO; }).map(function (h) { return h.dicaId; });

    var candidatas = escolherParaTi(dicas, calculo, dicas.length);
    var escolha = candidatas.find(function (item) { return usadosRecentes.indexOf(item.dica.id) < 0; }) || candidatas[0];
    if (!escolha) return null;

    historico.push({ data: chaveHoje, dicaId: escolha.dica.id, motivo: escolha.motivo || null });
    guardarHistoricoDicaDia(historico);
    return escolha;
  }

  /* Dicas guardadas pelo utilizador (botão de marcador, em Dicas e no
     cartão "Dica do dia" do Início). Centralizado aqui (em vez de
     duplicado nos dois ecrãs) para a sincronização (js/sync.js) ter um
     único sítio de onde ler e para onde escrever. */
  var CHAVE_GUARDADAS = 'pw_dicas_guardadas';

  function listarGuardadas() {
    try { return JSON.parse(localStorage.getItem(CHAVE_GUARDADAS) || '[]'); } catch (e) { return []; }
  }
  function guardarListaGuardadas(lista) { localStorage.setItem(CHAVE_GUARDADAS, JSON.stringify(lista)); }

  function estaGuardada(dicaId) { return listarGuardadas().indexOf(dicaId) >= 0; }

  function numeroDaDica(dicaId) { return Number(String(dicaId).replace(/[^0-9]/g, '')); }
  function dicaIdDoNumero(numero) { return 'd' + String(numero).padStart(3, '0'); }

  function atualizarGuardadaRemoto(dicaId, guardada) {
    if (!window.PennySupabase || !PennySupabase.configurado()) return;
    PennySupabase.sessaoAtual().then(function (sessao) {
      if (!sessao) return;
      return PennySupabase.cliente.from('dicas_estado')
        .upsert({ utilizador: sessao.user.id, dica_id: numeroDaDica(dicaId), guardada: guardada }, { onConflict: 'utilizador,dica_id' });
    }).catch(function () {});
  }

  function alternarGuardada(dicaId) {
    var lista = listarGuardadas();
    var indice = lista.indexOf(dicaId);
    var acabouDeGuardar = indice < 0;
    if (acabouDeGuardar) lista.push(dicaId); else lista.splice(indice, 1);
    guardarListaGuardadas(lista);
    atualizarGuardadaRemoto(dicaId, acabouDeGuardar);
    return acabouDeGuardar; // true = acabou de guardar; false = acabou de retirar
  }

  /* Chamada por js/sync.js: traz dicas guardadas noutro aparelho (não
     apaga nada aqui; retirar uma dica propaga-se de imediato, ver
     atualizarGuardadaRemoto acima). */
  function sincronizarGuardadas(cliente, utilizador) {
    return cliente.from('dicas_estado').select('dica_id').eq('utilizador', utilizador).eq('guardada', true).then(function (r) {
      if (r.error) throw r.error;
      var locais = listarGuardadas();
      var mudou = false;
      (r.data || []).forEach(function (linha) {
        var id = dicaIdDoNumero(linha.dica_id);
        if (locais.indexOf(id) < 0) { locais.push(id); mudou = true; }
      });
      if (mudou) guardarListaGuardadas(locais);
    });
  }

  window.PennyDicas = {
    carregar: carregar,
    calcularGatilhos: calcularGatilhos,
    escolherParaTi: escolherParaTi,
    escolherDicaDoDia: escolherDicaDoDia,
    agruparPorTema: agruparPorTema,
    TEMA_LABEL: TEMA_LABEL,
    listarGuardadas: listarGuardadas,
    guardarListaGuardadas: guardarListaGuardadas,
    estaGuardada: estaGuardada,
    alternarGuardada: alternarGuardada,
    sincronizarGuardadas: sincronizarGuardadas
  };
})();
