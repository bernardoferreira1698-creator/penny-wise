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

/* Correção para um bug conhecido do Safari/iOS: a barra de
   ferramentas do browser, em baixo, pode estar "expandida" ou
   "recolhida" consoante o scroll, e isso muda a zona realmente
   visível do ecrã (a "visual viewport") sem mudar o tamanho da
   página em si. Elementos de posição fixa (navegação flutuante,
   fundo) ficam desalinhados sempre que há essa diferença — e em
   ecrãs sem conteúdo suficiente para dar scroll, nunca corrigem
   sozinhos. Aqui medimos essa diferença e compensamo-la sempre que
   muda, em vez de depender de um gesto de scroll do utilizador. */
if (window.visualViewport) {
  var ajustarNavFixa = function () {
    var vv = window.visualViewport;
    var desvio = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    document.documentElement.style.setProperty('--desvio-barra-safari', desvio + 'px');
  };
  window.visualViewport.addEventListener('resize', ajustarNavFixa);
  window.visualViewport.addEventListener('scroll', ajustarNavFixa);
  window.addEventListener('load', ajustarNavFixa);
  ajustarNavFixa();
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
