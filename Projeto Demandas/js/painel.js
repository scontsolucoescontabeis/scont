// Projeto Demandas/js/painel.js — Painel gerencial.
DEM.painel = {
    render() {
        const raiz = DEM.$('tela-painel');
        const hoje = DEM.hojeISO();
        const m = window.DemandasMetricas.metricas(DEM.demandas, hoje);
        const esc = DEM.esc;

        const kpi = (valor, rotulo, filtro, classe = '') =>
            `<button class="card-kpi ${classe}" data-filtro='${esc(JSON.stringify(filtro))}' title="Ver na lista">
                <div class="valor num">${valor}</div><div class="rotulo">${esc(rotulo)}</div></button>`;

        const barras = (itens, fn) => {
            const max = Math.max(1, ...itens.map(i => i.n));
            return itens.map(i => `
                <div class="barra-linha">
                    <div>${fn ? fn(i.nome) : esc(i.nome)}</div>
                    <div class="trilho"><div class="preench" style="width:${(i.n / max) * 100}%"></div></div>
                    <div class="n num">${i.n}</div>
                </div>`).join('');
        };

        const antigas = m.maisAntigas.length
            ? `<div class="tabela-wrap"><table><thead><tr><th>Cliente</th><th>Demanda</th><th>Status</th><th>Aberta em</th><th>Dias</th></tr></thead><tbody>` +
              m.maisAntigas.map(d => `<tr class="clicavel ${DEM.vencida(d, hoje) ? 'vencida' : ''}" data-id="${esc(d.id)}">
                    <td>${esc(d.cliente)}</td><td class="corta">${esc(d.demanda_inicial || '—')}</td><td>${DEM.badgeStatus(d.status)}</td>
                    <td class="num">${DEM.fData(DEM.diaBR(d.aberta_em))}</td><td class="num">${d.dias_em_aberto}</td></tr>`).join('') +
              `</tbody></table></div>`
            : '<div class="vazio">Nenhuma demanda em aberto com data de abertura.</div>';

        raiz.innerHTML = `
            <div class="cabecalho"><div><h2>Painel</h2><p class="sub">Situação em ${DEM.fData(hoje)} · ${m.total} demanda(s) no banco</p></div>
                <div class="acoes"><button class="btn sec" id="pnAtualizar">🔄 Atualizar</button></div></div>
            ${m.total === 0 ? '<div class="aviso aviso-atencao">Ainda não há demandas. Use <strong>Importar planilha</strong> para carregar a primeira leitura.</div>' : ''}
            <div class="cards">
                ${kpi(m.abertas, 'Abertas', { abertas: true })}
                ${kpi(m.vencidas, 'Vencidas', { prazo: 'vencidas' }, m.vencidas ? 'perigo' : '')}
                ${kpi(m.vencendo7, 'Vencendo em até 7 dias', { prazo: 'ate7' }, m.vencendo7 ? 'atencao' : '')}
                ${kpi(m.aguardandoScont, 'Aguardando SCONT', { status: 'Aguardando SCONT' })}
                ${kpi(m.aguardandoCliente, 'Aguardando cliente', { status: 'Aguardando cliente' })}
                ${kpi(m.concluidasMes, 'Concluídas no mês', { status: 'Concluída', concluidaMes: true })}
            </div>
            <div class="grade-2">
                <div class="painel"><h3>Demandas por status</h3>${barras(m.porStatus, n => DEM.badgeStatus(n))}</div>
                <div class="painel"><h3>Demandas por prioridade</h3>${barras(m.porPrioridade, n => DEM.badgePrio(n))}</div>
            </div>
            <div class="grade-2">
                <div class="painel"><h3>Abertas por responsável</h3>${m.porResponsavel.length ? barras(m.porResponsavel) : '<div class="vazio">Sem demandas abertas.</div>'}</div>
                <div class="painel"><h3>Mais antigas em aberto</h3>${antigas}</div>
            </div>`;

        raiz.querySelectorAll('.card-kpi').forEach(b => b.addEventListener('click', () => {
            DEM.filtroInicial = JSON.parse(b.dataset.filtro);
            DEM.ir('lista');
        }));
        raiz.querySelectorAll('tr.clicavel').forEach(tr => tr.addEventListener('click', () => DEM.ir('detalhe', tr.dataset.id)));
        DEM.$('pnAtualizar').addEventListener('click', async () => { await DEM.carregar(); DEM.painel.render(); });
    },
};
