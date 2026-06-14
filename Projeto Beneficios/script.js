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
    tipoProc: '11', linhas: [],
    filtroEmps: new Set(),
    filtroNenhum: false,
    obsEmpresa: ''
  },
  escalas: {
    modo:             'semana',
    diasSemana:       new Set([1,2,3,4,5]),
    revTrab:          5,
    revFolga:         2,
    revInicio:        '',
    diasFolga:        new Set(),
    feriados:         [],
    feriadosMarcados:   new Set(),
    mesRef:             '',
    considerarFeriados: 'sim'
  },
  ferias: {
    empresas:      {},   // { nomeEmpresa: [ rowObj, ... ] }
    filtroEmpresa: '',
    filtroMes:     null,
    filtroAno:     null,
    omitirVazias:  false,
    atualizadoEm:  null
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
  setupFeriasListeners();
  await carregarFeriasSupabase();
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
    const rawList = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw) : []);
    S.escalas.feriados = rawList.map(f => ({
      ...f,
      data: f.data && f.data.length > 5 ? f.data.substring(0, 5) : f.data
    }));
  } catch {
    S.escalas.feriados = [];
  }
  S.escalas.feriadosMarcados = new Set(S.escalas.feriados.map(f => f.data));
}

// ── FILTRO DE EMPREGADOS ──────────────────────────────────

function empregadosFiltrados() {
  if (S.lancamento.filtroNenhum) return [];
  if (S.lancamento.filtroEmps.size === 0) return S.empregados;
  return S.empregados.filter(e => S.lancamento.filtroEmps.has(e.codigo_empregado));
}

function atualizarBtnFiltro() {
  if (S.lancamento.filtroNenhum) {
    $('btnFiltroEmp').textContent = '👥 Nenhum selecionado ▾';
    return;
  }
  const n = S.lancamento.filtroEmps.size;
  $('btnFiltroEmp').textContent = n === 0
    ? '👥 Todos os empregados ▾'
    : `👥 ${n} selecionado(s) ▾`;
}

function renderFiltroPainel() {
  const lista = $('filtroLista');
  if (!lista) return;
  lista.innerHTML = '';
  const nenhumFiltro = !S.lancamento.filtroNenhum && S.lancamento.filtroEmps.size === 0;

  const todosCheck = $('filtroTodos');
  todosCheck.checked       = nenhumFiltro;
  todosCheck.indeterminate = false;

  S.empregados.forEach(emp => {
    const checked = nenhumFiltro || (!S.lancamento.filtroNenhum && S.lancamento.filtroEmps.has(emp.codigo_empregado));
    const label = document.createElement('label');
    label.className = 'filtro-item';
    label.innerHTML =
      `<input type="checkbox" data-cod="${escHtml(emp.codigo_empregado)}" ${checked ? 'checked' : ''}>` +
      ` <span>${escHtml(emp.codigo_empregado)} — ${escHtml(emp.nome_empregado)}</span>`;
    lista.appendChild(label);
  });

  atualizarBtnFiltro();
}

function setupFiltroPainel() {
  $('btnFiltroEmp').addEventListener('click', e => {
    e.stopPropagation();
    $('filtroPainel').classList.toggle('hidden');
  });

  document.addEventListener('click', e => {
    if (!$('filtroPainel').contains(e.target) && e.target !== $('btnFiltroEmp')) {
      $('filtroPainel').classList.add('hidden');
    }
  });

  $('filtroTodos').addEventListener('change', () => {
    if ($('filtroTodos').checked) {
      S.lancamento.filtroEmps.clear();
      S.lancamento.filtroNenhum = false;
    } else {
      S.lancamento.filtroEmps.clear();
      S.lancamento.filtroNenhum = true;
    }
    renderFiltroPainel();
    buildGrade();
    renderGrade();
  });

  $('filtroLista').addEventListener('change', e => {
    const cb = e.target.closest('input[type=checkbox]');
    if (!cb) return;
    const cod = cb.dataset.cod;
    if (S.lancamento.filtroNenhum) {
      S.lancamento.filtroNenhum = false;
    } else if (S.lancamento.filtroEmps.size === 0) {
      S.empregados.forEach(emp => S.lancamento.filtroEmps.add(emp.codigo_empregado));
    }
    if (cb.checked) S.lancamento.filtroEmps.add(cod);
    else            S.lancamento.filtroEmps.delete(cod);
    if (S.lancamento.filtroEmps.size === S.empregados.length) S.lancamento.filtroEmps.clear();

    const n = S.lancamento.filtroEmps.size;
    const todosCheck = $('filtroTodos');
    todosCheck.checked       = n === 0;
    todosCheck.indeterminate = n > 0 && n < S.empregados.length;

    atualizarBtnFiltro();
    buildGrade();
    renderGrade();
  });
}

