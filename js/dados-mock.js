/* Penny Wise: dados agregados de exemplo (orçamentos sugeridos,
   totais por mês, categorias). Os movimentos em si já são reais,
   desde a Fase 3 (ver js/db.js e js/sync.js) — isto que fica aqui é
   só o que ainda depende da importação do Excel (Fase 5) e dos
   cálculos a partir dos movimentos (Fase 4). */

(function () {
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  /* "Hoje" real, para os sítios que têm mesmo de mostrar a data atual
     (cabeçalho do Início). O resto dos números de exemplo são de
     outubro de 2026, o último mês "fechado" nos dados do Excel. */
  function hoje() { return new Date(); }

  function mesAnoLabel(ano, mes) {
    return MESES[mes].charAt(0).toUpperCase() + MESES[mes].slice(1) + ' ' + ano;
  }

  /* Intervalo de meses com dados (para a navegação por mês em Análise,
     Contas da casa e Resumos). Janeiro a outubro de 2026. */
  var MES_MAIS_ANTIGO = { ano: 2026, mes: 0 };
  var MES_MAIS_RECENTE = { ano: 2026, mes: 9 };

  function dentroDoIntervalo(ano, mes) {
    var chave = ano * 12 + mes;
    return chave >= MES_MAIS_ANTIGO.ano * 12 + MES_MAIS_ANTIGO.mes &&
      chave <= MES_MAIS_RECENTE.ano * 12 + MES_MAIS_RECENTE.mes;
  }

  /* O que sobrou em cada mês do ano (índice 0 = janeiro). null = sem
     registos ainda. */
  var SOBROU_POR_MES_2026 = [2780.72, 810.14, -205.39, 702.59, 443.14, 221.12, 406.44, 634.34, 1801.67, 113.50, null, null];

  /* Despesas de Habitação por mês (total da categoria). */
  var HABITACAO_POR_MES_2026 = [684.20, 659.40, 634.10, 651.30, 658.90, 648.50, 653.70, 643.20, 648.60, 623.85, null, null];

  var RENDIMENTO_POR_MES_2026 = [4130, 1980, 1710, 1965, 1640, 1836, 1650, 2390, 2824, 1560, null, null];

  /* Cada categoria de base tem um id fixo (gerado uma única vez), para
     poder ser sincronizada com a tabela "categorias" do Supabase desde
     o início, tal como as categorias criadas pelo utilizador (ver
     js/dados-mock.js: criarCategoria, e js/sync.js). */
  var CATEGORIAS_DESPESA = [
    { id: 'cd904e78-6b59-45d2-b2ae-ebcd06b69493', nome: 'Habitação', periodicidade: 'Fixa', subcategorias: ['Renda', 'Água', 'Gás', 'Eletricidade', 'Internet', 'Limpeza', 'Outros'] },
    { id: '90d7f130-97e6-47d1-82f4-203f6a7a51f3', nome: 'Serviços', periodicidade: 'Fixa' },
    { id: 'e6164a17-3f04-445c-8da9-8fab57406d81', nome: 'Supermercado', periodicidade: 'Variável' },
    { id: '7d661ead-b60c-435e-bee8-ca62b7c141f4', nome: 'Restaurantes', periodicidade: 'Variável' },
    { id: 'b401ea75-0d43-448b-9c08-e9058dcbda53', nome: 'Transportes', periodicidade: 'Variável' },
    { id: '32249b82-84f3-4438-b382-e7e8f995851d', nome: 'Combustível', periodicidade: 'Variável' },
    { id: 'c859384d-3bcb-46cc-81b5-edf722c46d8a', nome: 'Portagens', periodicidade: 'Variável' },
    { id: '14e52fcb-371f-4e14-bd87-1082297ce9fa', nome: 'Saídas à Noite', periodicidade: 'Variável' },
    { id: '6618105f-5ab1-4edb-af81-7ada5d0dbe24', nome: 'Roupa', periodicidade: 'Variável' },
    { id: '59c60fa3-73fe-42ec-bfea-efb650d941c2', nome: 'Saúde', periodicidade: 'Variável' },
    { id: 'bc518612-6d95-40cf-8d5b-754125aeaa23', nome: 'Tabaco', periodicidade: 'Variável' },
    { id: 'b7cfdcbd-3974-4aed-a45a-4e45da2e09d0', nome: 'Férias', periodicidade: 'Variável' },
    { id: '576caefe-d06a-43bf-9d20-085975809fa8', nome: 'Diversos', periodicidade: 'Variável' }
  ];

  var CATEGORIAS_RENDIMENTO = [
    { id: 'cb00c571-2fe4-4ce1-91a1-4c7783d0df42', nome: 'Ordenado', periodicidade: 'Fixa' },
    { id: '237c1597-ad0e-443f-b68f-e81908a1e6a0', nome: 'Subsídio de alimentação', periodicidade: 'Fixa' },
    { id: 'd3813cd7-9327-41e3-a5b0-23437b76a85a', nome: 'Cheques combustível', periodicidade: 'Fixa' },
    { id: '7c62dbdd-8d27-4355-b24a-b790dd565a5d', nome: 'Freelance', periodicidade: 'Variável' },
    { id: 'e2827e26-05fd-444d-86bb-ab2db63f2469', nome: 'Outros', periodicidade: 'Variável' }
  ];

  /* Orçamentos sugeridos (média dos últimos meses), usados em
     Orçamentos e no cartão de Orçamentos do Início. O utilizador pode
     substituir por um valor fixo ou uma percentagem do rendimento,
     guardado em localStorage (ver orcamentosPersonalizados abaixo). */
  var ORCAMENTOS_SUGERIDOS = {
    'Supermercado': 127, 'Restaurantes': 111, 'Transportes': 55, 'Combustível': 90,
    'Portagens': 20, 'Saídas à Noite': 60, 'Roupa': 141, 'Saúde': 40,
    'Tabaco': 37, 'Diversos': 85, 'Serviços': 88
  };

  var GASTO_REAL_OUTUBRO = {
    'Habitação': 575.00, 'Serviços': 85, 'Supermercado': 243, 'Restaurantes': 145,
    'Transportes': 42, 'Combustível': 30, 'Portagens': 18, 'Saídas à Noite': 54,
    'Roupa': 150, 'Saúde': 22, 'Tabaco': 35, 'Férias': 0, 'Diversos': 91
  };

  /* Detalhes de um mês (rendimento, fixas/variáveis, por categoria).
     Fora de outubro, não temos a repartição por categoria guardada,
     por isso escalamos a distribuição de outubro à despesa total
     desse mês, só para a demonstração ter números coerentes em
     qualquer mês do intervalo. A partir da Fase 4 isto vem da base
     de dados, mês a mês, a sério. */
  function detalhesDoMes(ano, mes) {
    var indice = mes; // 2026 é o único ano com dados de exemplo
    var rendimento = RENDIMENTO_POR_MES_2026[indice] || 0;
    var sobrou = SOBROU_POR_MES_2026[indice];
    if (sobrou === null || sobrou === undefined) return null;
    var despesasTotal = rendimento - sobrou;

    /* As despesas fixas (Habitação, Serviços) mantêm-se perto do valor
       habitual de outubro mês a mês (como na vida real, a renda e as
       mensalidades não variam muito); são as despesas variáveis que
       absorvem a diferença até ao total de despesas desse mês. Isto
       faz com que a proporção fixas/variáveis mude de mês para mês,
       em vez de ser sempre a mesma. */
    var fixasOutubro = CATEGORIAS_DESPESA.filter(function (c) { return c.periodicidade === 'Fixa'; })
      .reduce(function (s, c) { return s + (GASTO_REAL_OUTUBRO[c.nome] || 0); }, 0);
    var variaveisOutubro = CATEGORIAS_DESPESA.filter(function (c) { return c.periodicidade === 'Variável'; })
      .reduce(function (s, c) { return s + (GASTO_REAL_OUTUBRO[c.nome] || 0); }, 0);

    var despesasFixas = indice === 9 ? fixasOutubro : Math.min(fixasOutubro, despesasTotal);
    var despesasVariaveis = despesasTotal - despesasFixas;
    var fatorFixas = fixasOutubro ? despesasFixas / fixasOutubro : 0;
    var fatorVariaveis = variaveisOutubro ? despesasVariaveis / variaveisOutubro : 0;

    var categorias = CATEGORIAS_DESPESA.map(function (c) {
      var valorOutubro = GASTO_REAL_OUTUBRO[c.nome] || 0;
      var fator = indice === 9 ? 1 : (c.periodicidade === 'Fixa' ? fatorFixas : fatorVariaveis);
      var valor = Math.round(valorOutubro * fator * 100) / 100;
      return { nome: c.nome, periodicidade: c.periodicidade, valor: valor, pct: rendimento ? valor / rendimento : 0 };
    }).filter(function (c) { return c.valor > 0; }).sort(function (a, b) { return b.valor - a.valor; });

    return {
      ano: ano, mes: mes, rendimento: rendimento, despesasFixas: despesasFixas, despesasVariaveis: despesasVariaveis,
      sobrou: sobrou, pctPoupada: rendimento ? sobrou / rendimento : 0, categorias: categorias
    };
  }

  /* Habitação por subcategoria em outubro (o único mês com o
     detalhe); nos outros meses, escalamos pela mesma proporção, só
     para a demonstração ter números coerentes em qualquer mês. */
  var HABITACAO_SUBCATEGORIAS_OUTUBRO = {
    'Renda': 575.00, 'Limpeza': 22.50, 'Outros': 10.00, 'Água': 8.85, 'Internet': 7.50, 'Gás': 0, 'Eletricidade': 0
  };

  function detalhesHabitacaoDoMes(ano, mes) {
    var totalOutubro = Object.keys(HABITACAO_SUBCATEGORIAS_OUTUBRO).reduce(function (s, k) { return s + HABITACAO_SUBCATEGORIAS_OUTUBRO[k]; }, 0);
    var totalMes = HABITACAO_POR_MES_2026[mes];
    if (totalMes === null || totalMes === undefined) return null;
    var fator = mes === 9 ? 1 : (totalOutubro ? totalMes / totalOutubro : 0);
    var subcategorias = Object.keys(HABITACAO_SUBCATEGORIAS_OUTUBRO)
      .map(function (nome) { return { nome: nome, valor: Math.round(HABITACAO_SUBCATEGORIAS_OUTUBRO[nome] * fator * 100) / 100 }; })
      .filter(function (s) { return s.valor > 0; })
      .sort(function (a, b) { return a.valor - b.valor; });
    return { ano: ano, mes: mes, total: totalMes, subcategorias: subcategorias };
  }

  /* Categorias: a lista base (acima) mais o que o utilizador edita ou
     cria no ecrã Categorias, guardado em localStorage. Todos os
     ecrãs que mostram categorias (Registo, Orçamentos, Recorrentes,
     Movimentos, Categorias) passam por aqui, para ficarem sempre
     coerentes entre si. */
  var CHAVE_CATEGORIAS_EDITS = 'pw_categorias_edits';
  var CHAVE_CATEGORIAS_NOVAS = 'pw_categorias_novas';

  function lerEdicoesCategorias() {
    try { return JSON.parse(localStorage.getItem(CHAVE_CATEGORIAS_EDITS) || '{}'); } catch (e) { return {}; }
  }
  function lerCategoriasNovas() {
    try { return JSON.parse(localStorage.getItem(CHAVE_CATEGORIAS_NOVAS) || '{"despesas":[],"rendimentos":[]}'); }
    catch (e) { return { despesas: [], rendimentos: [] }; }
  }
  function guardarCategoriasNovas(novas) { localStorage.setItem(CHAVE_CATEGORIAS_NOVAS, JSON.stringify(novas)); }

  function aplicarEdicoesCategorias(lista) {
    var edicoes = lerEdicoesCategorias();
    return lista.map(function (c) {
      var edicao = edicoes[c.id];
      return {
        id: c.id, chaveOriginal: c.id,
        nome: edicao && edicao.nome ? edicao.nome : c.nome,
        periodicidade: edicao && edicao.periodicidade ? edicao.periodicidade : c.periodicidade,
        subcategorias: edicao && edicao.subcategorias ? edicao.subcategorias : (c.subcategorias || [])
      };
    });
  }
  function categoriasDespesa() {
    return aplicarEdicoesCategorias(CATEGORIAS_DESPESA.concat(lerCategoriasNovas().despesas));
  }
  function categoriasRendimento() {
    return aplicarEdicoesCategorias(CATEGORIAS_RENDIMENTO.concat(lerCategoriasNovas().rendimentos));
  }
  function pedirSincronizacao() { if (window.PennySync) window.PennySync.sincronizar(); }

  function guardarEdicaoCategoria(chaveOriginal, dados) {
    var edicoes = lerEdicoesCategorias();
    edicoes[chaveOriginal] = dados; // { nome, periodicidade, subcategorias }
    localStorage.setItem(CHAVE_CATEGORIAS_EDITS, JSON.stringify(edicoes));
    pedirSincronizacao();
  }
  /* grupo: 'despesas' ou 'rendimentos'. */
  function criarCategoria(grupo, dados) {
    var novas = lerCategoriasNovas();
    var nova = {
      id: (crypto.randomUUID ? crypto.randomUUID() : 'cat_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10)),
      nome: dados.nome, periodicidade: dados.periodicidade, subcategorias: dados.subcategorias || []
    };
    novas[grupo].push(nova);
    guardarCategoriasNovas(novas);
    pedirSincronizacao();
    return nova;
  }

  function orcamentosPersonalizados() {
    try { return JSON.parse(localStorage.getItem('pw_orcamentos') || '{}'); }
    catch (e) { return {}; }
  }
  function guardarOrcamentoPersonalizado(categoria, def) {
    var atual = orcamentosPersonalizados();
    atual[categoria] = def; // { tipo: 'valor'|'percentagem', valor: number }
    localStorage.setItem('pw_orcamentos', JSON.stringify(atual));
    pedirSincronizacao();
  }
  function removerOrcamentoPersonalizado(categoria) {
    var atual = orcamentosPersonalizados();
    delete atual[categoria];
    localStorage.setItem('pw_orcamentos', JSON.stringify(atual));
    if (window.PennySupabase && PennySupabase.configurado()) {
      PennySupabase.sessaoAtual().then(function (sessao) {
        if (!sessao) return;
        return PennySupabase.cliente.from('orcamentos').delete().eq('utilizador', sessao.user.id).eq('categoria', categoria);
      }).catch(function () {});
    }
  }
  /* Ao renomear uma categoria (ver js/ecras/categorias.js), o
     orçamento personalizado que tivesses definido para o nome antigo
     também muda de nome, para não ficar preso a uma categoria que já
     não existe em lado nenhum da lista. */
  function renomearOrcamentoPersonalizado(nomeAntigo, nomeNovo) {
    if (nomeAntigo === nomeNovo) return;
    var personalizados = orcamentosPersonalizados();
    if (!personalizados[nomeAntigo]) return;
    personalizados[nomeNovo] = personalizados[nomeAntigo];
    delete personalizados[nomeAntigo];
    localStorage.setItem('pw_orcamentos', JSON.stringify(personalizados));
    removerOrcamentoPersonalizado(nomeAntigo);
  }

  /* Chamadas por js/sync.js. Mesma lógica aditiva de js/objetivos.js:
     envia o que há aqui, traz o que só existe no servidor, nunca
     apaga nem sobrepõe o que já está neste aparelho. As subcategorias
     continuam só locais (detalhe secundário, sem id próprio aqui). */
  function sincronizarCategorias(cliente, utilizador) {
    var edicoes = lerEdicoesCategorias();
    var novas = lerCategoriasNovas();

    function linhasDoGrupo(base, novasDoGrupo, tipo) {
      return aplicarEdicoesCategorias(base.concat(novasDoGrupo)).map(function (c) {
        return {
          id: c.id, utilizador: utilizador, nome: c.nome, tipo: tipo,
          periodicidade_defeito: c.periodicidade === 'Fixa' ? 'fixa' : 'variavel'
        };
      });
    }
    var linhas = linhasDoGrupo(CATEGORIAS_DESPESA, novas.despesas, 'despesa')
      .concat(linhasDoGrupo(CATEGORIAS_RENDIMENTO, novas.rendimentos, 'rendimento'));

    var idsConhecidos = {};
    linhas.forEach(function (l) { idsConhecidos[l.id] = true; });

    return cliente.from('categorias').upsert(linhas).then(function (r) {
      if (r.error) throw r.error;
      return cliente.from('categorias').select('*').eq('utilizador', utilizador);
    }).then(function (r) {
      if (r.error) throw r.error;
      var mudouNovas = false, mudouEdicoes = false;
      (r.data || []).forEach(function (linha) {
        if (idsConhecidos[linha.id]) {
          /* Já conhecido aqui: se o nome ou a periodicidade vierem
             diferentes do que este aparelho tem (ex.: editado noutro
             aparelho), passa a ser tratado como uma edição local. */
          return;
        }
        // Categoria nova, criada noutro aparelho: entra como "nova" aqui também.
        var grupo = linha.tipo === 'rendimento' ? 'rendimentos' : 'despesas';
        novas[grupo].push({
          id: linha.id, nome: linha.nome,
          periodicidade: linha.periodicidade_defeito === 'fixa' ? 'Fixa' : 'Variável', subcategorias: []
        });
        idsConhecidos[linha.id] = true;
        mudouNovas = true;
      });
      if (mudouNovas) guardarCategoriasNovas(novas);
    });
  }

  function sincronizarOrcamentos(cliente, utilizador) {
    var locais = orcamentosPersonalizados();
    var categoriasLocais = Object.keys(locais);
    var linhas = categoriasLocais.map(function (cat) {
      return { utilizador: utilizador, categoria: cat, tipo: locais[cat].tipo || 'valor', valor_mensal: locais[cat].valor };
    });
    var push = linhas.length
      ? cliente.from('orcamentos').upsert(linhas, { onConflict: 'utilizador,categoria' }).then(function (r) { if (r.error) throw r.error; })
      : Promise.resolve();
    return push.then(function () {
      return cliente.from('orcamentos').select('*').eq('utilizador', utilizador);
    }).then(function (r) {
      if (r.error) throw r.error;
      var mudou = false;
      (r.data || []).forEach(function (linha) {
        if (!locais[linha.categoria]) {
          locais[linha.categoria] = { tipo: linha.tipo, valor: Number(linha.valor_mensal) };
          mudou = true;
        }
      });
      if (mudou) localStorage.setItem('pw_orcamentos', JSON.stringify(locais));
    });
  }

  function valorOrcamento(categoria, rendimentoMes) {
    var personalizados = orcamentosPersonalizados();
    var def = personalizados[categoria];
    if (def) {
      return def.tipo === 'percentagem' ? (rendimentoMes || 1560) * (def.valor / 100) : def.valor;
    }
    return ORCAMENTOS_SUGERIDOS[categoria] || 0;
  }

  window.PennyDados = {
    MESES: MESES,
    hoje: hoje,
    mesAnoLabel: mesAnoLabel,
    MES_MAIS_ANTIGO: MES_MAIS_ANTIGO,
    MES_MAIS_RECENTE: MES_MAIS_RECENTE,
    dentroDoIntervalo: dentroDoIntervalo,
    SOBROU_POR_MES_2026: SOBROU_POR_MES_2026,
    HABITACAO_POR_MES_2026: HABITACAO_POR_MES_2026,
    RENDIMENTO_POR_MES_2026: RENDIMENTO_POR_MES_2026,
    CATEGORIAS_DESPESA: CATEGORIAS_DESPESA,
    CATEGORIAS_RENDIMENTO: CATEGORIAS_RENDIMENTO,
    categoriasDespesa: categoriasDespesa,
    categoriasRendimento: categoriasRendimento,
    guardarEdicaoCategoria: guardarEdicaoCategoria,
    criarCategoria: criarCategoria,
    sincronizarCategorias: sincronizarCategorias,
    ORCAMENTOS_SUGERIDOS: ORCAMENTOS_SUGERIDOS,
    GASTO_REAL_OUTUBRO: GASTO_REAL_OUTUBRO,
    orcamentosPersonalizados: orcamentosPersonalizados,
    guardarOrcamentoPersonalizado: guardarOrcamentoPersonalizado,
    removerOrcamentoPersonalizado: removerOrcamentoPersonalizado,
    renomearOrcamentoPersonalizado: renomearOrcamentoPersonalizado,
    sincronizarOrcamentos: sincronizarOrcamentos,
    valorOrcamento: valorOrcamento,
    detalhesDoMes: detalhesDoMes,
    detalhesHabitacaoDoMes: detalhesHabitacaoDoMes
  };
})();
