/* ============================================================
   CALENDÁRIO DA FOLHA — app.js
   Cronograma e controle das atividades da folha de pagamento
   Reusa: rh_empresas (empresas) e rh_feriados (dias úteis)
   ============================================================ */

let sb = null;
let usuario = null;

// estado
let hoje = new Date();
let mesAtual = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
let viewAtual = 'mes';

// dados
let empresas = [];          // [{codigo_empresa, nome_empresa}]
let feriados = [];          // [{data:'DD/MM' | 'DD/MM/AAAA', descricao}]
let templates = [];         // cronograma recorrente
let eventos = [];           // eventos carregados da janela do mês
let atrasados = [];         // pendências vencidas (qualquer data)

let eventoEditando = null;
let templateEditando = null;
let observacoesEditando = [];   // observações por empresa do evento aberto no modal
let checklistEditando = [];     // itens de checklist do evento aberto no modal

const TIPOS = {
  fechamento: { label: 'Fechamento',  emoji: '🔒', cor: '#8B3A3A' },
  pagamento:  { label: 'Pagamento',   emoji: '💰', cor: '#1E8449' },
  obrigacao:  { label: 'Obrigação',   emoji: '🏛️', cor: '#6D28D9' },
  envio:      { label: 'Envio/Recebimento', emoji: '📤', cor: '#2563EB' },
  ferias:     { label: 'Férias',      emoji: '🏖️', cor: '#0D9488' },
  decimo:     { label: '13º Salário', emoji: '🎁', cor: '#DB2777' },
  alerta:     { label: 'Alerta',      emoji: '⚠️', cor: '#EA580C' },
  observacao: { label: 'Observação',  emoji: '📝', cor: '#64748B' },
  outro:      { label: 'Outro',       emoji: '📌', cor: '#475569' }
};

const PRIORIDADES = {
  critico: '🔴 Crítico', urgente: '🟠 Urgente', atencao: '🟡 Atenção', info: '🔵 Informativo'
};

const STATUS_LABEL = {
  pendente: 'Pendente', em_andamento: 'Em andamento', concluido: 'Concluído'
};

/* ─────────────────────────── Init ─────────────────────────── */

async function initApp(auth) {
  usuario = auth;
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  popularSelectTipos();
  await Promise.all([carregarEmpresas(), carregarFeriados(), carregarTemplates()]);
  popularSelectEmpresas();
  await recarregar();
}

function popularSelectTipos() {
  const opts = Object.entries(TIPOS)
    .map(([k, t]) => `<option value="${k}">${t.emoji} ${t.label}</option>`).join('');
  document.getElementById('evTipo').innerHTML = opts;
  document.getElementById('tpTipo').innerHTML = opts;

  const filtro = document.getElementById('filtroTipo');
  filtro.innerHTML = '<option value="">Todos os tipos</option>' + opts;

  document.getElementById('calLegend').innerHTML = Object.entries(TIPOS)
    .map(([k, t]) => `<span><i class="tipo-${k}"></i>${t.label}</span>`).join('');
}

async function carregarEmpresas() {
  const { data, error } = await sb.from('rh_empresas')
    .select('codigo_empresa, nome_empresa')
    .order('nome_empresa');
  if (error) { toast('Erro ao carregar empresas: ' + error.message, 'error'); return; }
  empresas = data || [];
}

function popularSelectEmpresas() {
  const opts = empresas
    .map(e => `<option value="${esc(e.codigo_empresa)}">${esc(e.nome_empresa)} (${esc(e.codigo_empresa)})</option>`)
    .join('');
  document.getElementById('filtroEmpresa').innerHTML = '<option value="">Todas as empresas</option>' + opts;
  document.getElementById('evEmpresa').innerHTML     = '<option value="">Geral (todas)</option>' + opts;
  document.getElementById('tpEmpresa').innerHTML     = '<option value="">Todas as empresas</option>' + opts;
  document.getElementById('obsEmpresa').innerHTML    = opts;
  document.getElementById('chkEmpresaEspecifica').innerHTML = opts;
}

async function carregarFeriados() {
  const { data, error } = await sb.from('rh_feriados').select('data, descricao');
  if (error) { toast('Erro ao carregar feriados: ' + error.message, 'error'); return; }
  feriados = data || [];
}

async function carregarTemplates() {
  const { data, error } = await sb.from('cal_folha_templates')
    .select('*')
    .order('mes_offset').order('dia');
  if (error) { toast('Erro ao carregar cronograma: ' + error.message, 'error'); return; }
  templates = data || [];
}

async function recarregar() {
  await Promise.all([carregarEventos(), carregarAtrasados()]);
  await ligarChecklistNosEventos();
  render();
}

/** carrega, em lote, os itens de checklist dos eventos visíveis (mês + atrasados)
 *  — usado para o filtro por empresa e para o indicador de progresso nos cards */
async function carregarChecklistParaEventos(idsEventos) {
  if (!idsEventos.length) return {};
  const { data, error } = await sb.from('cal_folha_checklist_itens')
    .select('id, evento_id, codigo_empresa, concluido')
    .in('evento_id', idsEventos);
  if (error) return {};
  const mapa = {};
  (data || []).forEach(it => (mapa[it.evento_id] = mapa[it.evento_id] || []).push(it));
  return mapa;
}

async function ligarChecklistNosEventos() {
  const ids = [...new Set([...eventos, ...atrasados].map(e => e.id))];
  const mapa = await carregarChecklistParaEventos(ids);
  [...eventos, ...atrasados].forEach(ev => { ev._checklist = mapa[ev.id] || []; });
}

/* janela de datas exibida na grade do mês (inclui sobras das semanas) */
function janelaDoMes() {
  const ini = new Date(mesAtual);
  ini.setDate(1 - ini.getDay());
  const fim = new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1, 0);
  fim.setDate(fim.getDate() + (6 - fim.getDay()));
  return { ini, fim };
}

