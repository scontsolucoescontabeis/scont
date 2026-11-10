// Projeto Demandas/js/clientes.js — Visão por cliente: todas as demandas de um cliente ao longo do tempo.
DEM.clientes = {
    selecionado: null,        // chave do cliente

    /** Agrupa por empresa do Portal quando vinculada; senão pelo nome original da planilha. */
    agrupar() {
        const mapa = new Map();
        for (const d of DEM.demandas) {
            const chave = d.cliente_id ? 'id:' + d.cliente_id : 'nome:' + DEM.parser.norm(d.cliente);
            if (!mapa.has(chave)) {
                const emp = d.cliente_id ? DEM.empresas.find(e => e.codigo_empresa === d.cliente_id) : null;
                mapa.set(chave, { chave, nome: emp ? emp.nome_empresa : d.cliente, demandas: [] });
            }
            mapa.get(chave).demandas.push(d);
        }
        return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    },

    render() {
        const C = DEM.clientes, esc = DEM.esc, hoje = DEM.hojeISO();
        const grupos = C.agrupar();
        const sel = grupos.find(g => g.chave === C.selecionado);
        const raiz = DEM.$('tela-clientes');

        if (!sel) {
            raiz.innerHTML = `<div class="cabecalho"><div><h2>Por cliente</h2><p class="sub">${grupos.length} cliente(s) com demandas</p></div></div>
                <div class="filtros"><label>Buscar cliente<input type="search" id="clBusca" placeholder="Nome do cliente…"></label></div>
                <div class="lista-clientes" id="clLista"></div>`;
            const pintar = () => {
                const b = DEM.parser.norm(DEM.$('clBusca').value);
                const g = grupos.filter(x => !b || DEM.parser.norm(x.nome).includes(b));
                DEM.$('clLista').innerHTML = g.length ? g.map(x => {
                    const abertas = x.demandas.filter(DEM.ehAberta).length;
                    const venc = x.demandas.filter(d => DEM.vencida(d, hoje)).length;
                    return `<button class="card-kpi" data-chave="${esc(x.chave)}"><div style="font-weight:600">${esc(x.nome)}</div>
                        <div class="rotulo">${x.demandas.length} demanda(s) · ${abertas} aberta(s)${venc ? ` · <span class="venc">${venc} vencida(s)</span>` : ''}</div></button>`;
                }).join('') : '<div class="vazio">Nenhum cliente encontrado.</div>';
                DEM.$('clLista').querySelectorAll('[data-chave]').forEach(b => b.addEventListener('click', () => { C.selecionado = b.dataset.chave; C.render(); }));
            };
            DEM.$('clBusca').addEventListener('input', pintar);
            pintar();
            return;
        }

        const lista = [...sel.demandas].sort((a, b) => (Date.parse(b.aberta_em) || Date.parse(b.primeira_leitura) || 0) - (Date.parse(a.aberta_em) || Date.parse(a.primeira_leitura) || 0));
        const abertas = lista.filter(DEM.ehAberta).length;
        raiz.innerHTML = `
            <button class="link-voltar" id="clVoltar">← Todos os clientes</button>
            <div class="cabecalho"><div><h2>${esc(sel.nome)}</h2>
                <p class="sub">${lista.length} demanda(s) no total · ${abertas} em aberto · ${lista.length - abertas} concluída(s)/informativa(s)</p></div></div>
            <div class="tabela-wrap"><table>
                <thead><tr><th>Aberta em</th><th>Demanda</th><th>Área</th><th>Prioridade</th><th>Status</th><th>Responsável</th><th>Prazo</th></tr></thead>
                <tbody>${lista.map(d => { const v = DEM.vencida(d, hoje); return `
                    <tr class="clicavel ${v ? 'vencida' : ''}" data-id="${esc(d.id)}">
                        <td class="num">${d.aberta_em ? DEM.fData(DEM.diaBR(d.aberta_em)) : 'n/d'}</td><td class="corta">${esc(d.demanda_inicial || '—')}</td>
                        <td>${esc(d.area || '—')}</td><td>${DEM.badgePrio(d.prioridade)}</td><td>${DEM.badgeStatus(d.status)}</td>
                        <td>${esc(d.responsavel || '—')}</td><td class="num ${v ? 'venc' : ''}">${DEM.fData(d.prazo)}</td></tr>`; }).join('')}</tbody></table></div>`;
        DEM.$('clVoltar').addEventListener('click', () => { C.selecionado = null; C.render(); });
        raiz.querySelectorAll('tr.clicavel').forEach(tr => tr.addEventListener('click', () => DEM.ir('detalhe', tr.dataset.id)));
    },
};
