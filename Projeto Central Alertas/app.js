/* ============================================================
   CENTRAL DE ALERTAS — app.js  (mobile-first)
   ============================================================ */

'use strict';

/* ── State ── */
const STATE = {
  auth:          null,
  supabase:      null,
  allAlerts:     [],
  filtered:      [],
  currentFilter: 'todos',
  theme:         localStorage.getItem('ca_theme') || 'light',
  pollTimer:     null,
};

/* ── Severity ── */
const SEV = {
  critico: { label: 'Crítico', badgeClass: 'badge-critico', cardClass: 'sev-critico' },
  urgente: { label: 'Urgente', badgeClass: 'badge-urgente', cardClass: 'sev-urgente' },
  atencao: { label: 'Atenção', badgeClass: 'badge-atencao', cardClass: 'sev-atencao' },
  info:    { label: 'Info',    badgeClass: 'badge-info',    cardClass: 'sev-info'    },
};

const CAT_ICON = {
  certificados: '🔐',
  formularios:  '📄',
  admissoes:    '👤',
  portal:       '🏠',
  licencas:     '🏛️',
};

const CAT_LABEL = {
  certificados: 'Certificados Digitais',
  formularios:  'Formulários',
  admissoes:    'Admissões',
  portal:       'Portal',
  licencas:     'Licenças e Alvarás',
};

/* ── Init ── */
function initApp(auth) {
  STATE.auth     = auth;
  STATE.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  applyTheme(STATE.theme);

  const isAdmin = auth.role === 'admin' || auth.isAdmin;
  if (isAdmin) {
    const btn = document.getElementById('tabPortalBtn');
    if (btn) btn.style.display = '';
  }

  loadAlerts();
  STATE.pollTimer = setInterval(loadAlerts, 60_000);
}

/* ── Data ── */
async function loadAlerts() {
  showSkeleton(true);
  try {
    const { data, error } = await STATE.supabase.rpc('fn_alertas_sistema');
    if (error) throw error;
    STATE.allAlerts = Array.isArray(data) ? data : [];
    applyFilter();
    showSkeleton(false);
  } catch (err) {
    showSkeleton(false);
    showToast('Erro ao carregar alertas: ' + (err?.message || JSON.stringify(err)), 'error', 8000);
    console.error('[Central de Alertas]', err);
  }
}

/* ── Filter ── */
function setFilter(filter) {
  STATE.currentFilter = filter;

  document.querySelectorAll('.cat-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  document.querySelectorAll('.stat-chip').forEach(chip => {
    const sev = chip.dataset.sev;
    chip.classList.toggle('active',
      (filter === 'todos' && sev === 'total') || filter === sev
    );
  });

  applyFilter();
}

function applyFilter() {
  const f = STATE.currentFilter;
  if (f === 'todos' || f in SEV) {
    STATE.filtered = f === 'todos'
      ? [...STATE.allAlerts]
      : STATE.allAlerts.filter(a => a.severidade === f);
  } else {
    STATE.filtered = STATE.allAlerts.filter(a => a.categoria === f);
  }
  renderStats();
  renderAlerts();
  updateTabCounts();
}

/* ── Stats ── */
function renderStats() {
  const counts = { critico: 0, urgente: 0, atencao: 0, info: 0 };
  STATE.allAlerts.forEach(a => { if (counts[a.severidade] !== undefined) counts[a.severidade]++; });

  document.getElementById('statTotal').textContent   = STATE.allAlerts.length;
  document.getElementById('statCritico').textContent = counts.critico;
  document.getElementById('statUrgente').textContent = counts.urgente;
  document.getElementById('statAtencao').textContent = counts.atencao;
  document.getElementById('statInfo').textContent    = counts.info;
}

