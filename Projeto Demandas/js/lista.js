// Projeto Demandas/js/lista.js — Lista de demandas: filtros, busca, ordenação, destaque e exportação .xlsx.
DEM.lista = {
    filtros: {},                         // estado dos filtros (persiste enquanto a página está aberta)
    ordem: { campo: 'prazo', dir: 1 },

    COLUNAS: [
        { k: 'cliente', t: 'Cliente' }, { k: 'demanda_inicial', t: 'Demanda' }, { k: 'area', t: 'Área' },
        { k: 'prioridade', t: 'Prioridade' }, { k: 'status', t: 'Status' }, { k: 'responsavel', t: 'Responsável' },
        { k: 'prazo', t: 'Prazo' }, { k: 'aberta_em', t: 'Aberta em' }, { k: 'ultimo_movimento', t: 'Últ. movimento' },
    ],
    PESO_PRIO: { 'Alta': 0, 'Média': 1, 'Baixa': 2 },

    render() {
        const L = DEM.lista;
        if (DEM.filtroInicial) { L.filtros = { ...DEM.filtroInicial }; DEM.filtroInicial = null; }
        const f = L.filtros;
        const esc = DEM.esc;
        const distintos = (k) => [...new Set(DEM.demandas.map(d => d[k]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
        const opts = (lista, sel) => `<option value="">Todos</option>` + lista.map(v => `<option ${v === sel ? 'selected' : ''}>${esc(v)}</option>`).join('');
        const P = DEM.parser;

        DEM.$('tela-lista').innerHTML = `
            <div class="cabecalho"><div><h2>Demandas</h2><p class="sub" id="lsContagem"></p></div>
                <div class="acoes"><button class="btn sec" id="lsLimpar">Limpar filtros</button><button class="btn" id="lsExportar">📤 Exportar .xlsx</button></div></div>
            <div class="filtros">
                <label>Busca<input type="search" id="fBusca" placeholder="Cliente, demanda, solicitante…" value="${esc(f.busca || '')}"></label>
                <label>Status<select id="fStatus">${opts(P.STATUS, f.status)}</select></label>
                <label>Prioridade<select id="fPrio">${opts(P.PRIORIDADES, f.prioridade)}</select></label>
                <label>Área<select id="fArea">${opts(P.AREAS, f.area)}</select></label>
                <label>Responsável<select id="fResp">${opts(distintos('responsavel'), f.responsavel)}</select></label>
                <label>Cliente<select id="fCli">${opts(distintos('cliente'), f.cliente)}</select></label>
                <label>Prazo<select id="fPrazo">
                    <option value="">Todos</option>
                    ${[['vencidas', 'Vencidas'], ['ate7', 'Vencem em até 7 dias'], ['semprazo', 'Sem prazo'], ['comprazo', 'Com prazo']]
                        .map(([v, t]) => `<option value="${v}" ${f.prazo === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
                <label>Aberta de<input type="date" id="fDe" value="${esc(f.de || '')}"></label>
                <label>Aberta até<input type="date" id="fAte" value="${esc(f.ate || '')}"></label>
                <label>Situação<select id="fAbertas">
                    <option value="">Todas</option><option value="1" ${f.abertas ? 'selected' : ''}>Somente abertas</option></select></label>
            </div>
            <div class="tabela-wrap"><table>
                <thead><tr>${L.COLUNAS.map(c => `<th aria-sort="${L.ordem.campo === c.k ? (L.ordem.dir > 0 ? 'ascending' : 'descending') : 'none'}">
                    <button data-ord="${c.k}">${c.t}${L.ordem.campo === c.k ? (L.ordem.dir > 0 ? ' ▲' : ' ▼') : ''}</button></th>`).join('')}</tr></thead>
                <tbody id="lsCorpo"></tbody></table></div>`;

        const ler = () => {
            L.filtros = {
                busca: DEM.$('fBusca').value.trim(), status: DEM.$('fStatus').value, prioridade: DEM.$('fPrio').value,
                area: DEM.$('fArea').value, responsavel: DEM.$('fResp').value, cliente: DEM.$('fCli').value,
                prazo: DEM.$('fPrazo').value, de: DEM.$('fDe').value, ate: DEM.$('fAte').value,
                abertas: DEM.$('fAbertas').value === '1',
                // filtro vindo do painel (mês de conclusão) sobrevive enquanto o status não mudar
                concluidaMes: L.filtros.concluidaMes && DEM.$('fStatus').value === 'Concluída',
            };
            L.atualizarCorpo();
        };
        ['fBusca', 'fStatus', 'fPrio', 'fArea', 'fResp', 'fCli', 'fPrazo', 'fDe', 'fAte', 'fAbertas'].forEach(id => {
            DEM.$(id).addEventListener(id === 'fBusca' ? 'input' : 'change', ler);
        });
        DEM.$('lsLimpar').addEventListener('click', () => { L.filtros = {}; L.render(); });
        DEM.$('lsExportar').addEventListener('click', () => L.exportar());
        DEM.$('tela-lista').querySelectorAll('[data-ord]').forEach(b => b.addEventListener('click', () => {
            const k = b.dataset.ord;
            L.ordem = { campo: k, dir: L.ordem.campo === k ? -L.ordem.dir : 1 };
            L.render();
        }));
        L.atualizarCorpo();
    },

    filtradas() {
        const f = DEM.lista.filtros, hoje = DEM.hojeISO();
        const busca = f.busca ? DEM.parser.norm(f.busca) : '';
        const mes = hoje.slice(0, 7);
        return DEM.demandas.filter(d => {
            if (f.abertas && !DEM.ehAberta(d)) return false;
            if (f.status && d.status !== f.status) return false;
            if (f.concluidaMes && !(d.concluida_em && DEM.diaBR(d.concluida_em).slice(0, 7) === mes)) return false;
            if (f.prioridade && d.prioridade !== f.prioridade) return false;
            if (f.area && d.area !== f.area) return false;
            if (f.responsavel && d.responsavel !== f.responsavel) return false;
            if (f.cliente && d.cliente !== f.cliente) return false;
            if (f.prazo === 'vencidas' && !DEM.vencida(d, hoje)) return false;
            if (f.prazo === 'ate7') { const x = DEM.ehAberta(d) ? DEM.diasParaPrazo(d, hoje) : null; if (x == null || x < 0 || x > 7) return false; }
            if (f.prazo === 'semprazo' && d.prazo) return false;
            if (f.prazo === 'comprazo' && !d.prazo) return false;
            const aberta = d.aberta_em ? DEM.diaBR(d.aberta_em) : null;
            if (f.de && (!aberta || aberta < f.de)) return false;
            if (f.ate && (!aberta || aberta > f.ate)) return false;
            if (busca) {
                const alvo = DEM.parser.norm([d.cliente, d.demanda_inicial, d.solicitante, d.tipo, d.proxima_acao, d.responsavel].join(' '));
                if (!alvo.includes(busca)) return false;
            }
            return true;
        });
    },

    ordenadas(lista) {
        const { campo, dir } = DEM.lista.ordem;
        const val = (d) => campo === 'prioridade' ? (DEM.lista.PESO_PRIO[d.prioridade] ?? 9) : d[campo];
        return [...lista].sort((a, b) => {
            const x = val(a), y = val(b);
            if (x == null && y == null) return 0;
            if (x == null) return 1;                    // vazios sempre no fim
            if (y == null) return -1;
            const c = typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'pt-BR');
            return c * dir;
        });
    },

    atualizarCorpo() {
        const lista = DEM.lista.ordenadas(DEM.lista.filtradas());
        const hoje = DEM.hojeISO(), esc = DEM.esc;
        DEM.$('lsContagem').textContent = `${lista.length} de ${DEM.demandas.length} demanda(s)`;
        DEM.$('lsCorpo').innerHTML = lista.length ? lista.map(d => {
            const venc = DEM.vencida(d, hoje);
            return `<tr class="clicavel ${venc ? 'vencida' : ''}" data-id="${esc(d.id)}">
                <td>${esc(d.cliente)}</td><td class="corta">${esc(d.demanda_inicial || '—')}</td><td>${esc(d.area || '—')}</td>
                <td>${DEM.badgePrio(d.prioridade)}</td><td>${DEM.badgeStatus(d.status)}</td><td>${esc(d.responsavel || '—')}</td>
                <td class="num ${venc ? 'venc' : ''}">${DEM.fData(d.prazo)}${venc ? ' ⚠️' : ''}</td>
                <td class="num">${DEM.fData(DEM.diaBR(d.aberta_em))}</td><td class="num">${DEM.fDataHora(d.ultimo_movimento)}</td></tr>`;
        }).join('') : `<tr><td colspan="${DEM.lista.COLUNAS.length}" class="vazio">Nenhuma demanda encontrada com esses filtros.</td></tr>`;
        DEM.$('lsCorpo').querySelectorAll('tr.clicavel').forEach(tr => tr.addEventListener('click', () => DEM.ir('detalhe', tr.dataset.id)));
    },

    exportar() {
        const lista = DEM.lista.ordenadas(DEM.lista.filtradas());
        if (!lista.length) { DEM.toast('Nada para exportar com os filtros atuais.', 'erro'); return; }
        const hoje = DEM.hojeISO();
        const linhas = lista.map(d => ({
            'Cliente': d.cliente, 'Solicitante': d.solicitante || '', 'Demanda inicial': d.demanda_inicial || '',
            'Área': d.area || '', 'Tipo': d.tipo || '', 'Prioridade': d.prioridade || '', 'Status': d.status,
            'Responsável SCONT': d.responsavel || '', 'Aberta em': DEM.fDataHora(d.aberta_em).replace('—', ''),
            'Prazo': d.prazo ? DEM.fData(d.prazo) : '', 'Vencida': DEM.vencida(d, hoje) ? 'Sim' : 'Não',
            'Observação do prazo': d.prazo_obs || '', 'Próxima ação': d.proxima_acao || '',
            'Último movimento': DEM.fDataHora(d.ultimo_movimento).replace('—', ''), 'E-mail': d.link_email || '',
        }));
        const ws = XLSX.utils.json_to_sheet(linhas);
        ws['!cols'] = Object.keys(linhas[0]).map(k => ({ wch: Math.min(48, Math.max(k.length + 2, ...linhas.map(l => String(l[k]).length + 1))) }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Demandas');
        XLSX.writeFile(wb, `demandas_${hoje}.xlsx`);
    },
};
