/* Ecrã Definições: seletor de paleta e modo (ligado ao js/paleta.js,
   muda a app toda sem recarregar) e toggles de notificação/IA, cujo
   estado por agora só fica em localStorage (a gravação no perfil do
   Supabase chega na Fase 2/8). */

document.addEventListener('DOMContentLoaded', function () {
  var palGrid = document.getElementById('pal-grid');
  var segModo = document.getElementById('seg-modo');

  function pintarPaletaAtiva() {
    var atual = PennyPaleta.getPaleta();
    palGrid.querySelectorAll('.pal-btn').forEach(function (botao) {
      botao.classList.toggle('is-active', botao.getAttribute('data-paleta') === atual);
    });
  }
  function pintarModoAtivo() {
    var atual = PennyPaleta.getModoPreferido();
    segModo.querySelectorAll('.seg__item').forEach(function (botao) {
      botao.classList.toggle('is-active', botao.getAttribute('data-modo') === atual);
    });
  }

  palGrid.addEventListener('click', function (evento) {
    var botao = evento.target.closest('.pal-btn');
    if (!botao) return;
    PennyPaleta.setPaleta(botao.getAttribute('data-paleta'));
    pintarPaletaAtiva();
  });

  segModo.addEventListener('click', function (evento) {
    var botao = evento.target.closest('.seg__item');
    if (!botao) return;
    PennyPaleta.setModo(botao.getAttribute('data-modo'));
    pintarModoAtivo();
  });

  pintarPaletaAtiva();
  pintarModoAtivo();

  function ligarSwitch(id, chave, valorPadrao) {
    var botao = document.getElementById(id);
    var ligado = localStorage.getItem(chave);
    ligado = ligado === null ? valorPadrao : ligado === '1';
    function pintar() {
      botao.classList.toggle('is-on', ligado);
      botao.setAttribute('aria-checked', ligado ? 'true' : 'false');
    }
    pintar();
    botao.addEventListener('click', function () {
      ligado = !ligado;
      localStorage.setItem(chave, ligado ? '1' : '0');
      pintar();
    });
  }

  /* Resumo mensal: pede a permissão de notificações e subscreve o
     Web Push só quando o utilizador liga a opção aqui (nunca ao abrir
     a app pela primeira vez). O interrutor só fica "ligado" depois de
     a subscrição ter mesmo sido criada (ou apagada, ao desligar). */
  var btnResumo = document.getElementById('toggle-resumo');
  function pintarToggleResumo() {
    var ligado = window.PennyPush && PennyPush.ativo();
    btnResumo.classList.toggle('is-on', !!ligado);
    btnResumo.setAttribute('aria-checked', ligado ? 'true' : 'false');
  }
  pintarToggleResumo();
  btnResumo.addEventListener('click', function () {
    if (!window.PennyPush) return;
    var acao = PennyPush.ativo() ? PennyPush.desativar() : PennyPush.ativar();
    btnResumo.disabled = true;
    acao.catch(function (erro) {
      if (window.PennyAlerta) PennyAlerta.mostrar(erro.message || 'Não foi possível ativar as notificações.');
    }).then(function () {
      btnResumo.disabled = false;
      pintarToggleResumo();
    });
  });

  ligarSwitch('toggle-ia', 'pw_ia_ativa', false);

  var sheetExportar = document.getElementById('sheet-exportar');
  var btnExportar = document.getElementById('btn-exportar');
  if (btnExportar && sheetExportar) {
    btnExportar.addEventListener('click', function () { sheetExportar.hidden = false; });
    document.getElementById('btn-x-exportar').addEventListener('click', function () { sheetExportar.hidden = true; });
    sheetExportar.addEventListener('click', function (evento) { if (evento.target === sheetExportar) sheetExportar.hidden = true; });

    document.getElementById('btn-exportar-xlsx').addEventListener('click', function () {
      PennyDB.todos().then(function (movimentos) {
        PennyExportar.exportarXlsx(movimentos);
        sheetExportar.hidden = true;
      });
    });
    document.getElementById('btn-exportar-csv').addEventListener('click', function () {
      PennyDB.todos().then(function (movimentos) {
        PennyExportar.exportarCsv(movimentos);
        sheetExportar.hidden = true;
      });
    });
  }

  /* Estado da sincronização: só aparece quando há conta ligada.
     Avisa se ainda há movimentos por enviar ou se a última tentativa
     falhou, em vez de isso ficar só num aviso técnico invisível. */
  var blocoSincronizacao = document.getElementById('bloco-sincronizacao');
  var textoSincronizacao = document.getElementById('texto-sincronizacao');
  if (window.PennySupabase && PennySupabase.configurado() && window.PennySync) {
    blocoSincronizacao.hidden = false;
    PennySync.estado().then(function (s) {
      if (s.erro) textoSincronizacao.textContent = 'Não foi possível sincronizar: ' + s.erro;
      else if (s.pendentes > 0) textoSincronizacao.textContent = s.pendentes + (s.pendentes === 1 ? ' movimento por sincronizar' : ' movimentos por sincronizar');
      else textoSincronizacao.textContent = 'Tudo sincronizado.';
    });
  }

  /* Limpa os dados deste aparelho (movimentos locais e tudo o que só
     existe em localStorage) ao terminar sessão, para a próxima pessoa
     a entrar aqui não herdar dados de outra conta nem os enviar sem
     querer para a conta errada. */
  function limparDadosLocais() {
    var chaves = [
      'pw_avisos', 'pw_recorrentes', 'pw_recorrentes_confirmacoes', 'pw_recorrentes_sugestoes_descartadas',
      'pw_objetivos', 'pw_objetivo_sugestao_dispensada', 'pw_categorias_edits', 'pw_categorias_novas', 'pw_orcamentos',
      'pw_dicas_guardadas', 'pw_dica_dia_historico', 'pw_notificar_resumo', 'pw_ia_ativa',
      'pw_filtro_categorias', 'pw_filtro_periodicidade', 'pw_filtro_inesperadas'
    ];
    chaves.forEach(function (chave) { localStorage.removeItem(chave); });
    return window.PennyDB ? window.PennyDB.limparTudo() : Promise.resolve();
  }

  var btnTerminarSessao = document.getElementById('btn-terminar-sessao');
  if (btnTerminarSessao) {
    btnTerminarSessao.addEventListener('click', function (evento) {
      if (!window.PennySupabase || !PennySupabase.configurado()) return; // sem Supabase, segue o link normal
      evento.preventDefault();
      var desligarPush = (window.PennyPush && PennyPush.ativo()) ? PennyPush.desativar() : Promise.resolve();
      desligarPush.catch(function () {})
        .then(function () { return PennySupabase.terminarSessao(); })
        .then(function () { return limparDadosLocais(); })
        .then(function () { window.location.href = 'entrar.html'; });
    });
  }
});