function updateTabCounts() {
  const n = cat => STATE.allAlerts.filter(a => a.categoria === cat).length;
  document.getElementById('tabTodos').textContent        = STATE.allAlerts.length;
  document.getElementById('tabFormularios').textContent  = n('formularios');
  document.getElementById('tabAdmissoes').textContent    = n('admissoes');
  document.getElementById('tabCertificados').textContent = n('certificados');
  document.getElementById('tabPortal').textContent       = n('portal');
  const elLic = document.getElementById('tabLicencas');
  if (elLic) elLic.textContent = n('licencas');
}

/* ── Render ── */
function renderAlerts() {
  const grid  = document.getElementById('alertsGrid');
  const wrap  = document.getElementById('alertsContainer');
  const empty = document.getElementById('emptyState');

  if (!STATE.filtered.length) {
    wrap.style.display = 'none';
    empty.classList.add('visible');
    return;
  }

  empty.classList.remove('visible');
  wrap.style.display = 'block';

  const sorted = [...STATE.filtered].sort((a, b) => {
    const ord = { critico: 0, urgente: 1, atencao: 2, info: 3 };
    return (ord[a.severidade] ?? 9) - (ord[b.severidade] ?? 9);
  });

  const showGrouped = STATE.currentFilter === 'todos' || STATE.currentFilter in SEV;
  const groups = {};
  sorted.forEach(a => {
    if (!groups[a.categoria]) groups[a.categoria] = [];
    groups[a.categoria].push(a);
  });

  let html = '';
  if (showGrouped && Object.keys(groups).length > 1) {
    Object.entries(groups).forEach(([cat, items]) => {
      const icon  = CAT_ICON[cat]  || '📌';
      const label = CAT_LABEL[cat] || cat.charAt(0).toUpperCase() + cat.slice(1);
      html += `<div class="section-label">${icon} ${label}</div>`;
      items.forEach(a => { html += buildCard(a); });
    });
  } else {
    sorted.forEach(a => { html += buildCard(a); });
  }

  grid.innerHTML = html;
}

/* ── Card builder ── */
function buildCard(a) {
  const sev  = SEV[a.severidade] || SEV.info;
  const icon = CAT_ICON[a.categoria] || '📌';
  const time = formatTime(a.data_ref);
  const det  = a.detalhes || {};

  return `
    <div class="alert-card ${sev.cardClass}" onclick="toggleCard(this)">
      <div class="card-header">
        <div class="card-meta">
          <div class="card-ferramenta">${icon} ${escHtml(a.ferramenta || a.categoria)}</div>
          <div class="card-titulo">${escHtml(a.titulo)}</div>
          <div class="card-desc">${escHtml(a.descricao || '')}</div>
        </div>
        <div class="card-right">
          <span class="alert-badge ${sev.badgeClass}">${sev.label}</span>
          <span class="card-time">${time}</span>
          <span class="card-chevron">▾</span>
        </div>
      </div>
      <div class="card-detail">
        <div class="detail-inner">
          ${buildDetailContent(a, det)}
          ${a.link
            ? `<button class="btn-acao" onclick="event.stopPropagation(); navigate('${escHtml(a.link)}')">Abrir ferramenta →</button>`
            : ''}
        </div>
      </div>
    </div>`;
}

function buildDetailContent(a, det) {
  switch (a.categoria) {
    case 'formularios': return det.evento ? buildEventoDetail(det) : buildFormularioDetail(det);
    case 'admissoes':   return buildAdmissaoDetail(det);
    case 'certificados':return buildCertificadoDetail(det);
    case 'licencas':    return buildLicencaDetail(det);
    case 'portal':      return buildPortalDetail(det);
    default:            return '';
  }
}

/* ── Detail builders ── */

function dRow(label, value) {
  if (!value) return '';
  return `
    <div class="detail-field">
      <div class="detail-label">${label}</div>
      <div class="detail-value">${escHtml(String(value))}</div>
    </div>`;
}

function dSection(title) {
  return `<div class="detail-divider"></div><div class="detail-section-title">${title}</div>`;
}

