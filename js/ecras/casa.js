/* Ecrã Contas da casa: cabeçalho sempre do mês atual, lista de
   subcategorias de Habitação por ordem crescente de valor, e gráfico
   com os 12 meses do ano corrente (os meses sem registos aparecem
   esbatidos), com o valor de cada barra visível ao tocar. Tudo a
   partir dos movimentos reais (js/calculos.js). */

document.addEventListener('DOMContentLoaded', function () {
  var D = window.PennyDados;
  var MESES_INICIAL = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  var hoje = D.hoje();
  var ano = hoje.getFullYear(), mes = hoje.getMonth();
  var nomeMes = D.MESES[mes];

  PennyDB.todos().then(function (movimentos) {
    var detalhes = PennyCalculos.calcularCategoriaDoMes(movimentos, ano, mes, 'Habitação');

    if (!detalhes.temDados) {
      document.getElementById('frase-casa').innerHTML =
        '<span class="muted">Ainda não há despesas de Habitação registadas em</span><br>' + nomeMes + '.';
    } else {
      document.getElementById('frase-casa').innerHTML =
        '<span class="muted">A casa custou</span><br>' + PennyMoeda.formatar(detalhes.total) + '<br><span class="muted">em ' + nomeMes + '.</span>';
    }

    var lista = document.getElementById('lista-habitacao');
    var NOMES_VISIVEIS = { 'Outros': 'Outros (compras para casa)' };
    detalhes.subcategorias.forEach(function (s) {
      var linha = document.createElement('div');
      linha.className = 'glass-rows__row';
      linha.innerHTML = '<span class="glass-rows__title">' + (NOMES_VISIVEIS[s.nome] || s.nome) + '</span><span class="glass-rows__value">' + PennyMoeda.formatar(s.valor) + '</span>';
      lista.appendChild(linha);
    });

    var habitacao = D.categoriasDespesa().find(function (c) { return c.nome === 'Habitação'; });
    var todasSubcategorias = habitacao ? habitacao.subcategorias : [];
    var presentes = detalhes.subcategorias.map(function (s) { return s.nome; });
    var emFalta = todasSubcategorias.filter(function (n) { return presentes.indexOf(n) < 0; });
    document.getElementById('nota-sem-registos').textContent = emFalta.length
      ? (emFalta.join(' e ') + ' sem registos em ' + nomeMes + '.')
      : '';

    /* Gráfico com os 12 meses do ano corrente. */
    var valoresAno = [];
    for (var m = 0; m < 12; m++) {
      var detalhesMes = PennyCalculos.calcularCategoriaDoMes(movimentos, ano, m, 'Habitação');
      valoresAno.push(detalhesMes.temDados ? detalhesMes.total : null);
    }
    renderGrafico(valoresAno);
  });

  function renderGrafico(valoresAno) {
    var comDados = valoresAno.filter(function (v) { return v !== null; });
    var media = comDados.length ? comDados.reduce(function (s, v) { return s + v; }, 0) / comDados.length : 0;
    document.getElementById('media-habitacao').textContent = comDados.length ? ('média ' + PennyMoeda.formatar(media)) : '';

    var max = Math.max.apply(null, comDados.concat([100]));
    var escala = Math.ceil(max / 100) * 100;
    document.getElementById('nota-escala').textContent = 'Escala de 0 € a ' + PennyMoeda.formatar(escala);

    var grafico = document.getElementById('grafico-casa');
    var bolhaAtual = null;
    function esconderBolha() { if (bolhaAtual) { bolhaAtual.remove(); bolhaAtual = null; } }
    document.addEventListener('click', function (evento) {
      if (!evento.target.closest('.grafico-casa__barra')) esconderBolha();
    });

    valoresAno.forEach(function (valor, indice) {
    var coluna = document.createElement('div');
    coluna.className = 'grafico-casa__col';
    var cima = document.createElement('div');
    cima.className = 'grafico-casa__cima';

    if (valor !== null) {
      var barra = document.createElement('button');
      barra.type = 'button';
      barra.className = 'grafico-casa__barra';
      barra.style.height = Math.max(4, Math.round((valor / escala) * 90)) + 'px';
      if (indice === mes) barra.style.background = 'var(--text)';
      barra.setAttribute('aria-label', D.MESES[indice] + ': ' + PennyMoeda.formatar(valor));
      barra.addEventListener('click', function (evento) {
        evento.stopPropagation();
        esconderBolha();
        var bolha = document.createElement('span');
        bolha.className = 'grafico-casa__bolha';
        bolha.textContent = PennyMoeda.formatar(valor);
        var rectBarra = barra.getBoundingClientRect();
        var rectCaixa = grafico.closest('.glass').getBoundingClientRect();
        bolha.style.left = (rectBarra.left - rectCaixa.left + rectBarra.width / 2) + 'px';
        bolha.style.top = (rectBarra.top - rectCaixa.top) + 'px';
        grafico.closest('.glass').appendChild(bolha);
        bolhaAtual = bolha;
      });
      cima.appendChild(barra);
    } else {
      var vazio = document.createElement('div');
      vazio.style.cssText = 'height:4px; border-radius:2px; background:rgba(255,255,255,0.12); width:100%; max-width:18px; margin:0 auto';
      cima.appendChild(vazio);
    }

    var rotulo = document.createElement('span');
    rotulo.className = 'muted';
    rotulo.style.fontSize = '11px';
    rotulo.textContent = MESES_INICIAL[indice];

    coluna.appendChild(cima);
    coluna.appendChild(rotulo);
    grafico.appendChild(coluna);
    });
  }
});