// Stubs — implemented in Tasks 5-7
function setupConfigListeners() {
  $('cfgEmpresa').addEventListener('change', async () => {
    const emp = $('cfgEmpresa').value;
    await Promise.all([loadConfig(emp), loadEmpregados(emp), loadIndividuais(emp)]);
    renderConfigPadrao();
    renderIndividuais();
    const obsResult = await S.sb
      .from('rh_beneficios_empresa_obs')
      .select('observacoes')
      .eq('codigo_empresa', $('cfgEmpresa').value)
      .maybeSingle();
    $('cfgObs').value = obsResult.data?.observacoes || '';
  });

  $('cfgTabBar').addEventListener('click', e => {
    const tab = e.target.closest('.tab-btn')?.dataset.tab;
    if (!tab) return;
    $('cfgTabBar').querySelectorAll('.tab-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.tab === tab)
    );
    $('cfgTabPadrao').classList.toggle('hidden', tab !== 'padrao');
    $('cfgTabIndividual').classList.toggle('hidden', tab !== 'individual');
    $('cfgTabObservacoes').classList.toggle('hidden', tab !== 'observacoes');
  });

  $('btnSalvarConfig').addEventListener('click', saveConfigPadrao);
  $('btnSalvarTodosInd').addEventListener('click', saveAllIndividuais);
  $('btnSalvarObs').addEventListener('click', () => saveObs($('cfgEmpresa').value));
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

async function saveAllIndividuais() {
  const empresa = $('cfgEmpresa').value;
  if (!empresa) return;

  const rows = [];
  document.querySelectorAll('.btn-salvar-ind').forEach(btn => {
    const cod = btn.dataset.cod;
    const vtInput = document.querySelector(`.ind-vt[data-cod="${cod}"]`);
    const vaInput = document.querySelector(`.ind-va[data-cod="${cod}"]`);
    const vt = vtInput.value.trim() === '' ? null : parseDecimal(vtInput.value);
    const va = vaInput.value.trim() === '' ? null : parseDecimal(vaInput.value);
    rows.push({ codigo_empresa: empresa, codigo_empregado: cod, vt_valor_dia: vt, va_valor_dia: va });
  });

  if (rows.length === 0) return;

  const { error } = await S.sb
    .from('rh_beneficios_individuais')
    .upsert(rows, { onConflict: 'codigo_empresa,codigo_empregado' });

  if (error) { showToast('Erro: ' + error.message, 'error'); return; }
  await loadIndividuais(empresa);
  showToast(`✅ ${rows.length} valor(es) individual(is) salvo(s)!`);
}

async function loadObs(empresa) {
  if (!empresa) { S.lancamento.obsEmpresa = ''; return; }
  const { data } = await S.sb
    .from('rh_beneficios_empresa_obs')
    .select('observacoes')
    .eq('codigo_empresa', empresa)
    .maybeSingle();
  S.lancamento.obsEmpresa = data?.observacoes || '';
}

async function saveObs(empresa) {
  if (!empresa) return;
  const obs = $('cfgObs').value.trim();
  const { error } = await S.sb
    .from('rh_beneficios_empresa_obs')
    .upsert({ codigo_empresa: empresa, observacoes: obs }, { onConflict: 'codigo_empresa' });
  if (error) { showToast('Erro ao salvar: ' + error.message, 'error'); return; }
  S.lancamento.obsEmpresa = obs;
  showToast('✅ Observações salvas!');
}

function setupEscalasListeners() {
  $('escEmpresa').addEventListener('change', async () => {
    await loadFeriadosEmpresa($('escEmpresa').value);
    renderFeriados();
    calcularEAtualizar();
  });

  $('escMesRef').addEventListener('change', () => {
    S.escalas.mesRef = $('escMesRef').value;
    S.escalas.diasFolga.clear();
    renderFeriados();
    calcularEAtualizar();
  });

  $('escConsiderarFeriados').addEventListener('change', e => {
    S.escalas.considerarFeriados = e.target.value;
    $('feriadosCard').style.display = e.target.value === 'sim' ? 'block' : 'none';
    calcularEAtualizar();
  });

  $('escalaTabBar').addEventListener('click', e => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    $('escalaTabBar').querySelectorAll('.tab-btn').forEach(b =>
      b.classList.toggle('active', b === btn)
    );
    S.escalas.modo = btn.dataset.modo;
    $('modoSemana').classList.toggle('hidden',      S.escalas.modo !== 'semana');
    $('modoRevezamento').classList.toggle('hidden', S.escalas.modo !== 'revezamento');
    $('modoManual').classList.toggle('hidden',      S.escalas.modo !== 'manual');
    calcularEAtualizar();
  });

  $('dayToggles').addEventListener('click', e => {
    const btn = e.target.closest('.day-btn');
    if (!btn) return;
    const dia = parseInt(btn.dataset.dia);
    if (S.escalas.diasSemana.has(dia)) S.escalas.diasSemana.delete(dia);
    else S.escalas.diasSemana.add(dia);
    btn.classList.toggle('active', S.escalas.diasSemana.has(dia));
    atualizarEscalaLabel();
    calcularEAtualizar();
  });

  ['revTrab', 'revFolga', 'revInicio'].forEach(id => {
    $(id).addEventListener('change', () => {
      S.escalas.revTrab  = parseInt($('revTrab').value)  || 5;
      S.escalas.revFolga = parseInt($('revFolga').value) || 2;
      S.escalas.revInicio = $('revInicio').value;
      calcularEAtualizar();
    });
  });

  $('btnAddFeriado').addEventListener('click', () => {
    $('addFeriadoForm').style.display = 'flex';
  });
  $('btnConfirmarFeriado').addEventListener('click', adicionarFeriado);

  $('btnAplicarEscala').addEventListener('click', aplicarNosLancamentos);
}

function atualizarEscalaLabel() {
  const nomesDias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const sel = [0, 1, 2, 3, 4, 5, 6].filter(d => S.escalas.diasSemana.has(d));
  if (!sel.length) { $('escalaLabel').textContent = 'Nenhum dia selecionado'; return; }
  $('escalaLabel').textContent =
    `Escala ${sel.length}×${7 - sel.length} — ${sel.map(d => nomesDias[d]).join(', ')}`;
}

function renderFeriados() {
  const mesRef = S.escalas.mesRef;
  const mm = mesRef ? mesRef.split('/')[0] : null;
  const feriadosMes = mm
    ? S.escalas.feriados.filter(f => f.data && f.data.split('/')[1] === mm)
    : S.escalas.feriados;

  const tbody = $('feriadosTbody');
  tbody.innerHTML = '';
  if (!feriadosMes.length) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#7f8c8d;padding:12px">Nenhum feriado para este mês</td></tr>';
    return;
  }
  feriadosMes.forEach(f => {
    const marcado = S.escalas.feriadosMarcados.has(f.data);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="checkbox" data-data="${escHtml(f.data)}" ${marcado ? 'checked' : ''}></td>
      <td>${escHtml(f.data)}</td>
      <td>${escHtml(f.descricao)}</td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('input[type=checkbox]').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) S.escalas.feriadosMarcados.add(cb.dataset.data);
      else S.escalas.feriadosMarcados.delete(cb.dataset.data);
      calcularEAtualizar();
    });
  });
}

function adicionarFeriado() {
  const data = $('novaDataFeriado').value.trim();
  const desc = $('novaDescFeriado').value.trim();
  if (!/^\d{2}\/\d{2}$/.test(data)) { showToast('Formato inválido. Use DD/MM', 'error'); return; }
  if (!desc) { showToast('Informe a descrição', 'error'); return; }
  if (!S.escalas.feriados.some(f => f.data === data)) {
    S.escalas.feriados.push({ data, descricao: desc });
    S.escalas.feriadosMarcados.add(data);
  }
  $('novaDataFeriado').value = '';
  $('novaDescFeriado').value = '';
  $('addFeriadoForm').style.display = 'none';
  renderFeriados();
  calcularEAtualizar();
}

function toLocalDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDiasMes(mesAno) {
  const [mm, aaaa] = (mesAno || '').split('/');
  if (!mm || !aaaa) return [];
  const ano = parseInt(aaaa), mes = parseInt(mm) - 1;
  const total = new Date(ano, mes + 1, 0).getDate();
  const dias = [];
  for (let d = 1; d <= total; d++) dias.push(new Date(ano, mes, d));
  return dias;
}

function getFeriadosMarcadosMes(mesAno) {
  if (S.escalas.considerarFeriados !== 'sim') return new Set();
  const mm = mesAno ? mesAno.split('/')[0] : null;
  if (!mm) return new Set();
  return new Set(
    [...S.escalas.feriadosMarcados].filter(data => data.split('/')[1] === mm)
  );
}

function isFeriado(dateStr, feriadosMes) {
  const [yyyy, mm, dd] = dateStr.split('-');
  return feriadosMes.has(`${dd}/${mm}`);
}

function calcDiasSemana(dias, feriadosMes) {
  const trabalhados = new Set();
  let feriadosDescontados = 0;
  dias.forEach(d => {
    if (!S.escalas.diasSemana.has(d.getDay())) return;
    const ds = toLocalDateStr(d);
    if (isFeriado(ds, feriadosMes)) { feriadosDescontados++; return; }
    trabalhados.add(ds);
  });
  return { trabalhados, feriadosDescontados };
}

function calcRevezamento(dias, feriadosMes) {
  const [dd, mm, aaaa] = (S.escalas.revInicio || '').split('/');
  if (!dd || !mm || !aaaa) return { trabalhados: new Set(), feriadosDescontados: 0 };
  const inicio = new Date(`${aaaa}-${mm}-${dd}`);
  const ciclo = S.escalas.revTrab + S.escalas.revFolga;
  const trabalhados = new Set();
  let feriadosDescontados = 0;
  dias.forEach(d => {
    const diff = Math.floor((d - inicio) / 86400000);
    const pos  = ((diff % ciclo) + ciclo) % ciclo;
    if (pos >= S.escalas.revTrab) return;
    const ds = toLocalDateStr(d);
    if (isFeriado(ds, feriadosMes)) { feriadosDescontados++; return; }
    trabalhados.add(ds);
  });
  return { trabalhados, feriadosDescontados };
}

