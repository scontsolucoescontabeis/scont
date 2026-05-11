// ============================================
// INICIALIZAÇÃO DA APLICAÇÃO
// ============================================

async function initializeApp() {
  setupAuthListeners();
  setupAppListeners();
  applyTheme(APP_STATE.isDarkMode);
  await loadConfiguracoes();
  setPage('dashboard');
  fetchCertificates();
  setupRealtime();
}

// ============================================
// POLLING — atualiza a cada 60 s e após cada operação CRUD
// ============================================

function setupRealtime() {
  setInterval(fetchCertificates, 60 * 1000);
}

// ============================================
// NAVEGAÇÃO
// ============================================

function setPage(pageName) {
  qa('.page').forEach(p => p.classList.remove('active'));
  q(`#page-${pageName}`)?.classList.add('active');

  const [title, subtitle] = PAGE_MAP[pageName] || ['', ''];
  q('#pageTitle').textContent = title;
  q('#pageSubtitle').textContent = subtitle;

  qa('.nav button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === pageName);
  });

  if (pageName === 'certificados') renderCertTable();
  if (pageName === 'relatorios')   renderRelatorio();
  if (pageName === 'agenda')       renderAgendaPage();
  if (pageName === 'historico')    fetchHistory();
  if (pageName === 'seguranca')    renderSegurancaPage();
  if (pageName === 'configuracoes') renderConfigPage();
}

function toggleSidebar() {
  q('#sidebar').classList.toggle('collapsed');
}

function applyTheme(isDark) {
  document.body.classList.toggle('dark-mode', isDark);
  const label = q('#themeLabel');
  if (label) label.textContent = isDark ? '☀️ Tema escuro' : '🌙 Tema claro';
  setLocalStorage('theme', isDark ? 'dark' : 'light');
}

// ============================================
// RENDERIZAÇÃO — DASHBOARD
// ============================================

function renderDashboard() {
  const certs = APP_STATE._allCertificates;
  const ativos = certs.filter(c => c.ativo !== false);
  const total      = certs.length;
  const active     = ativos.filter(c => c.situacao === 'Ativo').length;
  const expired    = ativos.filter(c => { const d = daysLeft(c.data_vencimento); return d !== null && d < 0; }).length;
  const upcoming   = ativos.filter(c => { const d = daysLeft(c.data_vencimento); return d !== null && d >= 0 && d <= 30; }).length;
  const pendentes  = ativos.filter(c => c.situacao_financeira === 'Pendente').length;
  const inadimpl   = ativos.filter(c => c.situacao_financeira === 'Inadimplente').length;

  const alertCount = ativos.filter(c => { const d = daysLeft(c.data_vencimento); return d !== null && d <= 15; }).length;
  const notifBtn = q('#notifBtn');
  if (notifBtn) notifBtn.dataset.count = alertCount;

  q('#cards').innerHTML = `
    <div class="card">
      <div class="card-label">Total de Certificados</div>
      <div class="card-value">${total}</div>
      <div class="card-meta">Carteira completa</div>
    </div>
    <div class="card success">
      <div class="card-label">Certificados Ativos</div>
      <div class="card-value">${active}</div>
      <div class="card-meta">${total > 0 ? ((active / total) * 100).toFixed(0) : 0}% da carteira</div>
    </div>
    <div class="card critical">
      <div class="card-label">Vencidos</div>
      <div class="card-value">${expired}</div>
      <div class="card-meta">Requer ação imediata</div>
    </div>
    <div class="card warning">
      <div class="card-label">Vencimento Próximo</div>
      <div class="card-value">${upcoming}</div>
      <div class="card-meta">Próximos 30 dias</div>
    </div>
    <div class="card warning">
      <div class="card-label">Pagamentos Pendentes</div>
      <div class="card-value">${pendentes}</div>
      <div class="card-meta">Aguardando recebimento</div>
    </div>
    ${inadimpl > 0 ? `
    <div class="card critical">
      <div class="card-label">Inadimplentes</div>
      <div class="card-value">${inadimpl}</div>
      <div class="card-meta">Requer cobrança</div>
    </div>` : ''}
  `;

  const alerts = ativos
    .filter(c => { const d = daysLeft(c.data_vencimento); return d !== null && d <= 30; })
    .sort((a, b) => daysLeft(a.data_vencimento) - daysLeft(b.data_vencimento))
    .slice(0, 5);

  q('#alertsTable').innerHTML = alerts.length ? alerts.map(c => {
    const d = daysLeft(c.data_vencimento);
    const color = d < 0 ? 'var(--danger)' : d <= 7 ? 'var(--danger)' : d <= 15 ? 'var(--warning)' : 'var(--text-secondary)';
    const text  = d < 0 ? `Vencido há ${Math.abs(d)}d` : `${d} dias`;
    return `
      <tr>
        <td><strong>${c.empresa_id}</strong></td>
        <td>${fmt(c.data_vencimento)}</td>
        <td><span class="badge ${badgeClass(c.situacao)}">${c.situacao}</span></td>
        <td><span style="color:${color};font-weight:700;">${text}</span></td>
      </tr>`;
  }).join('') : '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);">Nenhum alerta crítico</td></tr>';

  const agenda = ativos
    .filter(c => c.data_renovacao_agendada)
    .sort((a, b) => new Date(a.data_renovacao_agendada) - new Date(b.data_renovacao_agendada))
    .slice(0, 5);

  q('#agendaTable').innerHTML = agenda.length ? agenda.map(c => `
    <tr>
      <td><strong>${c.empresa_id}</strong></td>
      <td>${fmtDateTime(c.data_renovacao_agendada)}</td>
      <td><span class="badge badge-info">${c.situacao}</span></td>
    </tr>`).join('') : '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);">Nenhum agendamento</td></tr>';

  q('#timeline').innerHTML = APP_STATE.historyLog.slice(0, 5).map(log => `
    <div class="timeline-item">
      <div class="timeline-content">
        <div class="timeline-title">${log.tipo_alteracao || log.acao || 'Alteração'}${log.empresa_id ? ' — ' + log.empresa_id : ''}</div>
        <div class="timeline-meta">${fmt(log.data_alteracao || log.created_at)}${log.responsavel ? ' • ' + log.responsavel : ''}</div>
      </div>
    </div>`).join('') || '<div style="color:var(--text-muted);text-align:center;">Nenhuma atividade registrada</div>';
}

