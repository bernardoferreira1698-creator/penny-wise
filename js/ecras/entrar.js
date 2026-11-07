/* Ecrã Entrar: dois passos (email -> código de 6 dígitos). Sem
   Supabase configurado (js/supabase-config.js vazio), mostra um aviso
   em vez de enviar o código, para ficar claro que falta esse passo. */

document.addEventListener('DOMContentLoaded', function () {
  /* Já com sessão ativa (ex.: voltou atrás para este ecrã) -> segue
     logo para o Início, em vez de mostrar o formulário outra vez. */
  if (window.PennySupabase && PennySupabase.configurado()) {
    PennySupabase.sessaoAtual().then(function (sessao) {
      if (sessao) window.location.href = 'inicio.html';
    });
  }

  var passoEmail = document.getElementById('passo-email');
  var passoCodigo = document.getElementById('passo-codigo');
  var btnEnviar = document.getElementById('btn-enviar-codigo');
  var btnConfirmar = document.getElementById('btn-confirmar-codigo');
  var btnVoltar = document.getElementById('btn-voltar-email');
  var email = document.getElementById('email');
  var emailConfirmacao = document.getElementById('email-confirmacao');
  var erroEmail = document.getElementById('erro-email');
  var erroCodigo = document.getElementById('erro-codigo');
  var caixas = document.querySelectorAll('.codigo-caixa');

  function mostrarErro(elemento, mensagem) {
    elemento.textContent = mensagem;
    elemento.hidden = false;
  }
  function esconderErro(elemento) { elemento.hidden = true; }

  function mostrarPassoCodigo() {
    emailConfirmacao.textContent = 'Enviado para ' + email.value;
    passoEmail.hidden = true;
    passoCodigo.hidden = false;
    caixas.forEach(function (c) { c.value = ''; });
    if (caixas[0]) caixas[0].focus();
  }

  btnEnviar.addEventListener('click', function () {
    esconderErro(erroEmail);
    var valor = email.value.trim();
    if (!valor || valor.indexOf('@') < 0) { mostrarErro(erroEmail, 'Escreve um email válido.'); return; }

    if (!window.PennySupabase || !window.PennySupabase.configurado()) {
      mostrarErro(erroEmail, 'A app ainda não está ligada ao Supabase (falta configurar js/supabase-config.js).');
      return;
    }

    btnEnviar.disabled = true;
    btnEnviar.textContent = 'A enviar...';
    PennySupabase.enviarCodigo(valor).then(function () {
      btnEnviar.disabled = false;
      btnEnviar.textContent = 'Enviar código';
      mostrarPassoCodigo();
    }).catch(function (erro) {
      btnEnviar.disabled = false;
      btnEnviar.textContent = 'Enviar código';
      mostrarErro(erroEmail, erro.message || 'Não foi possível enviar o código. Tenta outra vez.');
    });
  });

  btnVoltar.addEventListener('click', function () {
    passoCodigo.hidden = true;
    passoEmail.hidden = false;
    email.focus();
  });

  btnConfirmar.addEventListener('click', function () {
    esconderErro(erroCodigo);
    var codigo = Array.prototype.map.call(caixas, function (c) { return c.value; }).join('');
    if (codigo.length !== 8) { mostrarErro(erroCodigo, 'Introduz os 8 dígitos do código.'); return; }

    btnConfirmar.disabled = true;
    btnConfirmar.textContent = 'A confirmar...';
    PennySupabase.confirmarCodigo(email.value.trim(), codigo).then(function (sessao) {
      /* Primeira vez (sem nenhum movimento guardado ainda) -> ajuda a
         importar o Excel. Sessões seguintes (ex.: reinstalaste a app,
         ou a sessão expirou) -> direto para o Início, não para a
         importação outra vez. */
      return PennySupabase.cliente.from('movimentos').select('id', { count: 'exact', head: true })
        .eq('utilizador', sessao.user.id).then(function (r) {
          window.location.href = (r.count && r.count > 0) ? 'inicio.html' : 'importar.html';
        }).catch(function () {
          window.location.href = 'inicio.html'; // não deu para saber: segue para o Início, nunca força a importação
        });
    }).catch(function (erro) {
      btnConfirmar.disabled = false;
      btnConfirmar.textContent = 'Confirmar código';
      mostrarErro(erroCodigo, erro.message || 'Código incorreto. Tenta outra vez.');
    });
  });

  caixas.forEach(function (caixa, indice) {
    caixa.addEventListener('input', function () {
      caixa.value = caixa.value.replace(/[^0-9]/g, '').slice(0, 1);
      if (caixa.value && caixas[indice + 1]) caixas[indice + 1].focus();
    });
    caixa.addEventListener('keydown', function (evento) {
      if (evento.key === 'Backspace' && !caixa.value && caixas[indice - 1]) {
        caixas[indice - 1].focus();
      }
    });
  });
});
