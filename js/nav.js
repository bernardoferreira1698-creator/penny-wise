/* Penny Wise: navegação partilhada.
   - Barra flutuante em baixo (Início, Movimentos, +, Análise, Mais),
     usada em Início, Movimentos, Análise do mês/ano e Mais.
   - Botão "‹ Mais" usado nos ecrãs abertos a partir de Mais. */

(function () {
  var ICONS = {
    inicio: '<path d="M4 11l8-7 8 7 M6 9.5V20h12V9.5"/>',
    movimentos: '<path d="M9 6h11 M9 12h11 M9 18h11 M4 6h.01 M4 12h.01 M4 18h.01"/>',
    mais_add: '<path d="M12 5v14 M5 12h14"/>',
    analise: '<path d="M5 20V11 M12 20V4 M19 20v-6"/>',
    mais: '<path d="M5 12h.01 M12 12h.01 M19 12h.01"/>',
    voltar: '<path d="M15 5l-7 7 7 7"/>'
  };

  var ITEMS = [
    { chave: 'inicio', rotulo: 'Início', href: 'inicio.html', icon: ICONS.inicio },
    { chave: 'movimentos', rotulo: 'Movimentos', href: 'movimentos.html', icon: ICONS.movimentos },
    { chave: 'registo', rotulo: 'Novo movimento', href: 'registo.html', icon: ICONS.mais_add, central: true },
    { chave: 'analise', rotulo: 'Análise', href: 'mes.html', icon: ICONS.analise },
    { chave: 'mais', rotulo: 'Mais', href: 'mais.html', icon: ICONS.mais }
  ];

  function svg(path, largura) {
    return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="' + (largura || 1.6) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      path + '</svg>';
  }

  /* As classes nav-bottom/nav-fade já vêm no HTML (não à espera deste
     script), para a barra nascer já fixa ao fundo do ecrã, sem um
     instante a aparecer encaixada no fim do conteúdo antes de o
     JavaScript correr. Aqui só se preenche o conteúdo (ícones). */
  function mountBottomNav(ativo) {
    var el = document.getElementById('app-nav');
    if (!el) return;
    el.innerHTML = ITEMS.map(function (item) {
      if (item.central) {
        return '<a class="nav-add" href="' + item.href + '" aria-label="' + item.rotulo + '">' +
          svg(item.icon, 2) + '</a>';
      }
      var ativoAgora = item.chave === ativo;
      var abertura = ativoAgora ? '<button type="button" class="nav-item is-active" aria-label="' + item.rotulo + '" aria-current="page">'
        : '<a class="nav-item" href="' + item.href + '" aria-label="' + item.rotulo + '">';
      var fecho = ativoAgora ? '</button>' : '</a>';
      return abertura + svg(item.icon, 1.6) + (ativoAgora ? '<span class="nav-item__dot"></span>' : '') + fecho;
    }).join('');
  }

  function mountBackButton(rotulo, href) {
    var el = document.getElementById('app-back');
    if (!el) return;
    el.innerHTML = '<a class="pill-link" href="' + href + '">' + svg(ICONS.voltar, 1.8) + rotulo + '</a>';
  }

  window.PennyNav = { mountBottomNav: mountBottomNav, mountBackButton: mountBackButton };
})();