function calcManual(feriadosMes) {
  const todosDias = getDiasMes(S.escalas.mesRef);
  const trabalhados = new Set();
  let feriadosDescontados = 0;
  todosDias.forEach(d => {
    const ds = toLocalDateStr(d);
    if (isFeriado(ds, feriadosMes)) { feriadosDescontados++; return; }
    if (S.escalas.diasFolga.has(ds)) return;
    trabalhados.add(ds);
  });
  return { trabalhados, feriadosDescontados };
}

function calcularDiasUteis() {
  const mesRef = S.escalas.mesRef;
  if (!mesRef) return { trabalhados: new Set(), feriadosDescontados: 0 };
  const todosDias   = getDiasMes(mesRef);
  const feriadosMes = getFeriadosMarcadosMes(mesRef);
  if (S.escalas.modo === 'semana')      return calcDiasSemana(todosDias, feriadosMes);
  if (S.escalas.modo === 'revezamento') return calcRevezamento(todosDias, feriadosMes);
  return calcManual(feriadosMes);
}

function renderCalendario(trabalhados, mesRef) {
  const grid = $('calendarGrid');
  grid.innerHTML = '';
  if (!mesRef) { $('calTitulo').textContent = '🗓️ —'; return; }

  const [mm, aaaa] = mesRef.split('/');
  const ano = parseInt(aaaa), mes = parseInt(mm) - 1;
  const feriadosMes = getFeriadosMarcadosMes(mesRef);

  $('calTitulo').textContent = '🗓️ ' +
    new Date(ano, mes).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  ['D','S','T','Q','Q','S','S'].forEach(h => {
    const el = document.createElement('div');
    el.className = 'cal-header'; el.textContent = h;
    grid.appendChild(el);
  });

  const offset = new Date(ano, mes, 1).getDay();
  for (let i = 0; i < offset; i++) {
    const el = document.createElement('div'); el.className = 'cal-day empty'; grid.appendChild(el);
  }

  const totalDias = new Date(ano, mes + 1, 0).getDate();
  for (let d = 1; d <= totalDias; d++) {
    const date   = new Date(ano, mes, d);
    const dateStr = toLocalDateStr(date);
    const ddMm   = `${String(d).padStart(2,'0')}/${mm}`;
    const dow    = date.getDay();
    const eFer   = isFeriado(dateStr, feriadosMes);
    const eTrab  = trabalhados.has(dateStr);

    const el = document.createElement('div');
    el.textContent = d;

    if (S.escalas.modo === 'manual') {
      if (eFer) {
        el.className = 'cal-day holiday';
        const fDesc = S.escalas.feriados.find(f => f.data === ddMm)?.descricao || 'Feriado';
        el.title = escHtml(fDesc);
      } else {
        const eFolga = S.escalas.diasFolga.has(dateStr);
        const base   = eFolga ? (dow === 0 || dow === 6 ? 'weekend' : '') : 'work';
        el.className = `cal-day manual-toggle${base ? ' ' + base : ''}`;
        el.addEventListener('click', () => toggleDiaManual(dateStr));
      }
    } else if (eFer) {
      el.className = 'cal-day holiday';
      const fDesc = S.escalas.feriados.find(f => f.data === ddMm)?.descricao || 'Feriado';
      el.title = escHtml(fDesc);
    } else if (eTrab) {
      el.className = 'cal-day work';
    } else {
      el.className = 'cal-day' + (dow === 0 || dow === 6 ? ' weekend' : '');
    }
    grid.appendChild(el);
  }
}

function toggleDiaManual(dateStr) {
  if (S.escalas.diasFolga.has(dateStr)) S.escalas.diasFolga.delete(dateStr);
  else S.escalas.diasFolga.add(dateStr);
  calcularEAtualizar();
}

function calcularEAtualizar() {
  S.escalas.mesRef = $('escMesRef').value;
  const { trabalhados, feriadosDescontados } = calcularDiasUteis();
  const total = trabalhados.size;

  renderCalendario(trabalhados, S.escalas.mesRef);

  if (S.escalas.mesRef) {
    const [mm, aaaa] = S.escalas.mesRef.split('/');
    const label = new Date(parseInt(aaaa), parseInt(mm) - 1)
      .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    $('resultMes').textContent = label;
    $('resultNum').textContent = total;
    $('resultDetalhe').textContent = feriadosDescontados > 0
      ? `${total + feriadosDescontados} úteis − ${feriadosDescontados} feriado(s)`
      : '';
  } else {
    $('resultMes').textContent = '—';
    $('resultNum').textContent = '—';
    $('resultDetalhe').textContent = '';
  }

  $('btnAplicarEscala').disabled = !S.escalas.mesRef || total === 0;
  $('bannerMesRef').textContent = S.escalas.mesRef || '—';

  const legenda = $('calLegenda');
  if (legenda) {
    legenda.innerHTML = S.escalas.modo === 'manual'
      ? '🟢 Trabalhado &nbsp; ⬜ Folga marcada &nbsp; 🔴 Feriado descontado'
      : '🟢 Trabalhado &nbsp; ⬜ Fim de semana &nbsp; 🔴 Feriado descontado';
  }
}

function aplicarNosLancamentos() {
  const { trabalhados } = calcularDiasUteis();
  const total = trabalhados.size;
  const mesRef = S.escalas.mesRef;
  if (!mesRef || total === 0) { showToast('Calcule primeiro os dias úteis', 'error'); return; }

  $('lancDias').value   = total;
  $('lancMesRef').value = mesRef;
  S.lancamento.mesRef   = mesRef;
  if (typeof atualizarTotaisPadrao === 'function') atualizarTotaisPadrao();
  showScreen('lancamentos');
  showToast(`✅ ${total} dias aplicados nos Lançamentos`);
}

// Busca os funcionários de férias na competência mesRef para a empresa selecionada
function feriasDaEmpresaNaComp() {
  const mesRef = S.lancamento.mesRef;
  if (!mesRef || !Object.keys(S.ferias.empresas).length) return [];

  const m = mesRef.match(/^(\d{2})\/(\d{4})$/);
  if (!m) return [];
  const mes = +m[1], ano = +m[2];

  // Encontra empresa no PDF: nome do Supabase contido no nome do PDF (case-insensitive)
  const nomeEmpSupa = (S.empresas.find(e => e.codigo_empresa === S.lancamento.empresa) || {}).nome_empresa || '';
  const chavesPdf   = Object.keys(S.ferias.empresas);
  const chavePdf    = chavesPdf.find(k =>
    k.toLowerCase().includes(nomeEmpSupa.toLowerCase().slice(0, 15)) ||
    nomeEmpSupa.toLowerCase().includes(k.toLowerCase().slice(0, 15))
  );
  if (!chavePdf) return [];

  const rows = S.ferias.empresas[chavePdf] || [];
  const resultado = [];

  for (const r of rows) {
    // Tenta match por código (cod_folha do Supabase vs código do PDF)
    const codPdf = r.codigo.trim();
    const emp    = S.empregados.find(e => String(e.codigo_empregado).trim() === codPdf);
    if (!emp) continue;

    // Coleta todos os períodos (principal + extras) que caem no mês
    const periodos = [];
    function verificaPeriodo(ini_gozo, dias_str) {
      const ini = feriasParseDate(ini_gozo);
      if (!ini) return;
      const dias = parseFloat((dias_str || '').replace(',', '.'));
      if (!dias || dias <= 0) return;
      const primeiro = new Date(ano, mes - 1, 1);
      const ultimo   = new Date(ano, mes, 0);
      const fim      = new Date(ini);
      fim.setDate(fim.getDate() + Math.floor(dias) - 1);
      if (ini <= ultimo && fim >= primeiro) {
        periodos.push({ ini, fim, dias: Math.floor(dias) });
      }
    }
    verificaPeriodo(r.ini_gozo, r.dias);
    for (const ex of (r.extras || [])) verificaPeriodo(ex.ini_gozo, ex.dias);

    if (periodos.length) resultado.push({ emp, periodos, codPdf });
  }

  return resultado;
}