async function carregarEventos() {
  const { ini, fim } = janelaDoMes();
  const { data, error } = await sb.from('cal_folha_eventos')
    .select('*')
    .gte('data', iso(ini))
    .lte('data', iso(fim))
    .order('data').order('prioridade');
  if (error) { toast('Erro ao carregar eventos: ' + error.message, 'error'); return; }
  eventos = data || [];
}

async function carregarAtrasados() {
  const { data, error } = await sb.from('cal_folha_eventos')
    .select('*')
    .neq('status', 'concluido')
    .neq('tipo', 'observacao')
    .lt('data', iso(hoje))
    .order('data');
  if (error) return;
  atrasados = data || [];
}

/* ─────────────────────── Utilitários de data ─────────────────────── */

function iso(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function deIso(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function fmtBr(s) {
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

function nomeFeriado(d) {
  const dm  = String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
  const dma = dm + '/' + d.getFullYear();
  const f = feriados.find(f => f.data === dm || f.data === dma);
  return f ? f.descricao : null;
}

function ehDiaUtil(d) {
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return false;
  return !nomeFeriado(d);
}

function ajustarDiaUtil(d, modo) {
  if (modo === 'mantem') return d;
  const passo = modo === 'posterga' ? 1 : -1;
  const r = new Date(d);
  while (!ehDiaUtil(r)) r.setDate(r.getDate() + passo);
  return r;
}

/** n-ésimo dia útil do mês (1-based) */
function nEsimoDiaUtil(ano, mes0, n) {
  const d = new Date(ano, mes0, 1);
  let cont = 0;
  while (d.getMonth() === mes0) {
    if (ehDiaUtil(d)) {
      cont++;
      if (cont === n) return new Date(d);
    }
    d.setDate(d.getDate() + 1);
  }
  return new Date(ano, mes0 + 1, 0); // fallback: último dia
}

function ultimoDiaUtil(ano, mes0) {
  const d = new Date(ano, mes0 + 1, 0);
  while (!ehDiaUtil(d)) d.setDate(d.getDate() - 1);
  return d;
}

/** calcula a data de um template para a competência (ano, mes0) */
function dataDoTemplate(tpl, anoComp, mes0Comp) {
  const alvo = new Date(anoComp, mes0Comp + tpl.mes_offset, 1);
  const ano = alvo.getFullYear(), mes0 = alvo.getMonth();
  let d;
  if (tpl.regra === 'dia_util') {
    d = nEsimoDiaUtil(ano, mes0, tpl.dia);
  } else if (tpl.regra === 'ultimo_dia_util') {
    d = ultimoDiaUtil(ano, mes0);
  } else {
    const ultimo = new Date(ano, mes0 + 1, 0).getDate();
    d = new Date(ano, mes0, Math.min(tpl.dia, ultimo));
    d = ajustarDiaUtil(d, tpl.ajuste);
  }
  return d;
}

function competenciaStr(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function fmtCompetencia(c) {
  const [y, m] = c.split('-');
  return m + '/' + y;
}

/* ─────────────────────────── Filtros ─────────────────────────── */

let filtroRapidoAtivo = null;

function filtrosAtuais() {
  return {
    empresa: document.getElementById('filtroEmpresa').value,
    tipo:    document.getElementById('filtroTipo').value,
    status:  document.getElementById('filtroStatus').value
  };
}

function eventoVisivel(ev) {
  const f = filtrosAtuais();
  if (f.empresa) {
    const pertence = ev.codigo_empresa === f.empresa
      || (ev._checklist || []).some(i => i.codigo_empresa === f.empresa);
    if (!pertence) return false;
  }
  if (f.tipo && ev.tipo !== f.tipo) return false;
  if (f.status === 'atrasado') {
    if (!ehAtrasado(ev)) return false;
  } else if (f.status && ev.status !== f.status) return false;
  return true;
}

function ehAtrasado(ev) {
  return ev.status !== 'concluido' && ev.tipo !== 'observacao' && ev.data < iso(hoje);
}

function aplicarFiltros() {
  filtroRapidoAtivo = null;
  document.querySelectorAll('.stat-chip').forEach(c => c.classList.remove('active'));
  render();
}

function filtroRapido(qual) {
  const fs = document.getElementById('filtroStatus');
  document.querySelectorAll('.stat-chip').forEach(c => c.classList.remove('active'));

  if (filtroRapidoAtivo === qual) {          // clicar de novo desativa
    filtroRapidoAtivo = null;
    fs.value = '';
    render();
    return;
  }
  filtroRapidoAtivo = qual;
  document.querySelector('.chip-' + ({ hoje: 'hoje', atrasados: 'atrasados', semana: 'semana', concluidos: 'concluidos' })[qual])
    ?.classList.add('active');

  if (qual === 'atrasados')   { fs.value = 'atrasado';  setView('agenda'); }
  if (qual === 'concluidos')  { fs.value = 'concluido'; setView('agenda'); }
  if (qual === 'hoje' || qual === 'semana') { fs.value = ''; irParaHoje(); setView('agenda'); }
  render();
}

/* ─────────────────────────── Navegação ─────────────────────────── */

async function mudarMes(delta) {
  mesAtual = new Date(mesAtual.getFullYear(), mesAtual.getMonth() + delta, 1);
  await carregarEventos();
  await ligarChecklistNosEventos();
  render();
}

async function irParaHoje() {
  hoje = new Date();
  const alvo = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  if (alvo.getTime() !== mesAtual.getTime()) {
    mesAtual = alvo;
    await carregarEventos();
  }
  await ligarChecklistNosEventos();
  render();
}

function setView(v) {
  viewAtual = v;
  document.querySelectorAll('#viewSwitch button').forEach(b =>
    b.classList.toggle('active', b.dataset.view === v));
  render();
}

/* ─────────────────────────── Render ─────────────────────────── */

function render() {
  hoje = new Date();
  const nomeMes = mesAtual.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  document.getElementById('monthLabel').textContent = nomeMes;

  document.getElementById('viewMes').style.display    = viewAtual === 'mes' ? 'block' : 'none';
  document.getElementById('viewAgenda').style.display = viewAtual === 'agenda' ? 'block' : 'none';

  renderStats();
  renderAlertStrip();

  if (viewAtual === 'mes')    renderMes();
  if (viewAtual === 'agenda') renderAgenda();
}

function renderStats() {
  const hj = iso(hoje);
  const seteDias = new Date(hoje); seteDias.setDate(seteDias.getDate() + 7);

  const doMes = eventos.filter(e => deIso(e.data).getMonth() === mesAtual.getMonth()
                                 && deIso(e.data).getFullYear() === mesAtual.getFullYear());

  const paraHoje = eventos.filter(e => e.data === hj && e.status !== 'concluido' && e.tipo !== 'observacao');
  const proxSemana = eventos.filter(e => e.data > hj && e.data <= iso(seteDias)
                                       && e.status !== 'concluido' && e.tipo !== 'observacao');
  const concluidosMes = doMes.filter(e => e.status === 'concluido');

  document.getElementById('statHoje').textContent       = paraHoje.length;
  document.getElementById('statSemana').textContent     = proxSemana.length;
  document.getElementById('statConcluidos').textContent = concluidosMes.length;
  document.getElementById('statAtrasados').textContent  = atrasados.length;
  document.querySelector('.chip-atrasados').classList.toggle('tem-atraso', atrasados.length > 0);
}

function renderAlertStrip() {
  const strip = document.getElementById('alertStrip');
  const lista = document.getElementById('alertStripList');
  if (!atrasados.length) { strip.classList.remove('show'); return; }
  strip.classList.add('show');
  lista.innerHTML = atrasados.slice(0, 12).map(ev => {
    const emp = nomeEmpresa(ev.codigo_empresa);
    return `<span class="alert-strip-item" onclick="abrirEventoPorId('${ev.id}')">
      ${fmtBr(ev.data)} · ${esc(ev.titulo)}${emp ? ' · ' + esc(emp) : ''}</span>`;
  }).join('') + (atrasados.length > 12
    ? `<span class="alert-strip-item" onclick="filtroRapido('atrasados')">+ ${atrasados.length - 12} outros…</span>` : '');
}

function nomeEmpresa(codigo) {
  if (!codigo) return null;
  const e = empresas.find(e => e.codigo_empresa === codigo);
  return e ? e.nome_empresa : codigo;
}

/* ── visão mês ── */
function renderMes() {
  const grid = document.getElementById('calGrid');
  const { ini } = janelaDoMes();
  const hj = iso(hoje);
  const celulas = [];
  const d = new Date(ini);

  const visiveis = eventos.filter(eventoVisivel);
  const porDia = {};
  visiveis.forEach(ev => (porDia[ev.data] = porDia[ev.data] || []).push(ev));

  for (let i = 0; i < 42; i++) {
    const dataIso = iso(d);
    const outroMes = d.getMonth() !== mesAtual.getMonth();
    const fds = d.getDay() === 0 || d.getDay() === 6;
    const feriado = nomeFeriado(d);
    const evs = porDia[dataIso] || [];

    const pills = evs.slice(0, 3).map(ev => pillHtml(ev)).join('');
    const mais = evs.length > 3 ? `<span class="more-link">+ ${evs.length - 3} mais</span>` : '';

    celulas.push(`
      <div class="cal-day ${outroMes ? 'outro-mes' : ''} ${fds ? 'fim-semana' : ''} ${dataIso === hj ? 'hoje' : ''}"
           onclick="abrirDia('${dataIso}')">
        <div class="day-head">
          <span class="day-num">${d.getDate()}</span>
          ${feriado ? `<span class="day-feriado" title="${esc(feriado)}">🎌 ${esc(feriado)}</span>` : ''}
        </div>
        ${pills}${mais}
      </div>`);
    d.setDate(d.getDate() + 1);
  }
  grid.innerHTML = celulas.join('');
}

function pillHtml(ev) {
  const t = TIPOS[ev.tipo] || TIPOS.outro;
  const atras = ehAtrasado(ev);
  const cod = ev.codigo_empresa ? `<span class="pill-emp">${esc(ev.codigo_empresa)}</span>` : '';
  return `<span class="event-pill tipo-${ev.tipo} ${ev.status === 'concluido' ? 'concluido' : ''} ${atras ? 'atrasado' : ''}"
      title="${esc(ev.titulo)}${ev.codigo_empresa ? ' — ' + esc(nomeEmpresa(ev.codigo_empresa)) : ''}"
      onclick="event.stopPropagation(); abrirEventoPorId('${ev.id}')">${t.emoji} ${cod}${esc(ev.titulo)}</span>`;
}

/* ── visão agenda ── */
function renderAgenda() {
  const cont = document.getElementById('viewAgenda');
  const visiveis = eventos.filter(eventoVisivel)
    .filter(e => deIso(e.data).getMonth() === mesAtual.getMonth()
              && deIso(e.data).getFullYear() === mesAtual.getFullYear());

  // no filtro "atrasados", mostra todos os atrasados independentemente do mês
  const lista = (filtroRapidoAtivo === 'atrasados')
    ? atrasados.filter(eventoVisivel)
    : visiveis;

  if (!lista.length) {
    cont.innerHTML = emptyHtml('Nenhum evento', 'Nada encontrado com os filtros atuais neste mês.');
    return;
  }

  const porDia = {};
  lista.forEach(ev => (porDia[ev.data] = porDia[ev.data] || []).push(ev));

  cont.innerHTML = Object.keys(porDia).sort().map(dia => {
    const d = deIso(dia);
    const feriado = nomeFeriado(d);
    const nomeDia = d.toLocaleDateString('pt-BR', { weekday: 'long', month: 'long' });
    return `
      <div class="agenda-day ${dia === iso(hoje) ? 'hoje' : ''}">
        <div class="agenda-day-head">
          <span class="adh-num">${String(d.getDate()).padStart(2, '0')}</span>
          <span class="adh-info">${nomeDia}${dia === iso(hoje) ? ' — hoje' : ''}</span>
          ${feriado ? `<span class="adh-feriado">🎌 ${esc(feriado)}</span>` : ''}
        </div>
        ${porDia[dia].map(ev => cardHtml(ev)).join('')}
      </div>`;
  }).join('');
}

function checklistBadgeHtml(ev) {
  const itens = ev._checklist || [];
  if (!itens.length) return '';
  const done = itens.filter(i => i.concluido).length;
  return `<span class="badge badge-checklist" title="Itens de checklist concluídos">☑️ ${done}/${itens.length}</span>`;
}

function cardHtml(ev) {
  const t = TIPOS[ev.tipo] || TIPOS.outro;
  const atras = ehAtrasado(ev);
  const emp = nomeEmpresa(ev.codigo_empresa);
  const temChecklist = (ev._checklist || []).length > 0;
  return `
    <div class="event-card ${ev.status}" style="border-left-color: ${t.cor}"
         onclick="abrirEventoPorId('${ev.id}')">
      ${temChecklist
        ? `<span class="ec-check ec-check-auto" title="Status calculado pelo checklist">${ev.status === 'concluido' ? '✅' : '◐'}</span>`
        : `<button class="ec-check" title="Alternar status"
              onclick="event.stopPropagation(); alternarStatus('${ev.id}')">✓</button>`}
      <div class="ec-body">
        <div class="ec-title">
          <span class="tipo-txt-${ev.tipo}">${t.emoji}</span> ${esc(ev.titulo)}
          ${atras ? '<span class="badge badge-atrasado">Atrasado</span>' : ''}
        </div>
        ${ev.descricao ? `<div class="ec-desc">${esc(ev.descricao)}</div>` : ''}
        <div class="ec-meta">
          ${emp ? `<span class="badge badge-empresa">🏢 ${esc(emp)}</span>`
                : '<span class="badge badge-empresa">🌐 Geral</span>'}
          <span class="badge badge-${ev.prioridade}">${PRIORIDADES[ev.prioridade] || ev.prioridade}</span>
          <span class="badge badge-status-${ev.status}">${STATUS_LABEL[ev.status]}</span>
          ${checklistBadgeHtml(ev)}
          ${ev.origem === 'cronograma' ? '<span class="badge badge-cronograma">⚙️ Cronograma</span>' : ''}
          ${ev.responsavel ? `<span>👤 ${esc(ev.responsavel)}</span>` : ''}
          ${ev.status === 'concluido' && ev.concluido_por ? `<span>✅ ${esc(ev.concluido_por)} em ${ev.concluido_em ? fmtBr(ev.concluido_em.slice(0, 10)) : ''}</span>` : ''}
        </div>
      </div>
    </div>`;
}

function emptyHtml(titulo, sub) {
  return `<div class="empty-state">
    <div class="empty-icon">📭</div><h3>${titulo}</h3><p>${sub}</p></div>`;
}

/* ─────────────────────── Modal: dia ─────────────────────── */

function abrirDia(dataIso) {
  const d = deIso(dataIso);
  const feriado = nomeFeriado(d);
  document.getElementById('modalDiaTitulo').textContent =
    d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  const evs = eventos.filter(e => e.data === dataIso).filter(eventoVisivel);
  document.getElementById('modalDiaBody').innerHTML =
    (feriado ? `<p class="form-hint" style="margin-bottom:10px">🎌 Feriado: <strong>${esc(feriado)}</strong></p>` : '') +
    (evs.length ? evs.map(ev => cardHtml(ev)).join('')
                : '<p class="form-hint">Nenhum evento neste dia.</p>');

  document.getElementById('btnNovoNoDia').onclick = () => {
    fecharModal('modalDia');
    abrirNovoEvento(dataIso);
  };
  abrirModal('modalDia');
}

/* ─────────────────────── CRUD: eventos ─────────────────────── */

function abrirNovoEvento(dataIso) {
  eventoEditando = null;
  observacoesEditando = [];
  checklistEditando = [];
  document.getElementById('modalEventoTitulo').textContent = 'Novo evento';
  document.getElementById('evTitulo').value = '';
  document.getElementById('evData').value = dataIso || iso(hoje);
  document.getElementById('evEmpresa').value = document.getElementById('filtroEmpresa').value || '';
  document.getElementById('evTipo').value = 'outro';
  document.getElementById('evPrioridade').value = 'atencao';
  document.getElementById('evResponsavel').value = '';
  document.getElementById('evStatus').value = 'pendente';
  document.getElementById('evStatus').disabled = false;
  document.getElementById('evDescricao').value = '';
  document.getElementById('btnExcluirEvento').style.display = 'none';
  document.getElementById('evOrigemHint').style.display = 'none';
  document.getElementById('evStatusHint').style.display = 'none';
  document.getElementById('evSecObservacoes').style.display = 'none';
  document.getElementById('evSecChecklist').style.display = 'none';
  abrirModal('modalEvento');
  setTimeout(() => document.getElementById('evTitulo').focus(), 50);
}

async function abrirEventoPorId(id) {
  const ev = eventos.find(e => e.id === id) || atrasados.find(e => e.id === id);
  if (!ev) return;
  eventoEditando = ev;
  document.getElementById('modalEventoTitulo').textContent = 'Editar evento';
  document.getElementById('evTitulo').value = ev.titulo;
  document.getElementById('evData').value = ev.data;
  document.getElementById('evEmpresa').value = ev.codigo_empresa || '';
  document.getElementById('evTipo').value = ev.tipo;
  document.getElementById('evPrioridade').value = ev.prioridade;
  document.getElementById('evResponsavel').value = ev.responsavel || '';
  document.getElementById('evStatus').value = ev.status;
  document.getElementById('evDescricao').value = ev.descricao || '';
  document.getElementById('btnExcluirEvento').style.display = 'inline-flex';

  const hint = document.getElementById('evOrigemHint');
  if (ev.origem === 'cronograma') {
    hint.style.display = 'block';
    hint.textContent = '⚙️ Evento gerado do cronograma recorrente (competência ' + fmtCompetencia(ev.competencia) + ').';
  } else hint.style.display = 'none';

  document.getElementById('evSecObservacoes').style.display = 'block';
  document.getElementById('evSecChecklist').style.display = 'block';
  document.getElementById('obsTexto').value = '';
  document.getElementById('chkTexto').value = '';
  document.getElementById('chkEscopo').value = 'generico';
  atualizarEscopoChecklist();

  fecharModal('modalDia');
  abrirModal('modalEvento');

  await Promise.all([carregarObservacoesEvento(ev.id), carregarChecklistEvento(ev.id)]);
  renderObservacoes();
  renderChecklist();
}

async function salvarEvento() {
  const titulo = document.getElementById('evTitulo').value.trim();
  const data = document.getElementById('evData').value;
  if (!titulo || !data) { toast('Preencha título e data.', 'error'); return; }

  const status = document.getElementById('evStatus').value;
  const payload = {
    titulo,
    data,
    competencia: data.slice(0, 7),
    codigo_empresa: document.getElementById('evEmpresa').value || null,
    tipo: document.getElementById('evTipo').value,
    prioridade: document.getElementById('evPrioridade').value,
    responsavel: document.getElementById('evResponsavel').value.trim() || null,
    status,
    descricao: document.getElementById('evDescricao').value.trim() || null,
    atualizado_em: new Date().toISOString()
  };

  if (status === 'concluido' && (!eventoEditando || eventoEditando.status !== 'concluido')) {
    payload.concluido_por = usuario?.nome || usuario?.email || 'usuário';
    payload.concluido_em = new Date().toISOString();
  }
  if (status !== 'concluido') { payload.concluido_por = null; payload.concluido_em = null; }

  let error;
  if (eventoEditando) {
    // preserva competência original de eventos do cronograma
    if (eventoEditando.origem === 'cronograma') payload.competencia = eventoEditando.competencia;
    ({ error } = await sb.from('cal_folha_eventos').update(payload).eq('id', eventoEditando.id));
  } else {
    payload.origem = 'manual';
    payload.criado_por = usuario?.nome || usuario?.email || null;
    ({ error } = await sb.from('cal_folha_eventos').insert(payload));
  }

  if (error) { toast('Erro ao salvar: ' + error.message, 'error'); return; }
  toast(eventoEditando ? 'Evento atualizado.' : 'Evento criado.', 'success');
  fecharModal('modalEvento');
  await recarregar();
}

async function excluirEvento() {
  if (!eventoEditando) return;
  if (!confirm('Excluir este evento?')) return;
  const { error } = await sb.from('cal_folha_eventos').delete().eq('id', eventoEditando.id);
  if (error) { toast('Erro ao excluir: ' + error.message, 'error'); return; }
  toast('Evento excluído.', 'success');
  fecharModal('modalEvento');
  await recarregar();
}

/** ciclo rápido: pendente → em andamento → concluído → pendente */
async function alternarStatus(id) {
  const ev = eventos.find(e => e.id === id) || atrasados.find(e => e.id === id);
  if (!ev) return;
  const prox = { pendente: 'em_andamento', em_andamento: 'concluido', concluido: 'pendente' }[ev.status];
  const payload = { status: prox, atualizado_em: new Date().toISOString() };
  if (prox === 'concluido') {
    payload.concluido_por = usuario?.nome || usuario?.email || 'usuário';
    payload.concluido_em = new Date().toISOString();
  } else { payload.concluido_por = null; payload.concluido_em = null; }

  const { error } = await sb.from('cal_folha_eventos').update(payload).eq('id', id);
  if (error) { toast('Erro: ' + error.message, 'error'); return; }
  await recarregar();
}

/* ─────────────────────── Observações por empresa ─────────────────────── */

async function carregarObservacoesEvento(eventoId) {
  const { data, error } = await sb.from('cal_folha_observacoes')
    .select('*').eq('evento_id', eventoId).order('criado_em', { ascending: false });
  if (error) { toast('Erro ao carregar observações: ' + error.message, 'error'); observacoesEditando = []; return; }
  observacoesEditando = data || [];
}

function renderObservacoes() {
  const cont = document.getElementById('obsList');
  if (!observacoesEditando.length) {
    cont.innerHTML = '<p class="form-hint">Nenhuma observação registrada.</p>';
    return;
  }
  cont.innerHTML = observacoesEditando.map(o => `
    <div class="obs-item">
      <div class="obs-item-head">
        <span class="obs-empresa">🏢 ${esc(nomeEmpresa(o.codigo_empresa) || o.codigo_empresa)}</span>
        <span class="obs-meta">${esc(o.criado_por || '')}${o.criado_por && o.criado_em ? ' · ' : ''}${o.criado_em ? fmtBr(o.criado_em.slice(0, 10)) : ''}</span>
        <button class="obs-del" title="Excluir" onclick="excluirObservacao('${o.id}')">✕</button>
      </div>
      <div class="obs-texto">${esc(o.texto)}</div>
    </div>`).join('');
}

async function adicionarObservacao() {
  if (!eventoEditando) return;
  const codigo_empresa = document.getElementById('obsEmpresa').value;
  const texto = document.getElementById('obsTexto').value.trim();
  if (!codigo_empresa) { toast('Escolha a empresa.', 'error'); return; }
  if (!texto) { toast('Escreva a observação.', 'error'); return; }

  const { error } = await sb.from('cal_folha_observacoes').insert({
    evento_id: eventoEditando.id,
    codigo_empresa,
    texto,
    criado_por: usuario?.nome || usuario?.email || null
  });
  if (error) { toast('Erro ao salvar: ' + error.message, 'error'); return; }

  document.getElementById('obsTexto').value = '';
  await carregarObservacoesEvento(eventoEditando.id);
  renderObservacoes();
}

async function excluirObservacao(id) {
  if (!confirm('Excluir esta observação?')) return;
  const { error } = await sb.from('cal_folha_observacoes').delete().eq('id', id);
  if (error) { toast('Erro: ' + error.message, 'error'); return; }
  await carregarObservacoesEvento(eventoEditando.id);
  renderObservacoes();
}

/* ─────────────────────── Checklist (genérico / por empresa) ─────────────────────── */

function atualizarEscopoChecklist() {
  const escopo = document.getElementById('chkEscopo').value;
  document.getElementById('chkEmpresaEspecifica').style.display = escopo === 'empresa' ? 'inline-block' : 'none';
}

async function carregarChecklistEvento(eventoId) {
  const { data, error } = await sb.from('cal_folha_checklist_itens')
    .select('*').eq('evento_id', eventoId).order('criado_em');
  if (error) { toast('Erro ao carregar checklist: ' + error.message, 'error'); checklistEditando = []; return; }
  checklistEditando = data || [];
}

function renderChecklist() {
  if (eventoEditando) eventoEditando._checklist = checklistEditando;

  const cont = document.getElementById('chkList');
  const prog = document.getElementById('chkProgress');

  if (!checklistEditando.length) {
    cont.innerHTML = '<p class="form-hint">Nenhum item no checklist.</p>';
    prog.textContent = '';
  } else {
    const done = checklistEditando.filter(i => i.concluido).length;
    prog.textContent = `${done}/${checklistEditando.length} concluídos`;

    const linha = it => `
      <div class="chk-item ${it.concluido ? 'feito' : ''}">
        <input type="checkbox" ${it.concluido ? 'checked' : ''} onchange="alternarChecklistItem('${it.id}')" />
        <span class="chk-texto">${esc(it.texto)}${it.codigo_empresa ? ` <span class="chk-empresa">🏢 ${esc(nomeEmpresa(it.codigo_empresa) || it.codigo_empresa)}</span>` : ''}</span>
        <button class="chk-del" title="Excluir" onclick="excluirChecklistItem('${it.id}')">✕</button>
      </div>`;

    const genericos  = checklistEditando.filter(i => !i.codigo_empresa);
    const porEmpresa = checklistEditando.filter(i => i.codigo_empresa)
      .sort((a, b) => (nomeEmpresa(a.codigo_empresa) || a.codigo_empresa).localeCompare(nomeEmpresa(b.codigo_empresa) || b.codigo_empresa));

    cont.innerHTML =
      (genericos.length  ? `<div class="chk-group"><h5>Geral</h5>${genericos.map(linha).join('')}</div>` : '') +
      (porEmpresa.length ? `<div class="chk-group"><h5>Por empresa</h5>${porEmpresa.map(linha).join('')}</div>` : '');
  }

  atualizarStatusUI();
  render();   // atualiza pills/cards do calendário por trás do modal (status/badge já em memória)
}

async function adicionarChecklistItem() {
  if (!eventoEditando) return;
  const texto = document.getElementById('chkTexto').value.trim();
  if (!texto) { toast('Escreva a descrição da tarefa.', 'error'); return; }
  const escopo = document.getElementById('chkEscopo').value;

  let linhas = [];
  if (escopo === 'generico') {
    linhas = [{ evento_id: eventoEditando.id, codigo_empresa: null, texto }];
  } else if (escopo === 'todas') {
    if (!empresas.length) { toast('Nenhuma empresa cadastrada.', 'error'); return; }
    linhas = empresas.map(e => ({ evento_id: eventoEditando.id, codigo_empresa: e.codigo_empresa, texto }));
  } else {
    const cod = document.getElementById('chkEmpresaEspecifica').value;
    if (!cod) { toast('Escolha a empresa.', 'error'); return; }
    linhas = [{ evento_id: eventoEditando.id, codigo_empresa: cod, texto }];
  }

  const { error } = await sb.from('cal_folha_checklist_itens').insert(linhas);
  if (error) { toast('Erro ao salvar: ' + error.message, 'error'); return; }

  document.getElementById('chkTexto').value = '';
  await carregarChecklistEvento(eventoEditando.id);
  await sincronizarStatusPorChecklist(eventoEditando.id);
  renderChecklist();
}

async function alternarChecklistItem(id) {
  const item = checklistEditando.find(i => i.id === id);
  if (!item) return;
  const concluido = !item.concluido;
  const payload = { concluido };
  if (concluido) {
    payload.concluido_por = usuario?.nome || usuario?.email || 'usuário';
    payload.concluido_em = new Date().toISOString();
  } else {
    payload.concluido_por = null;
    payload.concluido_em = null;
  }

  const { error } = await sb.from('cal_folha_checklist_itens').update(payload).eq('id', id);
  if (error) { toast('Erro: ' + error.message, 'error'); return; }

  await carregarChecklistEvento(eventoEditando.id);
  await sincronizarStatusPorChecklist(eventoEditando.id);
  renderChecklist();
}

async function excluirChecklistItem(id) {
  if (!confirm('Excluir este item do checklist?')) return;
  const { error } = await sb.from('cal_folha_checklist_itens').delete().eq('id', id);
  if (error) { toast('Erro: ' + error.message, 'error'); return; }

  await carregarChecklistEvento(eventoEditando.id);
  await sincronizarStatusPorChecklist(eventoEditando.id);
  renderChecklist();
}

/** mantém cal_folha_eventos.status em sincronia com o progresso do checklist
 *  (pendente = nada feito, em_andamento = parcial, concluído = tudo feito) */
async function sincronizarStatusPorChecklist(eventoId) {
  const itens = checklistEditando;
  if (!itens.length) return;   // sem checklist: status continua manual

  const done = itens.filter(i => i.concluido).length;
  const novoStatus = done === 0 ? 'pendente' : (done === itens.length ? 'concluido' : 'em_andamento');
  const payload = { status: novoStatus, atualizado_em: new Date().toISOString() };
  if (novoStatus === 'concluido') {
    payload.concluido_por = usuario?.nome || usuario?.email || 'usuário';
    payload.concluido_em = new Date().toISOString();
  } else {
    payload.concluido_por = null;
    payload.concluido_em = null;
  }

  await sb.from('cal_folha_eventos').update(payload).eq('id', eventoId);
  if (eventoEditando && eventoEditando.id === eventoId) Object.assign(eventoEditando, payload);
}

function atualizarStatusUI() {
  const sel = document.getElementById('evStatus');
  const hint = document.getElementById('evStatusHint');
  if (checklistEditando.length) {
    sel.disabled = true;
    sel.value = eventoEditando.status;
    const done = checklistEditando.filter(i => i.concluido).length;
    hint.style.display = 'block';
    hint.textContent = `Status calculado automaticamente pelo checklist (${done}/${checklistEditando.length} concluídos).`;
  } else {
    sel.disabled = false;
    hint.style.display = 'none';
  }
}

/* ─────────────────────── CRUD: cronograma (templates) ─────────────────────── */

function abrirCronograma() {
  renderTemplates();
  abrirModal('modalCronograma');
}

function descreveRegra(t) {
  if (t.regra === 'dia_util') return `${t.dia}º dia útil`;
  if (t.regra === 'ultimo_dia_util') return 'Último dia útil';
  return `Dia ${t.dia}`;
}

function descrevePrazo(t) {
  const mes = t.mes_offset === 1 ? 'mês seguinte' : 'mesmo mês';
  const so = t.mes_especifico
    ? ' · só em ' + new Date(2000, t.mes_especifico - 1, 1).toLocaleDateString('pt-BR', { month: 'long' })
    : '';
  const aj = { antecipa: '· antecipa', posterga: '· posterga', mantem: '' }[t.ajuste];
  return `${mes} ${aj}${so}`;
}

function renderTemplates() {
  const tbody = document.getElementById('tplTbody');
  if (!templates.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--muted)">Nenhuma atividade recorrente cadastrada.</td></tr>';
    return;
  }
  tbody.innerHTML = templates.map(t => {
    const tipo = TIPOS[t.tipo] || TIPOS.outro;
    return `<tr class="${t.ativo ? '' : 'tpl-inativo'}">
      <td><strong>${esc(t.titulo)}</strong></td>
      <td>${t.codigo_empresa ? esc(nomeEmpresa(t.codigo_empresa) || t.codigo_empresa) : '🌐 Todas'}</td>
      <td><span class="tipo-txt-${t.tipo}">${tipo.emoji}</span> ${tipo.label}</td>
      <td>${descreveRegra(t)}</td>
      <td>${descrevePrazo(t)}</td>
      <td><span class="badge badge-${t.prioridade}">${(PRIORIDADES[t.prioridade] || '').replace(/^\S+ /, '')}</span></td>
      <td class="tpl-actions">
        <button title="Editar" onclick="abrirEditarTemplate('${t.id}')">✏️</button>
        <button title="${t.ativo ? 'Desativar' : 'Ativar'}" onclick="alternarTemplate('${t.id}')">${t.ativo ? '⏸️' : '▶️'}</button>
      </td>
    </tr>`;
  }).join('');
}

function atualizarHintRegra() {
  const regra = document.getElementById('tpRegra').value;
  const label = document.getElementById('tpDiaLabel');
  const dia = document.getElementById('tpDia');
  if (regra === 'ultimo_dia_util') { label.textContent = 'Dia (ignorado)'; dia.disabled = true; }
  else if (regra === 'dia_util')   { label.textContent = 'N-ésimo dia útil'; dia.disabled = false; dia.max = 23; }
  else                             { label.textContent = 'Dia do mês'; dia.disabled = false; dia.max = 31; }
}

function abrirNovoTemplate() {
  templateEditando = null;
  document.getElementById('modalTemplateTitulo').textContent = 'Nova atividade recorrente';
  document.getElementById('tpTitulo').value = '';
  document.getElementById('tpEmpresa').value = '';
  document.getElementById('tpTipo').value = 'fechamento';
  document.getElementById('tpRegra').value = 'dia_fixo';
  document.getElementById('tpDia').value = 1;
  document.getElementById('tpOffset').value = '0';
  document.getElementById('tpAjuste').value = 'antecipa';
  document.getElementById('tpPrioridade').value = 'atencao';
  document.getElementById('tpMesEspecifico').value = '';
  document.getElementById('tpDescricao').value = '';
  document.getElementById('btnExcluirTemplate').style.display = 'none';
  atualizarHintRegra();
  abrirModal('modalTemplate');
}

function abrirEditarTemplate(id) {
  const t = templates.find(t => t.id === id);
  if (!t) return;
  templateEditando = t;
  document.getElementById('modalTemplateTitulo').textContent = 'Editar atividade recorrente';
  document.getElementById('tpTitulo').value = t.titulo;
  document.getElementById('tpEmpresa').value = t.codigo_empresa || '';
  document.getElementById('tpTipo').value = t.tipo;
  document.getElementById('tpRegra').value = t.regra;
  document.getElementById('tpDia').value = t.dia;
  document.getElementById('tpOffset').value = String(t.mes_offset);
  document.getElementById('tpAjuste').value = t.ajuste;
  document.getElementById('tpPrioridade').value = t.prioridade;
  document.getElementById('tpMesEspecifico').value = t.mes_especifico || '';
  document.getElementById('tpDescricao').value = t.descricao || '';
  document.getElementById('btnExcluirTemplate').style.display = 'inline-flex';
  atualizarHintRegra();
  abrirModal('modalTemplate');
}

async function salvarTemplate() {
  const titulo = document.getElementById('tpTitulo').value.trim();
  if (!titulo) { toast('Informe o título.', 'error'); return; }

  const payload = {
    titulo,
    codigo_empresa: document.getElementById('tpEmpresa').value || null,
    tipo: document.getElementById('tpTipo').value,
    regra: document.getElementById('tpRegra').value,
    dia: parseInt(document.getElementById('tpDia').value, 10) || 1,
    mes_offset: parseInt(document.getElementById('tpOffset').value, 10),
    ajuste: document.getElementById('tpAjuste').value,
    prioridade: document.getElementById('tpPrioridade').value,
    mes_especifico: document.getElementById('tpMesEspecifico').value
      ? parseInt(document.getElementById('tpMesEspecifico').value, 10) : null,
    descricao: document.getElementById('tpDescricao').value.trim() || null
  };

  let error;
  if (templateEditando) {
    ({ error } = await sb.from('cal_folha_templates').update(payload).eq('id', templateEditando.id));
  } else {
    ({ error } = await sb.from('cal_folha_templates').insert(payload));
  }
  if (error) { toast('Erro ao salvar: ' + error.message, 'error'); return; }

  toast('Cronograma salvo.', 'success');
  fecharModal('modalTemplate');
  await carregarTemplates();
  renderTemplates();
}

async function alternarTemplate(id) {
  const t = templates.find(t => t.id === id);
  if (!t) return;
  const { error } = await sb.from('cal_folha_templates').update({ ativo: !t.ativo }).eq('id', id);
  if (error) { toast('Erro: ' + error.message, 'error'); return; }
  await carregarTemplates();
  renderTemplates();
}

async function excluirTemplate() {
  if (!templateEditando) return;
  if (!confirm('Excluir esta atividade recorrente? Eventos já gerados não serão apagados.')) return;
  const { error } = await sb.from('cal_folha_templates').delete().eq('id', templateEditando.id);
  if (error) { toast('Erro: ' + error.message, 'error'); return; }
  toast('Atividade excluída.', 'success');
  fecharModal('modalTemplate');
  await carregarTemplates();
  renderTemplates();
}

/* ─────────────────────── Geração de competência ─────────────────────── */

function abrirGerarCompetencia() {
  document.getElementById('gerarCompetencia').value = competenciaStr(mesAtual);
  document.getElementById('gerarResultado').textContent = '';
  abrirModal('modalGerar');
}

async function gerarCompetencia() {
  const comp = document.getElementById('gerarCompetencia').value;   // 'AAAA-MM'
  if (!comp) { toast('Escolha a competência.', 'error'); return; }

  const btn = document.getElementById('btnGerar');
  btn.disabled = true; btn.textContent = 'Gerando…';

  try {
    const [ano, mes] = comp.split('-').map(Number);
    const mes0 = mes - 1;
    const ativos = templates.filter(t => t.ativo)
      .filter(t => !t.mes_especifico || t.mes_especifico === mes);

    // eventos já gerados desta competência (para não duplicar nem sobrescrever status)
    const { data: existentes, error: errExist } = await sb.from('cal_folha_eventos')
      .select('template_id, codigo_empresa')
      .eq('competencia', comp)
      .not('template_id', 'is', null);
    if (errExist) { toast('Erro ao verificar eventos existentes: ' + errExist.message, 'error'); return; }
    const jaGerado = new Set((existentes || []).map(e => e.template_id + '|' + (e.codigo_empresa || '')));

    // calendário único: cada template gera 1 evento (geral, ou da empresa
    // específica do template — sem expandir por empresa)
    const linhas = [];
    let pulados = 0;
    for (const t of ativos) {
      const cod = t.codigo_empresa || null;
      if (jaGerado.has(t.id + '|' + (cod || ''))) { pulados++; continue; }

      linhas.push({
        codigo_empresa: cod,
        titulo: t.titulo,
        descricao: t.descricao,
        tipo: t.tipo,
        prioridade: t.prioridade,
        data: iso(dataDoTemplate(t, ano, mes0)),
        competencia: comp,
        origem: 'cronograma',
        template_id: t.id,
        criado_por: usuario?.nome || usuario?.email || null
      });
    }

    if (!linhas.length) {
      document.getElementById('gerarResultado').textContent = pulados
        ? `Nada a gerar: os ${pulados} eventos desta competência já existem.`
        : 'Nenhuma atividade do cronograma se aplica a esta competência.';
      return;
    }

    const { error } = await sb.from('cal_folha_eventos').insert(linhas);
    if (error) { toast('Erro ao gerar: ' + error.message, 'error'); return; }

    document.getElementById('gerarResultado').textContent =
      `Competência ${fmtCompetencia(comp)}: ${linhas.length} evento(s) gerado(s)` +
      (pulados ? ` (${pulados} já existiam e foram mantidos).` : '.');

    toast('Competência gerada.', 'success');
    // navega para o mês da competência para o usuário ver o resultado
    mesAtual = new Date(ano, mes0, 1);
    await recarregar();
  } finally {
    btn.disabled = false; btn.textContent = 'Gerar eventos';
  }
}

/* ─────────────────────── Exportação ICS ─────────────────────── */

function exportarICS() {
  const visiveis = eventos.filter(eventoVisivel);
  if (!visiveis.length) { toast('Nenhum evento visível para exportar.', 'error'); return; }

  const linhas = [
    'BEGIN:VCALENDAR', 'VERSION:2.0',
    'PRODID:-//SCONT//Calendario da Folha//PT-BR', 'CALSCALE:GREGORIAN'
  ];
  visiveis.forEach(ev => {
    const dt = ev.data.replace(/-/g, '');
    const emp = nomeEmpresa(ev.codigo_empresa);
    linhas.push(
      'BEGIN:VEVENT',
      'UID:' + ev.id + '@scont-calendario-folha',
      'DTSTART;VALUE=DATE:' + dt,
      'SUMMARY:' + icsEscape((emp ? '[' + emp + '] ' : '') + ev.titulo),
      ev.descricao ? 'DESCRIPTION:' + icsEscape(ev.descricao) : null,
      'STATUS:' + (ev.status === 'concluido' ? 'CONFIRMED' : 'TENTATIVE'),
      'END:VEVENT'
    );
  });
  linhas.push('END:VCALENDAR');

  const blob = new Blob([linhas.filter(Boolean).join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'calendario_folha_' + competenciaStr(mesAtual) + '.ics';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Arquivo .ics exportado.', 'success');
}

function icsEscape(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/* ─────────────────────── Infra: modais, toast, escape ─────────────────────── */

function abrirModal(id)  { document.getElementById(id).classList.add('show'); }
function fecharModal(id) { document.getElementById(id).classList.remove('show'); }

// fecha modal clicando fora
document.addEventListener('click', e => {
  if (e.target.classList?.contains('modal-overlay')) e.target.classList.remove('show');
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape')
    document.querySelectorAll('.modal-overlay.show').forEach(m => m.classList.remove('show'));
});

function toast(msg, tipo) {
  const el = document.createElement('div');
  el.className = 'toast ' + (tipo || '');
  el.textContent = msg;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
