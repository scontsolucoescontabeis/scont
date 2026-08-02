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

  // ─── ESCOPO / FLUXO DE FECHAMENTO ───────────────────────────
  // Ver docs/superpowers/specs/2026-08-01-diario-fechamento-validacao-design.md
  let _isAdmin = false;
  let _isScontTeam = false;
  let _podeEditarMapeamento = false; // edição do Mapeamento Estratégico é exclusiva da equipe Scont
  let _restringirSeletor = false; // true = "Prestador de Serviço" não-admin
  let _meusResponsaveisSet = new Set(); // empresas onde o usuário logado é responsável atribuído
  let fechamentos = []; // linhas cruas de contabil_diario_fechamentos
  let fechamentosPorChave = {}; // 'codigo|ano|mes' -> eventos (mais recente primeiro)

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

    await _resolverEscopoUsuario(auth);

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
    document.getElementById('btnValidacoes').addEventListener('click', () => {
      empresaAtualCodigo = null;
      document.getElementById('buscaEmpresa').value = '';
      window.DiarioValidacoes.render(document.getElementById('main'));
    });
    inicializarBuscaEmpresa();

    await carregarDadosDiario();
    atualizarBadgeValidacoes();

    const empresaNaUrl = new URLSearchParams(window.location.search).get('empresa');
    if (empresaNaUrl && empresas.some((e) => e.codigo_empresa === empresaNaUrl)) {
      selecionarEmpresaDiario(empresaNaUrl);
    } else {
      renderDashboardDiario();
    }
  }

  // Mesmo padrão de escopo já usado em Projeto RH/admin.js: usuários
  // vinculados à empresa "Prestador de Serviço" só veem, no seletor geral
  // do Diário, as empresas atribuídas a eles em
  // contabil_empresas_responsaveis. Super-admins do portal e usuários da
  // SCONT Soluções Contábeis continuam vendo tudo. A mesma consulta
  // também alimenta quem pode "Encerrar" o mês de uma empresa (mesmo se
  // não for restrito no seletor — ex.: alguém da equipe Scont responsável
  // por uma empresa de financeiro interno).
  async function _resolverEscopoUsuario(auth) {
    _isAdmin = !!auth.isAdmin;
    const empresaUsuario = (auth.userData?.empresa || '').trim().toLowerCase();
    _isScontTeam = empresaUsuario === 'scont soluções contábeis';
    _podeEditarMapeamento = _isAdmin || _isScontTeam;
    _restringirSeletor = !_isAdmin && empresaUsuario === 'prestador de serviço';

    if (!auth.userId) { _meusResponsaveisSet = new Set(); return; }
    const { data, error } = await supabaseClient
      .from('contabil_empresas_responsaveis')
      .select('codigo_empresa')
      .eq('usuario_id', auth.userId);
    if (error) { console.error(error); _meusResponsaveisSet = new Set(); return; }
    _meusResponsaveisSet = new Set((data || []).map((r) => r.codigo_empresa));
  }

  function podeEncerrar(codigoEmpresa) { return _isAdmin || _meusResponsaveisSet.has(codigoEmpresa); }
  function podeValidar() { return _isAdmin || _isScontTeam; }

  async function carregarDadosDiario() {
    const [{ data: dataEmpresas, error: errEmpresas }, { data: dataMapeamentos, error: errMapeamentos }, { data: dataConfig, error: errConfig }, { data: dataFechamentos, error: errFechamentos }] = await Promise.all([
      supabaseClient.from('rh_empresas').select('codigo_empresa, nome_empresa, status_situacao').order('nome_empresa', { ascending: true }),
      supabaseClient.from('contabil_mapeamento').select('*'),
      supabaseClient.from('contabil_empresas_config').select('codigo_empresa, possui_contabil'),
      supabaseClient.from('contabil_diario_fechamentos').select('*').order('created_at', { ascending: false }),
    ]);
    if (errEmpresas) console.error(errEmpresas);
    if (errMapeamentos) console.error(errMapeamentos);
    if (errConfig) console.error(errConfig);
    if (errFechamentos) console.error(errFechamentos);

    const configPorEmpresa = {};
    (dataConfig || []).forEach((c) => { configPorEmpresa[c.codigo_empresa] = c.possui_contabil; });
    const possuiContabil = (codigo) => configPorEmpresa[codigo] !== false;

    const ativa = (s) => !s || String(s).trim().toLowerCase().startsWith('ativ');
    empresas = (dataEmpresas || []).filter((e) => ativa(e.status_situacao) && possuiContabil(e.codigo_empresa));
    if (_restringirSeletor) empresas = empresas.filter((e) => _meusResponsaveisSet.has(e.codigo_empresa));
    mapeamentos = dataMapeamentos || [];

    fechamentos = dataFechamentos || []; // já vem ordenado created_at desc
    fechamentosPorChave = {};
    fechamentos.forEach((f) => {
      const chave = `${f.codigo_empresa}|${f.ano}|${f.mes}`;
      (fechamentosPorChave[chave] = fechamentosPorChave[chave] || []).push(f);
    });

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
      fechamentos,
      statusFechamentoDoMes,
      eventosFechamentoDoMes,
      podeEncerrar,
      podeValidar,
      criarEventoFechamento,
      selecionarEmpresaDiario,
      atualizarBadgeValidacoes,
      mostrarToast,
    };
  }

  // ─── FECHAMENTO — STATUS DERIVADO E EVENTOS ─────────────────

  function eventosFechamentoDoMes(codigoEmpresa, ano, mes) {
    return fechamentosPorChave[`${codigoEmpresa}|${ano}|${mes}`] || [];
  }

  // Deriva o status a partir do evento mais recente — nunca armazenado
  // como coluna própria (ver spec §1.1).
  function statusFechamentoDoMes(codigoEmpresa, ano, mes) {
    const eventos = eventosFechamentoDoMes(codigoEmpresa, ano, mes);
    if (!eventos.length) return 'aberto';
    const ultimo = eventos[0].tipo_evento;
    if (ultimo === 'enviado') return 'aguardando_validacao';
    if (ultimo === 'aprovado') return 'aprovado';
    return 'aberto'; // rejeitado volta para aberto
  }

  async function criarEventoFechamento(codigoEmpresa, ano, mes, tipoEvento, mensagem) {
    const auth = window.__contabilAuth || {};
    const registro = {
      codigo_empresa: codigoEmpresa,
      ano,
      mes,
      tipo_evento: tipoEvento,
      mensagem: mensagem || null,
      usuario_id: auth.userId || null,
      usuario_nome: auth.userData?.nome || null,
      usuario_email: auth.email || null,
    };
    const { data, error } = await supabaseClient.from('contabil_diario_fechamentos').insert(registro).select().single();
    if (error) return { error };

    const chave = `${codigoEmpresa}|${ano}|${mes}`;
    (fechamentosPorChave[chave] = fechamentosPorChave[chave] || []).unshift(data);
    fechamentos.unshift(data);

    if (tipoEvento === 'enviado') {
      enviarAlertaValidacao(codigoEmpresa, ano, mes, auth).catch((e) => console.error('Erro ao enviar alerta de validação:', e));
    }
    atualizarBadgeValidacoes();
    return { error: null };
  }

  async function enviarAlertaValidacao(codigoEmpresa, ano, mes, auth) {
    const { data: cfg, error: errCfg } = await supabaseClient
      .from('contabil_config_geral')
      .select('email_alerta_validacao')
      .eq('id', 1)
      .maybeSingle();
    if (errCfg) { console.error(errCfg); return; }

    const destinatarios = (cfg?.email_alerta_validacao || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!destinatarios.length) {
      mostrarToast('Fechamento enviado, mas nenhum e-mail de alerta está configurado (Configurações → Alertas por E-mail).', 'erro');
      return;
    }

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;

    const nomeEmp = empresaNome(codigoEmpresa);
    const mesAno = `${window.ContabilDiarioUtil.MESES_LABELS[mes - 1]}/${ano}`;
    const assunto = `🔔 Fechamento aguardando validação — ${nomeEmp} — ${mesAno}`;
    const params = {
      tipo: 'validacao_fechamento',
      empresa: nomeEmp,
      mes_ano: mesAno,
      enviado_por: auth.userData?.nome || auth.email || 'Usuário',
      portal_url: window.location.origin + window.location.pathname,
    };

    const resultados = await Promise.all(destinatarios.map((destinatario) =>
      fetch(`${SUPABASE_URL}/functions/v1/enviar-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}`, 'apikey': SUPABASE_KEY },
        body: JSON.stringify({ destinatario, assunto, params }),
      }).then((r) => r.json()).catch((e) => ({ ok: false, error: e.message }))
    ));

    if (resultados.some((r) => !r.ok)) {
      mostrarToast('Fechamento enviado, mas houve falha ao notificar por e-mail a equipe Scont.', 'erro');
    }
  }

  function contarPendenciasUsuario() {
    let total = 0;
    Object.keys(fechamentosPorChave).forEach((chave) => {
      const eventos = fechamentosPorChave[chave];
      if (!eventos.length) return;
      const [codigo] = chave.split('|');
      const ultimo = eventos[0].tipo_evento;
      if (podeValidar() && ultimo === 'enviado') total++;
      else if (!podeValidar() && ultimo === 'rejeitado' && podeEncerrar(codigo)) total++;
    });
    return total;
  }

  function atualizarBadgeValidacoes() {
    const badge = document.getElementById('badgeValidacoes');
    if (!badge) return;
    const total = contarPendenciasUsuario();
    badge.textContent = String(total);
    badge.style.display = total > 0 ? 'inline-block' : 'none';
  }

  function mostrarToast(msg, tipo) {
    let toast = document.getElementById('toastMsg');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toastMsg';
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.className = `toast show ${tipo === 'erro' ? 'erro' : tipo === 'sucesso' ? 'sucesso' : ''}`;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 3500);
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
    const hrefMapeamento = `mapeamento.html?empresa=${encodeURIComponent(empresaAtualCodigo)}&origem=diario`;
    const linkEditar = _podeEditarMapeamento
      ? `<a class="btn btn-primary" href="${hrefMapeamento}">✏️ Editar no Mapeamento Estratégico</a>`
      : `<a class="btn btn-secondary" href="${hrefMapeamento}">👁️ Ver Mapeamento Estratégico</a>`;

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
    if (statusFechamentoDoMes(codigoEmpresa, ano, mes) === 'aprovado') return; // mês travado

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

  const ICONE_FECHAMENTO = {
    aberto: { icone: '📤', titulo: 'Encerrar mês contábil' },
    aguardando_validacao: { icone: '⏳', titulo: 'Aguardando validação' },
    aprovado: { icone: '✅', titulo: 'Fechamento aprovado' },
  };

  function iconeFechamentoHtml(mes, statusFech) {
    const info = ICONE_FECHAMENTO[statusFech];
    return `<button type="button" class="btn-icone-fechamento" data-mes-fechamento="${mes}" title="${info.titulo}">${info.icone}</button>`;
  }

  function renderGradeMensal() {
    const el = document.getElementById('secaoGradeMensal');
    const meses = window.ContabilDiarioUtil.MESES_LABELS;

    const celulasHtml = meses.map((label, idx) => {
      const mes = idx + 1;
      const status = statusDoMes(empresaAtualCodigo, anoGradeAtual, mes);
      const statusFech = statusFechamentoDoMes(empresaAtualCodigo, anoGradeAtual, mes);
      const travada = statusFech === 'aprovado';
      return `
        <div class="mapa-grade-cel status-${status}${travada ? ' grade-travada' : ''}" data-mes="${mes}" title="${label}/${anoGradeAtual}${travada ? ' — fechamento aprovado (travado)' : ''}">
          <span class="mapa-grade-mes">${label}</span>
          ${status === 'concluido' ? iconeFechamentoHtml(mes, statusFech) : ''}
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
    el.querySelectorAll('.btn-icone-fechamento').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        abrirModalFechamento(empresaAtualCodigo, anoGradeAtual, Number(btn.getAttribute('data-mes-fechamento')));
      });
    });
  }

  // ─── MODAL: FECHAMENTO DO MÊS ───────────────────────────────

  const TIPO_EVENTO_LABEL = {
    enviado: '📤 Enviado para validação',
    aprovado: '✅ Aprovado',
    rejeitado: '❌ Rejeitado',
  };

  function formatarDataHoraFechamento(iso) {
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function timelineFechamentoHtml(codigoEmpresa, ano, mes) {
    const eventos = eventosFechamentoDoMes(codigoEmpresa, ano, mes);
    if (!eventos.length) return '<p class="mapa-empty">Nenhum evento registrado ainda para este mês.</p>';
    return eventos.map((ev) => `
      <div class="fechamento-evento">
        <div><strong>${TIPO_EVENTO_LABEL[ev.tipo_evento] || ev.tipo_evento}</strong> — ${escapeHtml(ev.usuario_nome || ev.usuario_email || 'desconhecido')} <span class="mapa-empty">(${formatarDataHoraFechamento(ev.created_at)})</span></div>
        ${ev.mensagem ? `<div class="fechamento-evento-msg">${escapeHtml(ev.mensagem)}</div>` : ''}
      </div>
    `).join('');
  }

  function abrirModalFechamento(codigoEmpresa, ano, mes) {
    let modal = document.getElementById('modalFechamento');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modalFechamento';
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h3 id="modalFechamentoTitulo">Fechamento do Mês</h3>
            <button class="modal-close" id="fecharModalFechamento">✕</button>
          </div>
          <div class="modal-body" id="modalFechamentoBody"></div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" id="fecharModalFechamento2">Fechar</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      const fechar = () => modal.classList.remove('active');
      document.getElementById('fecharModalFechamento').addEventListener('click', fechar);
      document.getElementById('fecharModalFechamento2').addEventListener('click', fechar);
      modal.addEventListener('click', (ev) => { if (ev.target === modal) fechar(); });
    }

    document.getElementById('modalFechamentoTitulo').textContent =
      `Fechamento — ${window.ContabilDiarioUtil.MESES_LABELS[mes - 1]}/${ano} — ${empresaNome(codigoEmpresa)}`;
    renderModalFechamentoBody(codigoEmpresa, ano, mes);
    modal.classList.add('active');
  }

  function renderModalFechamentoBody(codigoEmpresa, ano, mes) {
    const body = document.getElementById('modalFechamentoBody');
    const statusFech = statusFechamentoDoMes(codigoEmpresa, ano, mes);
    const ultimo = eventosFechamentoDoMes(codigoEmpresa, ano, mes)[0];

    let acaoHtml = '';
    if (statusFech === 'aberto' && podeEncerrar(codigoEmpresa)) {
      acaoHtml = `
        <div class="mapa-secao-body" style="padding:0 0 16px;">
          <div class="full"><label>Observação (opcional)</label><textarea id="fechObservacaoEnvio" rows="2" placeholder="Alguma observação para a equipe Scont..."></textarea></div>
          <div class="full"><button type="button" class="btn btn-primary" id="btnEncerrarMes">Encerrar mês contábil</button></div>
        </div>
      `;
    } else if (statusFech === 'aguardando_validacao') {
      if (podeValidar()) {
        acaoHtml = `
          <div class="mapa-secao-body" style="padding:0 0 16px;">
            <div class="full"><button type="button" class="btn btn-primary" id="btnAprovarFechamento">Aprovar</button></div>
            <div class="full"><label>Motivo da rejeição (obrigatório para rejeitar)</label><textarea id="fechMotivoRejeicao" rows="2" placeholder="Explique o que precisa ser corrigido..."></textarea></div>
            <div class="full"><button type="button" class="btn btn-secondary" id="btnRejeitarFechamento">Rejeitar</button></div>
          </div>
        `;
      } else {
        acaoHtml = `<p class="mapa-empty">Aguardando validação da equipe Scont${ultimo ? ` (enviado por ${escapeHtml(ultimo.usuario_nome || ultimo.usuario_email || '—')})` : ''}.</p>`;
      }
    } else if (statusFech === 'aprovado') {
      acaoHtml = '<p class="mapa-empty status-aprovado">Fechamento aprovado — mês travado.</p>';
    }

    body.innerHTML = `
      ${acaoHtml}
      <div class="mapa-secao-header" style="margin:0 -20px 12px;padding-left:20px;">Linha do Tempo</div>
      <div id="fechTimeline">${timelineFechamentoHtml(codigoEmpresa, ano, mes)}</div>
    `;

    const btnEncerrar = document.getElementById('btnEncerrarMes');
    if (btnEncerrar) {
      btnEncerrar.addEventListener('click', async () => {
        btnEncerrar.disabled = true;
        const mensagem = document.getElementById('fechObservacaoEnvio').value.trim();
        const { error } = await criarEventoFechamento(codigoEmpresa, ano, mes, 'enviado', mensagem);
        btnEncerrar.disabled = false;
        if (error) { console.error(error); mostrarToast('Erro ao encerrar o mês.', 'erro'); return; }
        mostrarToast('Mês encerrado e enviado para validação da equipe Scont.', 'sucesso');
        renderModalFechamentoBody(codigoEmpresa, ano, mes);
        renderGradeMensal();
      });
    }

    const btnAprovar = document.getElementById('btnAprovarFechamento');
    if (btnAprovar) {
      btnAprovar.addEventListener('click', async () => {
        btnAprovar.disabled = true;
        const { error } = await criarEventoFechamento(codigoEmpresa, ano, mes, 'aprovado', null);
        btnAprovar.disabled = false;
        if (error) { console.error(error); mostrarToast('Erro ao aprovar o fechamento.', 'erro'); return; }
        mostrarToast('Fechamento aprovado.', 'sucesso');
        renderModalFechamentoBody(codigoEmpresa, ano, mes);
        renderGradeMensal();
      });
    }

    const btnRejeitar = document.getElementById('btnRejeitarFechamento');
    if (btnRejeitar) {
      btnRejeitar.addEventListener('click', async () => {
        const motivo = document.getElementById('fechMotivoRejeicao').value.trim();
        if (!motivo) { mostrarToast('Informe o motivo da rejeição.', 'erro'); return; }
        btnRejeitar.disabled = true;
        const { error } = await criarEventoFechamento(codigoEmpresa, ano, mes, 'rejeitado', motivo);
        btnRejeitar.disabled = false;
        if (error) { console.error(error); mostrarToast('Erro ao rejeitar o fechamento.', 'erro'); return; }
        mostrarToast('Fechamento rejeitado — o mês voltou para aberto.', 'sucesso');
        renderModalFechamentoBody(codigoEmpresa, ano, mes);
        renderGradeMensal();
      });
    }
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
          <div class="full mapa-filtros mapa-filtros-lancamentos" style="margin-top:10px;border-top:1px solid var(--line-soft);padding-top:14px;">
            <div><label>De</label><input type="date" id="filtroLancamentoDe"></div>
            <div><label>Até</label><input type="date" id="filtroLancamentoAte"></div>
            <div>
              <label>Mês</label>
              <select id="filtroLancamentoMes">
                <option value="">Todos</option>
                ${window.ContabilDiarioUtil.MESES_LABELS.map((l, idx) => `<option value="${idx + 1}">${l}</option>`).join('')}
              </select>
            </div>
            <div><label>Ano</label><input type="number" id="filtroLancamentoAno" placeholder="Ano" style="width:80px;"></div>
            <button type="button" class="btn btn-secondary" id="btnFiltroMesAtual">Mês atual</button>
            <button type="button" class="btn btn-secondary" id="btnFiltroAnoAtual">Ano atual</button>
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

    el.querySelector('#btnFiltrarLancamentos').addEventListener('click', () => {
      const mes = document.getElementById('filtroLancamentoMes').value;
      const ano = document.getElementById('filtroLancamentoAno').value;
      if (ano) aplicarFiltroMesAno();
      else carregarListaLancamentos();
    });
    el.querySelector('#btnLimparFiltroLancamentos').addEventListener('click', () => {
      document.getElementById('filtroLancamentoDe').value = '';
      document.getElementById('filtroLancamentoAte').value = '';
      document.getElementById('filtroLancamentoMes').value = '';
      document.getElementById('filtroLancamentoAno').value = '';
      carregarListaLancamentos();
    });
    el.querySelector('#btnFiltroMesAtual').addEventListener('click', () => {
      const hoje = new Date();
      document.getElementById('filtroLancamentoMes').value = String(hoje.getMonth() + 1);
      document.getElementById('filtroLancamentoAno').value = String(hoje.getFullYear());
      aplicarFiltroMesAno();
    });
    el.querySelector('#btnFiltroAnoAtual').addEventListener('click', () => {
      const hoje = new Date();
      document.getElementById('filtroLancamentoMes').value = '';
      document.getElementById('filtroLancamentoAno').value = String(hoje.getFullYear());
      aplicarFiltroMesAno();
    });

    carregarListaLancamentos();
  }

  function aplicarFiltroMesAno() {
    const mes = document.getElementById('filtroLancamentoMes').value;
    const ano = document.getElementById('filtroLancamentoAno').value;
    if (!ano) return;
    const anoNum = Number(ano);

    if (mes) {
      const mesNum = Number(mes);
      const ultimoDia = new Date(anoNum, mesNum, 0).getDate();
      document.getElementById('filtroLancamentoDe').value = `${anoNum}-${String(mesNum).padStart(2, '0')}-01`;
      document.getElementById('filtroLancamentoAte').value = `${anoNum}-${String(mesNum).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;
    } else {
      document.getElementById('filtroLancamentoDe').value = `${anoNum}-01-01`;
      document.getElementById('filtroLancamentoAte').value = `${anoNum}-12-31`;
    }

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