function fmtData(d) {
  return d ? `${pad(d.getDate(),2)}/${pad(d.getMonth()+1,2)}/${d.getFullYear()}` : '—';
}

function renderBannerFerias() {
  const banner = $('bannerFerias');
  if (!S.lancamento.mesRef || !S.lancamento.empresa) {
    banner.classList.add('hidden');
    banner.style.display = 'none';
    return;
  }

  const lista = feriasDaEmpresaNaComp();

  if (!lista.length) {
    banner.classList.add('hidden');
    banner.style.display = 'none';
    return;
  }

  $('bannerFeriasTitulo').textContent =
    `${lista.length} empregado${lista.length > 1 ? 's' : ''} com férias em ${S.lancamento.mesRef} — verifique os dias lançados`;

  const ul = $('bannerFeriasLista');
  ul.innerHTML = lista.map(({ emp, periodos }) => {
    const periStr = periodos.map(p => `${fmtData(p.ini)} a ${fmtData(p.fim)} (${p.dias} dias)`).join(', ');
    return `<div>• <strong>${escHtml(emp.nome_empregado)}</strong> — ${escHtml(periStr)}</div>`;
  }).join('');

  banner.classList.remove('hidden');
  banner.style.display = 'flex';
}

function renderBannerObs() {
  const banner = $('bannerObsEmpresa');
  const texto  = S.lancamento.obsEmpresa.trim();
  if (texto) {
    $('bannerObsTexto').textContent = texto;
    banner.classList.remove('hidden');
    banner.style.display = 'flex';
  } else {
    banner.classList.add('hidden');
    banner.style.display = 'none';
  }
}

function setupLancamentosListeners() {
  $('lancEmpresa').addEventListener('change', async () => {
    const emp = $('lancEmpresa').value;
    S.lancamento.empresa  = emp;
    S.lancamento.compPgto = '';
    S.lancamento.linhas   = [];
    $('lancCompPgto').value         = '';
    $('bannerCompPgto').textContent = '—';
    await Promise.all([loadConfig(emp), loadEmpregados(emp), loadIndividuais(emp)]);
    S.lancamento.filtroEmps.clear();
    renderFiltroPainel();
    preencherConfigNaLancamentos();
    await tryLoadLancamento();
    if (!S.lancamento.linhas.length) buildGrade();
    await loadObs(emp);
    renderBannerObs();
    renderBannerFerias();
    renderGrade();
  });

  $('lancCompPgto').addEventListener('change', async () => {
    S.lancamento.compPgto = $('lancCompPgto').value;
    $('bannerCompPgto').textContent = S.lancamento.compPgto || '—';
    await tryLoadLancamento();
    if (!S.lancamento.linhas.length && S.empregados.length) buildGrade();
    renderGrade();
  });

  $('lancMesRef').addEventListener('change', () => {
    S.lancamento.mesRef = $('lancMesRef').value;
    $('bannerMesRef').textContent = S.lancamento.mesRef || '—';
    renderBannerFerias();
    renderGrade();
  });

  ['lancVtDia', 'lancVaDia', 'lancDias'].forEach(id => {
    $(id).addEventListener('input', atualizarTotaisPadrao);
  });

  $('btnAplicarPadrao').addEventListener('click', aplicarPadraoATodos);
  $('btnSalvar').addEventListener('click', salvarLancamento);
  $('btnGerarTxt').addEventListener('click', () => {
    if (typeof gerarTxt === 'function') gerarTxt();
    else showToast('TXT não disponível ainda', 'error');
  });

  $('btnImportarExcel').addEventListener('click', () => $('inputExcel').click());
  $('inputExcel').addEventListener('change', e => {
    if (e.target.files[0]) {
      if (typeof importarExcel === 'function') importarExcel(e.target.files[0]);
      else showToast('Importação não disponível ainda', 'error');
    }
    e.target.value = '';
  });

  setupFiltroPainel();
}

function preencherConfigNaLancamentos() {
  if (!S.config) return;
  $('lancVtDia').value = S.config.vt.valorDia || '';
  $('lancVaDia').value = S.config.va.valorDia || '';
  atualizarTotaisPadrao();
}

function atualizarTotaisPadrao() {
  const vt   = parseDecimal($('lancVtDia').value);
  const va   = parseDecimal($('lancVaDia').value);
  const dias = parseInt($('lancDias').value) || 0;
  $('lancTotalVt').value = dias > 0 ? `R$ ${fmtMoeda(vt * dias)}` : '';
  $('lancTotalVa').value = dias > 0 ? `R$ ${fmtMoeda(va * dias)}` : '';
}

async function tryLoadLancamento() {
  const emp  = S.lancamento.empresa;
  const comp = S.lancamento.compPgto;
  if (!emp || !comp) return;

  const { data, error } = await S.sb
    .from('rh_beneficios_lancamentos')
    .select('*')
    .eq('codigo_empresa', emp)
    .eq('competencia_pagamento', comp)
    .maybeSingle();

  if (error) return;

  if (data) {
    S.lancamento.mesRef   = data.mes_referencia || '';
    S.lancamento.tipoProc = data.tipo_processo  || '11';
    S.lancamento.linhas   = data.linhas_json    || [];
    $('lancMesRef').value   = S.lancamento.mesRef;
    $('lancTipoProc').value = S.lancamento.tipoProc;
    $('bannerMesRef').textContent = S.lancamento.mesRef || '—';
    showToast('Lançamento anterior carregado', 'info');
  } else {
    S.lancamento.linhas = [];
  }
}

function buildGrade() {
  const vtPad = parseDecimal($('lancVtDia').value) || (S.config?.vt.valorDia || 0);
  const vaPad = parseDecimal($('lancVaDia').value) || (S.config?.va.valorDia || 0);
  const dias  = parseInt($('lancDias').value) || 0;

  S.lancamento.linhas = empregadosFiltrados().map(emp => {
    const ind   = S.individuais[emp.codigo_empregado] || {};
    const vtDia = ind.vt_dia != null ? ind.vt_dia : vtPad;
    const vaDia = ind.va_dia != null ? ind.va_dia : vaPad;
    const status = ind.vt_dia != null || ind.va_dia != null ? 'individual' : 'padrao';
    return {
      cod_emp:  emp.codigo_empregado,
      nome:     emp.nome_empregado,
      vt_dia:   vtDia,
      va_dia:   vaDia,
      dias,
      total_vt: vtDia * dias,
      total_va: vaDia * dias,
      status
    };
  });
}

function calcTotaisLinha(linha) {
  linha.total_vt = parseDecimal(linha.vt_dia) * (parseInt(linha.dias) || 0);
  linha.total_va = parseDecimal(linha.va_dia) * (parseInt(linha.dias) || 0);
}

