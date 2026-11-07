/* Penny Wise: cliente Supabase e o fluxo de login sem palavra-passe
   (código de 6 dígitos por email). Enquanto js/supabase-config.js
   estiver vazio, "configurado()" devolve falso e a app segue como
   antes, com dados de exemplo e sem pedir login. */

(function () {
  var cfg = window.PENNY_SUPABASE || {};
  var cliente = (cfg.url && cfg.anonKey && window.supabase)
    ? window.supabase.createClient(cfg.url, cfg.anonKey)
    : null;

  function configurado() { return !!cliente; }

  /* Pede o código de 6 dígitos por email. "shouldCreateUser: true"
     cria a conta automaticamente na primeira vez, sem passo extra. */
  function enviarCodigo(email) {
    if (!cliente) return Promise.reject(new Error('A app ainda não está ligada ao Supabase.'));
    return cliente.auth.signInWithOtp({ email: email, options: { shouldCreateUser: true } })
      .then(function (r) { if (r.error) throw r.error; return r; });
  }

  /* Confirma o código. Faz logo sessão (fica guardada pelo próprio
     supabase-js no browser, não é preciso código nenhum aqui). */
  function confirmarCodigo(email, codigo) {
    if (!cliente) return Promise.reject(new Error('A app ainda não está ligada ao Supabase.'));
    return cliente.auth.verifyOtp({ email: email, token: codigo, type: 'email' })
      .then(function (r) { if (r.error) throw r.error; return r.data.session; });
  }

  function sessaoAtual() {
    if (!cliente) return Promise.resolve(null);
    return cliente.auth.getSession().then(function (r) { return r.data.session; });
  }

  function terminarSessao() {
    if (!cliente) return Promise.resolve();
    return cliente.auth.signOut();
  }

  window.PennySupabase = {
    cliente: cliente,
    configurado: configurado,
    enviarCodigo: enviarCodigo,
    confirmarCodigo: confirmarCodigo,
    sessaoAtual: sessaoAtual,
    terminarSessao: terminarSessao
  };
})();
