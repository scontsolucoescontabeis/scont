// Decisão pura do estado do cliente a partir de seus vínculos. Sem dependências.
(function (root) {
    function decidirEstado(vinculos) {
        const lista = Array.isArray(vinculos) ? vinculos : [];
        if (!lista.length) return { estado: 'sem_pedido', empresas: [], motivo: null };

        const aprovados = lista.filter(v => v && v.status === 'aprovado').map(v => v.codigo_empresa);
        if (aprovados.length >= 2) return { estado: 'seletor', empresas: aprovados, motivo: null };
        if (aprovados.length === 1) return { estado: 'home', empresas: aprovados, motivo: null };

        if (lista.some(v => v && v.status === 'pendente')) {
            return { estado: 'aguardando', empresas: [], motivo: null };
        }

        const comMotivo = lista.find(v => v && typeof v.motivo === 'string' && v.motivo.trim() !== '');
        return { estado: 'negado', empresas: [], motivo: comMotivo ? comMotivo.motivo.trim() : null };
    }

    // Texto de busca/filtro: minúsculas, sem acentos, espaços colapsados.
    function normalizarBusca(t) {
        return String(t == null ? '' : t)
            .normalize('NFD').replace(/[̀-ͯ]/g, '')
            .toLowerCase().replace(/\s+/g, ' ').trim();
    }

    // Link do Montador de Escala 5x2 em modo portal (relativo à página do portal).
    function urlMontador(codigo) {
        if (codigo == null || String(codigo) === '') return '';
        return '../Projeto Montador Escala 5x2/app/index.html?empresa=' + encodeURIComponent(String(codigo));
    }

    // Iniciais para avatar: até 2 letras, maiúsculas, acentos mantidos.
    // Usa as duas primeiras palavras significativas (ignora conectores); palavra única => 2 primeiras letras.
    const CONECTORES = ['de', 'da', 'do', 'dos', 'das', 'e'];
    function iniciais(nome) {
        const palavras = String(nome == null ? '' : nome).normalize('NFC').match(/[\p{L}\p{N}]+/gu) || [];
        if (!palavras.length) return '?';
        const sig = palavras.filter(p => !CONECTORES.includes(p.toLowerCase()));
        const usar = sig.length ? sig : palavras;
        const letras = usar.length >= 2
            ? [Array.from(usar[0])[0], Array.from(usar[1])[0]]
            : Array.from(usar[0]).slice(0, 2);
        return letras.join('').toLocaleUpperCase('pt-BR');
    }

    const api = { decidirEstado, normalizarBusca, urlMontador, iniciais };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.EstadoCliente = api;
})(typeof window !== 'undefined' ? window : globalThis);
