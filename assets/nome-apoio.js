(function () {
  'use strict';

  // Minúsculas, sem acentos, sem pontuação, espaços colapsados e trim.
  // Pontuação vira espaço (ex.: "Maria-José" e "Maria José" batem).
  function normalizarNome(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Procura pessoas (sócios/empregados) cujo nome bate com o nome informado.
  // exato: nomes normalizados iguais.
  // parcial: todos os termos do menor nome (mínimo 2 termos) estão no maior.
  // Retorna exatos primeiro; dentro de cada grupo, preserva a ordem de entrada.
  function acharApoio(nome, pessoas) {
    var alvo = normalizarNome(nome);
    if (!alvo || !Array.isArray(pessoas)) return [];

    var termosAlvo = alvo.split(' ');
    var setAlvo = new Set(termosAlvo);
    var exatos = [];
    var parciais = [];

    pessoas.forEach(function (p) {
      if (!p) return;
      var nomeP = normalizarNome(p.nome);
      if (!nomeP) return;

      var item = { nome: p.nome, origem: p.origem, tipo: null };

      if (nomeP === alvo) {
        item.tipo = 'exato';
        exatos.push(item);
        return;
      }

      var termosP = nomeP.split(' ');
      var setP = new Set(termosP);
      var menor = termosAlvo.length <= termosP.length ? termosAlvo : termosP;
      var maiorSet = termosAlvo.length <= termosP.length ? setP : setAlvo;
      if (menor.length < 2) return;

      var todosPresentes = menor.every(function (t) { return maiorSet.has(t); });
      if (todosPresentes) {
        item.tipo = 'parcial';
        parciais.push(item);
      }
    });

    return exatos.concat(parciais);
  }

  var api = { normalizarNome: normalizarNome, acharApoio: acharApoio };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof window !== 'undefined') {
    window.NomeApoio = api;
  }
})();
