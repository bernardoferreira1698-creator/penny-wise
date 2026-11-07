/* Penny Wise: alerta flutuante centrado no ecrã, para erros de
   validação de formulários (ex.: campos obrigatórios por preencher).
   Cria e remove o próprio elemento, não precisa de nada no HTML da
   página. */

(function () {
  var elementoAtual = null;
  var temporizador = null;

  function esconder() {
    if (temporizador) { clearTimeout(temporizador); temporizador = null; }
    if (elementoAtual) { elementoAtual.remove(); elementoAtual = null; }
  }

  function mostrar(mensagem, duracaoMs) {
    esconder();
    var overlay = document.createElement('div');
    overlay.className = 'pw-alerta-flutuante';
    var cartao = document.createElement('div');
    cartao.className = 'pw-alerta-flutuante__cartao';
    cartao.textContent = mensagem;
    overlay.appendChild(cartao);
    overlay.addEventListener('click', esconder);
    document.body.appendChild(overlay);
    elementoAtual = overlay;
    temporizador = setTimeout(esconder, duracaoMs || 3200);
  }

  window.PennyAlerta = { mostrar: mostrar, esconder: esconder };
})();
