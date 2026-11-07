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

(function () {
  var PAGINAS_PUBLICAS = ['entrar.html', 'index.html', ''];
  var pagina = window.location.pathname.split('/').pop();
  if (PAGINAS_PUBLICAS.indexOf(pagina) >= 0) return;
  if (!window.PennySupabase || !window.PennySupabase.configurado()) return;

  window.PennySupabase.sessaoAtual().then(function (sessao) {
    if (!sessao) window.location.href = 'entrar.html';
  });
})();
