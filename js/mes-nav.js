/* Penny Wise: navegação por mês com limites (usado em Resumos
   mensais). Esconde a seta para o mês seguinte quando já estamos no
   limite mais recente, e esconde a seta para o mês anterior quando já
   estamos no limite mais antigo. Os limites (opcionais) vêm de quem
   chama, calculados a partir dos dados reais — ex.: primeiro mês com
   movimentos e último mês já fechado. Sem limites, a navegação é
   livre. */

(function () {
  function criar(opcoes) {
    var D = window.PennyDados;
    var ano = opcoes.anoInicial;
    var mes = opcoes.mesInicial;
    var aoMudar = opcoes.aoMudar;
    var limiteAntigo = opcoes.limiteAntigo || null; // {ano, mes} ou null = sem limite
    var limiteRecente = opcoes.limiteRecente || null;

    function estaNoLimiteRecente() {
      return !!limiteRecente && ano === limiteRecente.ano && mes === limiteRecente.mes;
    }
    function estaNoLimiteAntigo() {
      return !!limiteAntigo && ano === limiteAntigo.ano && mes === limiteAntigo.mes;
    }
    function dentroDosLimites(a, m) {
      var chave = a * 12 + m;
      if (limiteAntigo && chave < limiteAntigo.ano * 12 + limiteAntigo.mes) return false;
      if (limiteRecente && chave > limiteRecente.ano * 12 + limiteRecente.mes) return false;
      return true;
    }

    function mudar(delta) {
      var novoMes = mes + delta;
      var novoAno = ano;
      if (novoMes < 0) { novoMes = 11; novoAno--; }
      if (novoMes > 11) { novoMes = 0; novoAno++; }
      if (!dentroDosLimites(novoAno, novoMes)) return;
      ano = novoAno;
      mes = novoMes;
      if (aoMudar) aoMudar(estado());
    }

    function estado() {
      return {
        ano: ano,
        mes: mes,
        rotulo: D.mesAnoLabel(ano, mes),
        podeAvancar: !estaNoLimiteRecente(),
        podeRecuar: !estaNoLimiteAntigo()
      };
    }

    return {
      estado: estado,
      anterior: function () { mudar(-1); },
      seguinte: function () { mudar(1); }
    };
  }

  /* Liga um par de botões (prev/next) + rótulo a um controlador criado
     com criar(), escondendo a seta quando não há para onde ir. */
  function ligarBotoes(controlador, elementos) {
    function atualizar() {
      var s = controlador.estado();
      elementos.rotulo.textContent = s.rotulo;
      elementos.anterior.style.visibility = s.podeRecuar ? 'visible' : 'hidden';
      elementos.seguinte.style.visibility = s.podeAvancar ? 'visible' : 'hidden';
    }
    elementos.anterior.addEventListener('click', function () { controlador.anterior(); atualizar(); });
    elementos.seguinte.addEventListener('click', function () { controlador.seguinte(); atualizar(); });
    atualizar();
  }

  window.PennyMesNav = { criar: criar, ligarBotoes: ligarBotoes };
})();
