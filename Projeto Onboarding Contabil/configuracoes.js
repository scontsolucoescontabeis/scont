(function () {
  'use strict';

  const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  let empresas = []; // [{ codigo_empresa, nome_empresa }]
  let configPorEmpresa = {}; // { codigo_empresa: boolean } — espelha o que já está salvo no banco

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
    return configPorEmpresa[codigoEmpresa] !== false;
  }

  // ─── PERSISTÊNCIA ───────────────────────────────────────────

  async function salvarLote(registros) {
    if (!registros.length) return { error: null };
    const { error } = await supabaseClient
      .from('contabil_empresas_config')
      .upsert(registros, { onConflict: 'codigo_empresa' });
    if (!error) registros.forEach((r) => { configPorEmpresa[r.codigo_empresa] = r.possui_contabil; });
    return { error };
  }

  // ─── TELA ───────────────────────────────────────────────────

  function renderTela() {
    const main = document.getElementById('main');
    main.classList.add('main-full');
    main.innerHTML = `
      <div class="onboarding-header"><div><h2>Configurações</h2></div></div>
      <div class="mapa-secao">
        <div class="mapa-secao-header">Empresas com Contábil</div>
        <div class="mapa-secao-body">
          <p class="full mapa-empty" style="margin-bottom:4px;">Marque as empresas que possuem contábil na Scont. Somente as marcadas aqui aparecem nos seletores e filtros do Onboarding e do Diário Contábil. As alterações são salvas automaticamente.</p>
          <div class="full mapa-filtros">
            <input type="text" id="buscaEmpresaConfig" placeholder="Buscar empresa...">
            <button type="button" class="btn btn-secondary" id="btnMarcarTodas">Marcar todas</button>
            <button type="button" class="btn btn-secondary" id="btnDesmarcarTodas">Desmarcar todas</button>
            <button type="button" class="btn btn-secondary" id="btnImportarPlanilha">📊 Importar planilha</button>
            <input type="file" id="fileImportarConfig" accept=".xlsx,.xls,.csv" style="display:none">
          </div>
          <p class="full mapa-empty" id="contadorEmpresasConfig"></p>
          <table class="mapa-table full">
            <thead><tr><th>Código Empresa</th><th>Nome Empresa</th><th>Contabilidade</th></tr></thead>
            <tbody id="corpoTabelaConfig"></tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('buscaEmpresaConfig').addEventListener('input', renderTabela);
    document.getElementById('btnMarcarTodas').addEventListener('click', () => alternarVisiveis(true));
    document.getElementById('btnDesmarcarTodas').addEventListener('click', () => alternarVisiveis(false));
    document.getElementById('btnImportarPlanilha').addEventListener('click', () => document.getElementById('fileImportarConfig').click());
    document.getElementById('fileImportarConfig').addEventListener('change', handleImportarPlanilha);

    renderTabela();
  }

  function empresasVisiveis() {
    const termo = (document.getElementById('buscaEmpresaConfig').value || '').trim().toLowerCase();
    if (!termo) return empresas;
    return empresas.filter((e) => e.nome_empresa.toLowerCase().includes(termo) || e.codigo_empresa.toLowerCase().includes(termo));
  }

  function toggleHtml(codigoEmpresa) {
    const sim = possuiContabil(codigoEmpresa);
    return `<button type="button" class="contabil-toggle ${sim ? 'contabil-sim' : 'contabil-nao'}" data-empresa-codigo="${escapeAttr(codigoEmpresa)}" data-value="${sim}">${sim ? 'Sim' : 'Não'}</button>`;
  }

  function renderTabela() {
    const corpo = document.getElementById('corpoTabelaConfig');
    const visiveis = empresasVisiveis();

    corpo.innerHTML = visiveis.length
      ? visiveis.map((e) => `
        <tr>
          <td>${escapeHtml(e.codigo_empresa)}</td>
          <td>${escapeHtml(e.nome_empresa)}</td>
          <td>${toggleHtml(e.codigo_empresa)}</td>
        </tr>
      `).join('')
      : '<tr><td colspan="3">Nenhuma empresa encontrada.</td></tr>';

    corpo.querySelectorAll('.contabil-toggle').forEach((btn) => {
      btn.addEventListener('click', () => alternarUma(btn));
    });

    atualizarContador();
  }

  function definirValor(btn, valor) {
    btn.setAttribute('data-value', String(valor));
    btn.textContent = valor ? 'Sim' : 'Não';
    btn.classList.toggle('contabil-sim', valor);
    btn.classList.toggle('contabil-nao', !valor);
  }

  async function alternarUma(btn) {
    const codigo = btn.getAttribute('data-empresa-codigo');
    const anterior = btn.getAttribute('data-value') === 'true';
    const novo = !anterior;

    definirValor(btn, novo);
    btn.disabled = true;
    atualizarContador();

    const { error } = await salvarLote([{ codigo_empresa: codigo, possui_contabil: novo }]);

    btn.disabled = false;
    if (error) {
      console.error(error);
      definirValor(btn, anterior);
      atualizarContador();
      mostrarToast('Erro ao salvar. Alteração desfeita.', 'erro');
    }
  }

  function atualizarContador() {
    const todos = document.querySelectorAll('#corpoTabelaConfig .contabil-toggle');
    const marcados = document.querySelectorAll('#corpoTabelaConfig .contabil-toggle[data-value="true"]');
    document.getElementById('contadorEmpresasConfig').textContent = `${marcados.length} de ${todos.length} com contábil (${empresas.length} no total)`;
  }

  async function alternarVisiveis(marcar) {
    const botoes = Array.from(document.querySelectorAll('#corpoTabelaConfig .contabil-toggle'));
    const paraSalvar = botoes.filter((b) => (b.getAttribute('data-value') === 'true') !== marcar);
    if (!paraSalvar.length) return;

    paraSalvar.forEach((b) => { b.disabled = true; });

    const registros = paraSalvar.map((b) => ({ codigo_empresa: b.getAttribute('data-empresa-codigo'), possui_contabil: marcar }));
    const { error } = await salvarLote(registros);

    paraSalvar.forEach((b) => { b.disabled = false; });

    if (error) {
      console.error(error);
      mostrarToast('Erro ao salvar as alterações.', 'erro');
      return;
    }

    paraSalvar.forEach((b) => definirValor(b, marcar));
    atualizarContador();
  }

  // ─── IMPORTAÇÃO EM MASSA ────────────────────────────────────

  function normalizarChave(str) {
    return String(str ?? '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  const ALIASES_CODIGO = ['codigoempresa', 'codigo', 'codempresa', 'codemp'];
  const ALIASES_CONTABILIDADE = ['contabilidade', 'possuicontabil', 'contabil', 'temcontabilidade'];

  function interpretarSimNao(valor) {
    if (valor === null || valor === undefined) return null;
    const v = normalizarChave(valor);
    if (!v) return null;
    if (['sim', 's', 'true', '1', 'yes', 'y'].includes(v)) return true;
    if (['nao', 'n', 'false', '0', 'no'].includes(v)) return false;
    return null;
  }

  function lerPlanilhaConfig(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target.result, { type: 'array' });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          if (!sheet) throw new Error('Não foi possível ler o conteúdo deste arquivo.');
          const linhas = XLSX.utils.sheet_to_json(sheet, { defval: null });
          resolve(linhas);
        } catch (err) { reject(err); }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  async function handleImportarPlanilha(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    let linhas;
    try {
      linhas = await lerPlanilhaConfig(file);
    } catch (err) {
      console.error(err);
      mostrarToast('Erro ao ler a planilha.', 'erro');
      return;
    }

    if (!linhas.length) { mostrarToast('Planilha vazia.', 'erro'); return; }

    const cabecalhos = Object.keys(linhas[0]);
    const chaveCodigo = cabecalhos.find((h) => ALIASES_CODIGO.includes(normalizarChave(h)));
    const chaveContabilidade = cabecalhos.find((h) => ALIASES_CONTABILIDADE.includes(normalizarChave(h)));

    if (!chaveCodigo || !chaveContabilidade) {
      mostrarToast('Planilha inválida: são necessárias as colunas "Código Empresa" e "Contabilidade".', 'erro');
      return;
    }

    const empresasPorCodigo = {};
    empresas.forEach((e) => { empresasPorCodigo[e.codigo_empresa] = e; });

    const registrosPorCodigo = {};
    let naoEncontradas = 0;
    let ignoradas = 0;

    linhas.forEach((linha) => {
      const codigo = String(linha[chaveCodigo] ?? '').trim();
      if (!codigo) return;

      const valor = interpretarSimNao(linha[chaveContabilidade]);
      if (valor === null) { ignoradas++; return; }

      if (!empresasPorCodigo[codigo]) { naoEncontradas++; return; }

      registrosPorCodigo[codigo] = valor; // linha repetida: prevalece a última ocorrência
    });

    const registros = Object.entries(registrosPorCodigo).map(([codigo_empresa, possui_contabil]) => ({ codigo_empresa, possui_contabil }));

    if (!registros.length) {
      const partes = ['Nenhuma alteração aplicável encontrada na planilha.'];
      if (naoEncontradas) partes.push(`${naoEncontradas} código(s) não encontrado(s) na base.`);
      if (ignoradas) partes.push(`${ignoradas} linha(s) com valor de contabilidade inválido.`);
      mostrarToast(partes.join(' '), 'erro');
      return;
    }

    const btnImportar = document.getElementById('btnImportarPlanilha');
    btnImportar.disabled = true;
    btnImportar.textContent = 'Importando...';

    const { error } = await salvarLote(registros);

    btnImportar.disabled = false;
    btnImportar.textContent = '📊 Importar planilha';

    if (error) {
      console.error(error);
      mostrarToast('Erro ao salvar as alterações importadas.', 'erro');
      return;
    }

    renderTabela();

    const partes = [`${registros.length} empresa(s) salva(s) no banco.`];
    if (naoEncontradas) partes.push(`${naoEncontradas} código(s) não encontrado(s) na base.`);
    if (ignoradas) partes.push(`${ignoradas} linha(s) com valor de contabilidade inválido.`);
    mostrarToast(partes.join(' '), 'sucesso');
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
