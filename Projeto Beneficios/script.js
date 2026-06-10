// ============================================================
// BENEFÍCIOS VA/VT — script.js
// ============================================================

// ── STATE ─────────────────────────────────────────────────
const S = {
  sb:           null,
  auth:         null,
  empresas:     [],
  empregados:   [],
  config:       null,
  individuais:  {},
  lancamento: {
    empresa: '', compPgto: '', mesRef: '',
    tipoProc: '11', linhas: []
  },
  escalas: {
    modo:             'semana',
    diasSemana:       new Set([1,2,3,4,5]),
    revTrab:          5,
    revFolga:         2,
    revInicio:        '',
    diasManuais:      new Set(),
    feriados:         [],
    feriadosMarcados: new Set(),
    mesRef:           ''
  }
};

// ── HELPERS ───────────────────────────────────────────────
const pad = (v, n) => String(v).padStart(n, '0');
const $   = id => document.getElementById(id);

function parseDecimal(s) {
  if (s === null || s === undefined || s === '') return 0;
  return parseFloat(String(s).replace(',', '.')) || 0;
}

function fmtMoeda(v) {
  return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** "05/2026" → "202605" */
function compToAaaamm(comp) {
  const [mm, aaaa] = (comp || '').split('/');
  if (!mm || !aaaa) return '';
  return `${aaaa}${mm.padStart(2, '0')}`;
}

function showToast(msg, tipo = 'success') {
  const t = $('toast');
  t.textContent = msg;
  t.className = `toast ${tipo}`;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 3000);
}

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  $(`screen-${name}`).classList.remove('hidden');
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.screen === name);
  });
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── INIT ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  S.sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);

  const auth = await window.PortalAuthGuard.init(1);
  if (!auth) return;
  S.auth = auth;

  $('authOverlay').style.display = 'none';
  $('app').style.display = 'flex';
  $('sidebarUser').textContent = auth.email || '';

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => showScreen(btn.dataset.screen));
  });

  await loadEmpresas();
  setupLancamentosListeners();
  setupEscalasListeners();
  setupConfigListeners();
});

// ── DATA LOADERS ──────────────────────────────────────────
async function loadEmpresas() {
  const { data, error } = await S.sb
    .from('rh_empresas')
    .select('codigo_empresa, nome_empresa')
    .order('codigo_empresa');
  if (error) { showToast('Erro ao carregar empresas', 'error'); return; }
  S.empresas = data || [];

  const opts = S.empresas.map(e =>
    `<option value="${escHtml(e.codigo_empresa)}">${escHtml(e.codigo_empresa)} — ${escHtml(e.nome_empresa)}</option>`
  ).join('');

  ['lancEmpresa', 'escEmpresa', 'cfgEmpresa'].forEach(id => {
    $(id).innerHTML = '<option value="">Selecione…</option>' + opts;
  });
}

async function loadEmpregados(empresa) {
  if (!empresa) { S.empregados = []; return; }
  const { data, error } = await S.sb
    .from('rh_empregados')
    .select('codigo_empregado, nome_empregado')
    .eq('codigo_empresa', empresa)
    .order('nome_empregado');
  if (error) { showToast('Erro ao carregar empregados', 'error'); return; }
  S.empregados = data || [];
}

async function loadConfig(empresa) {
  if (!empresa) { S.config = null; return; }
  const { data, error } = await S.sb
    .from('rh_beneficios_config')
    .select('tipo, codigo_rubrica, tipo_processo, valor_dia')
    .eq('codigo_empresa', empresa);
  if (error) { showToast('Erro ao carregar config', 'error'); return; }
  const rows = data || [];
  const vt = rows.find(r => r.tipo === 'vt') || {};
  const va = rows.find(r => r.tipo === 'va') || {};
  S.config = {
    vt: { rubrica: vt.codigo_rubrica || '', tipoProc: vt.tipo_processo || '11', valorDia: parseDecimal(vt.valor_dia) },
    va: { rubrica: va.codigo_rubrica || '', tipoProc: va.tipo_processo || '11', valorDia: parseDecimal(va.valor_dia) }
  };
}

async function loadIndividuais(empresa) {
  if (!empresa) { S.individuais = {}; return; }
  const { data, error } = await S.sb
    .from('rh_beneficios_individuais')
    .select('codigo_empregado, vt_valor_dia, va_valor_dia')
    .eq('codigo_empresa', empresa);
  if (error) { showToast('Erro ao carregar valores individuais', 'error'); return; }
  S.individuais = {};
  (data || []).forEach(r => {
    S.individuais[r.codigo_empregado] = {
      vt_dia: r.vt_valor_dia != null ? parseDecimal(r.vt_valor_dia) : null,
      va_dia: r.va_valor_dia != null ? parseDecimal(r.va_valor_dia) : null
    };
  });
}

async function loadFeriadosEmpresa(empresa) {
  if (!empresa) {
    S.escalas.feriados = [];
    S.escalas.feriadosMarcados = new Set();
    return;
  }
  const { data, error } = await S.sb
    .from('rh_saves')
    .select('feriados_json')
    .eq('empresa_codigo', empresa)
    .not('feriados_json', 'is', null)
    .order('data_criacao', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) { showToast('Erro ao carregar feriados', 'error'); return; }
  try {
    const raw = data?.feriados_json;
    S.escalas.feriados = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw) : []);
  } catch {
    S.escalas.feriados = [];
  }
  S.escalas.feriadosMarcados = new Set(S.escalas.feriados.map(f => f.data));
}