function renderGrade() {
  const tbody = $('gradeTbody');
  tbody.innerHTML = '';
  if (!S.lancamento.linhas.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#7f8c8d;padding:16px">Selecione empresa e competência</td></tr>';
    return;
  }

  // Mapa de empregados de férias no mês: codEmp -> periodos[]
  const feriasMap = {};
  for (const { emp, periodos } of feriasDaEmpresaNaComp()) {
    feriasMap[String(emp.codigo_empregado).trim()] = periodos;
  }

  S.lancamento.linhas.forEach((linha, idx) => {
    const badgeClass = { padrao: 'badge-ok', individual: 'badge-ind', divergente: 'badge-warn' }[linha.status] || 'badge-ok';
    const badgeLabel = { padrao: 'Padrão', individual: 'Individual', divergente: 'Divergente' }[linha.status] || 'Padrão';

    const periodos    = feriasMap[String(linha.cod_emp).trim()];
    const deFerias    = !!periodos;
    const periStr     = deFerias
      ? periodos.map(p => `${fmtData(p.ini)}→${fmtData(p.fim)} (${p.dias}d)`).join(' | ')
      : '';

    const tr = document.createElement('tr');
    if (deFerias) tr.style.background = '#eff6ff';
    tr.innerHTML = `
      <td>${escHtml(linha.cod_emp)}</td>
      <td>
        ${escHtml(linha.nome)}
        ${deFerias ? `<div class="grade-ferias-tag">🏖️ Férias: ${escHtml(periStr)}</div>` : ''}
      </td>
      <td><input type="number" step="0.01" min="0" class="grade-vt" data-idx="${idx}" value="${linha.vt_dia}"></td>
      <td><input type="number" step="0.01" min="0" class="grade-va" data-idx="${idx}" value="${linha.va_dia}"></td>
      <td><input type="number" min="0" max="31" class="grade-dias" data-idx="${idx}" value="${linha.dias}"></td>
      <td class="cell-calc">R$ ${fmtMoeda(linha.total_vt)}</td>
      <td class="cell-calc">R$ ${fmtMoeda(linha.total_va)}</td>
      <td><span class="badge ${badgeClass}">${badgeLabel}</span>${deFerias ? ' <span class="badge badge-ferias">🏖️</span>' : ''}</td>
      <td></td>`;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.grade-vt').forEach(inp => {
    inp.addEventListener('change', () => onGradeChange(parseInt(inp.dataset.idx), 'vt', parseDecimal(inp.value)));
  });
  tbody.querySelectorAll('.grade-va').forEach(inp => {
    inp.addEventListener('change', () => onGradeChange(parseInt(inp.dataset.idx), 'va', parseDecimal(inp.value)));
  });
  tbody.querySelectorAll('.grade-dias').forEach(inp => {
    inp.addEventListener('change', () => {
      const idx = parseInt(inp.dataset.idx);
      S.lancamento.linhas[idx].dias = parseInt(inp.value) || 0;
      calcTotaisLinha(S.lancamento.linhas[idx]);
      renderGrade();
    });
  });
}

function onGradeChange(idx, tipo, novoValor) {
  const linha    = S.lancamento.linhas[idx];
  const ind      = S.individuais[linha.cod_emp] || {};
  const configVal = tipo === 'vt'
    ? (ind.vt_dia != null ? ind.vt_dia : (S.config?.vt.valorDia || 0))
    : (ind.va_dia != null ? ind.va_dia : (S.config?.va.valorDia || 0));

  if (Math.abs(novoValor - configVal) > 0.001) {
    mostrarModalDivergencia(linha, tipo, novoValor, configVal, confirmado => {
      if (confirmado) {
        if (tipo === 'vt') linha.vt_dia = novoValor; else linha.va_dia = novoValor;
        linha.status = 'divergente';
        calcTotaisLinha(linha);
      }
      renderGrade();
    });
  } else {
    if (tipo === 'vt') linha.vt_dia = novoValor; else linha.va_dia = novoValor;
    const ind2 = S.individuais[linha.cod_emp] || {};
    linha.status = ind2.vt_dia != null || ind2.va_dia != null ? 'individual' : 'padrao';
    calcTotaisLinha(linha);
    renderGrade();
  }
}

function mostrarModalDivergencia(linha, tipo, novoValor, configVal, callback) {
  const tipoLabel = tipo === 'vt' ? 'Vale Transporte' : 'Vale Alimentação';
  $('modalDivergenciaMsg').innerHTML =
    `O valor de <strong>${escHtml(tipoLabel)}</strong> para <strong>${escHtml(linha.nome)}</strong>:<br><br>
     Novo valor: <strong>R$ ${fmtMoeda(novoValor)}</strong><br>
     Valor configurado: <strong>R$ ${fmtMoeda(configVal)}</strong><br><br>
     Deseja confirmar a divergência?`;

  $('modalDivergencia').classList.remove('hidden');

  function cleanup() {
    $('modalDivergencia').classList.add('hidden');
    $('btnDivConfirmar').removeEventListener('click', onConfirmar);
    $('btnDivCancelar').removeEventListener('click',  onCancelar);
  }
  function onConfirmar() { cleanup(); callback(true);  }
  function onCancelar()  { cleanup(); callback(false); }

  $('btnDivConfirmar').addEventListener('click', onConfirmar);
  $('btnDivCancelar').addEventListener('click',  onCancelar);
}

function aplicarPadraoATodos() {
  const vtPad = parseDecimal($('lancVtDia').value);
  const vaPad = parseDecimal($('lancVaDia').value);
  const dias  = parseInt($('lancDias').value) || 0;

  S.lancamento.linhas.forEach(linha => {
    const ind    = S.individuais[linha.cod_emp] || {};
    linha.vt_dia = ind.vt_dia != null ? ind.vt_dia : vtPad;
    linha.va_dia = ind.va_dia != null ? ind.va_dia : vaPad;
    linha.dias   = dias;
    calcTotaisLinha(linha);
    linha.status = ind.vt_dia != null || ind.va_dia != null ? 'individual' : 'padrao';
  });
  renderGrade();
  showToast('✅ Padrão aplicado a todos');
}

async function salvarLancamento() {
  const emp  = S.lancamento.empresa;
  const comp = S.lancamento.compPgto;
  if (!emp || !comp) { showToast('Selecione empresa e competência', 'error'); return; }
  if (!S.lancamento.linhas.length) { showToast('Grade vazia', 'error'); return; }

  const payload = {
    codigo_empresa:        emp,
    competencia_pagamento: comp,
    mes_referencia:        S.lancamento.mesRef || null,
    tipo_processo:         $('lancTipoProc').value,
    linhas_json:           S.lancamento.linhas,
    usuario_id:            S.auth?.authUserId || null,
    atualizado_em:         new Date().toISOString()
  };

  const { error } = await S.sb
    .from('rh_beneficios_lancamentos')
    .upsert(payload, { onConflict: 'codigo_empresa,competencia_pagamento' });

  if (error) { showToast('Erro ao salvar: ' + error.message, 'error'); return; }
  showToast('✅ Lançamento salvo!');
}

// ============================================================
// EXCEL IMPORT
// ============================================================

