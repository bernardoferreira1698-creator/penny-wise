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

/* Correção para um bug conhecido do Safari/iOS: ao abrir a página, a
   barra de ferramentas do browser ainda não recolheu, o que faz os
   elementos de posição fixa (navegação flutuante, fundo) nascerem
   desalinhados até ao primeiro gesto de scroll do utilizador. Um
   scroll impercetível e automático, já ao abrir, força o Safari a
   corrigir a posição de imediato, sem depender desse gesto. */
window.addEventListener('load', function () {
  requestAnimationFrame(function () {
    window.scrollTo(0, 1);
    requestAnimationFrame(function () { window.scrollTo(0, 0); });
  });
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
