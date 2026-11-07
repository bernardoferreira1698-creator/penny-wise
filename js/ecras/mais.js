/* Ecrã Mais: contagens dinâmicas de Avisos e Recorrentes por
   confirmar. */

document.addEventListener('DOMContentLoaded', function () {
  var D = window.PennyDados;
  var hoje = D.hoje();
  var mesReferencia = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0');

  var contagemAvisos = window.PennyAvisos ? PennyAvisos.contarPendentes() : 0;
  if (contagemAvisos > 0) {
    document.getElementById('mais-avisos-sub').textContent =
      contagemAvisos === 1 ? '1 situação por rever' : contagemAvisos + ' situações por rever';
    document.getElementById('mais-avisos-dot').hidden = false;
  }

  if (window.PennyRecorrentes) {
    var porConfirmar = PennyRecorrentes.listar().filter(function (r) {
      if (!r.ativo) return false;
      if (r.frequencia === 'anual' && r.mesPrevisto !== hoje.getMonth()) return false;
      if (r.diaPrevisto && r.diaPrevisto > hoje.getDate()) return false;
      return !PennyRecorrentes.estadoConfirmacao(r.id, mesReferencia);
    }).length;
    if (porConfirmar > 0) {
      document.getElementById('mais-recorrentes-sub').textContent =
        porConfirmar === 1 ? '1 por confirmar' : porConfirmar + ' por confirmar';
      document.getElementById('mais-recorrentes-dot').hidden = false;
    }
  }
});
