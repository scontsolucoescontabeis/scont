// Projeto Demandas/js/diff.js
// Pré-visualização da importação: classifica cada demanda da planilha contra o que já está
// no banco e detecta conflitos com edições manuais. Espelha as regras da RPC demandas_importar()
// (_sql/schema_demandas.sql) — se uma mudar, a outra também.
(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) module.exports = factory(require('./parser.js'));
    else root.DemandasDiff = factory(root.DemandasParser);
})(typeof self !== 'undefined' ? self : this, function (P) {

    // Campos que a equipe edita no Portal (protegidos da planilha quando editados à mão).
    const CAMPOS_MANUAIS = ['status', 'prioridade', 'responsavel', 'prazo', 'proxima_acao'];
    const CAMPOS_TEXTO = ['cliente', 'solicitante', 'area', 'tipo', 'demanda_inicial', 'prazo_obs', 'link_email'];
    const CAMPOS_INSTANTE = ['aberta_em', 'ultimo_movimento'];
    const ROTULOS = {
        status: 'Status', prioridade: 'Prioridade', responsavel: 'Responsável', prazo: 'Prazo', proxima_acao: 'Próxima ação',
    };

    const nulo = (v) => (v == null || String(v).trim() === '' ? null : String(v).trim());
    const instante = (v) => (v == null ? null : Date.parse(v));
    const dia = (v) => (v == null ? null : String(v).slice(0, 10));

    function igual(campo, a, b) {
        if (CAMPOS_INSTANTE.includes(campo)) return instante(a) === instante(b);
        if (campo === 'prazo') return dia(a) === dia(b);
        return nulo(a) === nulo(b);
    }

    /**
     * @param {object[]} planilha   demandas parseadas
     * @param {Map<string,object>|object} existentes  thread_id -> linha do banco (com campos_manuais)
     * @param {Object<string,string[]>} sobrescrever  thread_id -> campos que o usuário escolheu sobrescrever
     * @returns {{ novas:object[], atualizadas:object[], inalteradas:object[], conflitos:object[] }}
     *   conflitos: { id, cliente, demanda, campo, rotulo, atual, planilha }
     */
    function classificarDemandas(planilha, existentes, sobrescrever = {}) {
        const get = (id) => (existentes instanceof Map ? existentes.get(id) : existentes[id]);
        const out = { novas: [], atualizadas: [], inalteradas: [], conflitos: [] };
        for (const d of planilha) {
            const old = get(d.gmail_thread_id);
            if (!old) { out.novas.push(d); continue; }
            const manuais = old.campos_manuais || [];
            const sobre = sobrescrever[d.gmail_thread_id] || [];
            const mudancas = [];
            for (const c of [...CAMPOS_TEXTO, ...CAMPOS_INSTANTE]) {
                if (!igual(c, old[c], d[c])) mudancas.push(c);
            }
            for (const c of CAMPOS_MANUAIS) {
                if (igual(c, old[c], d[c])) continue;
                if (manuais.includes(c) && !sobre.includes(c)) {
                    out.conflitos.push({
                        id: d.gmail_thread_id, cliente: d.cliente, demanda: d.demanda_inicial, campo: c, rotulo: ROTULOS[c],
                        atual: old[c] ?? null, planilha: d[c] ?? null,
                    });
                } else mudancas.push(c);
            }
            // "atualizada" = algo será de fato gravado. Conflito mantido não conta como mudança.
            (mudancas.length ? out.atualizadas : out.inalteradas).push({ ...d, _mudancas: mudancas });
        }
        return out;
    }

    /**
     * Tratativas novas = as da planilha cuja chave (instante + texto) ainda não existe naquela demanda.
     * @param {Map<string,Set<string>>|object} chavesExistentes thread_id -> Set de chaves (P.chaveTratativa)
     * @param {Set<string>} threadsNaPlanilha threads que existirão após a importação (novas + existentes)
     */
    function tratativasNovas(tratativas, chavesExistentes, threadsNaPlanilha) {
        const get = (id) => (chavesExistentes instanceof Map ? chavesExistentes.get(id) : chavesExistentes[id]);
        const vistas = new Set();
        const novas = [], semDemanda = [];
        for (const t of tratativas) {
            if (!threadsNaPlanilha.has(t.gmail_thread_id)) { semDemanda.push(t); continue; }
            const chave = P.chaveTratativa(t.ocorrida_em, t.descricao);
            const k = `${t.gmail_thread_id}#${chave}`;
            if (vistas.has(k)) continue;           // repetida no próprio arquivo
            vistas.add(k);
            const ex = get(t.gmail_thread_id);
            if (ex && ex.has(chave)) continue;
            novas.push(t);
        }
        return { novas, semDemanda };
    }

    return { CAMPOS_MANUAIS, classificarDemandas, tratativasNovas };
});
