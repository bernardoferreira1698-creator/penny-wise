/* Ecrã Avisos: situações por rever manualmente (ver js/avisos.js). */

document.addEventListener('DOMContentLoaded', function () {
  var lista = document.getElementById('lista-avisos');
  var semAvisos = document.getElementById('sem-avisos');
  var resumo = document.getElementById('aviso-resumo');

  function render() {
    var avisos = PennyAvisos.pendentes();
    resumo.textContent = avisos.length === 1 ? '1 aviso por resolver' : avisos.length + ' avisos por resolver';
    lista.innerHTML = '';
    semAvisos.hidden = avisos.length > 0;

    avisos.forEach(function (aviso) {
      var card = document.createElement('div');
      card.className = 'aviso-card';
      var botaoEditar = aviso.movimentoId
        ? '<a href="registo.html?id=' + encodeURIComponent(aviso.movimentoId) + '" class="aviso-card__editar">Editar</a>'
        : '';
      card.innerHTML =
        '<svg class="aviso-card__icone" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 9v4 M12 17h.01 M10.3 3.9L2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>' +
        '<div class="aviso-card__texto"><span class="aviso-card__titulo">' + aviso.titulo + '</span>' +
        (aviso.detalhe ? '<span class="aviso-card__sub">' + aviso.detalhe + '</span>' : '') + '</div>' +
        '<div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px; flex:none">' +
        botaoEditar +
        '<button type="button" class="aviso-card__dispensar" data-id="' + aviso.id + '">Dispensar</button>' +
        '</div>';
      lista.appendChild(card);
    });
  }

  lista.addEventListener('click', function (evento) {
    var botao = evento.target.closest('.aviso-card__dispensar');
    if (!botao) return;
    botao.disabled = true;
    PennyAvisos.remover(botao.getAttribute('data-id')).then(render);
  });

  render();
});
