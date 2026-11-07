/* Penny Wise: notificações Web Push (só a do resumo mensal, no dia 1
   de manhã — ver service-worker.js para o evento "push" e
   dados/dicas.json para a biblioteca usada pelo resumo em si, que é
   sempre calculado na app, nunca enviado pela notificação). A
   permissão só é pedida quando o utilizador liga a opção em
   Definições, nunca ao abrir a app. */

(function () {
  var CHAVE = 'pw_notificar_resumo';

  function suportado() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  function ativo() {
    return localStorage.getItem(CHAVE) === '1';
  }

  /* A chave pública VAPID vem em base64url; o pushManager.subscribe
     precisa dela como Uint8Array. */
  function urlBase64ParaUint8Array(base64) {
    var padding = '='.repeat((4 - base64.length % 4) % 4);
    var base64Segura = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
    var bruto = atob(base64Segura);
    var saida = new Uint8Array(bruto.length);
    for (var i = 0; i < bruto.length; i++) saida[i] = bruto.charCodeAt(i);
    return saida;
  }

  function sessaoComUtilizador() {
    if (!window.PennySupabase || !PennySupabase.configurado()) return Promise.resolve(null);
    return PennySupabase.sessaoAtual().then(function (sessao) { return sessao ? sessao.user : null; });
  }

  /* Guarda a subscrição no Supabase (tabela subscricoes_push), para a
     Edge Function a conseguir encontrar no dia 1. Sem conta ligada,
     a permissão fica pedida e a app sabe que está "ativa" localmente,
     mas não há nada a notificar (não existe utilizador para guardar). */
  function guardarSubscricao(subscricao) {
    return sessaoComUtilizador().then(function (utilizador) {
      if (!utilizador) return;
      var json = subscricao.toJSON();
      return PennySupabase.cliente.from('subscricoes_push')
        .upsert({ utilizador: utilizador.id, endpoint: json.endpoint, chaves: json.keys }, { onConflict: 'utilizador,endpoint' });
    });
  }

  function apagarSubscricao(subscricao) {
    return sessaoComUtilizador().then(function (utilizador) {
      if (!utilizador) return;
      return PennySupabase.cliente.from('subscricoes_push').delete()
        .eq('utilizador', utilizador.id).eq('endpoint', subscricao.endpoint);
    });
  }

  function ativar() {
    if (!suportado()) return Promise.reject(new Error('Este navegador não suporta notificações.'));
    if (!window.PENNY_PUSH || !window.PENNY_PUSH.vapidPublicKey) return Promise.reject(new Error('Notificações ainda não configuradas.'));
    return Notification.requestPermission().then(function (permissao) {
      if (permissao !== 'granted') throw new Error('Permissão não concedida.');
      return navigator.serviceWorker.ready;
    }).then(function (registo) {
      return registo.pushManager.getSubscription().then(function (existente) {
        return existente || registo.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ParaUint8Array(window.PENNY_PUSH.vapidPublicKey)
        });
      });
    }).then(function (subscricao) {
      return guardarSubscricao(subscricao).then(function () {
        localStorage.setItem(CHAVE, '1');
        return subscricao;
      });
    });
  }

  function desativar() {
    localStorage.setItem(CHAVE, '0');
    if (!suportado()) return Promise.resolve();
    return navigator.serviceWorker.ready.then(function (registo) {
      return registo.pushManager.getSubscription();
    }).then(function (subscricao) {
      if (!subscricao) return;
      return apagarSubscricao(subscricao).then(function () { return subscricao.unsubscribe(); });
    });
  }

  window.PennyPush = { suportado: suportado, ativo: ativo, ativar: ativar, desativar: desativar };
})();
