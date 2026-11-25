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

    const api = { decidirEstado, normalizarBusca };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.EstadoCliente = api;
})(typeof window !== 'undefined' ? window : globalThis);
