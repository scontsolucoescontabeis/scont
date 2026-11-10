// Projeto Demandas/js/metricas.js — cálculos do painel (puros, testáveis em Node).
(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) module.exports = factory(require('./parser.js'));
    else root.DemandasMetricas = factory(root.DemandasParser);
})(typeof self !== 'undefined' ? self : this, function (P) {

    const diaBR = (v) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(v));
    const difDias = (a, b) => {
        const t = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
        return Math.round((t(b) - t(a)) / 86400000);
    };
    const ehAberta = (d) => d.status !== 'Concluída' && d.status !== 'Informativo';

    function metricas(demandas, hoje) {
        const abertas = demandas.filter(ehAberta);
        const comPrazo = abertas.filter(d => d.prazo);
        const mes = hoje.slice(0, 7);
        const contar = (lista, chave, ordem) => {
            const m = new Map(ordem.map(o => [o, 0]));
            for (const d of lista) { const k = d[chave] || '—'; m.set(k, (m.get(k) || 0) + 1); }
            return [...m.entries()].map(([nome, n]) => ({ nome, n })).filter(x => x.n > 0 || ordem.includes(x.nome));
        };
        const resp = new Map();
        for (const d of abertas) { const k = d.responsavel || 'A definir'; resp.set(k, (resp.get(k) || 0) + 1); }
        return {
            total: demandas.length,
            abertas: abertas.length,
            vencidas: comPrazo.filter(d => d.prazo < hoje).length,
            vencendo7: comPrazo.filter(d => { const x = difDias(hoje, d.prazo); return x >= 0 && x <= 7; }).length,
            aguardandoScont: demandas.filter(d => d.status === 'Aguardando SCONT').length,
            aguardandoCliente: demandas.filter(d => d.status === 'Aguardando cliente').length,
            concluidasMes: demandas.filter(d => d.status === 'Concluída' && d.concluida_em && diaBR(d.concluida_em).slice(0, 7) === mes).length,
            porStatus: contar(demandas, 'status', P.STATUS),
            porPrioridade: contar(demandas, 'prioridade', P.PRIORIDADES),
            porResponsavel: [...resp.entries()].map(([nome, n]) => ({ nome, n })).sort((a, b) => b.n - a.n || a.nome.localeCompare(b.nome, 'pt-BR')),
            maisAntigas: abertas.filter(d => d.aberta_em)
                .sort((a, b) => Date.parse(a.aberta_em) - Date.parse(b.aberta_em)).slice(0, 10)
                .map(d => ({ ...d, dias_em_aberto: difDias(diaBR(d.aberta_em), hoje) })),
        };
    }

    return { metricas, diaBR, difDias };
});