// ============================================
// RENDERIZAÇÃO — CERTIFICADOS
// ============================================

function renderCertTable() {
  const certs  = APP_STATE.certificates;
  const start  = (APP_STATE.currentPage - 1) * APP_STATE.pageSize;
  const paged  = certs.slice(start, start + APP_STATE.pageSize);

  q('#certTable').innerHTML = paged.length ? paged.map(c => {
    const inativo = c.ativo === false;
    const d = inativo ? null : daysLeft(c.data_vencimento);
    const rowStyle = inativo
      ? 'style="opacity:0.55;background:rgba(0,0,0,0.03);"'
      : d !== null && d < 0 ? 'style="background:rgba(239,68,68,0.04)"'
      : d !== null && d <= 7 ? 'style="background:rgba(245,158,11,0.03)"' : '';
    const inatBadge = inativo ? '<span class="badge" style="font-size:10px;background:var(--text-muted);color:#fff;margin-left:4px;">Inativo</span>' : '';
    return `
      <tr ${rowStyle}>
        <td><strong>${c.empresa_id}</strong>${inatBadge}</td>
        <td><span class="badge badge-info" style="font-size:11px;">${c.tipo_id || '—'}</span></td>
        <td>${fmt(c.data_vencimento)}</td>
        <td>${fmt(c.data_emissao)}</td>
        <td><span class="badge ${badgeClass(c.situacao)}">${c.situacao || '—'}</span></td>
        <td>${c.responsavel_nome || '—'}</td>
        <td style="white-space:nowrap;">
          <button class="btn btn-ghost" onclick="openDetails('${c.id}')"    style="padding:5px 10px;font-size:12px;margin-right:3px;">👁 Ver</button>
          <button class="btn btn-ghost" onclick="openCertModal('${c.id}')"  style="padding:5px 10px;font-size:12px;margin-right:3px;">✏ Editar</button>
          <button class="btn btn-ghost" onclick="removeCert('${c.id}')"    style="padding:5px 10px;font-size:12px;color:var(--danger);">🗑</button>
        </td>
      </tr>`;
  }).join('') : '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);">Nenhum certificado encontrado</td></tr>';

  const totalPages = Math.max(1, Math.ceil(certs.length / APP_STATE.pageSize));
  q('#currentPage').textContent = APP_STATE.currentPage;
  q('#totalPages').textContent  = totalPages;
  q('#totalRecords').textContent = certs.length;
  q('#prevPage').disabled = APP_STATE.currentPage === 1;
  q('#nextPage').disabled = APP_STATE.currentPage >= totalPages;
}

// ============================================
// RENDERIZAÇÃO — RELATÓRIOS
// ============================================

function renderRelatorio(certs = APP_STATE._allCertificates.filter(c => c.ativo !== false)) {
  const total    = certs.length;
  const vencidos = certs.filter(c => { const d = daysLeft(c.data_vencimento); return d !== null && d < 0; }).length;
  const criticos = certs.filter(c => { const d = daysLeft(c.data_vencimento); return d !== null && d >= 0 && d <= 7; }).length;
  const urgentes = certs.filter(c => { const d = daysLeft(c.data_vencimento); return d !== null && d > 7 && d <= 15; }).length;
  const atencao  = certs.filter(c => { const d = daysLeft(c.data_vencimento); return d !== null && d > 15 && d <= 30; }).length;

  const summaryEl = q('#relSummary');
  if (summaryEl) summaryEl.innerHTML = `
    <span class="badge badge-info">${total} total</span>
    <span class="badge badge-danger">${vencidos} vencidos</span>
    <span class="badge badge-danger">${criticos} críticos ≤7d</span>
    <span class="badge badge-warning">${urgentes} urgentes ≤15d</span>
    <span class="badge badge-warning">${atencao} atenção ≤30d</span>`;

  const relTable = q('#relTable');
  if (!relTable) return;

  relTable.innerHTML = certs.length ? certs.map(c => {
    const d = daysLeft(c.data_vencimento);
    const dStr = d === null ? '—'
      : d < 0 ? `<span style="color:var(--danger);font-weight:700;">Vencido há ${Math.abs(d)}d</span>`
      : `<span style="color:${d<=7?'var(--danger)':d<=15?'var(--warning)':'var(--text-secondary)'};font-weight:${d<=30?700:400};">${d}d</span>`;
    return `
      <tr>
        <td><strong>${c.empresa_id}</strong></td>
        <td>${c.cliente || '—'}</td>
        <td>${c.cpf_cnpj || '—'}</td>
        <td><span class="badge badge-info" style="font-size:11px;">${c.tipo_id || '—'}</span></td>
        <td>${fmt(c.data_emissao)}</td>
        <td>${fmt(c.data_vencimento)}</td>
        <td><span class="badge ${badgeClass(c.situacao)}">${c.situacao || '—'}</span></td>
        <td>${c.situacao_financeira || '—'}</td>
        <td>${c.forma_pagamento || '—'}</td>
        <td>${dStr}</td>
        <td>${c.responsavel_nome || '—'}</td>
      </tr>`;
  }).join('') : '<tr><td colspan="11" style="text-align:center;color:var(--text-muted);">Nenhum resultado</td></tr>';
}

