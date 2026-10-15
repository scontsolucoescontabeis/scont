// Projeto PDI/js/tela-painel.js — Painel dos Sócios / Minha equipe (gestor)
window.PdiPainel = (function () {
    'use strict';
    const U = window.PdiUI, e = U.esc, T = window.PdiTextos, C = window.PdiCalculo, Doc = window.PdiDocumento;
    const fd = Doc.fmtData;
    let filtros = { busca: '', gestor: '', status: 'ativo' };

    function resumo(item) {
        const fim = C.fimPdi(item.pdi.data_inicio, item.pdi.meses_acompanhamento);
        const dd = { ...item, semanasPrevistas: window.PdiAlertas.semanasPrevistas(item.pdi.data_inicio, U.hojeISO(), fim) };
        const alertas = window.PdiAlertas.calcular(dd, U.hojeISO());
        const acoes = item.acoes.filter(a => !a.recorrencia);
        const hoje = U.hojeISO();
        const ciclo = item.ciclos.find(c => hoje >= c.inicio && hoje <= c.fim);
        const abaixo = item.indicadores.filter(i => {
            const v = Doc.valorIndicador(i, dd);
            const s = C.atingimento(i, v);
            return s === 'nao_atingida' || s === 'parcial';
        }).length;
        const ultima = item.avaliacoes.filter(a => a.resultado).sort((a, b) => b.ciclo_numero - a.ciclo_numero)[0];
        return {
            ciclo: ciclo ? ciclo.numero : (hoje > fim ? 4 : 1),
            concluidas: acoes.filter(a => a.status === 'concluido').length, totalAcoes: acoes.length,
            atrasadas: alertas.filter(a => a.tipo === 'acao_vencida').length,
            nivelPendente: alertas.some(a => a.tipo === 'nivel_inicial'),
            resumoFalta: alertas.some(a => a.tipo === 'resumo_semanal'),
            abaixo, melhoriasPend: item.melhorias.filter(m => m.validacao_gestor === 'pendente').length,
            agendar: alertas.filter(a => a.tipo === 'avaliacao_agendar' || a.tipo === 'avaliacao_atrasada').length,
            ultima, alertas,
        };
    }

    async function render(host, ctx) {
        host.innerHTML = '<p class="muted">Carregando PDIs…</p>';
        const todos = await window.PdiApi.carregarTodos();
        const lista = ctx.somenteGestor ? todos.filter(i => i.pdi.gestor_user_id === ctx.user.id) : todos;
        const linhas = lista.map(i => ({ i, r: resumo(i) }));
        const gestores = [...new Set(lista.map(i => i.pdi.gestor_nome).filter(Boolean))].sort();

        const filtrar = () => linhas.filter(({ i }) =>
            (!filtros.status || i.pdi.status === filtros.status) &&
            (!filtros.gestor || i.pdi.gestor_nome === filtros.gestor) &&
            (!filtros.busca || `${i.pdi.colaborador_nome} ${i.pdi.cargo_setor}`.toLowerCase().includes(filtros.busca.toLowerCase())));

        const desenhar = () => {
            const vis = filtrar();
            const dist = Object.keys(T.RESULTADOS).map(k => ({ k, n: vis.filter(x => x.r.ultima && x.r.ultima.resultado === k).length }));
            const maxD = Math.max(1, ...dist.map(x => x.n));
            const tot = (f) => vis.reduce((s, x) => s + f(x.r), 0);
            host.innerHTML = `<h1>${ctx.somenteGestor ? 'Minha equipe' : 'Painel dos Sócios'}</h1>
              <div class="kpis">
                <div class="kpi"><span class="kpi-v">${vis.length}</span><span class="kpi-r">PDIs</span></div>
                <div class="kpi"><span class="kpi-v">${tot(r => r.atrasadas)}</span><span class="kpi-r">ações atrasadas</span></div>
                <div class="kpi"><span class="kpi-v">${vis.filter(x => x.r.nivelPendente).length}</span><span class="kpi-r">níveis iniciais pendentes</span></div>
                <div class="kpi"><span class="kpi-v">${tot(r => r.melhoriasPend)}</span><span class="kpi-r">melhorias a validar</span></div>
                <div class="kpi"><span class="kpi-v">${tot(r => r.agendar)}</span><span class="kpi-r">avaliações a agendar</span></div>
              </div>
              <div class="filtros">
                <input type="search" id="fBusca" placeholder="Buscar por nome ou cargo" value="${e(filtros.busca)}" aria-label="Buscar">
                <select id="fGestor" aria-label="Gestor"><option value="">Todos os gestores</option>${gestores.map(g => `<option${g === filtros.gestor ? ' selected' : ''}>${e(g)}</option>`).join('')}</select>
                <select id="fStatus" aria-label="Status"><option value="">Todos os status</option>${['ativo', 'rascunho', 'encerrado'].map(s => `<option value="${s}"${s === filtros.status ? ' selected' : ''}>${s}</option>`).join('')}</select>
              </div>
              <div class="tabela-wrap"><table class="doc-tab"><thead><tr><th>Colaborador</th><th>Cargo</th><th>Gestor</th><th>Ciclo</th><th>Ações</th>
                <th>Atrasos</th><th>Nível inicial</th><th>Resumo semanal</th><th>Indicadores abaixo</th><th>Melhorias a validar</th><th>Último resultado</th><th></th></tr></thead><tbody>
                ${vis.map(({ i, r }) => `<tr><td><strong>${e(i.pdi.colaborador_nome)}</strong></td><td>${e(i.pdi.cargo_setor)}</td><td>${e(i.pdi.gestor_nome || '—')}</td>
                  <td>${r.ciclo}</td><td>${r.concluidas}/${r.totalAcoes}</td>
                  <td>${r.atrasadas ? `<span class="aviso">${r.atrasadas}</span>` : '0'}</td>
                  <td>${r.nivelPendente ? '<span class="aviso">pendente</span>' : 'ok'}</td>
                  <td>${r.resumoFalta ? '<span class="aviso">ausente</span>' : 'ok'}</td>
                  <td>${r.abaixo}</td><td>${r.melhoriasPend}</td>
                  <td>${r.ultima ? e(T.RESULTADOS[r.ultima.resultado]) : '—'}</td>
                  <td><button class="btn peq" data-abrir="${i.pdi.id}">Abrir</button></td></tr>`).join('') || '<tr><td colspan="12" class="muted">Nenhum PDI encontrado.</td></tr>'}
              </tbody></table></div>
              <h3>Distribuição do resultado do ciclo (última avaliação)</h3>
              <div class="barras">${dist.map(x => `<div class="barra-l"><span>${e(T.RESULTADOS[x.k])}</span>
                <div class="barra-b"><i style="width:${(x.n / maxD) * 100}%"></i></div><b>${x.n}</b></div>`).join('')}</div>`;
            host.querySelector('#fBusca').oninput = (ev) => { filtros.busca = ev.target.value; desenhar(); host.querySelector('#fBusca').focus(); };
            host.querySelector('#fGestor').onchange = (ev) => { filtros.gestor = ev.target.value; desenhar(); };
            host.querySelector('#fStatus').onchange = (ev) => { filtros.status = ev.target.value; desenhar(); };
            host.querySelectorAll('[data-abrir]').forEach(b => b.onclick = () => ctx.abrirPdi(b.dataset.abrir));
        };
        desenhar();
    }

    return { render };
})();
