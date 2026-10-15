// Projeto PDI/js/tela-meu.js — "Meu PDI e Resultados" (colaborador): histórico de avaliações e feedbacks
window.PdiMeu = (function () {
    'use strict';
    const U = window.PdiUI, e = U.esc, T = window.PdiTextos, C = window.PdiCalculo, Doc = window.PdiDocumento;
    const fd = Doc.fmtData;

    async function render(host, ctx) {
        host.innerHTML = '<p class="carregando" role="status">Carregando seu PDI…</p>';
        const lista = (await window.PdiApi.listarPdis()).filter(p => p.colaborador_user_id === ctx.user.id);
        if (!lista.length) {
            host.innerHTML = `<h1>Meu PDI e Resultados</h1><p class="muted">Você ainda não possui um PDI cadastrado. Procure o administrador do portal.</p>`;
            return;
        }
        const blocos = [];
        for (const p of lista) blocos.push(await bloco(p, ctx));
        host.innerHTML = `<h1>Meu PDI e Resultados</h1>${blocos.join('')}`;
        host.querySelectorAll('[data-abrir]').forEach(b => b.onclick = () => ctx.abrirPdi(b.dataset.abrir, b.dataset.aba));
    }

    async function bloco(pdi, ctx) {
        const d = await window.PdiApi.carregar(pdi.id);
        const dd = { ...d, semanasPrevistas: window.PdiAlertas.semanasPrevistas(pdi.data_inicio, U.hojeISO(), C.fimPdi(pdi.data_inicio, pdi.meses_acompanhamento)) };
        const alertas = window.PdiAlertas.calcular(dd, U.hojeISO());
        const acoes = d.acoes.filter(a => !a.recorrencia);
        const conc = acoes.filter(a => a.status === 'concluido').length;
        const fichas = d.avaliacoes.slice().sort((a, b) => b.ciclo_numero - a.ciclo_numero);

        const notas = (f) => C.PILARES.map(p => {
            const x = f.pilares.find(q => q.pilar === p);
            return `<li>${e(T.PILARES_CURTO[p])}: <strong>${x ? (x.na ? 'N/A' : (x.nota_ciclo != null ? `${x.nota_ciclo} / 4` : '—')) : '—'}</strong></li>`;
        }).join('');

        return `<section class="cartao">
          <header class="cartao-topo"><div><h2>${e(pdi.cargo_setor)}</h2>
            <p class="muted">Gestor: ${e(pdi.gestor_nome || '—')} · Início: ${fd(pdi.data_inicio)} · Ações concluídas: ${conc} de ${acoes.length}</p></div>
            <div><button class="btn" data-abrir="${pdi.id}">Abrir meu PDI</button>
            <button class="btn sec" data-abrir="${pdi.id}" data-aba="acomp">Registrar resumo semanal</button></div></header>
          <h3>Pendências e avisos</h3>
          ${alertas.length ? `<ul class="alertas">${alertas.map(a => `<li class="al ${a.gravidade}">${e(a.mensagem)}</li>`).join('')}</ul>` : '<p class="muted">Tudo em dia.</p>'}
          <h3>Resultados das avaliações</h3>
          ${fichas.length ? fichas.map(f => `<article class="feedback">
              <header><strong>Ciclo ${f.ciclo_numero}</strong> ${U.badge(T.STATUS_FICHA[f.status], f.status)}
                <span class="muted">${f.data_reuniao ? 'Reunião em ' + fd(f.data_reuniao) : ''}</span></header>
              <ul class="notas">${notas(f)}</ul>
              ${f.resultado ? `<p><strong>Resultado:</strong> ${e(T.RESULTADOS[f.resultado])}</p>` : ''}
              ${f.direcionamentos.length ? `<p><strong>Direcionamento:</strong> ${e(f.direcionamentos.map(k => T.DIRECIONAMENTOS[k]).join(', '))}</p>` : ''}
              ${f.avancos ? `<p><strong>Principais avanços:</strong> ${U.br(f.avancos)}</p>` : ''}
              ${f.pontos_desenvolvimento ? `<p><strong>Pontos em desenvolvimento:</strong> ${U.br(f.pontos_desenvolvimento)}</p>` : ''}
              ${f.prioridades_proximo_ciclo ? `<p><strong>Prioridades para o próximo ciclo:</strong> ${U.br(f.prioridades_proximo_ciclo)}</p>` : ''}
              <p><button class="btn sec peq" data-abrir="${pdi.id}" data-aba="ficha">Ver ficha e dar ciência</button></p>
            </article>`).join('') : '<p class="muted">Nenhuma avaliação aberta ainda.</p>'}
          <h3>Feedbacks recebidos</h3>
          ${d.feedbacks.length ? d.feedbacks.map(f => `<article class="feedback"><header><strong>${e(f.autor_nome || f.autor_papel)}</strong>
              <span class="muted">${e({ gestor: 'Gestor', socio: 'Sócio', admin: 'Administrador' }[f.autor_papel])} · ${fd(f.created_at)}${f.ciclo_numero ? ` · Ciclo ${f.ciclo_numero}` : ''}</span></header>
              <p>${U.br(f.texto)}</p></article>`).join('') : '<p class="muted">Nenhum feedback recebido ainda.</p>'}
        </section>`;
    }

    return { render };
})();
