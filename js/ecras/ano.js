/* Ecrã Análise do ano: gráfico de barras a partir dos movimentos
   reais, com seletor de ano (sem limites, como em Movimentos),
   começando sempre no ano atual. */

document.addEventListener('DOMContentLoaded', function () {
  var D = window.PennyDados;
  var MESES_INICIAL = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  var hoje = D.hoje();
  var anoSelecionado = hoje.getFullYear();
  var TODOS_MOVIMENTOS = [];
  var limiteAntigo = null; // {ano, mes} do primeiro mês com movimentos; null = sem histórico nenhum ainda

  function podeRecuar() { return !!limiteAntigo && anoSelecionado > limiteAntigo.ano; }
  function podeAvancar() { return anoSelecionado < hoje.getFullYear(); }
  function atualizarBotaoAnterior() {
    document.getElementById('ano-anterior').style.visibility = podeRecuar() ? 'visible' : 'hidden';
    document.getElementById('ano-seguinte').style.visibility = podeAvancar() ? 'visible' : 'hidden';
  }

  var grafico = document.getElementById('grafico-ano');
  var bolhaAtual = null;
  function esconderBolha() { if (bolhaAtual) { bolhaAtual.remove(); bolhaAtual = null; } }
  document.addEventListener('click', function (evento) {
    if (!evento.target.closest('.grafico-ano__barra')) esconderBolha();
  });

  function render() {
    var calculo = PennyCalculos.calcularAno(TODOS_MOVIMENTOS, anoSelecionado);

    document.getElementById('ano-titulo').textContent = String(anoSelecionado);
    document.getElementById('ano-fundo').textContent = String(anoSelecionado);
    atualizarBotaoAnterior();

    document.getElementById('frase-poupado').innerHTML =
      '<span class="muted">Até agora,</span><br><span class="muted">poupaste</span><br><span>' + PennyMoeda.formatar(calculo.total) + '</span>';
    var pctAno = PennyMoeda.arredondarPct(calculo.pctPoupadaAno);
    document.getElementById('chips-ano').innerHTML =
      '<span class="chip chip--warn">' + pctAno + '% do rendimento</span>' +
      '<span class="chip">média ' + PennyMoeda.formatar(calculo.mediaMensal) + ' por mês</span>';

    var melhor = calculo.melhorMes, pior = calculo.piorMes;
    var painelMelhorPior = document.getElementById('melhor-pior-mes');
    painelMelhorPior.innerHTML = !melhor ? '' :
      '<div class="split-pill__item"><span class="stat-pill__label">Melhor mês</span><span style="font-size:16px; font-weight:500">' +
      (D.MESES[melhor.mes].charAt(0).toUpperCase() + D.MESES[melhor.mes].slice(1)) + ' · ' + PennyMoeda.formatar(melhor.sobrou) + '</span></div>' +
      '<div class="split-pill__item"><span class="stat-pill__label">Pior mês</span><span style="font-size:16px; font-weight:500" class="warn-text">' +
      (D.MESES[pior.mes].charAt(0).toUpperCase() + D.MESES[pior.mes].slice(1)) + ' · ' + PennyMoeda.formatar(pior.sobrou) + '</span></div>';

    var max = calculo.porMes.reduce(function (m, atual) { return atual.temDados ? Math.max(m, Math.abs(atual.sobrou)) : m; }, 1);
    esconderBolha();
    grafico.innerHTML = '';

    calculo.porMes.forEach(function (m, indice) {
      var coluna = document.createElement('div');
      coluna.className = 'grafico-ano__coluna';
      var cima = document.createElement('div');
      cima.className = 'grafico-ano__cima';
      var baixo = document.createElement('div');
      baixo.className = 'grafico-ano__baixo';

      if (m.temDados) {
        var barra = document.createElement('button');
        barra.type = 'button';
        barra.className = 'grafico-ano__barra';
        var altura = Math.max(4, Math.round((Math.abs(m.sobrou) / max) * 110));
        barra.style.height = altura + 'px';
        barra.style.background = (anoSelecionado === hoje.getFullYear() && indice === hoje.getMonth()) ? 'var(--text)' : 'var(--bar-v)';
        barra.setAttribute('aria-label', D.MESES[indice] + ': ' + PennyMoeda.formatar(m.sobrou));
        if (m.sobrou < 0) { barra.classList.add('grafico-ano__barra--baixo'); barra.style.background = 'var(--muted)'; baixo.appendChild(barra); }
        else cima.appendChild(barra);

        barra.addEventListener('click', function (evento) {
          evento.stopPropagation();
          esconderBolha();
          var bolha = document.createElement('span');
          bolha.className = 'grafico-ano__bolha';
          bolha.textContent = PennyMoeda.formatar(m.sobrou);
          var rectBarra = barra.getBoundingClientRect();
          var rectGrafico = grafico.closest('.glass').getBoundingClientRect();
          bolha.style.left = (rectBarra.left - rectGrafico.left + rectBarra.width / 2) + 'px';
          bolha.style.top = (rectBarra.top - rectGrafico.top) + 'px';
          grafico.closest('.glass').appendChild(bolha);
          bolhaAtual = bolha;
        });
      } else {
        var vazio = document.createElement('div');
        vazio.style.cssText = 'height:4px; border-radius:2px; background:rgba(255,255,255,0.12); width:100%; max-width:16px; margin:0 auto';
        cima.appendChild(vazio);
      }

      var rotulo = document.createElement('span');
      rotulo.className = 'muted';
      rotulo.style.fontSize = '11px';
      rotulo.textContent = MESES_INICIAL[indice];

      coluna.appendChild(cima);
      coluna.appendChild(baixo);
      coluna.appendChild(rotulo);
      grafico.appendChild(coluna);
    });
  }

  document.getElementById('ano-anterior').addEventListener('click', function () {
    if (!podeRecuar()) return;
    anoSelecionado--;
    render();
  });
  document.getElementById('ano-seguinte').addEventListener('click', function () {
    if (!podeAvancar()) return;
    anoSelecionado++;
    render();
  });

  /* Também chamada depois de gravar/apagar um movimento no popup de
     Registo, para atualizar este ano sem recarregar a página. */
  function carregarDados() {
    return Promise.all([PennyDB.todos(), PennyDB.primeiroMesComDados()]).then(function (resultados) {
      TODOS_MOVIMENTOS = resultados[0];
      limiteAntigo = resultados[1];
      render();
    });
  }
  window.PennyAoRegistar = carregarDados;

  carregarDados().then(function () {
    if (window.pwPronto) window.pwPronto(1)();
  });
});
