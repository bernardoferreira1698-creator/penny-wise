/* Penny Wise: formatação de moeda em português de Portugal e o
   comportamento de "cêntimos primeiro" do campo Valor (como numa
   máquina de pagamentos: cada dígito novo entra pela direita). */

(function () {
  function formatar(valor, opcoes) {
    opcoes = opcoes || {};
    var comSimbolo = opcoes.simbolo !== false;
    var n = Number(valor) || 0;
    var negativo = n < 0;
    n = Math.abs(n);
    var partes = n.toFixed(2).split('.');
    var inteiro = partes[0];
    var milhares = '';
    for (var i = 0; i < inteiro.length; i++) {
      if (i > 0 && (inteiro.length - i) % 3 === 0) milhares += ' ';
      milhares += inteiro[i];
    }
    var texto = milhares + ',' + partes[1];
    if (comSimbolo) texto += ' €';
    if (negativo) texto = (opcoes.sinalMenos !== false ? '−' : '-') + texto;
    return texto;
  }

  /* Liga um <input> ao comportamento "cêntimos primeiro": o valor
     interno é sempre um número inteiro de cêntimos; cada dígito
     escrito entra pela direita e empurra os restantes para a
     esquerda (5 -> 0,05; depois 4 -> 0,54; depois 2 -> 5,42).

     Assim que se escreve um "-", o campo passa a "modo de conta
     simples" (texto livre: dígitos, "-" e ","), para aceitar contas
     como "47-11-12,5-11,5" — ao guardar, soma-se tudo e a conta
     original fica na nota (ver expressaoOriginal()). Apagar tudo
     volta ao modo de cêntimos normal. */
  function ligarCampoCentimos(input, aoMudar) {
    var centimos = 0;
    var modoExpressao = false;
    var bufferExpressao = '';

    function somarExpressao(texto) {
      var partes = texto.split('-').map(function (p) { return p.trim(); }).filter(Boolean);
      if (!partes.length) return 0;
      var soma = 0;
      partes.forEach(function (p) { soma += Number(p.replace(',', '.')) || 0; });
      return Math.round(soma * 100) / 100;
    }

    function obterValor() { return modoExpressao ? somarExpressao(bufferExpressao) : centimos / 100; }

    function render() {
      input.value = modoExpressao ? bufferExpressao : formatar(centimos / 100, { simbolo: false, sinalMenos: false });
      if (aoMudar) aoMudar(obterValor());
    }

    function inserirDigito(d) {
      if (modoExpressao) { bufferExpressao += String(d); render(); return; }
      centimos = centimos * 10 + d;
      if (centimos > 999999999) centimos = 999999999; // limite de segurança
      render();
    }

    function inserirSeparador() {
      if (!modoExpressao) {
        modoExpressao = true;
        /* "centimos" guarda exatamente os dígitos escritos até aqui,
           pela ordem em que entraram (5 depois 4 dá 54) — é por isso
           que, como número inteiro (sem dividir por 100), já é a
           leitura literal "47" que a conta simples precisa, não o
           "0,47" do modo de cêntimos. */
        bufferExpressao = centimos ? String(centimos) : '';
      }
      bufferExpressao += '-';
      render();
    }

    function inserirVirgula() {
      if (!modoExpressao) return; // no modo de cêntimos a vírgula já está sempre lá
      bufferExpressao += ',';
      render();
    }

    function apagar() {
      if (modoExpressao) {
        bufferExpressao = bufferExpressao.slice(0, -1);
        if (!bufferExpressao) modoExpressao = false;
        render();
        return;
      }
      centimos = Math.floor(centimos / 10);
      render();
    }

    /* Só o "beforeinput" trata dígitos e apagar: é o que dispara de
       forma fiável tanto com teclado físico como com teclados táteis
       (incluindo o teclado decimal do iPhone). Tratar o mesmo dígito
       também no "keydown" duplicava a entrada (ex.: "5" a contar
       como "55"), por isso o keydown só bloqueia o que não for
       dígito, "-", ",", Backspace/Delete ou navegação. */
    input.addEventListener('keydown', function (evento) {
      if (/^[0-9]$/.test(evento.key)) return;
      if (evento.key === '-' || evento.key === ',') return;
      if (evento.key === 'Backspace' || evento.key === 'Delete') return;
      if (evento.key.length === 1 && evento.key !== 'Tab' && !evento.ctrlKey && !evento.metaKey) {
        evento.preventDefault();
      }
    });

    input.addEventListener('beforeinput', function (evento) {
      if (evento.inputType === 'insertText' && /^[0-9]$/.test(evento.data || '')) {
        evento.preventDefault();
        inserirDigito(Number(evento.data));
      } else if (evento.inputType === 'insertText' && evento.data === '-') {
        evento.preventDefault();
        inserirSeparador();
      } else if (evento.inputType === 'insertText' && evento.data === ',') {
        evento.preventDefault();
        inserirVirgula();
      } else if (evento.inputType === 'deleteContentBackward' || evento.inputType === 'deleteContentForward') {
        evento.preventDefault();
        apagar();
      } else if (evento.inputType && evento.inputType.indexOf('insert') === 0) {
        // Colar texto, autocorreção, etc.: ignora tudo o resto.
        evento.preventDefault();
      }
    });

    render();

    return {
      obterValor: obterValor,
      definirValor: function (euros) {
        modoExpressao = false; bufferExpressao = '';
        centimos = Math.round((Number(euros) || 0) * 100);
        render();
      },
      expressaoOriginal: function () { return modoExpressao ? bufferExpressao : null; }
    };
  }

  /* Arredonda uma fração (0.575) à percentagem inteira mais próxima
     (58), sem o erro de vírgula flutuante que faz, por exemplo,
     0.575*100 dar 57.499999999999993 em vez de 57.5 — o que
     arredondaria para 57 em vez de 58. Usar sempre esta função (em
     vez de Math.round(fracao*100) direto) sempre que se mostra uma
     percentagem na app. */
  function arredondarPct(fracao) {
    return Math.round(Number(((fracao || 0) * 100).toFixed(8)));
  }

  /* Largura (%) para uma barra de progresso tipo "valor vs. referência
     a 100%" (orçamento, meta, etc.): cresce com a percentagem e para
     em 100% de preenchimento, seja o valor 101% ou 1000%. Usar sempre
     esta função nas barras de progresso, para ficarem consistentes
     em toda a app. */
  function larguraBarra(pct) {
    return Math.max(0, Math.min(100, arredondarPct(pct)));
  }

  /* Anima a entrada das barras de progresso: cada elemento já nasce
     no DOM com width:0 e um atributo data-largura com o valor final.
     Esta função troca o 0 pelo valor real num frame seguinte, para o
     browser animar o crescimento (graças à transition já definida no
     CSS) em vez de mostrar logo a barra cheia. */
  function animarBarras(raiz) {
    var elementos = (raiz || document).querySelectorAll('[data-largura]');
    if (!elementos.length) return;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        elementos.forEach(function (el) { el.style.width = el.getAttribute('data-largura') + '%'; });
      });
    });
  }

  window.PennyMoeda = {
    formatar: formatar, ligarCampoCentimos: ligarCampoCentimos, larguraBarra: larguraBarra,
    animarBarras: animarBarras, arredondarPct: arredondarPct
  };
})();
