(function () {
  'use strict';

  let _chaveRejeicaoAberta = null; // 'codigo|ano|mes' com o textarea de motivo aberto

  function render(main) {
    const ctx = window.__diarioContext;
    if (!ctx) { main.innerHTML = '<p class="mapa-empty">Dados ainda não carregados.</p>'; return; }

    main.innerHTML = `
      <div class="onboarding-header"><div><h2>Validações</h2></div></div>
      <div id="secaoPendentesValidacao"></div>
      <div id="secaoTimelineValidacao"></div>
    `;

    renderPendentes(ctx);
    renderTimeline(ctx);
  }

  function nomeEmpresa(ctx, codigoEmpresa) {
    const e = ctx.empresas.find((x) => x.codigo_empresa === codigoEmpresa);
    return e ? e.nome_empresa : codigoEmpresa;
  }

  function mesAno(ano, mes) {
    return `${window.ContabilDiarioUtil.MESES_LABELS[mes - 1]}/${ano}`;
  }

  function formatarDataHora(iso) {
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  // Escopo de visualização: equipe Scont/admin veem tudo (null = sem
  // filtro); Prestador de Serviço só vê as empresas já filtradas em
  // ctx.empresas (mesma restrição aplicada ao seletor geral do Diário).
  function meuEscopoCodigos(ctx) {
    if (ctx.podeValidar()) return null;
    return new Set(ctx.empresas.map((e) => e.codigo_empresa));
  }

  function triplasUnicas(fechamentos) {
    const vistos = new Set();
    const lista = [];
    fechamentos.forEach((f) => {
      const chave = `${f.codigo_empresa}|${f.ano}|${f.mes}`;
      if (vistos.has(chave)) return;
      vistos.add(chave);
      lista.push({ codigo_empresa: f.codigo_empresa, ano: f.ano, mes: f.mes });
    });
    return lista;
  }

  function triplasNoEscopo(ctx) {
    const escopo = meuEscopoCodigos(ctx);
    return triplasUnicas(ctx.fechamentos).filter((t) => !escopo || escopo.has(t.codigo_empresa));
  }

  // ─── PENDENTES PARA VOCÊ ─────────────────────────────────────

  function renderPendentes(ctx) {
    const el = document.getElementById('secaoPendentesValidacao');
    const triplas = triplasNoEscopo(ctx);

    if (ctx.podeValidar()) {
      const pendentes = triplas.filter((t) => ctx.statusFechamentoDoMes(t.codigo_empresa, t.ano, t.mes) === 'aguardando_validacao');
      renderPendentesValidador(el, ctx, pendentes);
    } else {
      const pendentes = triplas.filter((t) => {
        if (!ctx.podeEncerrar(t.codigo_empresa)) return false;
        const eventos = ctx.eventosFechamentoDoMes(t.codigo_empresa, t.ano, t.mes);
        return eventos[0] && eventos[0].tipo_evento === 'rejeitado';
      });
      renderPendentesPrestador(el, ctx, pendentes);
    }
  }

  function renderPendentesValidador(el, ctx, pendentes) {
    if (!pendentes.length) {
      el.innerHTML = `
        <div class="mapa-secao">
          <div class="mapa-secao-header">Pendentes para você</div>
          <div class="mapa-secao-body"><p class="mapa-empty full">Nenhum fechamento aguardando validação.</p></div>
        </div>
      `;
      return;
    }

    const linhasHtml = pendentes.map((t) => {
      const chave = `${t.codigo_empresa}|${t.ano}|${t.mes}`;
      const evento = ctx.eventosFechamentoDoMes(t.codigo_empresa, t.ano, t.mes)[0];
      const rejeicaoAberta = _chaveRejeicaoAberta === chave;
      return `
        <tr data-chave="${chave}">
          <td>${ctx.escapeHtml(nomeEmpresa(ctx, t.codigo_empresa))}</td>
          <td>${mesAno(t.ano, t.mes)}</td>
          <td>${ctx.escapeHtml(evento.usuario_nome || evento.usuario_email || '—')}</td>
          <td>${formatarDataHora(evento.created_at)}</td>
          <td>
            <button type="button" class="btn btn-primary btn-aprovar-validacao" data-codigo="${ctx.escapeHtml(t.codigo_empresa)}" data-ano="${t.ano}" data-mes="${t.mes}">Aprovar</button>
            <button type="button" class="btn btn-secondary btn-toggle-rejeicao" data-chave="${chave}">${rejeicaoAberta ? 'Cancelar' : 'Rejeitar'}</button>
          </td>
        </tr>
        ${rejeicaoAberta ? `
        <tr class="linha-rejeicao" data-chave-rejeicao="${chave}">
          <td colspan="5">
            <label>Motivo da rejeição (obrigatório)</label>
            <textarea class="txt-motivo-rejeicao" rows="2" placeholder="Explique o que precisa ser corrigido..."></textarea>
            <button type="button" class="btn btn-secondary btn-confirmar-rejeicao" data-codigo="${ctx.escapeHtml(t.codigo_empresa)}" data-ano="${t.ano}" data-mes="${t.mes}">Confirmar rejeição</button>
          </td>
        </tr>` : ''}
      `;
    }).join('');

    el.innerHTML = `
      <div class="mapa-secao">
        <div class="mapa-secao-header">Pendentes para você (${pendentes.length})</div>
        <div class="mapa-secao-body">
          <table class="mapa-table full">
            <thead><tr><th>Empresa</th><th>Mês/Ano</th><th>Enviado por</th><th>Enviado em</th><th>Ação</th></tr></thead>
            <tbody>${linhasHtml}</tbody>
          </table>
        </div>
      </div>
    `;

    el.querySelectorAll('.btn-aprovar-validacao').forEach((btn) => {
      btn.addEventListener('click', () => acaoAprovar(ctx, btn.getAttribute('data-codigo'), Number(btn.getAttribute('data-ano')), Number(btn.getAttribute('data-mes'))));
    });
    el.querySelectorAll('.btn-toggle-rejeicao').forEach((btn) => {
      btn.addEventListener('click', () => {
        const chave = btn.getAttribute('data-chave');
        _chaveRejeicaoAberta = _chaveRejeicaoAberta === chave ? null : chave;
        renderPendentes(ctx);
      });
    });
    el.querySelectorAll('.btn-confirmar-rejeicao').forEach((btn) => {
      btn.addEventListener('click', () => {
        const linha = btn.closest('tr');
        const motivo = linha.querySelector('.txt-motivo-rejeicao').value.trim();
        if (!motivo) { ctx.mostrarToast('Informe o motivo da rejeição.', 'erro'); return; }
        acaoRejeitar(ctx, btn.getAttribute('data-codigo'), Number(btn.getAttribute('data-ano')), Number(btn.getAttribute('data-mes')), motivo);
      });
    });
  }

  function renderPendentesPrestador(el, ctx, pendentes) {
    if (!pendentes.length) {
      el.innerHTML = `
        <div class="mapa-secao">
          <div class="mapa-secao-header">Pendentes para você</div>
          <div class="mapa-secao-body"><p class="mapa-empty full">Nenhum fechamento rejeitado aguardando correção.</p></div>
        </div>
      `;
      return;
    }

    const linhasHtml = pendentes.map((t) => {
      const evento = ctx.eventosFechamentoDoMes(t.codigo_empresa, t.ano, t.mes)[0];
      return `
        <tr>
          <td>${ctx.escapeHtml(nomeEmpresa(ctx, t.codigo_empresa))}</td>
          <td>${mesAno(t.ano, t.mes)}</td>
          <td>${ctx.escapeHtml(evento.mensagem || '—')}</td>
          <td>${formatarDataHora(evento.created_at)}</td>
          <td><button type="button" class="btn btn-primary btn-reenviar-validacao" data-codigo="${ctx.escapeHtml(t.codigo_empresa)}" data-ano="${t.ano}" data-mes="${t.mes}">Reenviar para validação</button></td>
        </tr>
      `;
    }).join('');

    el.innerHTML = `
      <div class="mapa-secao">
        <div class="mapa-secao-header">Pendentes para você (${pendentes.length})</div>
        <div class="mapa-secao-body">
          <table class="mapa-table full">
            <thead><tr><th>Empresa</th><th>Mês/Ano</th><th>Motivo da rejeição</th><th>Rejeitado em</th><th>Ação</th></tr></thead>
            <tbody>${linhasHtml}</tbody>
          </table>
        </div>
      </div>
    `;

    el.querySelectorAll('.btn-reenviar-validacao').forEach((btn) => {
      btn.addEventListener('click', () => acaoEnviar(ctx, btn.getAttribute('data-codigo'), Number(btn.getAttribute('data-ano')), Number(btn.getAttribute('data-mes'))));
    });
  }

  async function acaoEnviar(ctx, codigo, ano, mes) {
    const { error } = await ctx.criarEventoFechamento(codigo, ano, mes, 'enviado', null);
    if (error) { console.error(error); ctx.mostrarToast('Erro ao reenviar para validação.', 'erro'); return; }
    ctx.mostrarToast('Reenviado para validação da equipe Scont.', 'sucesso');
    ctx.atualizarBadgeValidacoes();
    render(document.getElementById('main'));
  }

  async function acaoAprovar(ctx, codigo, ano, mes) {
    const { error } = await ctx.criarEventoFechamento(codigo, ano, mes, 'aprovado', null);
    if (error) { console.error(error); ctx.mostrarToast('Erro ao aprovar o fechamento.', 'erro'); return; }
    ctx.mostrarToast('Fechamento aprovado.', 'sucesso');
    ctx.atualizarBadgeValidacoes();
    render(document.getElementById('main'));
  }

  async function acaoRejeitar(ctx, codigo, ano, mes, motivo) {
    const { error } = await ctx.criarEventoFechamento(codigo, ano, mes, 'rejeitado', motivo);
    if (error) { console.error(error); ctx.mostrarToast('Erro ao rejeitar o fechamento.', 'erro'); return; }
    ctx.mostrarToast('Fechamento rejeitado — o mês voltou para aberto.', 'sucesso');
    _chaveRejeicaoAberta = null;
    ctx.atualizarBadgeValidacoes();
    render(document.getElementById('main'));
  }

  // ─── LINHA DO TEMPO ──────────────────────────────────────────

  function rotuloEvento(ctx, evento) {
    const nomeEmp = nomeEmpresa(ctx, evento.codigo_empresa);
    const quando = mesAno(evento.ano, evento.mes);
    const autor = evento.usuario_nome || evento.usuario_email || 'alguém';

    if (evento.tipo_evento === 'enviado') {
      return ctx.podeValidar()
        ? `📥 Recebido: solicitação de validação — ${quando} — ${nomeEmp} — enviado por ${autor}`
        : `📤 Enviado para validação da equipe Scont — ${quando} — ${nomeEmp}`;
    }
    if (evento.tipo_evento === 'aprovado') {
      return ctx.podeValidar()
        ? `✅ Fechamento aprovado — ${quando} — ${nomeEmp}`
        : `✅ Seu fechamento de ${quando} (${nomeEmp}) foi aprovado`;
    }
    // rejeitado
    return ctx.podeValidar()
      ? `❌ Fechamento rejeitado — ${quando} — ${nomeEmp}${evento.mensagem ? ` — motivo: ${evento.mensagem}` : ''}`
      : `❌ Seu fechamento de ${quando} (${nomeEmp}) foi rejeitado${evento.mensagem ? ` — motivo: ${evento.mensagem}` : ''}`;
  }

  function renderTimeline(ctx) {
    const el = document.getElementById('secaoTimelineValidacao');
    const escopo = meuEscopoCodigos(ctx);
    const eventos = (escopo ? ctx.fechamentos.filter((f) => escopo.has(f.codigo_empresa)) : ctx.fechamentos).slice(0, 200);

    if (!eventos.length) {
      el.innerHTML = '<div class="mapa-secao"><div class="mapa-secao-body"><p class="mapa-empty full">Nenhum evento registrado ainda.</p></div></div>';
      return;
    }

    const linhasHtml = eventos.map((ev) => `
      <div class="fechamento-evento">
        <div>${ctx.escapeHtml(rotuloEvento(ctx, ev))}</div>
        <div class="mapa-empty">${ctx.escapeHtml(ev.usuario_nome || ev.usuario_email || 'desconhecido')} — ${formatarDataHora(ev.created_at)}</div>
      </div>
    `).join('');

    el.innerHTML = `
      <div class="mapa-secao">
        <div class="mapa-secao-header">Linha do Tempo (${eventos.length}${eventos.length === 200 ? '+' : ''})</div>
        <div class="mapa-secao-body"><div class="full">${linhasHtml}</div></div>
      </div>
    `;
  }

  window.DiarioValidacoes = { render };
})();