function buildFormularioDetail(det) {
  const fmtCapital = val =>
    val ? 'R$ ' + Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : null;

  if (det.tipo_formulario === 'registro') {
    return `
      ${dSection('Dados da Empresa')}
      <div class="detail-grid">
        ${dRow('Nome fantasia', det.nome_fantasia)}
        ${dRow('Porte', det.porte_empresa)}
        ${dRow('Capital social', fmtCapital(det.capital_social))}
        ${dRow('Metragem', det.metragem ? det.metragem + ' m²' : null)}
        ${dRow('E-mail comercial', det.email_comercial)}
        ${dRow('Telefone', det.telefone_comercial)}
        ${dRow('Horário', det.horario)}
        ${dRow('Forma de atuação', det.forma_atuacao)}
        ${dRow('Endereço', det.endereco)}
        ${dRow('CEP', det.cep)}
      </div>
      ${dSection('Atividades')}
      <div class="detail-grid">
        ${dRow('CNAE principal', det.cnae_principal)}
        ${dRow('IPTU', det.iptu)}
      </div>
      ${det.atividades_secundarias
        ? dSection('Atividades secundárias') + `<div class="detail-obs">${escHtml(det.atividades_secundarias)}</div>`
        : ''}`;
  }

  if (det.tipo_formulario === 'alteracao') {
    let html = '';

    if (det.alterar_nome || det.alterar_fantasia) {
      html += dSection('Alteração de Nome');
      html += '<div class="detail-grid">';
      if (det.alterar_nome) {
        html += dRow('Opção 1', det.nome_opcao_1);
        html += dRow('Opção 2', det.nome_opcao_2);
        html += dRow('Opção 3', det.nome_opcao_3);
      }
      if (det.alterar_fantasia) {
        html += dRow('Novo nome fantasia', det.novo_nome_fantasia);
      }
      html += '</div>';
    }

    if (det.alterar_capital) {
      html += dSection('Alteração de Capital Social');
      html += '<div class="detail-grid">';
      html += dRow('Novo capital', fmtCapital(det.novo_capital));
      html += '</div>';
    }

    if (det.alterar_dados) {
      html += dSection('Alteração de Dados Cadastrais');
      html += '<div class="detail-grid">';
      html += dRow('Novo endereço', det.novo_endereco);
      html += dRow('CEP', det.cep_novo);
      html += dRow('E-mail comercial', det.email_comercial_novo);
      html += dRow('Telefone comercial', det.telefone_comercial_novo);
      html += dRow('Horário', det.horario_novo);
      html += dRow('IPTU', det.iptu_novo);
      html += '</div>';
    }

    if (det.alterar_atividades) {
      html += dSection('Alteração de Atividades');
      html += '<div class="detail-grid">';
      html += dRow('Atividade principal', det.atividade_principal_nova);
      html += '</div>';
    }

    return html || '<div class="detail-obs">Nenhuma alteração especificada</div>';
  }

  return `
    <div class="detail-grid">
      ${dRow('Status', det.status)}
      ${dRow('E-mail', det.email_comercial)}
      ${dRow('Telefone', det.telefone_comercial)}
    </div>`;
}

function buildEventoDetail(det) {
  const evLabel = det.evento === 'EVENTO_EXCLUSAO' ? 'Exclusão' : 'Edição';
  return `
    <div class="detail-grid">
      ${dRow('Tipo de evento', evLabel)}
      ${dRow('Realizado por', det.editado_por)}
      ${dRow('Status anterior', det.valor_anterior)}
      ${dRow('Novo status', det.valor_novo)}
      ${dRow('Tabela', det.tabela)}
    </div>`;
}

