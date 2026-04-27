/* ============================================================
   CENTRAL DE ALERTAS — app.js
   ============================================================ */

'use strict';

/* ---- State ---- */
const STATE = {
  auth:         null,
  supabase:     null,
  allAlerts:    [],
  filtered:     [],
  currentFilter:'todos',
  theme:        localStorage.getItem('ca_theme') || 'light',
  pollTimer:    null,
};

/* ---- Severity config ---- */
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

/* ---- Init ---- */
function initApp(auth) {
  STATE.auth    = auth;
  STATE.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  applyTheme(STATE.theme);

  const isAdmin = auth.role === 'admin' || auth.isAdmin;
  if (isAdmin) {
    document.getElementById('tabPortalBtn').style.display = '';
  }

  loadAlerts();
  STATE.pollTimer = setInterval(loadAlerts, 60 * 1000);
}

/* ---- Data ---- */
async function loadAlerts() {
  showSkeleton(true);

  try {
    const [portalResult, licencasAlerts] = await Promise.allSettled([
      STATE.supabase.rpc('fn_alertas_sistema'),
      loadLicencasAlerts(),
    ]);

    let portalAlerts = [];
    if (portalResult.status === 'fulfilled' && !portalResult.value.error) {
      portalAlerts = Array.isArray(portalResult.value.data) ? portalResult.value.data : [];
    } else if (portalResult.status === 'rejected') {
      console.warn('[Central de Alertas] fn_alertas_sistema:', portalResult.reason);
    }

    const licAlerts = licencasAlerts.status === 'fulfilled' ? licencasAlerts.value : [];

    STATE.allAlerts = [...portalAlerts, ...licAlerts];
    applyFilter();
    showSkeleton(false);
  } catch (err) {
    showSkeleton(false);
    const msg = err?.message || err?.error_description || JSON.stringify(err);
    showToast('Erro ao carregar alertas: ' + msg, 'error', 8000);
    console.error('[Central de Alertas]', err);
  }
}

/* ---- Licenças alerts (Supabase externo) ---- */
async function loadLicencasAlerts() {
  if (typeof LIC_URL_A === 'undefined' || typeof LIC_KEY_A === 'undefined') return [];

  try {
    const licClient = window.supabase.createClient(LIC_URL_A, LIC_KEY_A);
    const today     = new Date();
    const in30Days  = new Date(today.getTime() + 30 * 86400000);

    const [{ data: licencas }, { data: alvaras }] = await Promise.all([
      licClient.from('licencas').select('id,estabelecimento,tipo,numero,orgao_emissor,data_validade,responsavel'),
      licClient.from('alvaras').select('id,estabelecimento,tipo,numero,orgao_emissor,data_validade,responsavel'),
    ]);

    const allDocs = [
      ...(licencas || []).map(d => ({ ...d, _origem: 'Licença' })),
      ...(alvaras  || []).map(d => ({ ...d, _origem: 'Alvará'  })),
    ].filter(d => d.data_validade);

    return allDocs
      .filter(d => new Date(d.data_validade) <= in30Days)
      .map(d => {
        const venc = new Date(d.data_validade);
        const dias = Math.ceil((venc - today) / 86400000);

        let severidade;
        if      (dias < 0)   severidade = 'critico';
        else if (dias <= 7)  severidade = 'critico';
        else if (dias <= 14) severidade = 'urgente';
        else                 severidade = 'atencao';

        const diasStr = dias < 0
          ? `vencido há ${Math.abs(dias)} dia(s)`
          : dias === 0 ? 'vence hoje'
          : `vence em ${dias} dia(s)`;

        return {
          categoria:  'licencas',
          ferramenta: `Licenças — ${d._origem}`,
          severidade,
          titulo:     `${d.tipo} · ${d.estabelecimento}`,
          descricao:  `${diasStr} • Nº ${d.numero || 'N/A'} | ${d.orgao_emissor || ''}`,
          data_ref:   d.data_validade,
          link:       '../Projeto Licenças/index.html',
        };
      });
  } catch (err) {
    console.warn('[Central de Alertas] Licenças:', err.message);
    return [];
  }
}