// Stubs — implemented in Tasks 5-7
function setupConfigListeners() {
  $('cfgEmpresa').addEventListener('change', async () => {
    const emp = $('cfgEmpresa').value;
    await Promise.all([loadConfig(emp), loadEmpregados(emp), loadIndividuais(emp)]);
    renderConfigPadrao();
    renderIndividuais();
  });

  $('cfgTabBar').addEventListener('click', e => {
    const tab = e.target.closest('.tab-btn')?.dataset.tab;
    if (!tab) return;
    $('cfgTabBar').querySelectorAll('.tab-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.tab === tab)
    );
    $('cfgTabPadrao').classList.toggle('hidden', tab !== 'padrao');
    $('cfgTabIndividual').classList.toggle('hidden', tab !== 'individual');
  });

  $('btnSalvarConfig').addEventListener('click', saveConfigPadrao);
}

function renderConfigPadrao() {
  if (!S.config) return;
  $('cfgVtRubrica').value  = S.config.vt.rubrica;
  $('cfgVtTipoProc').value = S.config.vt.tipoProc;
  $('cfgVtValorDia').value = S.config.vt.valorDia || '';
  $('cfgVaRubrica').value  = S.config.va.rubrica;
  $('cfgVaTipoProc').value = S.config.va.tipoProc;
  $('cfgVaValorDia').value = S.config.va.valorDia || '';
}

async function saveConfigPadrao() {
  const emp = $('cfgEmpresa').value;
  if (!emp) { showToast('Selecione uma empresa', 'error'); return; }

  const rows = [
    { codigo_empresa: emp, tipo: 'vt',
      codigo_rubrica: $('cfgVtRubrica').value.trim(),
      tipo_processo:  $('cfgVtTipoProc').value,
      valor_dia:      parseDecimal($('cfgVtValorDia').value) },
    { codigo_empresa: emp, tipo: 'va',
      codigo_rubrica: $('cfgVaRubrica').value.trim(),
      tipo_processo:  $('cfgVaTipoProc').value,
      valor_dia:      parseDecimal($('cfgVaValorDia').value) }
  ];

  const { error } = await S.sb
    .from('rh_beneficios_config')
    .upsert(rows, { onConflict: 'codigo_empresa,tipo' });

  if (error) { showToast('Erro ao salvar: ' + error.message, 'error'); return; }
  await loadConfig(emp);
  showToast('✅ Configurações salvas!');
}

function renderIndividuais() {
  const tbody = $('indTbody');
  tbody.innerHTML = '';
  if (!S.empregados.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#7f8c8d;padding:16px">Selecione uma empresa</td></tr>';
    return;
  }
  S.empregados.forEach(emp => {
    const ind = S.individuais[emp.codigo_empregado] || {};
    const vtVal = ind.vt_dia != null ? ind.vt_dia : '';
    const vaVal = ind.va_dia != null ? ind.va_dia : '';
    const vtPlaceholder = S.config ? `padrão R$ ${fmtMoeda(S.config.vt.valorDia)}` : 'padrão';
    const vaPlaceholder = S.config ? `padrão R$ ${fmtMoeda(S.config.va.valorDia)}` : 'padrão';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="color:#7f8c8d">${escHtml(emp.codigo_empregado)}</td>
      <td>${escHtml(emp.nome_empregado)}</td>
      <td><input type="number" step="0.01" min="0"
            class="ind-vt" data-cod="${escHtml(emp.codigo_empregado)}"
            value="${escHtml(String(vtVal))}" placeholder="${escHtml(vtPlaceholder)}"
            style="width:120px"></td>
      <td><input type="number" step="0.01" min="0"
            class="ind-va" data-cod="${escHtml(emp.codigo_empregado)}"
            value="${escHtml(String(vaVal))}" placeholder="${escHtml(vaPlaceholder)}"
            style="width:120px"></td>
      <td><button type="button" class="btn btn-sm btn-secondary btn-salvar-ind"
            data-cod="${escHtml(emp.codigo_empregado)}">💾</button></td>`;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.btn-salvar-ind').forEach(btn => {
    btn.addEventListener('click', () => saveIndividual($('cfgEmpresa').value, btn.dataset.cod));
  });
}

async function saveIndividual(empresa, codEmp) {
  const vtInput = document.querySelector(`.ind-vt[data-cod="${codEmp}"]`);
  const vaInput = document.querySelector(`.ind-va[data-cod="${codEmp}"]`);
  const vt = vtInput.value.trim() === '' ? null : parseDecimal(vtInput.value);
  const va = vaInput.value.trim() === '' ? null : parseDecimal(vaInput.value);

  const { error } = await S.sb
    .from('rh_beneficios_individuais')
    .upsert(
      { codigo_empresa: empresa, codigo_empregado: codEmp, vt_valor_dia: vt, va_valor_dia: va },
      { onConflict: 'codigo_empresa,codigo_empregado' }
    );

  if (error) { showToast('Erro: ' + error.message, 'error'); return; }
  await loadIndividuais(empresa);
  showToast('✅ Valor individual salvo!');
}

function setupEscalasListeners()    {}
function setupLancamentosListeners() {}
