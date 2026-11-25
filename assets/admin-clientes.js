(function () {
  'use strict';

  function getNomeApoio() {
    if (typeof window !== 'undefined' && window.NomeApoio) return window.NomeApoio;
    if (typeof require === 'function') return require('./nome-apoio.js');
    return null;
  }

  // Cruza o nome do pedido com sócios e empregados (arrays de nomes).
  // Exato vence parcial. Rótulo em português para o administrador.
  // Nomes de sócios são públicos (QSA): coincidência de nome NÃO prova
  // identidade, por isso o rótulo sempre pede confirmação com a empresa.
  function montarApoio(pedidoNome, socios, empregados, truncado) {
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
    if (exatos.length) return { tipo: 'exato', rotulo: 'Nome coincide com ' + exatos.join(', ') + ' — confirmar com a empresa' };
    var parciais = origens('parcial');
    if (parciais.length) return { tipo: 'parcial', rotulo: 'Nome parecido com ' + parciais.join(', ') + ' — confirmar com a empresa' };
    if (truncado) return { tipo: 'truncado', rotulo: 'Base truncada — conferir manualmente' };
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

  // Status que o acesso precisa ter para a decisão valer (evita que uma aba
  // desatualizada sobrescreva uma decisão mais nova).
  function statusAnteriorEsperado(status) {
    if (status === 'aprovado' || status === 'recusado') return 'pendente';
    if (status === 'revogado') return 'aprovado';
    return null;
  }

  function normalizarEmail(e) {
    return String(e == null ? '' : e).trim().toLowerCase();
  }

  // Conjunto de e-mails (normalizados) a partir de linhas de cliente_usuarios.
  function emailsDeClientes(linhas) {
    var s = new Set();
    (Array.isArray(linhas) ? linhas : []).forEach(function (l) {
      var e = l ? normalizarEmail(l.email) : '';
      if (e) s.add(e);
    });
    return s;
  }

  function ehEmailCliente(conjunto, email) {
    var e = normalizarEmail(email);
    return !!(e && conjunto && conjunto.has(e));
  }

  // Lê todas as páginas via fetchPage(from, to) -> Promise<array>. Para na primeira página curta;
  // se atingir maxPaginas com páginas cheias, marca truncado.
  async function paginar(fetchPage, tamanho, maxPaginas) {
    tamanho = tamanho || 1000;
    maxPaginas = maxPaginas || 20;
    var rows = [];
    for (var i = 0; i < maxPaginas; i++) {
      var pagina = (await fetchPage(i * tamanho, i * tamanho + tamanho - 1)) || [];
      rows = rows.concat(pagina);
      if (pagina.length < tamanho) return { rows: rows, truncado: false };
    }
    return { rows: rows, truncado: true };
  }

  var api = {
    paginar: paginar, montarApoio: montarApoio, agruparPorStatus: agruparPorStatus, validarDecisao: validarDecisao,
    statusAnteriorEsperado: statusAnteriorEsperado, emailsDeClientes: emailsDeClientes, ehEmailCliente: ehEmailCliente,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.AdminClientes = api;
})();