function filterRelatorio() {
  const empresa   = q('#relEmpresa')?.value.toLowerCase().trim()  || '';
  const cliente   = q('#relCliente')?.value.toLowerCase().trim()  || '';
  const tipo      = q('#relTipo')?.value.toLowerCase().trim()     || '';
  const situacao  = q('#relSituacao')?.value.toLowerCase().trim() || '';
  const sitFin    = q('#relSitFinanceira')?.value.toLowerCase().trim() || '';
  const formaPag  = q('#relFormaPag')?.value.toLowerCase().trim() || '';
  const dataDe    = q('#relDataDe')?.value    || '';
  const dataAte   = q('#relDataAte')?.value   || '';

  const filtered = APP_STATE._allCertificates.filter(c => {
    if (c.ativo === false) return false;
    if (empresa  && !(c.empresa_id || '').toLowerCase().includes(empresa)) return false;
    if (cliente  && !(c.cliente    || '').toLowerCase().includes(cliente)) return false;
    if (tipo     && (c.tipo_id     || '').toLowerCase() !== tipo)          return false;
    if (situacao && (c.situacao    || '').toLowerCase() !== situacao)      return false;
    if (sitFin   && (c.situacao_financeira || '').toLowerCase() !== sitFin)   return false;
    if (formaPag && (c.forma_pagamento     || '').toLowerCase() !== formaPag) return false;
    if (dataDe   && c.data_vencimento && c.data_vencimento < dataDe) return false;
    if (dataAte  && c.data_vencimento && c.data_vencimento > dataAte) return false;
    return true;
  });
  renderRelatorio(filtered);
}

function clearRelatorio() {
  ['#relEmpresa','#relCliente','#relTipo','#relSituacao','#relSitFinanceira','#relFormaPag','#relDataDe','#relDataAte'].forEach(sel => {
    const el = q(sel); if (el) el.value = '';
  });
  renderRelatorio();
}

