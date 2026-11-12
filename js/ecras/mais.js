/* Ecrã Mais: contagens dinâmicas de Avisos e Recorrentes por
   confirmar, e o aviso de um novo Resumo mensal por ver. */

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

  /* Só conta despesas: um recorrente de rendimento nunca passa pelo
     ecrã Recorrentes para ser "confirmado" (não tem esse botão lá),
     por isso não deve contar aqui como estando por confirmar. */
  if (window.PennyRecorrentes) {
    var porConfirmar = PennyRecorrentes.listar().filter(function (r) {
      if (!r.ativo || r.tipo !== 'despesa') return false;
      if (r.frequencia === 'anual' && r.mesPrevisto !== hoje.getMonth()) return false;
      if (r.diaPrevisto && r.diaPrevisto > hoje.getDate()) return false;
      return !PennyRecorrentes.estadoConfirmacao(r.id, mesReferencia);
    }).length;
    document.getElementById('mais-recorrentes-dot').hidden = porConfirmar === 0;
  }

  /* Resumo mensal: é sempre do mês já fechado (ver js/ecras/resumo.js).
     A bolinha laranja assinala que há um resumo novo (de um mês que
     ainda não existia a mês passado) e que ainda não foi aberto desde
     que ficou disponível — resumo.js marca-o como visto assim que o
     ecrã é aberto. */
  var mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  var nomeMesAnterior = D.MESES[mesAnterior.getMonth()];
  var nomeMesAtual = D.MESES[hoje.getMonth()];
  var mesReferenciaResumo = mesAnterior.getFullYear() + '-' + String(mesAnterior.getMonth() + 1).padStart(2, '0');
  document.getElementById('mais-resumos-sub').textContent =
    (nomeMesAnterior.charAt(0).toUpperCase() + nomeMesAnterior.slice(1)) + ' pronto desde 1 de ' + nomeMesAtual;
  document.getElementById('mais-resumos-dot').hidden = localStorage.getItem('pw_resumo_visto') === mesReferenciaResumo;
});
