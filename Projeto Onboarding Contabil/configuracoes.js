(function () {
  'use strict';

  const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  let empresas = []; // [{ codigo_empresa, nome_empresa }]
  let configPorEmpresa = {}; // { codigo_empresa: boolean }

  document.addEventListener('DOMContentLoaded', iniciar);

  async function iniciar() {
    const auth = await window.PortalAuthGuard.init(1);
    if (!auth) return;
    document.getElementById('authOverlay')?.remove();

    await carregarDados();
    renderTela();
  }

  async function carregarDados() {
    const [{ data: dataEmpresas, error: errEmpresas }, { data: dataConfig, error: errConfig }] = await Promise.all([
      supabaseClient.from('rh_empresas').select('codigo_empresa, nome_empresa, status_situacao').order('nome_empresa', { ascending: true }),
      supabaseClient.from('contabil_empresas_config').select('codigo_empresa, possui_contabil'),
    ]);
    if (errEmpresas) console.error(errEmpresas);
    if (errConfig) console.error(errConfig);

    const ativa = (s) => !s || String(s).trim().toLowerCase().startsWith('ativ');
    empresas = (dataEmpresas || []).filter((e) => ativa(e.status_situacao));

    configPorEmpresa = {};
    (dataConfig || []).forEach((c) => { configPorEmpresa[c.codigo_empresa] = c.possui_contabil; });
  }

  function possuiContabil(codigoEmpresa) {
    const v = configPorEmpresa[codigoEmpresa];
    return v !== false;
  }

  function renderTela() {
    const main = document.getElementById('main');
    main.innerHTML = `
      <div class="onboarding-header"><div><h2>Configurações</h2></div></div>
      <div class="mapa-secao">
        <div class="mapa-secao-header">Empresas com Contábil</div>
        <div class="mapa-secao-body">
          <p class="full mapa-empty" style="margin-bottom:4px;">Selecione as empresas que possuem contábil na Scont. Somente as marcadas aqui aparecem nos seletores e filtros do Onboarding e do Diário Contábil.</p>
          <div class="full mapa-filtros">
            <input type="text" id="buscaEmpresaConfig" placeholder="Buscar empresa...">
            <button type="button" class="btn btn-secondary" id="btnMarcarTodas">Marcar todas</button>
            <button type="button" class="btn btn-secondary" id="btnDesmarcarTodas">Desmarcar todas</button>
          </div>
          <p class="full mapa-empty" id="contadorEmpresasConfig"></p>
          <div class="full mapa-checkbox-grupo" id="listaEmpresasConfig"></div>
          <div class="full"><button type="button" class="btn-novo" id="btnSalvarConfig">Salvar</button></div>
        </div>
      </div>
    `;

    document.getElementById('buscaEmpresaConfig').addEventListener('input', renderLista);
    document.getElementById('btnMarcarTodas').addEventListener('click', () => alternarVisiveis(true));
    document.getElementById('btnDesmarcarTodas').addEventListener('click', () => alternarVisiveis(false));
    document.getElementById('btnSalvarConfig').addEventListener('click', salvarConfig);

    renderLista();
  }

  function empresasVisiveis() {
    const termo = (document.getElementById('buscaEmpresaConfig').value || '').trim().toLowerCase();
    if (!termo) return empresas;
    return empresas.filter((e) => e.nome_empresa.toLowerCase().includes(termo));
  }

  function renderLista() {
    const lista = document.getElementById('listaEmpresasConfig');
    const visiveis = empresasVisiveis();

    lista.innerHTML = visiveis.length
      ? visiveis.map((e) => `
        <label class="mapa-checkbox-item">
          <input type="checkbox" data-empresa-codigo="${escapeAttr(e.codigo_empresa)}" ${possuiContabil(e.codigo_empresa) ? 'checked' : ''}> ${escapeHtml(e.nome_empresa)}
        </label>
      `).join('')
      : '<p class="mapa-empty full">Nenhuma empresa encontrada.</p>';

    lista.querySelectorAll('[data-empresa-codigo]').forEach((chk) => {
      chk.addEventListener('change', atualizarContador);
    });

    atualizarContador();
  }

  function atualizarContador() {
    const todos = document.querySelectorAll('#listaEmpresasConfig [data-empresa-codigo]');
    const marcados = document.querySelectorAll('#listaEmpresasConfig [data-empresa-codigo]:checked');
    document.getElementById('contadorEmpresasConfig').textContent = `${marcados.length} de ${todos.length} selecionadas (${empresas.length} no total)`;
  }

  function alternarVisiveis(marcar) {
    document.querySelectorAll('#listaEmpresasConfig [data-empresa-codigo]').forEach((chk) => { chk.checked = marcar; });
    atualizarContador();
  }

  async function salvarConfig() {
    const btn = document.getElementById('btnSalvarConfig');
    const checkboxes = Array.from(document.querySelectorAll('#listaEmpresasConfig [data-empresa-codigo]'));
    if (!checkboxes.length) return;

    btn.disabled = true;
    btn.textContent = 'Salvando...';

    const registros = checkboxes.map((chk) => ({
      codigo_empresa: chk.getAttribute('data-empresa-codigo'),
      possui_contabil: chk.checked,
    }));

    const { error } = await supabaseClient
      .from('contabil_empresas_config')
      .upsert(registros, { onConflict: 'codigo_empresa' });

    btn.disabled = false;
    btn.textContent = 'Salvar';

    if (error) {
      console.error(error);
      mostrarToast('Erro ao salvar configurações.', 'erro');
      return;
    }

    registros.forEach((r) => { configPorEmpresa[r.codigo_empresa] = r.possui_contabil; });
    mostrarToast('Configurações salvas.', 'sucesso');
  }

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function escapeAttr(str) { return escapeHtml(str); }

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
})();
