/* Ecrã Objetivos: quanto sobrou este ano por guardar, lista dos
   objetivos (com o sugerido "Fundo de emergência", calculado a partir
   das despesas fixas médias reais), transferências e criação/edição. */

document.addEventListener('DOMContentLoaded', function () {
  var D = window.PennyDados;
  var hoje = D.hoje();
  var TODOS_MOVIMENTOS = [];

  function mesesEntre(dataA, mesAnoAlvo) {
    var partes = mesAnoAlvo.split('-');
    var anoAlvo = Number(partes[0]), mesAlvo = Number(partes[1]) - 1;
    return (anoAlvo * 12 + mesAlvo) - (dataA.getFullYear() * 12 + dataA.getMonth());
  }

  /* Média das despesas fixas dos últimos "janela" meses com dados,
     olhando para trás a partir de hoje sem se limitar ao ano civil
     corrente (até 24 meses atrás) — para a sugestão do Fundo de
     emergência não desaparecer logo em janeiro, só porque o ano
     ainda não tem nenhum mês registado. */
  function mediaDespesasFixasRecente(movimentos, janela) {
    var valores = [];
    for (var i = 0; valores.length < janela && i < 24; i++) {
      var total = hoje.getFullYear() * 12 + hoje.getMonth() - i;
      var ano = Math.floor(total / 12), mes = ((total % 12) + 12) % 12;
      var detalhes = PennyCalculos.calcularMes(movimentos, ano, mes);
      if (detalhes.temDados && detalhes.despesasFixas > 0) valores.push(detalhes.despesasFixas);
    }
    return valores.length ? valores.reduce(function (s, v) { return s + v; }, 0) / valores.length : 0;
  }

  function render() {
    var anoAtual = hoje.getFullYear();
    var detalhesAno = PennyCalculos.calcularAno(TODOS_MOVIMENTOS, anoAtual);
    var porGuardarAno = detalhesAno.porMes.reduce(function (s, m) {
      return s + (m.temDados ? (m.sobrou - m.poupadoDeFacto) : 0);
    }, 0);
    document.getElementById('frase-objetivos').innerHTML = porGuardarAno >= 0
      ? '<span class="muted">Este ano sobraram</span><br>' + PennyMoeda.formatar(porGuardarAno) + '<br><span class="muted">por guardar.</span>'
      : '<span class="muted">Este ano ainda não sobrou nada</span><br>por guardar.';

    var mediaDespesasFixas = mediaDespesasFixasRecente(TODOS_MOVIMENTOS, 3);
    PennyObjetivos.garantirSugestaoFundoEmergencia(mediaDespesasFixas);

    var lista = PennyObjetivos.listar();
    var container = document.getElementById('lista-objetivos');
    container.innerHTML = '';
    document.getElementById('sem-objetivos').hidden = lista.length > 0;
    document.getElementById('btn-transferir').style.display = lista.length ? '' : 'none';

    lista.forEach(function (o) {
      var atual = PennyObjetivos.valorAtual(o.id, TODOS_MOVIMENTOS);
      var pct = o.valorAlvo ? atual / o.valorAlvo : 0;

      var subtitulo;
      if (o.sugerido) {
        subtitulo = '3 meses das tuas despesas fixas (média de ' + PennyMoeda.formatar(mediaDespesasFixas) + ' por mês)';
      } else if (o.dataAlvo) {
        subtitulo = 'Até ' + D.mesAnoLabel(Number(o.dataAlvo.split('-')[0]), Number(o.dataAlvo.split('-')[1]) - 1);
      } else {
        subtitulo = '';
      }

      var rodape;
      var falta = o.valorAlvo - atual;
      if (falta <= 0) {
        rodape = 'Objetivo atingido!';
      } else if (o.dataAlvo) {
        var meses = mesesEntre(hoje, o.dataAlvo);
        rodape = meses > 0
          ? PennyMoeda.formatar(falta / meses) + ' por mês durante ' + meses + (meses === 1 ? ' mês' : ' meses')
          : 'Data alvo já passou';
      } else {
        rodape = 'Faltam ' + PennyMoeda.formatar(falta);
      }

      var cartao = document.createElement('button');
      cartao.type = 'button';
      cartao.className = 'card-light';
      cartao.style.cssText = 'width:100%; text-align:left; border:0; cursor:pointer; font-family:inherit; color:var(--ink)';
      cartao.innerHTML =
        '<span class="card-light__blob" style="right:-60px; top:-90px"></span>' +
        '<div style="position:relative; display:flex; justify-content:space-between; align-items:baseline; gap:10px">' +
        '<span style="font-size:20px; font-weight:600; letter-spacing:-0.4px">' + o.nome + '</span>' +
        (o.sugerido ? '<span style="font-size:12px; font-weight:600; padding:4px 10px; border-radius:999px; background:rgba(0,0,0,0.06); color:var(--card-muted2); flex:none">Sugerido</span>' : '') +
        '</div>' +
        (subtitulo ? '<span style="position:relative; font-size:13px; color:var(--card-muted2)">' + subtitulo + '</span>' : '') +
        '<div style="position:relative; height:8px; border-radius:4px; background:rgba(0,0,0,0.08); overflow:hidden"><div style="width:0%; height:8px; border-radius:4px; background:var(--bar-h2)" data-largura="' + PennyMoeda.larguraBarra(pct) + '"></div></div>' +
        '<div style="position:relative; display:flex; justify-content:space-between; font-size:14px">' +
        '<span><b>' + PennyMoeda.formatar(atual) + '</b> <span style="color:var(--card-muted2)">de ' + PennyMoeda.formatar(o.valorAlvo) + '</span></span>' +
        '<span style="color:var(--card-muted2)">' + rodape + '</span></div>';
      cartao.addEventListener('click', function () { abrirEdicaoObjetivo(o); });
      container.appendChild(cartao);
    });
    PennyMoeda.animarBarras(container);

    popularSelectObjetivos(lista);
  }

  /* Sheet de transferência. */
  var sheetTransferir = document.getElementById('sheet-transferir');
  var campoObjetivoTransferencia = document.getElementById('campo-objetivo-transferencia');
  var campoValorTransferencia = PennyMoeda.ligarCampoCentimos(document.getElementById('campo-valor-transferencia'));
  var campoDataTransferencia = document.getElementById('campo-data-transferencia');

  function popularSelectObjetivos(lista) {
    var valorAtualSelecionado = campoObjetivoTransferencia.value;
    campoObjetivoTransferencia.innerHTML = '';
    lista.forEach(function (o) {
      var opt = document.createElement('option');
      opt.value = o.id; opt.textContent = o.nome;
      campoObjetivoTransferencia.appendChild(opt);
    });
    if (valorAtualSelecionado) campoObjetivoTransferencia.value = valorAtualSelecionado;
  }

  function abrirTransferencia() {
    if (!PennyObjetivos.listar().length) return;
    campoValorTransferencia.definirValor(0);
    campoDataTransferencia.value = hoje.toISOString().slice(0, 10);
    sheetTransferir.hidden = false;
  }
  function fecharTransferencia() { sheetTransferir.hidden = true; }

  document.getElementById('btn-transferir').addEventListener('click', function (evento) {
    evento.preventDefault();
    abrirTransferencia();
  });
  document.getElementById('btn-x-transferir').addEventListener('click', fecharTransferencia);
  document.getElementById('btn-fechar-transferir').addEventListener('click', fecharTransferencia);
  sheetTransferir.addEventListener('click', function (evento) { if (evento.target === sheetTransferir) fecharTransferencia(); });

  document.getElementById('btn-guardar-transferir').addEventListener('click', function () {
    var objetivoId = campoObjetivoTransferencia.value;
    var objetivo = PennyObjetivos.obter(objetivoId);
    var valor = campoValorTransferencia.obterValor();
    if (!objetivo || !valor || !campoDataTransferencia.value) return;
    var partesData = campoDataTransferencia.value.split('-').map(Number);
    var data = new Date(partesData[0], partesData[1] - 1, partesData[2]);
    PennyObjetivos.transferir(objetivoId, objetivo.nome, valor, data).then(function () {
      return PennyDB.todos();
    }).then(function (movimentos) {
      TODOS_MOVIMENTOS = movimentos;
      fecharTransferencia();
      render();
    });
  });

  /* Sheet de criação/edição de objetivo. */
  var sheetObjetivo = document.getElementById('sheet-editar-objetivo');
  var campoNomeObjetivo = document.getElementById('campo-nome-objetivo');
  var campoValorObjetivo = PennyMoeda.ligarCampoCentimos(document.getElementById('campo-valor-objetivo'));
  var campoDataObjetivo = document.getElementById('campo-data-objetivo');
  var objetivoEmEdicao = null;

  function abrirEdicaoObjetivo(objetivo) {
    objetivoEmEdicao = objetivo;
    document.getElementById('titulo-editar-objetivo').textContent = objetivo ? 'Editar objetivo' : 'Novo objetivo';
    document.getElementById('btn-apagar-objetivo').hidden = !objetivo;
    campoNomeObjetivo.value = objetivo ? objetivo.nome : '';
    campoValorObjetivo.definirValor(objetivo ? objetivo.valorAlvo : 0);
    campoDataObjetivo.value = objetivo && objetivo.dataAlvo ? objetivo.dataAlvo : '';
    sheetObjetivo.hidden = false;
    campoNomeObjetivo.focus();
  }
  function fecharEdicaoObjetivo() { sheetObjetivo.hidden = true; }

  document.getElementById('btn-novo-objetivo').addEventListener('click', function (evento) {
    evento.preventDefault();
    abrirEdicaoObjetivo(null);
  });
  document.getElementById('btn-x-objetivo').addEventListener('click', fecharEdicaoObjetivo);
  sheetObjetivo.addEventListener('click', function (evento) { if (evento.target === sheetObjetivo) fecharEdicaoObjetivo(); });

  document.getElementById('btn-guardar-objetivo').addEventListener('click', function () {
    var nome = campoNomeObjetivo.value.trim();
    var valorAlvo = campoValorObjetivo.obterValor();
    if (!nome || !valorAlvo) return;
    var dados = { nome: nome, valorAlvo: valorAlvo, dataAlvo: campoDataObjetivo.value || null };
    if (objetivoEmEdicao) {
      PennyObjetivos.atualizar(objetivoEmEdicao.id, dados);
    } else {
      PennyObjetivos.criar(dados);
    }
    fecharEdicaoObjetivo();
    render();
  });

  document.getElementById('btn-apagar-objetivo').addEventListener('click', function () {
    if (!objetivoEmEdicao) return;
    if (!window.confirm('Apagar este objetivo? As transferências já feitas continuam em Movimentos, mas deixam de estar ligadas a um objetivo.')) return;
    PennyObjetivos.remover(objetivoEmEdicao.id);
    fecharEdicaoObjetivo();
    render();
  });

  PennyDB.todos().then(function (movimentos) {
    TODOS_MOVIMENTOS = movimentos;
    render();
  });
});