function importarExcel(file) {
  if (!S.lancamento.linhas.length) {
    showToast('Carregue a grade antes de importar', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = async e => {
    const workbook = XLSX.read(e.target.result, { type: 'array' });
    const sheet    = workbook.Sheets[workbook.SheetNames[0]];
    const rows     = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    const linhasMap = {};
    S.lancamento.linhas.forEach(l => { linhasMap[String(l.cod_emp)] = l; });

    const pendentes = [];
    let processados = 0;

    for (const row of rows) {
      const codEmp = String(row[1] ?? '').trim();
      if (!codEmp || codEmp.toLowerCase() === 'cod' || codEmp.toLowerCase() === 'código') continue;

      const vtNovo   = parseDecimal(row[2]);
      const vaNovo   = parseDecimal(row[3]);
      const diasNovo = parseInt(row[4]) || 0;

      const linha = linhasMap[codEmp];
      if (!linha) continue;

      const ind      = S.individuais[codEmp] || {};
      const vtConfig = ind.vt_dia != null ? ind.vt_dia : (S.config?.vt.valorDia || 0);
      const vaConfig = ind.va_dia != null ? ind.va_dia : (S.config?.va.valorDia || 0);

      const divergeVt = Math.abs(vtNovo - vtConfig) > 0.001;
      const divergeVa = Math.abs(vaNovo - vaConfig) > 0.001;

      if (divergeVt || divergeVa) {
        pendentes.push({ linha, vtNovo, vaNovo, diasNovo, vtConfig, vaConfig, divergeVt, divergeVa });
      } else {
        linha.vt_dia = vtNovo;
        linha.va_dia = vaNovo;
        linha.dias   = diasNovo;
        calcTotaisLinha(linha);
        linha.status = ind.vt_dia != null || ind.va_dia != null ? 'individual' : 'padrao';
        processados++;
      }
    }

    for (const p of pendentes) {
      const partes = [];
      if (p.divergeVt) partes.push(`VT: R$ ${fmtMoeda(p.vtNovo)} (configurado: R$ ${fmtMoeda(p.vtConfig)})`);
      if (p.divergeVa) partes.push(`VA: R$ ${fmtMoeda(p.vaNovo)} (configurado: R$ ${fmtMoeda(p.vaConfig)})`);

      await new Promise(resolve => {
        $('modalDivergenciaMsg').innerHTML =
          `Importação de <strong>${escHtml(p.linha.nome)}</strong> com divergência:<br><br>` +
          partes.join('<br>') +
          `<br><br>Confirmar os valores importados?`;

        $('modalDivergencia').classList.remove('hidden');

        function cleanup() {
          $('modalDivergencia').classList.add('hidden');
          $('btnDivConfirmar').removeEventListener('click', onConfirmar);
          $('btnDivCancelar').removeEventListener('click',  onCancelar);
        }
        function onConfirmar() {
          p.linha.vt_dia = p.vtNovo;
          p.linha.va_dia = p.vaNovo;
          p.linha.dias   = p.diasNovo;
          calcTotaisLinha(p.linha);
          p.linha.status = 'divergente';
          processados++;
          cleanup();
          resolve();
        }
        function onCancelar() { cleanup(); resolve(); }

        $('btnDivConfirmar').addEventListener('click', onConfirmar);
        $('btnDivCancelar').addEventListener('click',  onCancelar);
      });
    }

    renderGrade();
    showToast(`✅ Excel importado — ${processados} linha(s) aplicada(s)`);
  };
  reader.readAsArrayBuffer(file);
}

// ============================================================
// TXT GENERATION
// ============================================================

function gerarTxt() {
  const empresa  = S.lancamento.empresa;
  const compPgto = S.lancamento.compPgto;
  const tipoProc = $('lancTipoProc').value;

  if (!empresa || !compPgto) {
    showToast('Selecione empresa e competência', 'error');
    return;
  }
  if (!S.config?.vt.rubrica || !S.config?.va.rubrica) {
    showToast('Configure as rubricas de VT e VA em Configurações', 'error');
    return;
  }
  if (!S.lancamento.linhas.length) {
    showToast('Grade vazia', 'error');
    return;
  }

  const aaaamm    = compToAaaamm(compPgto);
  if (!aaaamm) { showToast('Formato de competência inválido (use MM/AAAA)', 'error'); return; }
  const codEmpPad = pad(empresa, 10);
  const rubVt     = pad(S.config.vt.rubrica, 9);
  const rubVa     = pad(S.config.va.rubrica, 9);
  const tpPad     = pad(tipoProc, 2);
  const linhas    = [];

  S.lancamento.linhas.forEach(linha => {
    const codFolhaPad = pad(linha.cod_emp, 10);
    const dias        = parseInt(linha.dias) || 0;

    const vtCentavos = Math.round(parseDecimal(linha.vt_dia) * dias * 100);
    const vaCentavos = Math.round(parseDecimal(linha.va_dia) * dias * 100);

    if (vtCentavos > 0) {
      linhas.push(`10${codFolhaPad}${aaaamm}${rubVt}${tpPad}${pad(vtCentavos, 9)}${codEmpPad}`);
    }
    if (vaCentavos > 0) {
      linhas.push(`10${codFolhaPad}${aaaamm}${rubVa}${tpPad}${pad(vaCentavos, 9)}${codEmpPad}`);
    }
  });

  if (!linhas.length) {
    showToast('Nenhum lançamento com valor > 0', 'error');
    return;
  }

  const conteudo    = linhas.join('\n') + '\n';
  const [mm, aaaa]  = compPgto.split('/');
  const nomeArquivo = `Beneficios_${empresa}_${mm}-${aaaa}.txt`;

  $('previaTxtInfo').textContent = `${nomeArquivo} · ${linhas.length} linha(s)`;
  $('previaTxtConteudo').textContent = conteudo;
  $('modalPreviaTxt').classList.remove('hidden');

  $('btnPreviaCancelar').onclick = () => $('modalPreviaTxt').classList.add('hidden');

  $('btnPreviaDownload').onclick = () => {
    const blob = new Blob([conteudo], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = nomeArquivo;
    a.click();
    URL.revokeObjectURL(a.href);
    $('modalPreviaTxt').classList.add('hidden');
    showToast(`✅ ${nomeArquivo} gerado com ${linhas.length} linha(s)`);
  };
}

// ============================================================
// FÉRIAS — Programação de Férias
// ============================================================

// Bandas de colunas X (calibradas pelo relatório SCONT)
const FERIAS_COLS = [
  { key: 'codigo',      x0: 0,   x1: 37  },
  { key: 'empregado',   x0: 37,  x1: 200 },
  { key: 'admissao',    x0: 200, x1: 252 },
  { key: 'vencto',      x0: 252, x1: 303 },
  { key: 'fer_venc',    x0: 303, x1: 319 },
  { key: 'fer_pro',     x0: 319, x1: 355 },
  { key: 'ini_aquis',   x0: 355, x1: 415 },
  { key: 'fim_aquis',   x0: 415, x1: 472 },
  { key: 'ini_gozo',    x0: 472, x1: 525 },
  { key: 'dias',        x0: 525, x1: 553 },
  { key: 'dir',         x0: 606, x1: 628 },
  { key: 'goz',         x0: 628, x1: 657 },
  { key: 'rest',        x0: 657, x1: 676 },
  { key: 'limite_gozo', x0: 676, x1: 729 },
];

const FERIAS_SKIP = /CNPJ:|Data base:|PROGRAMA|Empregado|admiss|Observa|Sistema|Total de|C.digo|P.gina|Emiss|Horas|Vencto|In.cio|Limite|Dias\b|Abono|aquisitivo|gozo|afast|faltas|dir\.|goz\.|rest\.|pro\.|venc\.|Fer\.|^Fim$|13/i;

function feriasColText(words, x0, x1) {
  return words
    .filter(w => w.x >= x0 && w.x < x1)
    .map(w => w.t)
    .join(' ')
    .trim();
}

function feriasParseDate(s) {
  s = (s || '').trim();
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  const d = new Date(+m[3], +m[2] - 1, +m[1]);
  return isNaN(d) ? null : d;
}

function feriasDentroDoMes(row, ano, mes) {
  const primeiro = new Date(ano, mes - 1, 1);
  const ultimo   = new Date(ano, mes, 0);

  function verifica(ini_gozo, dias_str) {
    const ini = feriasParseDate(ini_gozo);
    if (!ini) return false;
    const dias = parseFloat((dias_str || '').replace(',', '.'));
    if (!dias || dias <= 0) return false;
    const fim = new Date(ini);
    fim.setDate(fim.getDate() + Math.floor(dias) - 1);
    return ini <= ultimo && fim >= primeiro;
  }

  if (verifica(row.ini_gozo, row.dias)) return true;
  for (const ex of (row.extras || [])) {
    if (verifica(ex.ini_gozo, ex.dias)) return true;
  }
  return false;
}

async function parsePdfFerias(file) {
  // Configura worker do pdf.js
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const empresas = {};
  let empresaAtual = null;

  for (let p = 1; p <= pdf.numPages; p++) {
    const page    = await pdf.getPage(p);
    const content = await page.getTextContent();
    const vp      = page.getViewport({ scale: 1 });

    // Extrai palavras com coordenadas X (pdf.js usa sistema Y invertido)
    const words = content.items.map(item => ({
      t:   item.str,
      x:   item.transform[4],
      y:   Math.round(vp.height - item.transform[5]),
    })).filter(w => w.t.trim());

    // Agrupa por linha (y arredondado)
    const linesMap = {};
    for (const w of words) {
      const y = Math.round(w.y / 2) * 2; // tolerance 2px
      (linesMap[y] = linesMap[y] || []).push(w);
    }

    for (const y of Object.keys(linesMap).map(Number).sort((a, b) => a - b)) {
      const rw       = linesMap[y];
      const fullText = rw.map(w => w.t).join(' ');

      // Detecta nome da empresa: linha que tem "Página:" mas não é cabeçalho de coluna
      if (/P.gina:/i.test(fullText) && !/PROGRAMA|admiss/i.test(fullText)) {
        const nome = rw
          .filter(w => w.x < 600)
          .map(w => w.t)
          .join(' ')
          .replace(/[^\x20-\x7EÀ-ɏ]/g, '')
          .trim();
        empresaAtual = nome || 'EMPRESA DESCONHECIDA';
        if (!empresas[empresaAtual]) empresas[empresaAtual] = [];
        continue;
      }

      if (FERIAS_SKIP.test(fullText)) continue;
      if (!empresaAtual) continue;

      const r = {};
      for (const col of FERIAS_COLS) {
        r[col.key] = feriasColText(rw, col.x0, col.x1);
      }

      // Linha secundária (período extra): sem código nem nome, mas com período aquisitivo
      if (!r.codigo && !r.empregado && r.ini_aquis) {
        const list = empresas[empresaAtual];
        if (list.length) {
          list[list.length - 1].extras = list[list.length - 1].extras || [];
          list[list.length - 1].extras.push(r);
        }
        continue;
      }

      if (!r.empregado && !r.codigo) continue;

      r.extras = [];
      empresas[empresaAtual].push(r);
    }
  }

  return empresas;
}

function feriasRenderResultados() {
  const { empresas, filtroEmpresa, filtroMes, filtroAno, omitirVazias } = S.ferias;
  const container = $('feriaResultados');
  const comComp   = filtroMes && filtroAno;

  let html = '';

  for (const [nome, rows] of Object.entries(empresas)) {
    if (filtroEmpresa && !nome.toLowerCase().includes(filtroEmpresa.toLowerCase())) continue;

    const temFerias = comComp && rows.some(r => feriasDentroDoMes(r, filtroAno, filtroMes));
    if (omitirVazias && comComp && !temFerias) continue;
    if (omitirVazias && !rows.length) continue;

    const totalFerias = comComp ? rows.filter(r => feriasDentroDoMes(r, filtroAno, filtroMes)).length : 0;

    html += `<div class="card feria-empresa-card">
      <div class="feria-empresa-header">
        <h3 class="card-title" style="margin:0">${escHtml(nome)}</h3>
        <div class="feria-empresa-stats">
          <span class="feria-stat">${rows.length} funcionário${rows.length !== 1 ? 's' : ''}</span>
          ${comComp ? `<span class="feria-stat-ferias ${totalFerias > 0 ? 'has-ferias' : ''}">${totalFerias} de férias em ${pad(filtroMes,2)}/${filtroAno}</span>` : ''}
        </div>
      </div>`;

    if (!rows.length) {
      html += `<p class="hint-text">Nenhum funcionário cadastrado.</p>`;
    } else {
      html += `<div class="table-wrapper"><table class="data-table feria-table">
        <thead><tr>
          <th>Cód</th><th>Empregado</th><th>Admissão</th><th>Ini Gozo</th><th>Dias</th><th>Limite Gozo</th>
          ${comComp ? `<th class="feria-col-status">Férias ${pad(filtroMes,2)}/${filtroAno}</th>` : ''}
        </tr></thead>
        <tbody>`;

      for (const r of rows) {
        const deFerias = comComp && feriasDentroDoMes(r, filtroAno, filtroMes);
        const trClass  = deFerias ? ' class="feria-row-sim"' : '';
        const badge    = comComp
          ? `<td class="feria-col-status">${deFerias
              ? '<span class="badge feria-badge-sim">SIM</span>'
              : '<span class="badge feria-badge-nao">não</span>'}</td>`
          : '';

        const iniGozo = r.ini_gozo && !r.ini_gozo.includes('....') ? escHtml(r.ini_gozo) : '—';
        const limite  = r.limite_gozo && !r.limite_gozo.includes('....') ? escHtml(r.limite_gozo) : '—';

        html += `<tr${trClass}>
          <td>${escHtml(r.codigo)}</td>
          <td>${escHtml(r.empregado)}</td>
          <td>${escHtml(r.admissao || '—')}</td>
          <td>${iniGozo}</td>
          <td>${escHtml(r.dias || '—')}</td>
          <td>${limite}</td>
          ${badge}
        </tr>`;

        for (const ex of (r.extras || [])) {
          const exDeFerias = comComp && feriasDentroDoMes({ ini_gozo: ex.ini_gozo, dias: ex.dias, extras: [] }, filtroAno, filtroMes);
          const exBadge    = comComp
            ? `<td class="feria-col-status">${exDeFerias
                ? '<span class="badge feria-badge-sim">SIM</span>'
                : '<span class="badge feria-badge-nao">não</span>'}</td>`
            : '';
          const exIni  = ex.ini_gozo && !ex.ini_gozo.includes('....') ? escHtml(ex.ini_gozo) : '—';
          const exLim  = ex.limite_gozo && !ex.limite_gozo.includes('....') ? escHtml(ex.limite_gozo) : '—';
          html += `<tr class="feria-row-extra${exDeFerias ? ' feria-row-sim' : ''}">
            <td colspan="2" style="padding-left:28px;color:#666;font-size:12px">↳ período adicional</td>
            <td></td>
            <td>${exIni}</td>
            <td>${escHtml(ex.dias || '—')}</td>
            <td>${exLim}</td>
            ${exBadge}
          </tr>`;
        }
      }

      html += `</tbody></table></div>`;
    }

    html += `</div>`;
  }

  container.innerHTML = html || '<p class="hint-text" style="padding:16px">Nenhum resultado para os filtros selecionados.</p>';
}

function feriasAtualizarFiltroEmpresas() {
  const sel = $('feriaFiltroEmpresa');
  const val = sel.value;
  sel.innerHTML = '<option value="">Todas as empresas</option>';
  for (const nome of Object.keys(S.ferias.empresas)) {
    const opt = document.createElement('option');
    opt.value = nome;
    opt.textContent = nome;
    if (nome === val) opt.selected = true;
    sel.appendChild(opt);
  }
}

function feriasMascaraComp(input) {
  input.addEventListener('input', () => {
    let v = input.value.replace(/\D/g, '');
    if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2, 6);
    input.value = v;
  });
}

async function carregarFeriasSupabase() {
  const { data, error } = await S.sb
    .from('rh_beneficios_ferias')
    .select('empresa, funcionarios_json, atualizado_em')
    .order('empresa');
  if (error) { console.warn('Férias: erro ao carregar do Supabase', error); return; }
  if (!data || !data.length) return;

  const empresas = {};
  let atualizado_em = null;
  for (const row of data) {
    empresas[row.empresa] = row.funcionarios_json || [];
    if (!atualizado_em || row.atualizado_em > atualizado_em) atualizado_em = row.atualizado_em;
  }
  S.ferias.empresas    = empresas;
  S.ferias.atualizadoEm = atualizado_em;

  feriasRenderStatusCarregado();
}

async function salvarFeriasSupabase(empresas, atualizado_em) {
  const ts = atualizado_em || new Date().toISOString();

  // 1. Apaga tudo
  const { error: delErr } = await S.sb
    .from('rh_beneficios_ferias')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (delErr) { showToast('Erro ao limpar férias: ' + delErr.message, 'error'); return false; }

  // 2. Insere uma linha por empresa
  const rows = Object.entries(empresas).map(([empresa, funcs]) => ({
    empresa,
    funcionarios_json: funcs,
    atualizado_em:     ts
  }));

  if (!rows.length) return true;

  const { error: insErr } = await S.sb
    .from('rh_beneficios_ferias')
    .insert(rows);

  if (insErr) { showToast('Erro ao salvar férias: ' + insErr.message, 'error'); return false; }
  return true;
}

function feriasRenderStatusCarregado() {
  const temDados      = Object.keys(S.ferias.empresas).length > 0;
  const totalEmpresas = Object.keys(S.ferias.empresas).length;
  const totalFuncs    = Object.values(S.ferias.empresas).reduce((s, r) => s + r.length, 0);

  // Painel de status (dados existem)
  $('feriaStatusCarregado').classList.toggle('hidden', !temDados);
  // Drop zone inicial (sem dados)
  $('feriaDropZone').style.display        = temDados ? 'none' : '';
  // Zone de novo upload (esconde sempre ao renderizar status)
  $('feriaNovoUploadZone').classList.add('hidden');

  if (temDados) {
    $('feriaStatusStats').textContent = `${totalEmpresas} empresa${totalEmpresas !== 1 ? 's' : ''} · ${totalFuncs} funcionário${totalFuncs !== 1 ? 's' : ''}`;

    if (S.ferias.atualizadoEm) {
      const d = new Date(S.ferias.atualizadoEm);
      const fmt = d.toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
      $('feriaStatusData').textContent = `Importado em ${fmt}`;
    } else {
      $('feriaStatusData').textContent = '';
    }

    $('feriaFiltrosCard').style.display = '';
    feriasAtualizarFiltroEmpresas();
    feriasRenderResultados();
  } else {
    $('feriaFiltrosCard').style.display = 'none';
    $('feriaResultados').innerHTML = '';
  }
}

function setupFeriasListeners() {
  // ── Drop zone inicial (sem dados) ──
  function bindDropZone(zone, input) {
    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) feriaCarregarPdf(file);
    });
    input.addEventListener('change', () => {
      if (input.files[0]) feriaCarregarPdf(input.files[0]);
      input.value = '';
    });
  }

  bindDropZone($('feriaDropZone'),  $('feriaInputPdf'));
  bindDropZone($('feriaDropZone2'), $('feriaInputPdf2'));

  // ── Novo upload (quando já há dados) ──
  $('feriaBtnNovoUpload').addEventListener('click', () => {
    $('feriaNovoUploadZone').classList.remove('hidden');
    $('feriaStatusCarregado').classList.add('hidden');
  });

  $('feriaBtnCancelarUpload').addEventListener('click', () => {
    $('feriaNovoUploadZone').classList.add('hidden');
    $('feriaStatusCarregado').classList.remove('hidden');
  });

  // ── Remover dados ──
  $('feriaBtnLimpar').addEventListener('click', async () => {
    if (!confirm('Remover todos os dados de férias do servidor?')) return;
    await S.sb.from('rh_beneficios_ferias').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    S.ferias.empresas     = {};
    S.ferias.atualizadoEm = null;
    feriasRenderStatusCarregado();
    renderBannerFerias();
    renderGrade();
    showToast('Programação de férias removida', 'info');
  });

  // ── Filtros ──
  $('feriaFiltroEmpresa').addEventListener('change', () => {
    S.ferias.filtroEmpresa = $('feriaFiltroEmpresa').value;
    feriasRenderResultados();
  });

  const inputComp = $('feriaFiltroComp');
  feriasMascaraComp(inputComp);
  inputComp.addEventListener('input', () => {
    const val = inputComp.value;
    const m   = val.match(/^(\d{2})\/(\d{4})$/);
    S.ferias.filtroMes = m ? +m[1] : null;
    S.ferias.filtroAno = m ? +m[2] : null;
    feriasRenderResultados();
  });

  $('feriaOmitirVazias').addEventListener('change', e => {
    S.ferias.omitirVazias = e.target.checked;
    feriasRenderResultados();
  });
}

