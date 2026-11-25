(function () {
  'use strict';

  function getNomeApoio() {
    if (typeof window !== 'undefined' && window.NomeApoio) return window.NomeApoio;
    if (typeof require === 'function') return require('./nome-apoio.js');
    return null;
  }

  // Cruza o nome do pedido com sócios e empregados (arrays de nomes).
  // Exato vence parcial. Rótulo em português para o administrador.
  function montarApoio(pedidoNome, socios, empregados) {
    var NA = getNomeApoio();
    var pessoas = [];
    (Array.isArray(socios) ? socios : []).forEach(function (n) { pessoas.push({ nome: n, origem: 'sócio' }); });
    (Array.isArray(empregados) ? empregados : []).forEach(function (n) { pessoas.push({ nome: n, origem: 'empregado' }); });
    var achados = NA ? NA.acharApoio(pedidoNome, pessoas) : [];

    function origens(tipo) {
      var lista = [];
      achados.forEach(function (a) {
        if (a.tipo === tipo && lista.indexOf(a.origem) === -1) lista.push(a.origem);
      });
      return lista;
    }
    var exatos = origens('exato');
    if (exatos.length) return { tipo: 'exato', rotulo: '✔ Exato: ' + exatos.join(', ') };
    var parciais = origens('parcial');
    if (parciais.length) return { tipo: 'parcial', rotulo: '~ Parcial: ' + parciais.join(', ') };
    return { tipo: 'nenhum', rotulo: 'Nenhuma correspondência' };
  }

  function agruparPorStatus(acessos) {
    var g = { pendentes: [], liberados: [], encerrados: [] };
    (Array.isArray(acessos) ? acessos : []).forEach(function (a) {
      if (!a) return;
      if (a.status === 'pendente') g.pendentes.push(a);
      else if (a.status === 'aprovado') g.liberados.push(a);
      else if (a.status === 'recusado' || a.status === 'revogado') g.encerrados.push(a);
    });
    return g;
  }

  function validarDecisao(status, motivo) {
    if (['aprovado', 'recusado', 'revogado'].indexOf(status) === -1) {
      return { ok: false, erro: 'Status de decisão inválido.' };
    }
    if (status !== 'aprovado' && !String(motivo == null ? '' : motivo).trim()) {
      return { ok: false, erro: 'Informe o motivo.' };
    }
    return { ok: true };
  }

  var api = { montarApoio: montarApoio, agruparPorStatus: agruparPorStatus, validarDecisao: validarDecisao };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.AdminClientes = api;
})();