/* ---- Filter ---- */
function setFilter(filter) {
  STATE.currentFilter = filter;

  document.querySelectorAll('.filter-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });

  document.querySelectorAll('.stat-card').forEach(card => {
    const sev = card.classList[1]; // total, critico, urgente, atencao, info
    card.classList.toggle('active',
      (filter === 'todos' && sev === 'total') ||
      (filter === sev)
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

/* ---- Render stats ---- */
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
  const catCount = cat => STATE.allAlerts.filter(a => a.categoria === cat).length;

  document.getElementById('tabTodos').textContent        = STATE.allAlerts.length;
  document.getElementById('tabCertificados').textContent = catCount('certificados');
  document.getElementById('tabFormularios').textContent  = catCount('formularios');
  document.getElementById('tabAdmissoes').textContent    = catCount('admissoes');
  document.getElementById('tabPortal').textContent       = catCount('portal');

  const elLic = document.getElementById('tabLicencas');
  if (elLic) elLic.textContent = catCount('licencas');
}

/* ---- Render alerts ---- */
function renderAlerts() {
  const grid  = document.getElementById('alertsGrid');
  const wrap  = document.getElementById('alertsContainer');
  const empty = document.getElementById('emptyState');

  if (!STATE.filtered.length) {
    wrap.style.display  = 'none';
    empty.classList.add('visible');
    return;
  }

  empty.classList.remove('visible');
  wrap.style.display = 'flex';

  const sorted = [...STATE.filtered].sort((a, b) => {
    const order = { critico: 0, urgente: 1, atencao: 2, info: 3 };
    return (order[a.severidade] ?? 9) - (order[b.severidade] ?? 9);
  });

  /* Group by category */
  const groups = {};
  sorted.forEach(a => {
    if (!groups[a.categoria]) groups[a.categoria] = [];
    groups[a.categoria].push(a);
  });

  const showGrouped = STATE.currentFilter === 'todos' || STATE.currentFilter in SEV;

  let html = '';

  if (showGrouped && Object.keys(groups).length > 1) {
    Object.entries(groups).forEach(([cat, items]) => {
      const icon = CAT_ICON[cat] || '📌';
      const label = cat.charAt(0).toUpperCase() + cat.slice(1);
      html += `<div class="section-label">${icon} ${label}</div>`;
      items.forEach(a => { html += buildCard(a); });
    });
  } else {
    sorted.forEach(a => { html += buildCard(a); });
  }

  grid.innerHTML = html;
}

function buildCard(a) {
  const sev      = SEV[a.severidade] || SEV.info;
  const icon     = CAT_ICON[a.categoria] || '📌';
  const timeStr  = formatTime(a.data_ref);
  const linkBtn  = a.link
    ? `<button class="btn-acao" onclick="navigate('${escHtml(a.link)}')">Ver detalhes →</button>`
    : '';

  return `
    <div class="alert-card ${sev.cardClass}">
      <div class="alert-card-inner">
        <div class="alert-card-top">
          <span class="alert-ferramenta">${icon} ${escHtml(a.ferramenta || a.categoria)}</span>
          <span class="alert-badge ${sev.badgeClass}">${sev.label}</span>
        </div>
        <div class="alert-titulo">${escHtml(a.titulo)}</div>
        <div class="alert-descricao">${escHtml(a.descricao || '')}</div>
        <div class="alert-card-footer">
          <span class="alert-time">${timeStr}</span>
          ${linkBtn}
        </div>
      </div>
    </div>`;
}

/* ---- Refresh ---- */
function refreshAlerts() {
  const btn = document.getElementById('btnRefresh');
  btn.classList.add('spinning');
  loadAlerts().finally(() => {
    setTimeout(() => btn.classList.remove('spinning'), 600);
  });
}

/* ---- Theme ---- */
function toggleTheme() {
  STATE.theme = STATE.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('ca_theme', STATE.theme);
  applyTheme(STATE.theme);
}

function applyTheme(theme) {
  document.body.classList.toggle('dark-mode', theme === 'dark');
  const btn = document.getElementById('btnTheme');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

/* ---- Skeleton ---- */
function showSkeleton(on) {
  const sk   = document.getElementById('skeleton');
  const wrap = document.getElementById('alertsContainer');
  const empty = document.getElementById('emptyState');

  if (on) {
    sk.style.display   = 'flex';
    wrap.style.display = 'none';
    empty.classList.remove('visible');
  } else {
    sk.style.display = 'none';
  }
}

/* ---- Navigate ---- */
function navigate(url) {
  if (url) window.location.href = url;
}

/* ---- Toast ---- */
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

/* ---- Helpers ---- */
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

    if (diff < 60)   return 'agora mesmo';
    if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;

    const days = Math.floor(diff / 86400);
    if (days < 7)    return `há ${days} dia${days > 1 ? 's' : ''}`;

    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  } catch {
    return '';
  }
}

/* ---- Expose globals referenced from HTML ---- */
window.initApp       = initApp;
window.refreshAlerts = refreshAlerts;
window.setFilter     = setFilter;
window.toggleTheme   = toggleTheme;
window.navigate      = navigate;
