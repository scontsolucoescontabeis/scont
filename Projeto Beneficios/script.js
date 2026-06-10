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
    `<option value="${e.codigo_empresa}">${e.codigo_empresa} — ${e.nome_empresa}</option>`
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
  const { data } = await S.sb
    .from('rh_beneficios_config')
    .select('tipo, codigo_rubrica, tipo_processo, valor_dia')
    .eq('codigo_empresa', empresa);
  const rows = data || [];
  const vt = rows.find(r => r.tipo === 'vt') || {};
  const va = rows.find(r => r.tipo === 'va') || {};
  S.config = {
    vt: { rubrica: vt.codigo_rubrica || '', tipoProc: vt.tipo_processo || '11', valorDia: parseFloat(vt.valor_dia) || 0 },
    va: { rubrica: va.codigo_rubrica || '', tipoProc: va.tipo_processo || '11', valorDia: parseFloat(va.valor_dia) || 0 }
  };
}

async function loadIndividuais(empresa) {
  if (!empresa) { S.individuais = {}; return; }
  const { data } = await S.sb
    .from('rh_beneficios_individuais')
    .select('codigo_empregado, vt_valor_dia, va_valor_dia')
    .eq('codigo_empresa', empresa);
  S.individuais = {};
  (data || []).forEach(r => {
    S.individuais[r.codigo_empregado] = {
      vt_dia: r.vt_valor_dia != null ? parseFloat(r.vt_valor_dia) : null,
      va_dia: r.va_valor_dia != null ? parseFloat(r.va_valor_dia) : null
    };
  });
}

async function loadFeriadosEmpresa(empresa) {
  if (!empresa) return;
  const { data } = await S.sb
    .from('rh_saves')
    .select('feriados_json')
    .eq('empresa_codigo', empresa)
    .not('feriados_json', 'is', null)
    .order('data_criacao', { ascending: false })
    .limit(1)
    .maybeSingle();
  try {
    const raw = data?.feriados_json;
    S.escalas.feriados = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw) : []);
  } catch {
    S.escalas.feriados = [];
  }
  S.escalas.feriadosMarcados = new Set(S.escalas.feriados.map(f => f.data));
}

// Stubs — implemented in Tasks 5-7
function setupConfigListeners()     {}
function setupEscalasListeners()    {}
function setupLancamentosListeners() {}