async function feriaCarregarPdf(file) {
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    showToast('Selecione um arquivo PDF', 'error');
    return;
  }

  $('feriaProgressBar').classList.remove('hidden');
  $('feriaProgressFill').style.width = '10%';

  try {
    $('feriaProgressFill').style.width = '30%';
    const empresas = await parsePdfFerias(file);
    $('feriaProgressFill').style.width = '70%';

    const agora = new Date().toISOString();
    const ok    = await salvarFeriasSupabase(empresas, agora);
    $('feriaProgressFill').style.width = '100%';
    if (!ok) { $('feriaProgressBar').classList.add('hidden'); return; }

    S.ferias.empresas     = empresas;
    S.ferias.atualizadoEm = agora;

    setTimeout(() => {
      $('feriaProgressBar').classList.add('hidden');
      feriasRenderStatusCarregado();
    }, 400);

    const totalEmpresas = Object.keys(empresas).length;
    const totalFuncs    = Object.values(empresas).reduce((s, r) => s + r.length, 0);
    showToast(`✅ PDF importado e salvo: ${totalEmpresas} empresa(s), ${totalFuncs} funcionário(s)`);

    if (S.lancamento.empresa && S.lancamento.mesRef) {
      renderBannerFerias();
      renderGrade();
    }
  } catch (e) {
    console.error(e);
    showToast('Erro ao processar o PDF', 'error');
    $('feriaProgressBar').classList.add('hidden');
  }
}
