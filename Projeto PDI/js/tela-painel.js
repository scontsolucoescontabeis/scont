// Projeto PDI/js/tela-painel.js — Painel dos Sócios / Minha equipe (gestor)
window.PdiPainel = (function () {
    'use strict';
    const U = window.PdiUI, e = U.esc, T = window.PdiTextos, C = window.PdiCalculo, Doc = window.PdiDocumento;
    // filtro: '' (todos) | 'atencao' (algo crítico) | 'validar' | 'agendar'
    let filtros = { busca: '', gestor: '', status: 'ativo', foco: '' };

    function resumo(item) {
        const fim = C.fimPdi(item.pdi.data_inicio, item.pdi.meses_acompanhamento);
        const dd = { ...item, semanasPrevistas: window.PdiAlertas.semanasPrevistas(item.pdi.data_inicio, U.hojeISO(), fim) };
        const alertas = window.PdiAlertas.calcular(dd, U.hojeISO());
        const acoes = item.acoes.filter(a => !a.recorrencia);
        const hoje = U.hojeISO();
        const ciclo = item.ciclos.find(c => hoje >= c.inicio && hoje <= c.fim);
        const abaixo = item.indicadores.filter(i => {
            const s = C.atingimento(i, Doc.valorIndicador(i, dd));
            return s === 'nao_atingida' || s === 'parcial';
        }).length;
        const ultima = item.avaliacoes.filter(a => a.resultado).sort((a, b) => b.ciclo_numero - a.ciclo_numero)[0];
        const r = {
            ciclo: ciclo ? ciclo.numero : (hoje > fim ? 4 : 1),
            concluidas: acoes.filter(a => a.status === 'concluido').length, totalAcoes: acoes.length,
            atrasadas: alertas.filter(a => a.tipo === 'acao_vencida').length,
            nivelPendente: alertas.some(a => a.tipo === 'nivel_inicial'),
            resumoFalta: alertas.some(a => a.tipo === 'resumo_semanal'),
            abaixo, melhoriasPend: item.melhorias.filter(m => m.validacao_gestor === 'pendente').length,
            agendar: alertas.filter(a => a.tipo === 'avaliacao_agendar' || a.tipo === 'avaliacao_atrasada').length,
            ultima,
        };
        r.critico = r.atrasadas > 0 || r.nivelPendente;
        r.urgencia = r.atrasadas * 3 + (r.nivelPendente ? 3 : 0) + r.agendar * 2 + (r.resumoFalta ? 1 : 0) + r.melhoriasPend + r.abaixo;
        return r;
    }

    function chips(r) {
        const c = [];
        if (r.atrasadas) c.push(`<span class="chip crit">${r.atrasadas} ação(ões) atrasada(s)</span>`);
        if (r.nivelPendente) c.push('<span class="chip crit">Nível inicial pendente</span>');
        if (r.agendar) c.push('<span class="chip atenc">Agendar avaliação</span>');
        if (r.resumoFalta) c.push('<span class="chip atenc">Resumo semanal ausente</span>');
        if (r.abaixo) c.push(`<span class="chip atenc">${r.abaixo} indicador(es) abaixo da meta</span>`);
        if (r.melhoriasPend) c.push(`<span class="chip info">${r.melhoriasPend} melhoria(s) a validar</span>`);
        return c.length ? c.join('') : '<span class="chip ok">Em dia</span>';
    }

    async function render(host, ctx) {
        host.innerHTML = '<p class="carregando" role="status">Carregando PDIs…</p>';
        const todos = await window.PdiApi.carregarTodos();
        const lista = ctx.somenteGestor ? todos.filter(i => i.pdi.gestor_user_id === ctx.user.id) : todos;
        const linhas = lista.map(i => ({ i, r: resumo(i) }));
        const gestores = [...new Set(lista.map(i => i.pdi.gestor_nome).filter(Boolean))].sort();
        document.title = `${ctx.somenteGestor ? 'Minha equipe' : 'Painel dos Sócios'} — PDI — SCONT`;

        const base = () => linhas.filter(({ i }) =>
            (!filtros.status || i.pdi.status === filtros.status) &&
            (!filtros.gestor || i.pdi.gestor_nome === filtros.gestor) &&
            (!filtros.busca || `${i.pdi.colaborador_nome} ${i.pdi.cargo_setor}`.toLowerCase().includes(filtros.busca.toLowerCase())));
        const porFoco = (arr) => arr.filter(({ r }) =>
            !filtros.foco || (filtros.foco === 'atencao' && r.critico) || (filtros.foco === 'validar' && r.melhoriasPend > 0) || (filtros.foco === 'agendar' && r.agendar > 0));

        const desenhar = () => {
            const b = base();
            const vis = porFoco(b).sort((x, y) => y.r.urgencia - x.r.urgencia || x.i.pdi.colaborador_nome.localeCompare(y.i.pdi.colaborador_nome));
            const dist = Object.keys(T.RESULTADOS).map(k => ({ k, n: b.filter(x => x.r.ultima && x.r.ultima.resultado === k).length }));
            const maxD = Math.max(1, ...dist.map(x => x.n));
            const nAt = b.filter(x => x.r.critico).length;
            const nVal = b.filter(x => x.r.melhoriasPend > 0).length;
            const nAg = b.filter(x => x.r.agendar > 0).length;
            const tile = (foco, n, rot) => `<button class="kpi kpi-btn${filtros.foco === foco ? ' ativo' : ''}" data-foco="${foco}" aria-pressed="${filtros.foco === foco}">
                <span class="kpi-v">${n}</span><span class="kpi-r">${rot}</span></button>`;
            host.innerHTML = `<h1>${ctx.somenteGestor ? 'Minha equipe' : 'Painel dos Sócios'}</h1>
              <div class="kpis">
                ${tile('', b.length, 'PDIs no filtro')}
                ${tile('atencao', nAt, 'precisam de atenção')}
                ${tile('validar', nVal, 'com melhorias a validar')}
                ${tile('agendar', nAg, 'com avaliação a agendar')}
              </div>
              <div class="filtros">
                <input type="search" id="fBusca" placeholder="Buscar por nome ou cargo…" value="${e(filtros.busca)}" aria-label="Buscar por nome ou cargo" autocomplete="off">
                <select id="fGestor" aria-label="Filtrar por gestor"><option value="">Todos os gestores</option>${gestores.map(g => `<option${g === filtros.gestor ? ' selected' : ''}>${e(g)}</option>`).join('')}</select>
                <select id="fStatus" aria-label="Filtrar por status"><option value="">Todos os status</option>${['ativo', 'rascunho', 'encerrado'].map(s => `<option value="${s}"${s === filtros.status ? ' selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`).join('')}</select>
                ${(filtros.busca || filtros.gestor || filtros.foco || filtros.status !== 'ativo') ? '<button class="btn sec peq" id="fLimpar">Limpar filtros</button>' : ''}
              </div>
              <p class="muted resumo-lista" aria-live="polite">${vis.length} de ${lista.length} PDI(s), os mais urgentes primeiro.</p>
              <div class="tabela-wrap"><table class="doc-tab empilhar"><thead><tr><th>Colaborador</th><th>Ciclo</th><th>Ações concluídas</th><th>Situação</th><th>Último resultado</th><th><span class="sr-only">Abrir</span></th></tr></thead><tbody>
                ${vis.map(({ i, r }) => {
                    const pct = r.totalAcoes ? Math.round(r.concluidas / r.totalAcoes * 100) : 0;
                    return `<tr class="clicavel" tabindex="0" data-abrir="${i.pdi.id}" aria-label="Abrir PDI de ${e(i.pdi.colaborador_nome)}">
                      <td data-label="Colaborador"><strong>${e(i.pdi.colaborador_nome)}</strong><br><small>${e(i.pdi.cargo_setor)}${i.pdi.gestor_nome ? ' · ' + e(i.pdi.gestor_nome) : ''}</small></td>
                      <td data-label="Ciclo" class="nowrap">${r.ciclo} de 4</td>
                      <td data-label="Ações concluídas"><div class="progresso" role="img" aria-label="${r.concluidas} de ${r.totalAcoes} ações"><i style="width:${pct}%"></i></div><small>${r.concluidas} de ${r.totalAcoes}</small></td>
                      <td data-label="Situação"><div class="chips">${chips(r)}</div></td>
                      <td data-label="Último resultado">${r.ultima ? e(T.RESULTADOS[r.ultima.resultado]) : '<span class="muted">Sem avaliação</span>'}</td>
                      <td data-label=""><button class="btn peq" data-abrir="${i.pdi.id}">Abrir</button></td></tr>`;
                }).join('') || `<tr><td colspan="6" class="vazio">${lista.length ? 'Nenhum PDI com esses filtros.' : 'Nenhum PDI cadastrado ainda.'}</td></tr>`}
              </tbody></table></div>
              <h3>Resultado da última avaliação</h3>
              <div class="barras">${dist.map(x => `<div class="barra-l"><span>${e(T.RESULTADOS[x.k])}</span>
                <div class="barra-b"><i style="width:${(x.n / maxD) * 100}%"></i></div><b>${x.n}</b></div>`).join('')}</div>`;
            const busca = host.querySelector('#fBusca');
            busca.oninput = (ev) => {
                filtros.busca = ev.target.value;
                const pos = ev.target.selectionStart;
                desenhar();
                const nova = host.querySelector('#fBusca');
                nova.focus(); nova.setSelectionRange(pos, pos);
            };
            host.querySelector('#fGestor').onchange = (ev) => { filtros.gestor = ev.target.value; desenhar(); };
            host.querySelector('#fStatus').onchange = (ev) => { filtros.status = ev.target.value; desenhar(); };
            const limpar = host.querySelector('#fLimpar');
            if (limpar) limpar.onclick = () => { filtros = { busca: '', gestor: '', status: 'ativo', foco: '' }; desenhar(); };
            host.querySelectorAll('[data-foco]').forEach(t => t.onclick = () => { filtros.foco = filtros.foco === t.dataset.foco ? '' : t.dataset.foco; desenhar(); });
            host.querySelectorAll('tr[data-abrir]').forEach(tr => {
                tr.onclick = (ev) => { if (!ev.target.closest('button')) ctx.abrirPdi(tr.dataset.abrir); };
                tr.onkeydown = (ev) => { if (ev.key === 'Enter') ctx.abrirPdi(tr.dataset.abrir); };
            });
            host.querySelectorAll('button[data-abrir]').forEach(bt => bt.onclick = () => ctx.abrirPdi(bt.dataset.abrir));
        };
        desenhar();
    }

    return { render };
})();
