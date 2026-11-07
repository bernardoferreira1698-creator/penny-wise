/* Penny Wise: gestão da paleta de cores (A/B/C/D) e do modo
   (automatico/claro/escuro). O estado fica em localStorage e é aplicado
   via atributos data-paleta e data-modo em <html>, que o tokens.css lê.

   O arranque (antes desta ficheiro carregar) é feito por um pequeno
   script inline no <head> de cada página, para evitar um "flash" com a
   cor errada. Este ficheiro trata do resto: reagir a mudanças do tema
   do iPhone/computador quando o modo é "automatico", atualizar a cor da
   barra de estado (theme-color) e expor uma API simples para o ecrã de
   Definições. */

(function () {
  var CHAVE_PALETA = 'pw_paleta';
  var CHAVE_MODO = 'pw_modo';
  var PALETAS = ['A', 'B', 'C', 'D'];
  var MODOS = ['automatico', 'claro', 'escuro'];

  function getPaleta() {
    var p = localStorage.getItem(CHAVE_PALETA);
    return PALETAS.indexOf(p) >= 0 ? p : 'A';
  }

  function getModoPreferido() {
    var m = localStorage.getItem(CHAVE_MODO);
    return MODOS.indexOf(m) >= 0 ? m : 'automatico';
  }

  function modoEfetivo(modoPreferido) {
    if (modoPreferido === 'claro' || modoPreferido === 'escuro') return modoPreferido;
    var prefereClaro = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
    return prefereClaro ? 'claro' : 'escuro';
  }

  function atualizarThemeColor() {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    /* O ecrã de Registo (e outros marcados assim) têm sempre fundo
       claro, mesmo quando o resto da app está em modo escuro. */
    var corFixa = document.documentElement.hasAttribute('data-cor-clara-fixa');
    var token = corFixa ? '--light-bg' : '--bg';
    var cor = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
    if (cor) meta.setAttribute('content', cor);
  }

  function aplicar(paleta, modoPreferido) {
    document.documentElement.setAttribute('data-paleta', paleta);
    /* Páginas marcadas como "cor clara fixa" (ex.: Registo) usam sempre
       o par de tokens ink/text do conjunto "escuro" (fundo é sobreposto
       a claro à parte), independentemente da preferência de modo do
       utilizador. */
    var corFixa = document.documentElement.hasAttribute('data-cor-clara-fixa');
    var modo = corFixa ? 'escuro' : modoEfetivo(modoPreferido);
    document.documentElement.setAttribute('data-modo', modo);
    atualizarThemeColor();
    document.dispatchEvent(new CustomEvent('pw:tema-mudou', {
      detail: { paleta: paleta, modo: modoPreferido }
    }));
  }

  function setPaleta(paleta) {
    if (PALETAS.indexOf(paleta) < 0) return;
    localStorage.setItem(CHAVE_PALETA, paleta);
    aplicar(paleta, getModoPreferido());
  }

  function setModo(modoPreferido) {
    if (MODOS.indexOf(modoPreferido) < 0) return;
    localStorage.setItem(CHAVE_MODO, modoPreferido);
    aplicar(getPaleta(), modoPreferido);
  }

  // Aplica de novo ao carregar (garante consistência com o script de
  // arranque do <head>, mesmo que este ficheiro demore a chegar).
  aplicar(getPaleta(), getModoPreferido());

  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: light)');
    var onChange = function () {
      if (getModoPreferido() === 'automatico') aplicar(getPaleta(), 'automatico');
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }

  window.PennyPaleta = {
    PALETAS: PALETAS,
    MODOS: MODOS,
    getPaleta: getPaleta,
    getModoPreferido: getModoPreferido,
    modoEfetivo: function () { return modoEfetivo(getModoPreferido()); },
    setPaleta: setPaleta,
    setModo: setModo
  };
})();