function exportCSV() {
  const empresa  = q('#relEmpresa')?.value.toLowerCase()  || '';
  const tipo     = q('#relTipo')?.value    || '';
  const situacao = q('#relSituacao')?.value || '';
  const dataDe   = q('#relDataDe')?.value  || '';
  const dataAte  = q('#relDataAte')?.value  || '';

  const certs = APP_STATE._allCertificates.filter(c => {
    if (empresa  && !c.empresa_id.toLowerCase().includes(empresa)) return false;
    if (tipo     && c.tipo_id !== tipo)     return false;
    if (situacao && c.situacao !== situacao) return false;
    if (dataDe   && c.data_vencimento < dataDe) return false;
    if (dataAte  && c.data_vencimento > dataAte) return false;
    return true;
  });

  const header = ['Empresa','Cliente','CPF/CNPJ','Tipo','Emissão','Vencimento','Situação','Sit. Financeira','Forma Pagamento','Dias Restantes','Responsável','Email','Telefone'];
  const rows = certs.map(c => {
    const d = daysLeft(c.data_vencimento);
    return [
      c.empresa_id, c.cliente || '', c.cpf_cnpj || '', c.tipo_id,
      fmt(c.data_emissao), fmt(c.data_vencimento), c.situacao,
      c.situacao_financeira || '', c.forma_pagamento || '',
      d === null ? '' : d,
      c.responsavel_nome || '', c.responsavel_email || '', c.responsavel_telefone || ''
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
  });

  const csv  = [header.join(','), ...rows].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `certificados_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exportado com sucesso!');
}

// ============================================
// RENDERIZAÇÃO — AGENDA
// ============================================

function renderAgendaPage() {
  const el = q('#agendaPageContent');
  if (!el) return;

  const certs = APP_STATE._allCertificates.filter(c => c.ativo !== false);

  const scheduled = certs
    .filter(c => c.data_renovacao_agendada)
    .sort((a, b) => new Date(a.data_renovacao_agendada) - new Date(b.data_renovacao_agendada));

  const needsAction = certs
    .filter(c => {
      if (c.data_renovacao_agendada) return false;
      const d = daysLeft(c.data_vencimento);
      return d !== null && d <= 60;
    })
    .sort((a, b) => daysLeft(a.data_vencimento) - daysLeft(b.data_vencimento));

  const schedHTML = scheduled.length ? scheduled.map(c => `
    <tr>
      <td><strong>${c.empresa_id}</strong></td>
      <td><span class="badge badge-info" style="font-size:11px;">${c.tipo_id}</span></td>
      <td>${fmtDateTime(c.data_renovacao_agendada)}</td>
      <td>${fmt(c.data_vencimento)}</td>
      <td><span class="badge ${badgeClass(c.situacao)}">${c.situacao}</span></td>
      <td>${c.responsavel_nome || '—'}</td>
      <td><button class="btn btn-ghost" onclick="openCertModal('${c.id}')" style="padding:5px 10px;font-size:12px;">✏ Editar</button></td>
    </tr>`).join('')
    : '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);">Nenhum agendamento registrado</td></tr>';

  const needsHTML = needsAction.length ? needsAction.map(c => {
    const d = daysLeft(c.data_vencimento);
    const color = d < 0 ? 'var(--danger)' : d <= 7 ? 'var(--danger)' : d <= 15 ? 'var(--warning)' : 'var(--text-secondary)';
    const text  = d < 0 ? `Vencido há ${Math.abs(d)}d` : `${d} dias`;
    return `
    <tr>
      <td><strong>${c.empresa_id}</strong></td>
      <td><span class="badge badge-info" style="font-size:11px;">${c.tipo_id}</span></td>
      <td>${fmt(c.data_vencimento)}</td>
      <td><span style="color:${color};font-weight:700;">${text}</span></td>
      <td><span class="badge ${badgeClass(c.situacao)}">${c.situacao}</span></td>
      <td><button class="btn btn-primary" onclick="openCertModal('${c.id}')" style="padding:5px 10px;font-size:12px;">📅 Agendar</button></td>
    </tr>`;
  }).join('')
    : '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);">Sem vencimentos próximos sem agendamento</td></tr>';

  el.innerHTML = `
    <section class="section">
      <div class="section-head">
        <div>
          <h2>Renovações agendadas</h2>
          <div class="meta">${scheduled.length} agendamento(s) registrado(s)</div>
        </div>
      </div>
      <div class="section-body">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Empresa</th><th>Tipo</th><th>Data Agendada</th><th>Vencimento</th><th>Situação</th><th>Responsável</th><th>Ação</th></tr></thead>
            <tbody>${schedHTML}</tbody>
          </table>
        </div>
      </div>
    </section>
    <section class="section">
      <div class="section-head">
        <div>
          <h2>Vencimentos próximos sem agendamento</h2>
          <div class="meta">${needsAction.length} certificado(s) nos próximos 60 dias sem data agendada</div>
        </div>
      </div>
      <div class="section-body">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Empresa</th><th>Tipo</th><th>Vencimento</th><th>Dias Restantes</th><th>Situação</th><th>Ação</th></tr></thead>
            <tbody>${needsHTML}</tbody>
          </table>
        </div>
      </div>
    </section>`;
}

// ============================================
// RENDERIZAÇÃO — HISTÓRICO
// ============================================

async function fetchHistory() {
  try {
    const { data, error } = await supabaseClient
      .from(TABLE_NAMES.HISTORICO)
      .select('*')
      .order('data_alteracao', { ascending: false })
      .limit(100);
    if (error) throw error;
    APP_STATE.historyLog = data || [];
  } catch (err) {
    console.error('Erro ao buscar histórico:', err);
  }
  renderHistoryPage();
  if (q('#page-dashboard')?.classList.contains('active')) renderDashboard();
}

function filterHistory() {
  renderHistoryPage(q('#histSearchInput')?.value.toLowerCase() || '');
}

function renderHistoryPage(search = '') {
  const el = q('#historyTimeline');
  if (!el) return;

  let logs = APP_STATE.historyLog;
  if (search) {
    logs = logs.filter(l => {
      const text = `${l.tipo_alteracao || ''} ${l.acao || ''} ${l.empresa_id || ''} ${l.responsavel || ''} ${l.campo_alterado || ''}`.toLowerCase();
      return text.includes(search);
    });
  }

  if (!logs.length) {
    el.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:40px;">Nenhuma atividade encontrada</div>';
    return;
  }

  el.innerHTML = logs.map(log => {
    const tipo    = log.tipo_alteracao || log.acao || 'Alteração';
    const empresa = log.empresa_id || log.certificado_id || '';
    const campo   = log.campo_alterado
      ? `<div style="font-size:12px;color:var(--text-muted);margin-top:4px;">Campo: <strong>${log.campo_alterado}</strong> — <em>${log.valor_anterior || '—'}</em> → <strong>${log.valor_novo || '—'}</strong></div>`
      : '';
    return `
      <div class="timeline-item">
        <div class="timeline-content">
          <div class="timeline-title">${tipo}${empresa ? ' — ' + empresa : ''}</div>
          <div class="timeline-meta">${fmt(log.data_alteracao || log.created_at)}${log.responsavel ? ' • ' + log.responsavel : ''}</div>
          ${campo}
        </div>
      </div>`;
  }).join('');
}

// ============================================
// RENDERIZAÇÃO — SEGURANÇA
// ============================================

function renderSegurancaPage() {
  const el = q('#segurancaContent');
  if (!el) return;

  const certs = APP_STATE._allCertificates.filter(c => c.senha_hash);

  el.innerHTML = `
    <div style="margin-bottom:16px;padding:14px 18px;background:var(--warning-light);border-radius:var(--radius-md);border:1px solid rgba(245,158,11,0.3);font-size:13px;color:var(--text-secondary);">
      ⚠️ As senhas são exibidas apenas para consulta local. Mantenha esses dados seguros e nunca compartilhe.
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Empresa</th><th>Tipo</th><th>Vencimento</th><th>Situação</th><th>Senha</th></tr>
        </thead>
        <tbody>
          ${certs.length ? certs.map((c, i) => `
            <tr>
              <td><strong>${c.empresa_id}</strong></td>
              <td><span class="badge badge-info" style="font-size:11px;">${c.tipo_id}</span></td>
              <td>${fmt(c.data_vencimento)}</td>
              <td><span class="badge ${badgeClass(c.situacao)}">${c.situacao}</span></td>
              <td>
                <div style="display:flex;align-items:center;gap:8px;">
                  <span id="senha-${i}" style="font-family:monospace;font-size:13px;letter-spacing:2px;">••••••••</span>
                  <button class="btn btn-ghost" onclick="toggleSenha(${i},'${encodeURIComponent(c.senha_hash)}')" data-visible="false" style="padding:4px 10px;font-size:11px;">👁 Ver</button>
                </div>
              </td>
            </tr>`).join('')
          : '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);">Nenhuma senha cadastrada</td></tr>'}
        </tbody>
      </table>
    </div>`;
}

function toggleSenha(index, encodedSenha) {
  const el  = q(`#senha-${index}`);
  const btn = el?.nextElementSibling;
  if (!el || !btn) return;
  const visible = btn.dataset.visible === 'true';
  if (visible) {
    el.textContent = '••••••••';
    btn.textContent = '👁 Ver';
    btn.dataset.visible = 'false';
  } else {
    el.textContent = decodeURIComponent(encodedSenha);
    btn.textContent = '🙈 Ocultar';
    btn.dataset.visible = 'true';
  }
}

// ============================================
// RENDERIZAÇÃO — CONFIGURAÇÕES
// ============================================

function renderConfigPage() {
  const el = q('#configContent');
  if (!el) return;
  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:24px;">
      <div>
        <h3 style="font-size:15px;font-weight:700;margin-bottom:16px;color:var(--text-primary);">Aparência</h3>
        <div class="field">
          <label>Tema da interface</label>
          <div style="display:flex;gap:8px;">
            <button class="btn ${!APP_STATE.isDarkMode ? 'btn-primary' : 'btn-secondary'}" onclick="setTheme(false)">☀️ Claro</button>
            <button class="btn ${APP_STATE.isDarkMode  ? 'btn-primary' : 'btn-secondary'}" onclick="setTheme(true)">🌙 Escuro</button>
          </div>
        </div>
        <div class="field" style="margin-top:16px;">
          <label>Itens por página</label>
          <select onchange="setPageSize(this.value)">
            <option value="5"  ${APP_STATE.pageSize === 5  ? 'selected' : ''}>5</option>
            <option value="10" ${APP_STATE.pageSize === 10 ? 'selected' : ''}>10</option>
            <option value="20" ${APP_STATE.pageSize === 20 ? 'selected' : ''}>20</option>
            <option value="50" ${APP_STATE.pageSize === 50 ? 'selected' : ''}>50</option>
          </select>
        </div>
      </div>
      <div>
        <h3 style="font-size:15px;font-weight:700;margin-bottom:16px;color:var(--text-primary);">Limiares de Alerta</h3>
        <div class="field">
          <label>🔴 Crítico (dias)</label>
          <input type="number" id="cfgCritico" value="${ALERT_CONFIG.dias_critico}" min="1" max="30">
        </div>
        <div class="field">
          <label>🟠 Urgente (dias)</label>
          <input type="number" id="cfgUrgente" value="${ALERT_CONFIG.dias_urgente}" min="1" max="60">
        </div>
        <div class="field">
          <label>🟡 Atenção (dias)</label>
          <input type="number" id="cfgCaution" value="${ALERT_CONFIG.dias_caution}" min="1" max="90">
        </div>
        <button class="btn btn-primary" onclick="salvarConfig()" style="margin-top:8px;">💾 Salvar configurações</button>
      </div>
      <div>
        <h3 style="font-size:15px;font-weight:700;margin-bottom:16px;color:var(--text-primary);">Navegação</h3>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <button class="btn btn-secondary" onclick="fetchCertificates()" style="width:100%;">🔄 Sincronizar dados</button>
          <button class="btn btn-secondary" onclick="window.location.href='../portal.html'" style="width:100%;">🏠 Voltar ao Portal</button>
        </div>
      </div>
    </div>`;
}

function setTheme(isDark) {
  APP_STATE.isDarkMode = isDark;
  applyTheme(isDark);
  renderConfigPage();
}

async function setPageSize(size) {
  APP_STATE.pageSize = parseInt(size);
  APP_STATE.currentPage = 1;
  localStorage.setItem('cert_pageSize', String(size));
  renderCertTable();
  try {
    await supabaseClient
      .from(TABLE_NAMES.CONFIG)
      .upsert({ chave: 'pageSize', valor: String(size), atualizado_em: new Date().toISOString() }, { onConflict: 'chave' });
  } catch (e) {
    // Tabela configuracoes_certificados opcional — localStorage garante persistência
  }
}

async function loadConfiguracoes() {
  try {
    const { data } = await supabaseClient
      .from(TABLE_NAMES.CONFIG)
      .select('chave, valor');
    if (!data) return;
    data.forEach(row => {
      if (row.chave === 'pageSize') {
        APP_STATE.pageSize = parseInt(row.valor) || 10;
      }
    });
  } catch (e) {
    console.error('Erro ao carregar configurações:', e);
  }
}

function salvarConfig() {
  const critico = parseInt(q('#cfgCritico')?.value) || 7;
  const urgente = parseInt(q('#cfgUrgente')?.value) || 15;
  const caution = parseInt(q('#cfgCaution')?.value) || 30;
  ALERT_CONFIG.dias_critico = critico;
  ALERT_CONFIG.dias_urgente = urgente;
  ALERT_CONFIG.dias_caution = caution;
  setLocalStorage('alertConfig', { critico, urgente, caution });
  showToast('Configurações salvas!');
}

// ============================================
// MODAIS
// ============================================

function openCertModal(id = null) {
  const form = q('#certForm');
  if (id) {
    const cert = APP_STATE._allCertificates.find(c => c.id === id);
    if (cert) {
      q('#certModalTitle').textContent = 'Editar certificado';
      q('#certId').value       = cert.id;
      q('#empresa').value      = cert.empresa_id;
      q('#cpfcnpj').value      = cert.cpf_cnpj || '';
      q('#tipo').value         = cert.tipo_id;
      q('#autoridade').value   = cert.autoridade_id || '';
      q('#emissao').value      = toISODate(cert.data_emissao);
      q('#vencimento').value   = toISODate(cert.data_vencimento);
      q('#senha').value        = cert.senha_hash || '';
      q('#situacao').value     = cert.situacao;
      q('#agendamento').value  = toISODateTime(cert.data_renovacao_agendada);
      q('#responsavel').value  = cert.responsavel_nome || '';
      q('#email').value        = cert.responsavel_email || '';
      q('#telefone').value     = cert.responsavel_telefone || '';
      q('#cliente').value              = cert.cliente             || '';
      q('#situacao_financeira').value  = cert.situacao_financeira || '';
      q('#forma_pagamento').value      = cert.forma_pagamento     || '';
      q('#info').value                 = cert.informacoes_adicionais || '';
      q('#risco').value                = cert.observacao_risco       || '';
      const ativoEl = q('#ativo');
      if (ativoEl) {
        ativoEl.checked = cert.ativo === false;
        const warning = q('#ativoWarning');
        if (warning) warning.style.display = ativoEl.checked ? 'block' : 'none';
      }
    }
  } else {
    q('#certModalTitle').textContent = 'Novo certificado';
    form.reset();
    q('#certId').value = '';
    const ativoEl = q('#ativo');
    if (ativoEl) { ativoEl.checked = false; }
    const warning = q('#ativoWarning');
    if (warning) warning.style.display = 'none';
  }
  q('#certModal').classList.add('active');
}

function closeCertModal() {
  q('#certModal').classList.remove('active');
}

function openDetails(id) {
  const cert = APP_STATE._allCertificates.find(c => c.id === id);
  if (!cert) return;

  const d = daysLeft(cert.data_vencimento);
  const dColor = d === null ? 'var(--text-muted)' : d < 0 ? 'var(--danger)' : d <= 7 ? 'var(--danger)' : d <= 15 ? 'var(--warning)' : 'var(--success)';
  const dText  = d === null ? '—' : d < 0 ? `Vencido há ${Math.abs(d)} dias` : `${d} dias restantes`;
  const dBg    = d !== null && d <= 30 ? 'rgba(239,68,68,0.05)' : 'var(--bg-soft)';
  const dBorder = d !== null && d <= 30 ? 'rgba(239,68,68,0.2)' : 'var(--border)';

  q('#detailsContent').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      ${dRow('🏢 Empresa',    cert.empresa_id)}
      ${dRow('📋 Tipo',       cert.tipo_id)}
      ${dRow('🪪 CPF/CNPJ',   cert.cpf_cnpj || '—')}
      ${dRow('🏦 Autoridade', cert.autoridade_id || '—')}
      ${dRow('📅 Emissão',    fmt(cert.data_emissao))}
      ${dRow('⏰ Vencimento', fmt(cert.data_vencimento))}
      <div style="grid-column:1/-1;background:${dBg};border-radius:var(--radius-md);padding:14px 18px;border:1px solid ${dBorder};">
        <div style="font-size:11px;color:var(--text-muted);font-weight:600;margin-bottom:4px;">⏳ SITUAÇÃO TEMPORAL</div>
        <div style="font-size:20px;font-weight:800;color:${dColor};">${dText}</div>
      </div>
      ${dRow('📊 Situação',        `<span class="badge ${badgeClass(cert.situacao)}">${cert.situacao}</span>`)}
      ${dRow('💰 Sit. Financeira', cert.situacao_financeira || '—')}
      ${dRow('💳 Forma Pagamento', cert.forma_pagamento     || '—')}
      ${dRow('👤 Cliente',         cert.cliente             || '—')}
      ${dRow('📅 Agendamento',     cert.data_renovacao_agendada ? fmtDateTime(cert.data_renovacao_agendada) : '—')}
      ${dRow('👤 Responsável',     cert.responsavel_nome    || '—')}
      ${dRow('📧 E-mail',      cert.responsavel_email || '—')}
      ${dRow('📞 Telefone',    cert.responsavel_telefone || '—')}
      ${cert.informacoes_adicionais ? `<div style="grid-column:1/-1;">${dRow('📝 Informações', cert.informacoes_adicionais)}</div>` : ''}
      ${cert.observacao_risco ? `<div style="grid-column:1/-1;">${dRow('⚠️ Risco', cert.observacao_risco)}</div>` : ''}
    </div>
    <div style="display:flex;gap:8px;margin-top:20px;">
      <button class="btn btn-primary" onclick="openCertModal('${cert.id}');closeDetailsModal();" style="flex:1;">✏ Editar</button>
      <button class="btn btn-secondary" onclick="closeDetailsModal();" style="flex:1;">Fechar</button>
    </div>`;
  q('#detailsModal').classList.add('active');
}

function dRow(label, value) {
  return `
    <div style="background:var(--bg-soft);border-radius:var(--radius-md);padding:12px 14px;border:1px solid var(--border);">
      <div style="font-size:11px;color:var(--text-muted);font-weight:600;margin-bottom:4px;">${label}</div>
      <div style="font-size:14px;font-weight:600;color:var(--text-primary);">${value}</div>
    </div>`;
}

function closeDetailsModal() {
  q('#detailsModal').classList.remove('active');
}

// ============================================
// SUPABASE — CRUD
// ============================================

async function fetchCertificates() {
  try {
    updateConnectionStatus(false);
    const { data, error } = await supabaseClient
      .from(TABLE_NAMES.CERTIFICADOS)
      .select('*')
      .is('deleted_at', null)
      .order('data_vencimento', { ascending: true });
    if (error) throw error;
    APP_STATE._allCertificates = data || [];
    APP_STATE.certificates = [...APP_STATE._allCertificates];
    updateConnectionStatus(true);
    renderCertTable();
    renderDashboard();
  } catch (err) {
    console.error('Erro ao buscar certificados:', err);
    updateConnectionStatus(false);
    const msg = err?.message || err?.error_description || JSON.stringify(err);
    showToast('Erro: ' + msg, 'error', 8000);
  }
}

async function saveCertificate(formData) {
  try {
    const id = formData.get('certId');
    const cert = {
      empresa_id:               formData.get('empresa'),
      cpf_cnpj:                 formData.get('cpfcnpj')    || null,
      tipo_id:                  formData.get('tipo'),
      autoridade_id:            formData.get('autoridade') || null,
      data_emissao:             formData.get('emissao')    || null,
      data_vencimento:          formData.get('vencimento'),
      senha_hash:               formData.get('senha')      || null,
      situacao:                 formData.get('situacao'),
      data_renovacao_agendada:  formData.get('agendamento') || null,
      responsavel_nome:         formData.get('responsavel') || null,
      responsavel_email:        formData.get('email')       || null,
      responsavel_telefone:     formData.get('telefone')    || null,
      informacoes_adicionais:   formData.get('info')               || null,
      observacao_risco:         formData.get('risco')              || null,
      cliente:                  formData.get('cliente')            || null,
      situacao_financeira:      formData.get('situacao_financeira')|| null,
      forma_pagamento:          formData.get('forma_pagamento')    || null,
      ativo:                    !(q('#ativo')?.checked),
      atualizado_por:           APP_STATE.currentUser?.usuario_id
    };

    if (id) {
      const { error } = await supabaseClient.from(TABLE_NAMES.CERTIFICADOS).update(cert).eq('id', id);
      if (error) throw error;
      showToast('Certificado atualizado com sucesso!');
    } else {
      cert.criado_por = APP_STATE.currentUser?.usuario_id;
      const { error } = await supabaseClient.from(TABLE_NAMES.CERTIFICADOS).insert([cert]);
      if (error) throw error;
      showToast('Certificado criado com sucesso!');
    }
    closeCertModal();
    await fetchCertificates();
  } catch (err) {
    showToast('Erro ao salvar: ' + err.message, 'error');
  }
}

async function removeCert(id) {
  if (!confirm('Tem certeza que deseja excluir este certificado?')) return;
  try {
    const { error } = await supabaseClient
      .from(TABLE_NAMES.CERTIFICADOS)
      .update({ deleted_at: new Date().toISOString(), deleted_by: APP_STATE.currentUser?.usuario_id })
      .eq('id', id);
    if (error) throw error;
    showToast('Certificado excluído.');
    await fetchCertificates();
  } catch (err) {
    showToast('Erro ao excluir: ' + err.message, 'error');
  }
}

function updateConnectionStatus(connected) {
  APP_STATE.isConnected = connected;
  const badge = q('#statusConnection .status-badge');
  if (badge) {
    badge.className = 'status-badge ' + (connected ? 'connected' : 'disconnected');
    badge.textContent = connected ? '🟢 Conectado' : '⚫ Desconectado';
  }
}

// ============================================
// SELEÇÃO E EXCLUSÃO EM LOTE
// ============================================

function updateSelectionBar() {
  const checkboxes = document.querySelectorAll('.cert-checkbox');
  const selected   = document.querySelectorAll('.cert-checkbox:checked');
  const btn        = q('#btnDeleteSelected');
  const counter    = q('#selectedCount');
  if (btn)     btn.style.display = selected.length > 0 ? 'inline-flex' : 'none';
  if (counter) counter.textContent = selected.length;
}

function selectAllCerts() {
  document.querySelectorAll('.cert-checkbox').forEach(cb => cb.checked = true);
  updateSelectionBar();
}

function deselectAllCerts() {
  document.querySelectorAll('.cert-checkbox').forEach(cb => cb.checked = false);
  updateSelectionBar();
}

async function deleteSelectedCerts() {
  const selected = [...document.querySelectorAll('.cert-checkbox:checked')];
  if (!selected.length) return;

  if (!confirm(`Excluir ${selected.length} certificado(s) selecionado(s)? Esta ação não pode ser desfeita.`)) return;

  const ids = selected.map(cb => cb.dataset.id);
  let ok = 0, fail = 0;
  const now = new Date().toISOString();
  const userId = APP_STATE.currentUser?.usuario_id || null;

  for (const id of ids) {
    try {
      const { error } = await supabaseClient
        .from(TABLE_NAMES.CERTIFICADOS)
        .update({ deleted_at: now, deleted_by: userId })
        .eq('id', id);
      if (error) {
        console.error(`Falha ao excluir id ${id}:`, error.message, error);
        showToast('Erro: ' + error.message, 'error', 6000);
        fail++;
      } else {
        ok++;
      }
    } catch (e) {
      console.error('Exceção ao excluir:', id, e);
      fail++;
    }
  }

  if (ok > 0) {
    showToast(`${ok} excluído(s)${fail ? ` • ${fail} falharam` : ''}`, 'success', 5000);
  }
  updateSelectionBar();
  await fetchCertificates();
}

// ============================================
// IMPORTAÇÃO EXCEL — CERTIFICADOS
// ============================================

const SITUACAO_MAP = {
  'ativo': 'Ativo',
  'agendado': 'Agendado',
  'renovado': 'Renovado',
  'aguardando contato': 'Aguardando Contato',
  'realizar contato': 'Aguardando Contato',
  'vencido': 'Vencido',
};

function normalizeSituacao(val) {
  if (!val) return null;
  const key = String(val).trim().toLowerCase();
  return SITUACAO_MAP[key] || String(val).trim() || null;
}

function parseDateCert(val) {
  if (!val) return null;
  if (typeof val === 'number') {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    return d.toISOString().split('T')[0];
  }
  const s = String(val).trim();
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

function showCertImportPreview(rows, onConfirm) {
  const cols = ['empresa','senha','data_vencimento','informacoes','situacao','data_agendamento','cliente','situacao_financeira','forma_pagamento'];
  const visibleCols = cols.filter(c => rows[0]?.hasOwnProperty(c));
  const preview = rows.slice(0, 10);

  const ths = visibleCols.map(c => `<th style="padding:6px 10px;background:var(--bg-soft);font-size:12px;">${c}</th>`).join('');
  const trs = preview.map(r =>
    `<tr>${visibleCols.map(c => `<td style="padding:6px 10px;border-bottom:1px solid var(--border);font-size:12px;">${r[c] ?? '—'}</td>`).join('')}</tr>`
  ).join('');

  const modal = document.createElement('div');
  modal.id = 'importPreviewModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:28px;max-width:90vw;max-height:85vh;overflow:auto;min-width:420px;">
      <h3 style="margin:0 0 8px;font-size:1.1rem;">Prévia da importação</h3>
      <p style="margin:0 0 16px;color:#666;font-size:.88rem;">${rows.length} registro(s) encontrado(s). Exibindo até 10.</p>
      <div style="overflow-x:auto;margin-bottom:20px;">
        <table style="border-collapse:collapse;width:100%;">
          <thead><tr>${ths}</tr></thead>
          <tbody>${trs}</tbody>
        </table>
      </div>
      <div style="display:flex;gap:10px;">
        <button id="confirmCertImport" class="btn btn-primary">✓ Confirmar importação</button>
        <button onclick="document.getElementById('importPreviewModal').remove()" class="btn btn-secondary">Cancelar</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  document.getElementById('confirmCertImport').addEventListener('click', async () => {
    document.getElementById('confirmCertImport').disabled = true;
    document.getElementById('confirmCertImport').textContent = 'Importando...';
    await onConfirm();
    modal.remove();
  });
}

async function importarExcelCertificados(file) {
  if (!window.XLSX) { showToast('Biblioteca Excel não carregada', 'error'); return; }
  try {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

    if (!rows.length) { showToast('Planilha vazia ou sem dados', 'error'); return; }

    showCertImportPreview(rows, async () => {
      // Carrega empresas existentes para deduplicação
      let existentes = new Set();
      try {
        const { data: existing } = await supabaseClient
          .from(TABLE_NAMES.CERTIFICADOS)
          .select('empresa_id')
          .is('deleted_at', null);
        (existing || []).forEach(c => existentes.add(c.empresa_id.trim().toLowerCase()));
      } catch (_) {}

      let ok = 0, fail = 0, skipped = 0;
      for (const r of rows) {
        const empresa = String(r['empresa'] || '').trim();
        if (!empresa) { fail++; continue; }

        if (existentes.has(empresa.toLowerCase())) { skipped++; continue; }

        const cert = {
          empresa_id:              empresa,
          tipo_id:                 String(r['tipo'] || '').trim() || null,
          senha_hash:              String(r['senha'] ?? '').trim() || null,
          data_vencimento:         parseDateCert(r['data_vencimento']) || null,
          informacoes_adicionais:  String(r['informacoes'] || '').trim() || null,
          situacao:                normalizeSituacao(r['situacao']),
          data_renovacao_agendada: parseDateCert(r['data_agendamento']) || null,
          cliente:                 String(r['cliente'] || '').trim() || null,
          situacao_financeira:     String(r['situacao_financeira'] || '').trim() || null,
          forma_pagamento:         String(r['forma_pagamento'] || '').trim() || null,
          criado_por:              APP_STATE.currentUser?.usuario_id || null,
        };

        try {
          const { error } = await supabaseClient.from(TABLE_NAMES.CERTIFICADOS).insert([cert]);
          if (error) throw error;
          ok++;
          existentes.add(empresa.toLowerCase()); // evita duplicatas dentro da própria planilha
        } catch (e) {
          console.error('Falha na linha:', r, e);
          fail++;
        }
      }
      const msg = [
        ok      ? `${ok} importado(s)`       : '',
        skipped ? `${skipped} duplicado(s) ignorado(s)` : '',
        fail    ? `${fail} falharam`          : '',
      ].filter(Boolean).join(' • ');
      showToast(msg, ok || skipped ? 'success' : 'error', 6000);
      await fetchCertificates();
    });
  } catch (err) {
    console.error('Erro ao ler Excel:', err);
    showToast('Erro ao ler o arquivo Excel', 'error');
  }
}

function baixarModeloCertificados() {
  const ws = XLSX.utils.aoa_to_sheet([
    ['empresa','tipo','senha','data_vencimento','informacoes','situacao','data_agendamento','cliente','situacao_financeira','forma_pagamento'],
    ['Empresa Exemplo Ltda','A1','Senha@2024','31/12/2025','Certificado A1 emitido pela Serasa','Ativo','15/11/2025','João da Silva','Pago','Cartão'],
    ['Comércio Silva ME','e-CNPJ','Pass#456','30/06/2025','e-CNPJ renovado','Agendado','01/06/2025','Maria Oliveira','Pendente','PIX']
  ]);
  ws['!cols'] = [24,10,14,16,28,18,16,20,18,18].map(w => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Certificados');
  XLSX.writeFile(wb, 'modelo_importacao_certificados.xlsx');
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupAppListeners() {
  qa('.nav button').forEach(btn => {
    btn.addEventListener('click', () => setPage(btn.dataset.page));
  });

  q('#sidebarCollapseBtn')?.addEventListener('click', toggleSidebar);
  q('#themeLabel')?.addEventListener('click', () => {
    APP_STATE.isDarkMode = !APP_STATE.isDarkMode;
    applyTheme(APP_STATE.isDarkMode);
  });

  q('#notifBtn')?.addEventListener('click', () => setPage('relatorios'));

  q('#settingsItem')?.addEventListener('click', () => { q('#userDropdown')?.classList.remove('active'); setPage('configuracoes'); });
  q('#securityItem')?.addEventListener('click', () => { q('#userDropdown')?.classList.remove('active'); setPage('seguranca'); });

  q('#btnNewCert')?.addEventListener('click', () => openCertModal());

  q('#btnImportCert')?.addEventListener('click', () => q('#importCertFile')?.click());
  q('#importCertFile')?.addEventListener('change', e => {
    if (e.target.files[0]) importarExcelCertificados(e.target.files[0]);
    e.target.value = '';
  });
  q('#btnModeloCert')?.addEventListener('click', baixarModeloCertificados);
  q('#closeCertModal')?.addEventListener('click', closeCertModal);
  q('#cancelCertForm')?.addEventListener('click', closeCertModal);
  q('#ativo')?.addEventListener('change', function () {
    const warning = q('#ativoWarning');
    if (warning) warning.style.display = this.checked ? 'block' : 'none';
  });
  q('#certForm')?.addEventListener('submit', e => {
    e.preventDefault();
    saveCertificate(new FormData(q('#certForm')));
  });

  q('#btnFilterCert')?.addEventListener('click', () => {
    const empresa      = q('#filterEmpresa').value.toLowerCase();
    const cliente      = q('#filterCliente').value.toLowerCase();
    const tipo         = q('#filterTipo').value;
    const situacao     = q('#filterSituacao').value;
    const sitFin       = q('#filterSitFinanceira').value;
    APP_STATE.certificates = APP_STATE._allCertificates.filter(c =>
      (!empresa  || c.empresa_id.toLowerCase().includes(empresa)) &&
      (!cliente  || (c.cliente || '').toLowerCase().includes(cliente)) &&
      (!tipo     || c.tipo_id === tipo) &&
      (!situacao || c.situacao === situacao) &&
      (!sitFin   || c.situacao_financeira === sitFin)
    );
    APP_STATE.currentPage = 1;
    renderCertTable();
  });

  q('#btnClearFilter')?.addEventListener('click', () => {
    q('#filterEmpresa').value       = '';
    q('#filterCliente').value       = '';
    q('#filterTipo').value          = '';
    q('#filterSituacao').value      = '';
    q('#filterSitFinanceira').value = '';
    APP_STATE.certificates = [...APP_STATE._allCertificates];
    APP_STATE.currentPage  = 1;
    renderCertTable();
  });

  q('#prevPage')?.addEventListener('click', () => {
    if (APP_STATE.currentPage > 1) { APP_STATE.currentPage--; renderCertTable(); }
  });
  q('#nextPage')?.addEventListener('click', () => {
    const totalPages = Math.ceil(APP_STATE.certificates.length / APP_STATE.pageSize);
    if (APP_STATE.currentPage < totalPages) { APP_STATE.currentPage++; renderCertTable(); }
  });

  q('#closeDetailsModal')?.addEventListener('click', closeDetailsModal);

  q('#userMenuBtn')?.addEventListener('click', () => q('#userDropdown').classList.toggle('active'));
  document.addEventListener('click', e => {
    if (!e.target.closest('.user-menu')) q('#userDropdown')?.classList.remove('active');
  });

  q('#histSearchInput')?.addEventListener('input', filterHistory);
}

// ============================================
// INICIALIZAÇÃO
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  setupAuthListeners();
  checkAuth();
});

// Expor funções globais (chamadas via onclick no HTML)
window.openDetails              = openDetails;
window.openCertModal            = openCertModal;
window.removeCert               = removeCert;
window.exportCSV                = exportCSV;
window.filterRelatorio          = filterRelatorio;
window.clearRelatorio           = clearRelatorio;
window.toggleSenha              = toggleSenha;
window.setTheme                 = setTheme;
window.setPageSize              = setPageSize;
window.salvarConfig             = salvarConfig;
window.importarExcelCertificados = importarExcelCertificados;
window.baixarModeloCertificados  = baixarModeloCertificados;
window.selectAllCerts            = selectAllCerts;
window.deselectAllCerts          = deselectAllCerts;
window.deleteSelectedCerts       = deleteSelectedCerts;
