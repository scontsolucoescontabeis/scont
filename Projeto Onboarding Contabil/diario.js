(function () {
  'use strict';

  const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  const NIVEL_LABELS = { baixo: 'Baixo', medio: 'Médio', alto: 'Alto', critico: 'Crítico' };
  const REGIME_LABELS = { simples_nacional: 'Simples Nacional', lucro_presumido: 'Lucro Presumido', lucro_real: 'Lucro Real', mei: 'MEI' };
  const SITUACAO_LABELS = { regularizado: 'Regularizado', em_regularizacao: 'Em Regularização', pendente: 'Pendente', critico: 'Crítico' };
  const FINANCEIRO_LABELS = { interno: 'Interno', bpo_scont: 'BPO Scont', bpo_terceiro: 'BPO Terceiro', nao_possui: 'Não possui' };
  const PERIODICIDADE_LABELS = { mensal: 'Mensal', trimestral: 'Trimestral', anual: 'Anual' };

  let empresas = [];
  let mapeamentos = [];
  let pendenciasPorMapeamento = {};
  let bancosPorMapeamento = {};
  let statusMensalPorEmpresa = {}; // { codigo_empresa: { 'ano-mes': status } }
  let empresaAtualCodigo = null;
  let anoGradeAtual = new Date().getFullYear();

  document.addEventListener('DOMContentLoaded', iniciar);

  function parseDataLocal(str) {
    if (str instanceof Date) return str;
    const [ano, mes, dia] = String(str).split('-').map(Number);
    return new Date(ano, (mes || 1) - 1, dia || 1);
  }

  async function iniciar() {
    const auth = await window.PortalAuthGuard.init(1);
    if (!auth) return;
    document.getElementById('authOverlay')?.remove();
    window.__contabilAuth = auth;

    document.getElementById('btnDashboard').addEventListener('click', () => {
      empresaAtualCodigo = null;
      document.getElementById('buscaEmpresa').value = '';
      renderDashboardDiario();
    });
    document.getElementById('btnRelatorios').addEventListener('click', () => {
      empresaAtualCodigo = null;
      document.getElementById('buscaEmpresa').value = '';
      window.DiarioRelatorios.render(document.getElementById('main'));
    });
    document.getElementById('btnHistorico').addEventListener('click', () => {
      empresaAtualCodigo = null;
      document.getElementById('buscaEmpresa').value = '';
      window.DiarioHistorico.render(document.getElementById('main'));
    });
    inicializarBuscaEmpresa();

    await carregarDadosDiario();

    const empresaNaUrl = new URLSearchParams(window.location.search).get('empresa');
    if (empresaNaUrl && empresas.some((e) => e.codigo_empresa === empresaNaUrl)) {
      selecionarEmpresaDiario(empresaNaUrl);
    } else {
      renderDashboardDiario();
    }
  }

  async function carregarDadosDiario() {
    const [{ data: dataEmpresas, error: errEmpresas }, { data: dataMapeamentos, error: errMapeamentos }, { data: dataConfig, error: errConfig }] = await Promise.all([
      supabaseClient.from('rh_empresas').select('codigo_empresa, nome_empresa, status_situacao').order('nome_empresa', { ascending: true }),
      supabaseClient.from('contabil_mapeamento').select('*'),
      supabaseClient.from('contabil_empresas_config').select('codigo_empresa, possui_contabil'),
    ]);
    if (errEmpresas) console.error(errEmpresas);
    if (errMapeamentos) console.error(errMapeamentos);
    if (errConfig) console.error(errConfig);

    const configPorEmpresa = {};
    (dataConfig || []).forEach((c) => { configPorEmpresa[c.codigo_empresa] = c.possui_contabil; });
    const possuiContabil = (codigo) => configPorEmpresa[codigo] !== false;

    const ativa = (s) => !s || String(s).trim().toLowerCase().startsWith('ativ');
    empresas = (dataEmpresas || []).filter((e) => ativa(e.status_situacao) && possuiContabil(e.codigo_empresa));
    mapeamentos = dataMapeamentos || [];

    const ids = mapeamentos.map((m) => m.id);
    pendenciasPorMapeamento = {};
    bancosPorMapeamento = {};
    if (ids.length) {
      const [{ data: pendencias, error: errPend }, { data: bancos, error: errBancos }] = await Promise.all([
        supabaseClient.from('contabil_mapeamento_pendencias').select('*').in('mapeamento_id', ids),
        supabaseClient.from('contabil_mapeamento_bancos').select('*').in('mapeamento_id', ids),
      ]);
      if (errPend) console.error(errPend);
      if (errBancos) console.error(errBancos);
      (pendencias || []).forEach((p) => {
        (pendenciasPorMapeamento[p.mapeamento_id] = pendenciasPorMapeamento[p.mapeamento_id] || []).push(p);
      });
      (bancos || []).forEach((b) => {
        (bancosPorMapeamento[b.mapeamento_id] = bancosPorMapeamento[b.mapeamento_id] || []).push(b);
      });
    }

    const { data: statusMensal, error: errStatus } = await supabaseClient
      .from('contabil_diario_status_mensal')
      .select('*');
    if (errStatus) console.error(errStatus);
    statusMensalPorEmpresa = {};
    (statusMensal || []).forEach((s) => {
      const bucket = (statusMensalPorEmpresa[s.codigo_empresa] = statusMensalPorEmpresa[s.codigo_empresa] || {});
      bucket[`${s.ano}-${s.mes}`] = s.status;
    });

    window.__diarioContext = {
      supabaseClient,
      empresas,
      mapeamentos,
      bancosPorMapeamento,
      statusMensalPorEmpresa,
      NIVEL_LABELS, REGIME_LABELS, SITUACAO_LABELS, FINANCEIRO_LABELS, PERIODICIDADE_LABELS,
      mapeamentoDe,
      escapeHtml,
    };
  }

  function mapeamentoDe(codigoEmpresa) {
    return mapeamentos.find((m) => m.codigo_empresa === codigoEmpresa) || null;
  }

  function nivelDe(codigoEmpresa) {
    const m = mapeamentoDe(codigoEmpresa);
    return m ? (m.nivel_atencao || 'baixo') : 'baixo';
  }

  function pendenciasAbertasDe(mapeamentoId) {
    return (pendenciasPorMapeamento[mapeamentoId] || []).filter((p) => p.status === 'aberta');
  }

  function statusDoMes(codigoEmpresa, ano, mes) {
    const bucket = statusMensalPorEmpresa[codigoEmpresa];
    return (bucket && bucket[`${ano}-${mes}`]) || 'sem_documentacao';
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function empresaNome(codigoEmpresa) {
    const e = empresas.find((x) => x.codigo_empresa === codigoEmpresa);
    return e ? e.nome_empresa : codigoEmpresa;
  }

  function inicializarBuscaEmpresa() {
    const input = document.getElementById('buscaEmpresa');
    const lista = document.getElementById('listaBuscaEmpresa');

    input.addEventListener('input', () => {
      const termo = input.value.trim().toLowerCase();
      if (!termo) { lista.innerHTML = ''; lista.classList.remove('aberta'); return; }
      const resultados = empresas.filter((e) => e.nome_empresa.toLowerCase().includes(termo)).slice(0, 20);
      if (!resultados.length) {
        lista.innerHTML = '<div class="combobox-item combobox-vazio">Nenhuma empresa encontrada.</div>';
      } else {
        lista.innerHTML = resultados.map((e) => `<div class="combobox-item" data-codigo="${escapeHtml(e.codigo_empresa)}">${escapeHtml(e.nome_empresa)}</div>`).join('');
      }
      lista.classList.add('aberta');
    });

    lista.addEventListener('click', (ev) => {
      const item = ev.target.closest('.combobox-item[data-codigo]');
      if (!item) return;
      lista.innerHTML = '';
      lista.classList.remove('aberta');
      selecionarEmpresaDiario(item.getAttribute('data-codigo'));
    });

    document.addEventListener('click', (ev) => {
      if (!ev.target.closest('#wrapBuscaEmpresa')) {
        lista.innerHTML = '';
        lista.classList.remove('aberta');
      }
    });

    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') { lista.innerHTML = ''; lista.classList.remove('aberta'); }
    });
  }

  // ─── DASHBOARD ──────────────────────────────────────────────

  function miniGradeHtml(codigoEmpresa) {
    const hoje = new Date();
    const meses = window.ContabilDiarioUtil.ultimosNMeses(hoje.getFullYear(), hoje.getMonth() + 1, 6);
    return `<span class="mapa-mini-grade">${meses.map(({ ano, mes }) => {
      const status = statusDoMes(codigoEmpresa, ano, mes);
      return `<span class="mini-quad status-${status}" title="${String(mes).padStart(2, '0')}/${ano}"></span>`;
    }).join('')}</span>`;
  }

  function renderDashboardDiario() {
    const main = document.getElementById('main');
    const linhas = empresas.map((e) => {
      const m = mapeamentoDe(e.codigo_empresa);
      const nivel = nivelDe(e.codigo_empresa);
      const abertas = m ? pendenciasAbertasDe(m.id).length : 0;
      return `
        <tr data-codigo="${escapeHtml(e.codigo_empresa)}">
          <td>${escapeHtml(e.nome_empresa)}</td>
          <td>${m && m.regime_tributario ? (REGIME_LABELS[m.regime_tributario] || m.regime_tributario) : '—'}</td>
          <td>${m && m.responsavel_execucao ? escapeHtml(m.responsavel_execucao) : '—'}</td>
          <td><span class="badge-nivel nivel-${nivel}">${NIVEL_LABELS[nivel]}</span></td>
          <td>${abertas}</td>
          <td>${miniGradeHtml(e.codigo_empresa)}</td>
        </tr>
      `;
    }).join('');

    main.innerHTML = `
      <div class="onboarding-header">
        <div><h2>Visão Geral</h2></div>
      </div>
      <table class="mapa-table">
        <thead><tr><th>Empresa</th><th>Regime</th><th>Responsável</th><th>Nível</th><th>Pendências</th><th>Últimos 6 meses</th></tr></thead>
        <tbody>${linhas || '<tr><td colspan="6">Nenhuma empresa encontrada.</td></tr>'}</tbody>
      </table>
    `;

    main.querySelectorAll('tbody tr[data-codigo]').forEach((tr) => {
      tr.addEventListener('click', () => selecionarEmpresaDiario(tr.getAttribute('data-codigo')));
    });
  }

  // ─── PÁGINA DA EMPRESA ──────────────────────────────────────

  function selecionarEmpresaDiario(codigoEmpresa) {
    empresaAtualCodigo = codigoEmpresa;
    document.getElementById('buscaEmpresa').value = empresaNome(codigoEmpresa);
    anoGradeAtual = new Date().getFullYear();
    renderPaginaEmpresa();
  }

  function renderPaginaEmpresa() {
    const main = document.getElementById('main');
    main.innerHTML = `
      <div class="onboarding-header">
        <div><h2>${escapeHtml(empresaNome(empresaAtualCodigo))}</h2></div>
      </div>
      <div id="secaoResumoMapeamento"></div>
      <div id="secaoGradeMensal"></div>
      <div id="secaoLancamentos"></div>
    `;
    renderResumoMapeamento();
    renderGradeMensal();
    renderLancamentos();
  }

  function renderResumoMapeamento() {
    const el = document.getElementById('secaoResumoMapeamento');
    const m = mapeamentoDe(empresaAtualCodigo);
    const linkEditar = `<a class="btn btn-primary" href="mapeamento.html?empresa=${encodeURIComponent(empresaAtualCodigo)}">✏️ Editar no Mapeamento Estratégico</a>`;

    if (!m) {
      el.innerHTML = `
        <div class="mapa-secao">
          <div class="mapa-secao-header">Resumo do Mapeamento Estratégico</div>
          <div class="mapa-secao-body">
            <p class="mapa-empty full">Nenhum mapeamento cadastrado ainda.</p>
            <div class="full">${linkEditar}</div>
          </div>
        </div>
      `;
      return;
    }

    const bancos = (bancosPorMapeamento[m.id] || []).map((b) => b.banco);
    const nivel = m.nivel_atencao || 'baixo';
    const anoAtual = String(new Date().getFullYear());
    const statusAno = m[`situacao_${anoAtual}_status`];

    el.innerHTML = `
      <div class="mapa-secao">
        <div class="mapa-secao-header">Resumo do Mapeamento Estratégico</div>
        <div class="mapa-secao-body">
          <div><label>Regime Tributário</label><span>${m.regime_tributario ? REGIME_LABELS[m.regime_tributario] : '—'}</span></div>
          <div><label>Periodicidade</label><span>${m.periodicidade ? PERIODICIDADE_LABELS[m.periodicidade] : '—'}</span></div>
          <div><label>Responsável pela Execução</label><span>${m.responsavel_execucao ? escapeHtml(m.responsavel_execucao) : '—'}</span></div>
          <div><label>Contato</label><span>${[m.contato_nome, m.contato_telefone, m.contato_email].filter(Boolean).map(escapeHtml).join(' • ') || '—'}</span></div>
          <div><label>Financeiro Interno/BPO</label><span>${m.financeiro_interno_bpo ? FINANCEIRO_LABELS[m.financeiro_interno_bpo] : '—'}</span></div>
          <div><label>Bancos Utilizados</label><span>${bancos.length ? bancos.map(escapeHtml).join(', ') : '—'}</span></div>
          <div><label>Sistemas Utilizados</label><span>${(m.sistemas_utilizados || []).length ? m.sistemas_utilizados.map(escapeHtml).join(', ') : '—'}</span></div>
          <div><label>Situação ${anoAtual}</label><span>${statusAno ? SITUACAO_LABELS[statusAno] : '—'}</span></div>
          <div><label>Nível de Atenção</label><span class="badge-nivel nivel-${nivel}">${NIVEL_LABELS[nivel]}</span></div>
          <div class="full">${linkEditar}</div>
        </div>
      </div>
    `;
  }

  // ─── AUDITORIA ──────────────────────────────────────────────

  const STATUS_GRADE_LABELS = { sem_documentacao: 'Sem Documentação', pendencias: 'Pendências', concluido: 'Concluído' };

  async function registrarAuditoria(codigoEmpresa, campo, valorAnterior, valorNovo) {
    const auth = window.__contabilAuth || {};
    const { error } = await supabaseClient.from('contabil_diario_auditoria').insert({
      codigo_empresa: codigoEmpresa,
      campo,
      valor_anterior: valorAnterior,
      valor_novo: valorNovo,
      usuario_nome: auth.userData?.nome || null,
      usuario_email: auth.email || null,
    });
    if (error) console.error(error);
  }

  // ─── GRADE MENSAL ───────────────────────────────────────────

  async function alternarStatusMes(codigoEmpresa, ano, mes) {
    const atual = statusDoMes(codigoEmpresa, ano, mes);
    const proximo = window.ContabilDiarioUtil.proximoStatus(atual);
    const bucket = (statusMensalPorEmpresa[codigoEmpresa] = statusMensalPorEmpresa[codigoEmpresa] || {});

    if (proximo === 'sem_documentacao') {
      const { error } = await supabaseClient
        .from('contabil_diario_status_mensal')
        .delete()
        .eq('codigo_empresa', codigoEmpresa).eq('ano', ano).eq('mes', mes);
      if (error) { console.error(error); return; }
      delete bucket[`${ano}-${mes}`];
    } else {
      const { error } = await supabaseClient
        .from('contabil_diario_status_mensal')
        .upsert({ codigo_empresa: codigoEmpresa, ano, mes, status: proximo, updated_at: new Date().toISOString() }, { onConflict: 'codigo_empresa,ano,mes' });
      if (error) { console.error(error); return; }
      bucket[`${ano}-${mes}`] = proximo;
    }

    const campo = `Status Mensal — ${window.ContabilDiarioUtil.MESES_LABELS[mes - 1]}/${ano}`;
    registrarAuditoria(codigoEmpresa, campo, STATUS_GRADE_LABELS[atual] || 'Sem Documentação', STATUS_GRADE_LABELS[proximo] || 'Sem Documentação');

    renderGradeMensal();
  }

  function renderGradeMensal() {
    const el = document.getElementById('secaoGradeMensal');
    const meses = window.ContabilDiarioUtil.MESES_LABELS;

    const celulasHtml = meses.map((label, idx) => {
      const mes = idx + 1;
      const status = statusDoMes(empresaAtualCodigo, anoGradeAtual, mes);
      return `
        <div class="mapa-grade-cel status-${status}" data-mes="${mes}" title="${label}/${anoGradeAtual}">
          <span class="mapa-grade-mes">${label}</span>
        </div>
      `;
    }).join('');

    el.innerHTML = `
      <div class="mapa-secao">
        <div class="mapa-secao-header">Situação de Fechamento — Grade Mensal</div>
        <div class="mapa-secao-body">
          <div class="full mapa-grade-nav">
            <button type="button" id="btnAnoAnterior">‹</button>
            <strong>${anoGradeAtual}</strong>
            <button type="button" id="btnAnoSeguinte">›</button>
          </div>
          <div class="full mapa-grade-linha">${celulasHtml}</div>
        </div>
      </div>
    `;

    el.querySelector('#btnAnoAnterior').addEventListener('click', () => { anoGradeAtual -= 1; renderGradeMensal(); });
    el.querySelector('#btnAnoSeguinte').addEventListener('click', () => { anoGradeAtual += 1; renderGradeMensal(); });
    el.querySelectorAll('.mapa-grade-cel').forEach((cel) => {
      cel.addEventListener('click', () => alternarStatusMes(empresaAtualCodigo, anoGradeAtual, Number(cel.getAttribute('data-mes'))));
    });
  }

  // ─── LANÇAMENTOS DO DIÁRIO ──────────────────────────────────

  function formatarDataHora(iso) {
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  async function renderLancamentos() {
    const el = document.getElementById('secaoLancamentos');
    el.innerHTML = `
      <div class="mapa-secao">
        <div class="mapa-secao-header">Lançamentos do Diário</div>
        <div class="mapa-secao-body">
          <div><label>Data</label><input type="date" id="novoLancamentoData" value="${new Date().toISOString().slice(0, 10)}"></div>
          <div class="full"><label>Registro</label><textarea id="novoLancamentoTexto" rows="2" placeholder="Ex: Enviado SPED Fiscal de junho, pendente confirmação do cliente."></textarea></div>
          <div><button type="button" class="btn-novo" id="btnAddLancamento">+ Adicionar Lançamento</button></div>
          <div class="full mapa-filtros" style="margin-top:10px;border-top:1px solid var(--line-soft);padding-top:14px;">
            <div><label>Filtrar de</label><input type="date" id="filtroLancamentoDe"></div>
            <div><label>até</label><input type="date" id="filtroLancamentoAte"></div>
            <button type="button" class="btn btn-secondary" id="btnFiltrarLancamentos">Filtrar</button>
            <button type="button" class="btn btn-secondary" id="btnLimparFiltroLancamentos">Limpar</button>
          </div>
          <div class="full" id="listaLancamentos"><p class="mapa-empty">Carregando...</p></div>
        </div>
      </div>
    `;

    el.querySelector('#btnAddLancamento').addEventListener('click', async () => {
      const data = document.getElementById('novoLancamentoData').value;
      const texto = document.getElementById('novoLancamentoTexto').value.trim();
      if (!data || !texto) return;
      const auth = window.__contabilAuth || {};
      const { error } = await supabaseClient.from('contabil_diario_lancamentos').insert({
        codigo_empresa: empresaAtualCodigo,
        data,
        texto,
        criado_por_nome: auth.userData?.nome || null,
        criado_por_email: auth.email || null,
      });
      if (error) { console.error(error); return; }
      document.getElementById('novoLancamentoTexto').value = '';
      carregarListaLancamentos();
    });

    el.querySelector('#btnFiltrarLancamentos').addEventListener('click', () => carregarListaLancamentos());
    el.querySelector('#btnLimparFiltroLancamentos').addEventListener('click', () => {
      document.getElementById('filtroLancamentoDe').value = '';
      document.getElementById('filtroLancamentoAte').value = '';
      carregarListaLancamentos();
    });

    carregarListaLancamentos();
  }

  async function carregarListaLancamentos() {
    const container = document.getElementById('listaLancamentos');
    const de = document.getElementById('filtroLancamentoDe')?.value || null;
    const ate = document.getElementById('filtroLancamentoAte')?.value || null;

    let query = supabaseClient
      .from('contabil_diario_lancamentos')
      .select('*')
      .eq('codigo_empresa', empresaAtualCodigo);
    if (de) query = query.gte('data', de);
    if (ate) query = query.lte('data', ate);

    const { data, error } = await query
      .order('data', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) { console.error(error); container.innerHTML = '<p class="mapa-empty">Erro ao carregar lançamentos.</p>'; return; }

    if (!data || !data.length) {
      container.innerHTML = '<p class="mapa-empty">Nenhum lançamento registrado.</p>';
      return;
    }

    container.innerHTML = data.map((l) => `
      <div class="mapa-lancamento-item">
        <div class="mapa-lancamento-data">${parseDataLocal(l.data).toLocaleDateString('pt-BR')}</div>
        <div class="mapa-lancamento-texto">${escapeHtml(l.texto)}</div>
        <div class="mapa-lancamento-autor">— ${escapeHtml(l.criado_por_nome || l.criado_por_email || 'desconhecido')} (${formatarDataHora(l.created_at)})</div>
      </div>
    `).join('');
  }
})();
