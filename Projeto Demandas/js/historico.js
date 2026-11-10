// Projeto Demandas/js/historico.js — Histórico de importações (leituras_diarias).
DEM.historico = {
    async render() {
        const raiz = DEM.$('tela-historico');
        raiz.innerHTML = '<div class="cabecalho"><div><h2>Histórico de importações</h2><p class="sub">Cada linha é uma planilha importada.</p></div></div><div id="hsCorpo" class="vazio">Carregando…</div>';
        let dados;
        try {
            dados = await DEM.buscarTudo(() => DEM.sb.from('leituras_diarias').select('*').order('importado_em', { ascending: false }));
        } catch (e) {
            DEM.$('hsCorpo').className = 'aviso aviso-erro';
            DEM.$('hsCorpo').textContent = 'Erro ao carregar o histórico: ' + (e.message || e);
            return;
        }
        const esc = DEM.esc;
        DEM.$('hsCorpo').className = '';
        DEM.$('hsCorpo').innerHTML = dados.length ? `<div class="tabela-wrap"><table>
            <thead><tr><th>Importada em</th><th>Data de leitura</th><th>Arquivo</th><th>Por</th><th>Conversas</th><th>Novas</th><th>Atualizadas</th><th>Inalteradas</th><th>Tratativas novas</th><th>Linhas c/ erro</th></tr></thead>
            <tbody>${dados.map(l => `<tr><td class="num">${DEM.fDataHora(l.importado_em)}</td><td class="num">${DEM.fData(l.data_leitura)}</td>
                <td>${esc(l.arquivo || '—')}</td><td>${esc(l.importado_por_nome || '—')}</td>
                <td class="num">${l.conversas ?? '—'}</td><td class="num">${l.novas ?? '—'}</td><td class="num">${l.atualizadas ?? '—'}</td>
                <td class="num">${l.inalteradas ?? '—'}</td><td class="num">${l.tratativas_novas ?? '—'}</td><td class="num">${l.linhas_com_erro ?? 0}</td></tr>`).join('')}</tbody></table></div>`
            : '<div class="vazio">Nenhuma importação realizada ainda.</div>';
    },
};
