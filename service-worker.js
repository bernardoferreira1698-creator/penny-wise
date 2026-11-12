/* Penny Wise: service worker simples.
   Fase 1: só guarda em cache o essencial para a app abrir sem rede
   (estrutura, estilos, scripts, ícones). A sincronização dos
   movimentos guardados offline chega na Fase 3, com IndexedDB.

   Estratégia: "rede primeiro". Enquanto há internet, vai sempre
   buscar a versão mais recente de cada ficheiro ao servidor (sem usar
   a cache do browser), para nunca mostrares uma versão antiga por
   engano. Só usa a cópia guardada quando não há rede. */

var CACHE = 'penny-wise-v44';

var FICHEIROS_BASE = [
  'inicio.html',
  'movimentos.html',
  'registo.html',
  'mes.html',
  'ano.html',
  'mais.html',
  'objetivos.html',
  'resumo.html',
  'dicas.html',
  'recorrentes.html',
  'orcamentos.html',
  'casa.html',
  'definicoes.html',
  'categorias.html',
  'entrar.html',
  'importar.html',
  'avisos.html',
  'css/tokens.css',
  'css/base.css',
  'js/paleta.js',
  'js/nav.js',
  'js/app.js',
  'js/moeda.js',
  'js/mes-nav.js',
  'js/dados-mock.js',
  'js/dicas-engine.js',
  'js/supabase-config.js',
  'js/supabase.js',
  'js/db.js',
  'js/sync.js',
  'js/registo-popup.js',
  'js/calculos.js',
  'js/avisos.js',
  'js/recorrentes.js',
  'js/objetivos.js',
  'js/push.js',
  'js/push-config.js',
  'js/exportar.js',
  'js/alerta.js',
  'js/importar-excel.js',
  'js/ecras/importar.js',
  'js/ecras/avisos.js',
  'js/ecras/mais.js',
  'js/ecras/recorrentes.js',
  'js/ecras/entrar.js',
  'js/ecras/registo.js',
  'js/ecras/inicio.js',
  'js/ecras/movimentos.js',
  'js/ecras/mes.js',
  'js/ecras/ano.js',
  'js/ecras/casa.js',
  'js/ecras/objetivos.js',
  'js/ecras/resumo.js',
  'js/ecras/dicas.js',
  'js/ecras/orcamentos.js',
  'js/ecras/categorias.js',
  'js/ecras/definicoes.js',
  'dados/dicas.json',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

self.addEventListener('install', function (evento) {
  evento.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(FICHEIROS_BASE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (evento) {
  evento.waitUntil(
    caches.keys().then(function (chaves) {
      return Promise.all(
        chaves.filter(function (chave) { return chave !== CACHE; })
          .map(function (chave) { return caches.delete(chave); })
      );
    })
  );
  self.clients.claim();
});

/* Notificação do resumo mensal (dia 1, de manhã): a Edge Function do
   Supabase envia só um título e uma ligação, nunca valores
   financeiros (esses só a app, já com sessão, os vai buscar). */
self.addEventListener('push', function (evento) {
  var dados = {};
  try { dados = evento.data ? evento.data.json() : {}; } catch (e) {}

  var titulo = dados.titulo || 'O teu resumo está pronto';
  var opcoes = {
    body: dados.corpo || 'Toca para ver como correu o mês.',
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    data: { url: dados.url || 'resumo.html' }
  };
  evento.waitUntil(self.registration.showNotification(titulo, opcoes));
});

self.addEventListener('notificationclick', function (evento) {
  evento.notification.close();
  var url = (evento.notification.data && evento.notification.data.url) || 'resumo.html';
  evento.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(function (lista) {
      for (var i = 0; i < lista.length; i++) {
        if ('focus' in lista[i]) return lista[i].focus().then(function (cliente) { return cliente.navigate(url); });
      }
      return self.clients.openWindow(url);
    })
  );
});

self.addEventListener('fetch', function (evento) {
  if (evento.request.method !== 'GET') return;

  evento.respondWith(
    fetch(evento.request, { cache: 'no-store' }).then(function (res) {
      if (res && res.ok) {
        var copia = res.clone();
        caches.open(CACHE).then(function (cache) { cache.put(evento.request, copia); });
      }
      return res;
    }).catch(function () {
      return caches.match(evento.request);
    })
  );
});
