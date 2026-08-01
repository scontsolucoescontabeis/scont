(function () {
  'use strict';

  const LIMITE = 500;

  function render(main) {
    const ctx = window.__diarioContext;
    if (!ctx) { main.innerHTML = '<p class="mapa-empty">Dados ainda não carregados.</p>'; return; }

    main.innerHTML = `
      <div class="onboarding-header"><div><h2>Histórico de Alterações</h2></div></div>
      <div class="mapa-secao">
        <div class="mapa-secao-header">Filtros</div>
        <div class="mapa-secao-body">
          <div><label>Empresa</label><input type="text" id="filtroHistoricoEmpresa" placeholder="Buscar empresa..."></div>
          <div><label>De</label><input type="date" id="filtroHistoricoDe"></div>
          <div><label>Até</label><input type="date" id="filtroHistoricoAte"></div>
          <div class="full"><button type="button" class="btn-novo" id="btnBuscarHistorico">Buscar</button></div>
        </div>
      </div>
      <div id="secaoResultadosHistorico"></div>
    `;

    document.getElementById('btnBuscarHistorico').addEventListener('click', () => buscar(ctx));
    buscar(ctx);
  }

  async function buscar(ctx) {
    const el = document.getElementById('secaoResultadosHistorico');
    el.innerHTML = '<p class="mapa-empty">Carregando...</p>';

    const empresaTermo = (document.getElementById('filtroHistoricoEmpresa').value || '').trim().toLowerCase();
    const de = document.getElementById('filtroHistoricoDe').value || null;
    const ate = document.getElementById('filtroHistoricoAte').value || null;

    let queryLancamentos = ctx.supabaseClient
      .from('contabil_diario_lancamentos')
      .select('codigo_empresa, texto, criado_por_nome, criado_por_email, created_at')
      .order('created_at', { ascending: false })
      .limit(LIMITE);
    let queryAuditoria = ctx.supabaseClient
      .from('contabil_diario_auditoria')
      .select('codigo_empresa, campo, valor_anterior, valor_novo, usuario_nome, usuario_email, created_at')
      .order('created_at', { ascending: false })
      .limit(LIMITE);

    if (de) { queryLancamentos = queryLancamentos.gte('created_at', de); queryAuditoria = queryAuditoria.gte('created_at', de); }
    if (ate) { queryLancamentos = queryLancamentos.lte('created_at', ate + 'T23:59:59'); queryAuditoria = queryAuditoria.lte('created_at', ate + 'T23:59:59'); }

    const [{ data: lancamentos, error: errLanc }, { data: auditoria, error: errAud }] = await Promise.all([queryLancamentos, queryAuditoria]);
    if (errLanc) console.error(errLanc);
    if (errAud) console.error(errAud);

    const linhas = [
      ...(lancamentos || []).map((l) => ({
        codigo_empresa: l.codigo_empresa,
        usuario: l.criado_por_nome || l.criado_por_email || 'desconhecido',
        created_at: l.created_at,
        campo: 'Lançamento do Diário',
        detalhe: l.texto,
      })),
      ...(auditoria || []).map((a) => ({
        codigo_empresa: a.codigo_empresa,
        usuario: a.usuario_nome || a.usuario_email || 'desconhecido',
        created_at: a.created_at,
        campo: a.campo,
        detalhe: `${a.valor_anterior || '—'} → ${a.valor_novo || '—'}`,
      })),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const filtradas = empresaTermo
      ? linhas.filter((l) => ctx.escapeHtml(nomeEmpresa(ctx, l.codigo_empresa)).toLowerCase().includes(empresaTermo) || l.codigo_empresa.toLowerCase().includes(empresaTermo))
      : linhas;

    renderResultados(el, ctx, filtradas);
  }

  function nomeEmpresa(ctx, codigoEmpresa) {
    const e = ctx.empresas.find((x) => x.codigo_empresa === codigoEmpresa);
    return e ? e.nome_empresa : codigoEmpresa;
  }

  function formatarDataHora(iso) {
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function renderResultados(el, ctx, linhas) {
    if (!linhas.length) {
      el.innerHTML = '<div class="mapa-secao"><div class="mapa-secao-body"><p class="mapa-empty full">Nenhuma alteração encontrada.</p></div></div>';
      return;
    }

    const linhasHtml = linhas.map((l) => `
      <tr>
        <td>${ctx.escapeHtml(l.usuario)}</td>
        <td>${formatarDataHora(l.created_at)}</td>
        <td>${ctx.escapeHtml(nomeEmpresa(ctx, l.codigo_empresa))}</td>
        <td>${ctx.escapeHtml(l.campo)}</td>
        <td>${ctx.escapeHtml(l.detalhe)}</td>
      </tr>
    `).join('');

    el.innerHTML = `
      <div class="mapa-secao">
        <div class="mapa-secao-header">Alterações (${linhas.length}${linhas.length === LIMITE * 2 ? '+' : ''})</div>
        <div class="mapa-secao-body">
          <table class="mapa-table full">
            <thead><tr><th>Usuário</th><th>Data e Hora</th><th>Empresa</th><th>Campo Alterado</th><th>Detalhe</th></tr></thead>
            <tbody>${linhasHtml}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  window.DiarioHistorico = { render };
})();
