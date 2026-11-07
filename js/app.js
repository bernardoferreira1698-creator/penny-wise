/* Penny Wise: arranque comum a todas as páginas.
   Regista o service worker (PWA, funcionar sem rede) e, a partir da
   Fase 2, verifica se há sessão Supabase: sem ela, manda para o
   ecrã Entrar. Enquanto js/supabase-config.js estiver vazio (chaves
   por preencher), PennySupabase.configurado() é falso e este ecrã
   continua a abrir livremente, com os dados de exemplo. */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('service-worker.js').catch(function (err) {
      console.warn('Não foi possível registar o service worker:', err);
    });
  });
}


/* Alguns ecrãs marcam o seu conteúdo principal com a classe
   "pw-carregar" (invisível) enquanto esperam pelos dados reais do
   IndexedDB, para nunca mostrar 0€ só por um instante antes do valor
   a sério aparecer. window.pwPronto(n) devolve uma função a chamar
   depois de cada um dos "n" blocos de dados desse ecrã estar pronto;
   ao fim dos "n", o conteúdo aparece com um esbatimento suave. O
   limite de 1,5s é só uma rede de segurança, para nunca ficar
   invisível para sempre se algo correr mal. */
window.pwPronto = function (vezes) {
  var restantes = vezes;
  var el = document.querySelector('.app__content');
  return function () {
    restantes--;
    if (restantes <= 0 && el) el.classList.remove('pw-carregar');
  };
};
window.addEventListener('load', function () {
  setTimeout(function () {
    document.querySelectorAll('.pw-carregar').forEach(function (el) { el.classList.remove('pw-carregar'); });
  }, 1500);
});

(function () {
  var PAGINAS_PUBLICAS = ['entrar.html', 'index.html', ''];
  var pagina = window.location.pathname.split('/').pop();
  if (PAGINAS_PUBLICAS.indexOf(pagina) >= 0) return;
  if (!window.PennySupabase || !window.PennySupabase.configurado()) return;

  window.PennySupabase.sessaoAtual().then(function (sessao) {
    if (!sessao) window.location.href = 'entrar.html';
  });
})();
