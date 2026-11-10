// Projeto Demandas/js/parser.js
// Lê a planilha de demandas POR NOME de aba e de coluna (nunca por posição).
// Recebe matrizes (array de linhas) — quem lê o .xlsx converte antes (ver importar.js) —
// o que mantém este módulo testável em Node, sem dependências.
(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) module.exports = factory();
    else root.DemandasParser = factory();
})(typeof self !== 'undefined' ? self : this, function () {

    const STATUS = ['Aguardando SCONT', 'Em análise (SCONT)', 'Aguardando cliente', 'Concluída', 'Informativo'];
    const PRIORIDADES = ['Alta', 'Média', 'Baixa'];
    const AREAS = ['DP', 'DP – eSocial', 'Contábil', 'Fiscal', 'Outra'];
    const AUTORES = ['SCONT', 'Cliente', 'Terceiro'];

    // nome canônico da coluna -> apelidos aceitos (já normalizados por norm())
    const COLUNAS_DEMANDAS = {
        gmail_thread_id: { rotulo: 'ID da conversa', obrigatoria: true, apelidos: ['id da conversa', 'gmail thread id', 'thread id'] },
        cliente:         { rotulo: 'Cliente', obrigatoria: true, apelidos: ['cliente'] },
        solicitante:     { rotulo: 'Solicitante', apelidos: ['solicitante'] },
        aberta_em:       { rotulo: 'Data da demanda inicial', apelidos: ['data da demanda inicial', 'aberta em'] },
        demanda_inicial: { rotulo: 'Demanda inicial', apelidos: ['demanda inicial', 'demanda'] },
        area:            { rotulo: 'Área', apelidos: ['area'] },
        tipo:            { rotulo: 'Tipo', apelidos: ['tipo'] },
        prioridade:      { rotulo: 'Prioridade', apelidos: ['prioridade'] },
        status:          { rotulo: 'Status', obrigatoria: true, apelidos: ['status'] },
        responsavel:     { rotulo: 'Responsável SCONT', apelidos: ['responsavel scont', 'responsavel'] },
        prazo:           { rotulo: 'Prazo', apelidos: ['prazo'] },
        prazo_obs:       { rotulo: 'Observação do prazo', apelidos: ['observacao do prazo', 'observacao prazo'] },
        proxima_acao:    { rotulo: 'Próxima ação', apelidos: ['proxima acao'] },
        ultimo_movimento:{ rotulo: 'Último movimento', apelidos: ['ultimo movimento'] },
        link_email:      { rotulo: 'E-mail (link)', apelidos: ['e-mail (link)', 'e-mail', 'email', 'email (link)', 'link'] },
    };
    const COLUNAS_TRATATIVAS = {
        gmail_thread_id: { rotulo: 'ID da conversa', obrigatoria: true, apelidos: ['id da conversa', 'gmail thread id', 'thread id'] },
        ocorrida_em:     { rotulo: 'Data/hora', obrigatoria: true, apelidos: ['data/hora', 'data hora', 'data e hora'] },
        autor_tipo:      { rotulo: 'Autor', obrigatoria: true, apelidos: ['autor'] },
        descricao:       { rotulo: 'Tratativa adotada', obrigatoria: true, apelidos: ['tratativa adotada', 'tratativa'] },
    };

    /** minúsculo, sem acento, traço longo -> '-', espaços colapsados */
    function norm(v) {
        return String(v == null ? '' : v)
            .normalize('NFD').replace(/[̀-ͯ]/g, '')
            .replace(/[–—]/g, '-')
            .replace(/\s+/g, ' ').trim().toLowerCase();
    }

    function vazio(v) {
        if (v == null) return true;
        const s = String(v).trim();
        return s === '' || norm(s) === 'n/d' || norm(s) === 'nd' || s === '-' || s === '—';
    }

    const p2 = (n) => String(n).padStart(2, '0');

    function montar(y, mo, d, h, mi, s, comHora) {
        if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return null;
        const t = new Date(Date.UTC(y, mo - 1, d));
        if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return null; // 31/02 etc.
        const data = `${y}-${p2(mo)}-${p2(d)}`;
        return comHora ? `${data}T${p2(h)}:${p2(mi)}:${p2(s)}-03:00` : data;   // Brasília = UTC-3 (sem horário de verão desde 2019)
    }

    /**
     * Converte célula (serial do Excel, Date, "dd/mm/aaaa [hh:mm[:ss]]", ISO) em
     * { ok, valor } onde valor = null ("n/d"/vazio) | 'YYYY-MM-DD' | ISO com -03:00.
     * ok=false => valor inválido.
     */
    function lerData(v, { comHora }) {
        if (vazio(v)) return { ok: true, valor: null };
        let y, mo, d, h = 0, mi = 0, s = 0;
        if (v instanceof Date) {
            if (isNaN(v)) return { ok: false };
            y = v.getFullYear(); mo = v.getMonth() + 1; d = v.getDate(); h = v.getHours(); mi = v.getMinutes(); s = v.getSeconds();
        } else if (typeof v === 'number') {
            if (!(v > 0 && v < 2958466)) return { ok: false };
            const ms = Math.round((v - Math.floor(v)) * 86400);                 // segundos do dia
            const dt = new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 86400000);
            y = dt.getUTCFullYear(); mo = dt.getUTCMonth() + 1; d = dt.getUTCDate();
            h = Math.floor(ms / 3600) % 24; mi = Math.floor(ms / 60) % 60; s = ms % 60;
        } else {
            const t = String(v).trim();
            let m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
            if (m) { d = +m[1]; mo = +m[2]; y = +m[3]; h = +(m[4] || 0); mi = +(m[5] || 0); s = +(m[6] || 0); }
            else {
                m = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
                if (!m) return { ok: false };
                y = +m[1]; mo = +m[2]; d = +m[3]; h = +(m[4] || 0); mi = +(m[5] || 0); s = +(m[6] || 0);
            }
        }
        const out = montar(y, mo, d, h, mi, s, comHora);
        return out ? { ok: true, valor: out } : { ok: false };
    }

    /** Valor de lista fechada: devolve o canônico, null se vazio, ou undefined se fora da lista. */
    function lerLista(v, lista) {
        if (vazio(v)) return null;
        const n = norm(v);
        const achado = lista.find(x => norm(x) === n);
        return achado === undefined ? undefined : achado;
    }

    /** true quando a célula traz só a data (tratativa exige data E hora). */
    function semHorario(v) {
        if (typeof v === 'number') return Number.isInteger(v);
        if (v instanceof Date) return v.getHours() === 0 && v.getMinutes() === 0 && v.getSeconds() === 0;
        return !/\d{1,2}:\d{2}/.test(String(v));
    }

    const txt = (v) => (vazio(v) ? null : String(v).trim());

    /** Acha a linha de cabeçalho (a primeira que contém as colunas obrigatórias) e mapeia nome -> índice. */
    function mapearColunas(matriz, defs) {
        const obrig = Object.entries(defs).filter(([, d]) => d.obrigatoria);
        const limite = Math.min(matriz.length, 30);
        let melhor = null;
        for (let i = 0; i < limite; i++) {
            const linha = matriz[i] || [];
            const mapa = {};
            linha.forEach((c, idx) => {
                const n = norm(c);
                if (!n) return;
                for (const [chave, def] of Object.entries(defs)) {
                    if (mapa[chave] === undefined && def.apelidos.includes(n)) { mapa[chave] = idx; break; }
                }
            });
            const achadas = obrig.filter(([k]) => mapa[k] !== undefined).length;
            if (!melhor || Object.keys(mapa).length > Object.keys(melhor.mapa).length) melhor = { linha: i, mapa, achadas };
            if (achadas === obrig.length) return { linha: i, mapa };
        }
        return melhor && Object.keys(melhor.mapa).length ? melhor : { linha: -1, mapa: {} };
    }

    function colunasAusentes(mapa, defs) {
        const obrigatorias = [], opcionais = [];
        for (const [k, d] of Object.entries(defs)) {
            if (mapa[k] === undefined) (d.obrigatoria ? obrigatorias : opcionais).push(d.rotulo);
        }
        return { obrigatorias, opcionais };
    }

    function linhaVazia(l) { return !l || l.every(c => c == null || String(c).trim() === ''); }

    /**
     * Aba "Demandas".
     * @returns {{ demandas: object[], erros: {linha:number, mensagem:string, id?:string}[],
     *             avisos: string[], bloqueio: string|null }}
     *   linha = número da linha na planilha (1-based). Linhas com erro NÃO entram em `demandas`.
     */
    function parseDemandas(matriz) {
        const res = { demandas: [], erros: [], avisos: [], bloqueio: null };
        if (!Array.isArray(matriz) || !matriz.length) { res.bloqueio = 'A aba "Demandas" está vazia.'; return res; }
        const { linha: cab, mapa } = mapearColunas(matriz, COLUNAS_DEMANDAS);
        const falta = colunasAusentes(mapa, COLUNAS_DEMANDAS);
        if (cab < 0 || falta.obrigatorias.length) {
            res.bloqueio = `Coluna(s) obrigatória(s) ausente(s) na aba "Demandas": ${(cab < 0 ? Object.values(COLUNAS_DEMANDAS).filter(d => d.obrigatoria).map(d => d.rotulo) : falta.obrigatorias).join(', ')}.`;
            return res;
        }
        if (falta.opcionais.length) res.avisos.push(`Coluna(s) ausente(s) na aba "Demandas" (campos ficarão vazios): ${falta.opcionais.join(', ')}.`);

        const vistos = new Set();
        for (let i = cab + 1; i < matriz.length; i++) {
            const l = matriz[i];
            if (linhaVazia(l)) continue;
            const get = (k) => (mapa[k] === undefined ? undefined : l[mapa[k]]);
            const nl = i + 1;
            const id = txt(get('gmail_thread_id'));
            const erros = [];
            const erro = (m) => erros.push(m);

            if (!id) erro('ID da conversa vazio.');
            else if (vistos.has(id)) erro(`ID da conversa duplicado na planilha (${id}).`);
            const cliente = txt(get('cliente'));
            if (!cliente) erro('Cliente vazio.');

            const status = lerLista(get('status'), STATUS);
            if (status === null) erro('Status vazio.');
            else if (status === undefined) erro(`Status fora da lista: "${get('status')}".`);
            const prioridade = lerLista(get('prioridade'), PRIORIDADES);
            if (prioridade === undefined) erro(`Prioridade fora da lista: "${get('prioridade')}".`);
            const area = lerLista(get('area'), AREAS);
            if (area === undefined) erro(`Área fora da lista: "${get('area')}".`);

            const aberta = lerData(get('aberta_em'), { comHora: true });
            if (!aberta.ok) erro(`Data da demanda inicial inválida: "${get('aberta_em')}".`);
            const prazo = lerData(get('prazo'), { comHora: false });
            if (!prazo.ok) erro(`Prazo inválido: "${get('prazo')}".`);
            const mov = lerData(get('ultimo_movimento'), { comHora: true });
            if (!mov.ok) erro(`Último movimento inválido: "${get('ultimo_movimento')}".`);

            if (erros.length) { erros.forEach(m => res.erros.push({ linha: nl, id: id || null, mensagem: m })); continue; }
            vistos.add(id);

            let link = txt(get('link_email'));
            if (!link || !/^https?:\/\//i.test(link) || /\/mail\/\?authuser=[^#]*$/i.test(link)) {
                link = `https://mail.google.com/mail/u/0/#all/${encodeURIComponent(id)}`;   // abre a conversa direto
            }
            res.demandas.push({
                gmail_thread_id: id, cliente, solicitante: txt(get('solicitante')),
                area, tipo: txt(get('tipo')), prioridade, status,
                responsavel: txt(get('responsavel')),
                demanda_inicial: txt(get('demanda_inicial')),
                aberta_em: aberta.valor, prazo: prazo.valor, prazo_obs: txt(get('prazo_obs')),
                proxima_acao: txt(get('proxima_acao')), ultimo_movimento: mov.valor, link_email: link,
                _linha: nl,
            });
        }
        return res;
    }

    /** Aba "Tratativas". Mesmo contrato de retorno de parseDemandas. */
    function parseTratativas(matriz) {
        const res = { tratativas: [], erros: [], avisos: [], bloqueio: null };
        if (!Array.isArray(matriz) || !matriz.length) { res.bloqueio = 'A aba "Tratativas" está vazia.'; return res; }
        const { linha: cab, mapa } = mapearColunas(matriz, COLUNAS_TRATATIVAS);
        const falta = colunasAusentes(mapa, COLUNAS_TRATATIVAS);
        if (cab < 0 || falta.obrigatorias.length) {
            res.bloqueio = `Coluna(s) obrigatória(s) ausente(s) na aba "Tratativas": ${(cab < 0 ? Object.values(COLUNAS_TRATATIVAS).map(d => d.rotulo) : falta.obrigatorias).join(', ')}.`;
            return res;
        }
        for (let i = cab + 1; i < matriz.length; i++) {
            const l = matriz[i];
            if (linhaVazia(l)) continue;
            const get = (k) => l[mapa[k]];
            const nl = i + 1;
            const id = txt(get('gmail_thread_id'));
            const erros = [];
            if (!id) erros.push('ID da conversa vazio.');
            const quando = lerData(get('ocorrida_em'), { comHora: true });
            if (!quando.ok || quando.valor === null) erros.push(`Data/hora inválida ou ausente: "${get('ocorrida_em') ?? ''}".`);
            else if (semHorario(get('ocorrida_em'))) erros.push(`Data/hora sem horário: "${get('ocorrida_em')}".`);
            const autor = lerLista(get('autor_tipo'), AUTORES);
            if (autor === null) erros.push('Autor vazio.');
            else if (autor === undefined) erros.push(`Autor fora da lista (SCONT/Cliente/Terceiro): "${get('autor_tipo')}".`);
            const descricao = txt(get('descricao'));
            if (!descricao) erros.push('Tratativa adotada vazia.');
            if (erros.length) { erros.forEach(m => res.erros.push({ linha: nl, id: id || null, mensagem: m })); continue; }
            res.tratativas.push({ gmail_thread_id: id, ocorrida_em: quando.valor, autor_tipo: autor, autor: null, descricao, _linha: nl });
        }
        return res;
    }

    /** Chave de deduplicação equivalente ao hash_dedup do banco (instante em segundos + texto normalizado). */
    function chaveTratativa(ocorridaEm, descricao) {
        return `${Math.floor(Date.parse(ocorridaEm) / 1000)}|${String(descricao).trim().toLowerCase()}`;
    }

    return { STATUS, PRIORIDADES, AREAS, AUTORES, norm, lerData, lerLista, parseDemandas, parseTratativas, chaveTratativa };
});
