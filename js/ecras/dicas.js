/* Ecrã Dicas: "Para ti" (até 10, pelos gatilhos do mês), "Guardadas"
   e "Todas" (as 150, agrupadas por tema). */

document.addEventListener('DOMContentLoaded', function () {
  var D = window.PennyDados;

  function construirCartao(dica, motivo) {
    var cartao = document.createElement('div');
    cartao.className = 'glass dica-card';
    cartao.setAttribute('data-dica-id', dica.id);
    var byline = dica.autor + (dica.livro ? (' · ' + dica.livro) : '');
    var estaGuardada = PennyDicas.estaGuardada(dica.id);
    cartao.innerHTML =
      '<div class="dica-card__topo">' +
      '  <span class="muted" style="font-size:12px">' + byline + '</span>' +
      '  <button type="button" class="guardar-btn" aria-label="Guardar dica">' +
      '    <svg width="16" height="16" viewBox="0 0 24 24" fill="' + (estaGuardada ? 'var(--dot)' : 'none') + '" stroke="' + (estaGuardada ? 'var(--dot)' : 'var(--muted)') + '" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z"/></svg>' +
      '  </button>' +
      '</div>' +
      '<span class="dica-card__texto">' + dica.texto + '</span>' +
      (motivo ? '<span class="chip chip--warn" style="align-self:flex-start">' + motivo + '</span>' : '');

    cartao.querySelector('.guardar-btn').addEventListener('click', function () {
      var agoraGuardada = PennyDicas.alternarGuardada(dica.id);
      var svg = this.querySelector('svg');
      svg.setAttribute('fill', agoraGuardada ? 'var(--dot)' : 'none');
      svg.setAttribute('stroke', agoraGuardada ? 'var(--dot)' : 'var(--muted)');
      if (abaAtiva === 'guardadas') renderAba();
    });

    return cartao;
  }

  var lista = document.getElementById('lista-dicas');
  var mensagemVazia = document.getElementById('mensagem-vazia');
  var abaAtiva = 'para-ti';
  var todasAsDicas = [];
  var paraTi = [];

  function renderAba() {
    lista.innerHTML = '';
    if (abaAtiva === 'para-ti') {
      paraTi.forEach(function (item) { lista.appendChild(construirCartao(item.dica, item.motivo)); });
      mensagemVazia.hidden = paraTi.length > 0;
      mensagemVazia.textContent = 'Sem dicas para já: regista alguns movimentos este mês.';
    } else if (abaAtiva === 'guardadas') {
      var dicasGuardadas = todasAsDicas.filter(function (d) { return PennyDicas.estaGuardada(d.id); });
      dicasGuardadas.forEach(function (d) { lista.appendChild(construirCartao(d, null)); });
      mensagemVazia.hidden = dicasGuardadas.length > 0;
      mensagemVazia.textContent = 'Ainda não guardaste nenhuma dica.';
    } else {
      mensagemVazia.hidden = true;
      var grupos = PennyDicas.agruparPorTema(todasAsDicas);
      grupos.forEach(function (grupo) {
        var cabecalho = document.createElement('div');
        cabecalho.className = 'tema-cabecalho';
        cabecalho.textContent = grupo.rotulo;
        lista.appendChild(cabecalho);
        grupo.dicas.forEach(function (d) { lista.appendChild(construirCartao(d, null)); });
      });
    }
  }

  var tabs = document.getElementById('tabs-dicas');
  tabs.addEventListener('click', function (evento) {
    var botao = evento.target.closest('.tabs__item');
    if (!botao) return;
    tabs.querySelectorAll('.tabs__item').forEach(function (b) { b.classList.remove('is-active'); });
    botao.classList.add('is-active');
    abaAtiva = botao.getAttribute('data-aba');
    renderAba();
  });

  Promise.all([PennyDicas.carregar(), PennyDB.todos()]).then(function (resultados) {
    todasAsDicas = resultados[0];
    var movimentos = resultados[1];
    var hoje = D.hoje();
    var calculo = PennyDicas.calcularGatilhos(movimentos, hoje.getFullYear(), hoje.getMonth());
    paraTi = PennyDicas.escolherParaTi(todasAsDicas, calculo, 10);
    document.getElementById('mensagem-carregando').hidden = true;
    renderAba();
  });
});