function buildAdmissaoDetail(det) {
  const admissao = det.data_admissao
    ? new Date(det.data_admissao).toLocaleDateString('pt-BR')
    : null;
  return `
    <div class="detail-grid">
      ${dRow('Empresa', det.nome_empresa)}
      ${dRow('CNPJ da empresa', det.cnpj_empresa)}
      ${dRow('CPF', det.cpf)}
      ${dRow('E-mail', det.email)}
      ${dRow('Celular', det.celular || det.telefone)}
      ${dRow('Cargo', det.cargo)}
      ${dRow('Departamento', det.departamento)}
      ${dRow('Data de admissão', admissao)}
      ${dRow('Status', det.status)}
    </div>`;
}

function buildCertificadoDetail(det) {
  const fmtDate = iso => iso ? new Date(iso).toLocaleDateString('pt-BR') : null;
  const risco = det.observacao_risco
    ? `<div class="detail-risco">⚠️ ${escHtml(det.observacao_risco)}</div>`
    : '';

  return `
    <div class="detail-grid">
      ${dRow('Tipo de certificado', det.tipo_id)}
      ${dRow('Situação', det.situacao)}
      ${dRow('CPF / CNPJ', det.cpf_cnpj)}
      ${dRow('Emissão', fmtDate(det.data_emissao))}
      ${dRow('Vencimento', fmtDate(det.data_vencimento))}
      ${dRow('Renovação agendada', fmtDate(det.data_renovacao_agendada))}
    </div>
    ${dSection('Responsável')}
    <div class="detail-grid">
      ${dRow('Nome', det.responsavel_nome)}
      ${dRow('E-mail', det.responsavel_email)}
      ${dRow('Telefone', det.responsavel_telefone)}
    </div>
    ${det.informacoes_adicionais ? dSection('Informações adicionais') + `<div class="detail-obs">${escHtml(det.informacoes_adicionais)}</div>` : ''}
    ${risco}`;
}

function buildLicencaDetail(det) {
  const fmtDate = iso => iso ? new Date(iso).toLocaleDateString('pt-BR') : null;
  const tipoDoc = det.tipo_documento === 'alvaras' ? 'Alvará' : 'Licença';
  const procContainerId = `proc-${det.id || 'x'}`;

  // Dispara busca de processos após render
  if (det.id) setTimeout(() => loadProcessos(det.id, det.tipo_documento, procContainerId), 0);

  return `
    <div class="detail-grid">
      ${dRow('Tipo de documento', tipoDoc)}
      ${dRow('Número', det.numero)}
      ${dRow('Órgão emissor', det.orgao_emissor)}
      ${dRow('Data de emissão', fmtDate(det.data_emissao))}
      ${dRow('Validade', fmtDate(det.data_validade))}
      ${dRow('Responsável', det.responsavel)}
    </div>
    ${dSection('Processos associados')}
    <div id="${procContainerId}" class="loading-inline">Carregando processos…</div>`;
}

async function loadProcessos(docId, tipoDoc, containerId) {
  const el = document.getElementById(containerId);
  if (!el || !STATE.supabase) return;

  try {
    const { data, error } = await STATE.supabase
      .from('processos')
      .select(`
        id, numero_processo, status, descricao, data_abertura, responsavel,
        andamento_processos ( status_anterior, status_novo, data_mudanca, responsavel )
      `)
      .eq('documento_id', docId)
      .eq('tipo_documento', tipoDoc)
      .eq('ativo', true)
      .order('data_abertura', { ascending: false });

    if (error) throw error;

    if (!data || !data.length) {
      el.innerHTML = '<div class="detail-obs">Nenhum processo vinculado</div>';
      return;
    }

    el.innerHTML = data.map(p => {
      const andamentos = (p.andamento_processos || [])
        .sort((a, b) => new Date(b.data_mudanca) - new Date(a.data_mudanca))
        .slice(0, 5)
        .map(and => `
          <div class="andamento-line">
            <span class="andamento-date">${new Date(and.data_mudanca).toLocaleDateString('pt-BR')}</span>
            ${and.status_anterior ? `<span class="andamento-from">${escHtml(and.status_anterior)}</span> → ` : ''}
            <strong>${escHtml(and.status_novo)}</strong>
            ${and.responsavel ? `<span class="andamento-by"> · ${escHtml(and.responsavel)}</span>` : ''}
          </div>`).join('');

      return `
        <div class="processo-item">
          <div class="processo-header">
            <span class="processo-numero">${escHtml(p.numero_processo || 'Sem número')}</span>
            <span class="processo-badge status-${escHtml(p.status)}">${escHtml(p.status.replace('_', ' '))}</span>
          </div>
          ${p.descricao ? `<div class="processo-desc">${escHtml(p.descricao)}</div>` : ''}
          ${p.responsavel ? `<div class="processo-resp">👤 ${escHtml(p.responsavel)}</div>` : ''}
          ${andamentos ? `<div class="andamentos">${andamentos}</div>` : ''}
        </div>`;
    }).join('');

  } catch (err) {
    if (el) el.innerHTML = '<div class="detail-obs">Erro ao carregar processos</div>';
    console.warn('[Central] processos:', err.message);
  }
}

function buildPortalDetail(det) {
  const data = det.data_solicitacao
    ? new Date(det.data_solicitacao).toLocaleDateString('pt-BR')
    : null;
  return `
    <div class="detail-grid">
      ${dRow('Solicitante', det.nome)}
      ${dRow('E-mail', det.email)}
      ${dRow('Empresa', det.empresa)}
      ${dRow('Cargo', det.cargo)}
      ${dRow('Telefone', det.telefone)}
      ${dRow('Data da solicitação', data)}
    </div>`;
}

/* ── Card expand/collapse ── */
function toggleCard(cardEl) {
  const isOpen = cardEl.classList.contains('expanded');
  document.querySelectorAll('.alert-card.expanded').forEach(c => c.classList.remove('expanded'));
  if (!isOpen) cardEl.classList.add('expanded');
}

/* ── Refresh ── */
function refreshAlerts() {
  const btn = document.getElementById('btnRefresh');
  if (btn) btn.classList.add('spinning');
  loadAlerts().finally(() => {
    setTimeout(() => { if (btn) btn.classList.remove('spinning'); }, 600);
  });
}

/* ── Theme ── */
function toggleTheme() {
  STATE.theme = STATE.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('ca_theme', STATE.theme);
  applyTheme(STATE.theme);
}

function applyTheme(t) {
  document.body.classList.toggle('dark-mode', t === 'dark');
  const btn = document.getElementById('btnTheme');
  if (btn) btn.textContent = t === 'dark' ? '☀️' : '🌙';
}

/* ── Skeleton ── */
function showSkeleton(on) {
  const sk    = document.getElementById('skeleton');
  const wrap  = document.getElementById('alertsContainer');
  const empty = document.getElementById('emptyState');
  if (on) {
    if (sk)    sk.style.display    = 'block';
    if (wrap)  wrap.style.display  = 'none';
    if (empty) empty.classList.remove('visible');
  } else {
    if (sk) sk.style.display = 'none';
  }
}

/* ── Navigate ── */
function navigate(url) { if (url) window.location.href = url; }

/* ── Toast ── */
function showToast(message, type = 'success', duration = 4000) {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('visible'));
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 400);
  }, duration);
}

/* ── Helpers ── */
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatTime(iso) {
  if (!iso) return '';
  try {
    const d    = new Date(iso);
    const now  = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60)    return 'agora mesmo';
    if (diff < 3600)  return `há ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
    const days = Math.floor(diff / 86400);
    if (days < 7) return `há ${days} dia${days > 1 ? 's' : ''}`;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  } catch { return ''; }
}

/* ── Globals ── */
window.initApp       = initApp;
window.refreshAlerts = refreshAlerts;
window.setFilter     = setFilter;
window.toggleTheme   = toggleTheme;
window.navigate      = navigate;
window.toggleCard    = toggleCard;
