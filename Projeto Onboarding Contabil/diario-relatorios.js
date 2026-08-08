(function () {
  'use strict';

  const STATUS_GRADE_LABELS = { nao_iniciado: 'Não Iniciado', em_andamento: 'Em Andamento', pendencia: 'Pendência', concluido: 'Concluído' };

  const COLUNAS = [
    { key: 'empresa', grupo: 'fixa', label: 'Empresa', padrao: true, fixa: true },
    { key: 'regime', grupo: 'mapeamento', label: 'Regime Tributário', padrao: true },
    { key: 'periodicidade', grupo: 'mapeamento', label: 'Periodicidade', padrao: false },
    { key: 'responsavel', grupo: 'mapeamento', label: 'Responsável pela Execução', padrao: true },
    { key: 'contato', grupo: 'mapeamento', label: 'Contato', padrao: false },
    { key: 'financeiro', grupo: 'mapeamento', label: 'Financeiro Interno/BPO', padrao: false },
    { key: 'bancos', grupo: 'mapeamento', label: 'Bancos Utilizados', padrao: false },
    { key: 'sistemas', grupo: 'mapeamento', label: 'Sistemas Utilizados', padrao: false },
    { key: 'situacaoAno', grupo: 'mapeamento', label: 'Situação do Ano Corrente', padrao: false },
    { key: 'nivel', grupo: 'mapeamento', label: 'Nível de Atenção', padrao: true },
    { key: 'entregaveis', grupo: 'mapeamento', label: 'Entregáveis Esperados', padrao: false },
    { key: 'obrigacoes', grupo: 'mapeamento', label: 'Obrigações Acessórias', padrao: false },
    { key: 'particularidadesContabeis', grupo: 'mapeamento', label: 'Particularidades Contábeis', padrao: false },
    { key: 'particularidadesFiscais', grupo: 'mapeamento', label: 'Particularidades Fiscais', padrao: false },
    { key: 'particularidadesSocietarias', grupo: 'mapeamento', label: 'Particularidades Societárias', padrao: false },
    { key: 'statusGrade', grupo: 'diario', label: 'Status da Grade Mensal', padrao: false },
    { key: 'qtdLancamentos', grupo: 'diario', label: 'Qtd. Lançamentos no Período', padrao: false },
    { key: 'ultimoLancamento', grupo: 'diario', label: 'Último Lançamento', padrao: false },
  ];

  function parseDataLocalRelatorio(str) {
    const [ano, mes, dia] = String(str).split('-').map(Number);
    return new Date(ano, (mes || 1) - 1, dia || 1);
  }

  function anoAtualStr() {
    return String(new Date().getFullYear());
  }

  function render(main) {
    const ctx = window.__diarioContext;
    if (!ctx) { main.innerHTML = '<p class="mapa-empty">Dados ainda não carregados.</p>'; return; }
    renderFiltros(main, ctx);
  }

  function bancosDistintos(ctx) {
    const nomes = new Set();
    Object.values(ctx.bancosPorMapeamento).forEach((lista) => {
      lista.forEach((b) => nomes.add(b.banco));
    });
    return Array.from(nomes).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  function checkboxGrupo(nomeGrupo, opcoes) {
    return opcoes.map(({ value, label }) => `
      <label class="mapa-checkbox-item">
        <input type="checkbox" name="${nomeGrupo}" value="${value}"> ${label}
      </label>
    `).join('');
  }

  function renderFiltros(main, ctx) {
    const hoje = new Date();
    const mesAtual = hoje.getMonth() + 1;
    const anoAtual = hoje.getFullYear();

    main.innerHTML = `
      <div class="onboarding-header"><div><h2>Relatórios</h2></div></div>
      <div class="mapa-secao">
        <div class="mapa-secao-header">Filtros</div>
        <div class="mapa-secao-body">
          <div class="full">
            <label>Nível de Atenção</label>
            <div class="mapa-checkbox-grupo">${checkboxGrupo('filtroNivel', Object.entries(ctx.NIVEL_LABELS).map(([value, label]) => ({ value, label })))}</div>
          </div>
          <div class="full">
            <label>Situação do Ano Corrente (${anoAtualStr()})</label>
            <div class="mapa-checkbox-grupo">${checkboxGrupo('filtroSituacaoAno', Object.entries(ctx.SITUACAO_LABELS).map(([value, label]) => ({ value, label })))}</div>
          </div>
          <div>
            <label>Status da Grade Mensal</label>
            <select id="filtroStatusGrade">
              <option value="">(não filtrar)</option>
              ${Object.entries(STATUS_GRADE_LABELS).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
            </select>
          </div>
          <div>
            <label>Mês/Ano da Grade</label>
            <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
              <select id="filtroGradeMes">
                <option value="">Todos os meses</option>
                ${window.ContabilDiarioUtil.MESES_LABELS.map((l, idx) => `<option value="${idx + 1}" ${idx + 1 === mesAtual ? 'selected' : ''}>${l}</option>`).join('')}
              </select>
              <input type="number" id="filtroGradeAno" value="${anoAtual}" style="width:90px;">
              <label style="display:flex; align-items:center; gap:4px; font-weight:normal;">
                <input type="checkbox" id="chkGradeTodosAnos"> Todos os anos
              </label>
            </div>
          </div>
          <div class="full">
            <label>Banco</label>
            <div class="mapa-checkbox-grupo">${checkboxGrupo('filtroBanco', bancosDistintos(ctx).map((b) => ({ value: b, label: b })))}</div>
          </div>
          <div class="full">
            <label>Regime Tributário</label>
            <div class="mapa-checkbox-grupo">${checkboxGrupo('filtroRegime', Object.entries(ctx.REGIME_LABELS).map(([value, label]) => ({ value, label })))}</div>
          </div>
          <div class="full">
            <label>Financeiro Interno/BPO</label>
            <div class="mapa-checkbox-grupo">${checkboxGrupo('filtroFinanceiro', Object.entries(ctx.FINANCEIRO_LABELS).map(([value, label]) => ({ value, label })))}</div>
          </div>
          <div><label>Lançamentos — de</label><input type="date" id="filtroPeriodoDe"></div>
          <div><label>Lançamentos — até</label><input type="date" id="filtroPeriodoAte"></div>
          <div class="full"><button type="button" class="btn-novo" id="btnBuscarRelatorio">Buscar</button></div>
        </div>
      </div>
      <div id="secaoResultadosRelatorio"></div>
    `;

    const chkTodosAnos = document.getElementById('chkGradeTodosAnos');
    const inputGradeAno = document.getElementById('filtroGradeAno');
    chkTodosAnos.addEventListener('change', () => { inputGradeAno.disabled = chkTodosAnos.checked; });

    document.getElementById('btnBuscarRelatorio').addEventListener('click', () => {
      const filtros = lerFiltros();
      const encontradas = aplicarFiltros(ctx, filtros);
      renderResultados(document.getElementById('secaoResultadosRelatorio'), ctx, encontradas, filtros);
    });
  }

  function valoresMarcados(nomeGrupo) {
    return Array.from(document.querySelectorAll(`input[name="${nomeGrupo}"]:checked`)).map((el) => el.value);
  }

  // gradeMes/gradeAno = null significa "todos" (checkbox/opção "Todos"
  // marcada) — ver docs/superpowers/specs/2026-08-08-diario-relatorios-filtro-todos-mes-ano-design.md.
  function lerFiltros() {
    const valorMes = document.getElementById('filtroGradeMes').value;
    const todosAnos = document.getElementById('chkGradeTodosAnos').checked;
    return {
      niveis: valoresMarcados('filtroNivel'),
      situacoesAno: valoresMarcados('filtroSituacaoAno'),
      statusGrade: document.getElementById('filtroStatusGrade').value || null,
      gradeMes: valorMes === '' ? null : Number(valorMes),
      gradeAno: todosAnos ? null : Number(document.getElementById('filtroGradeAno').value),
      bancos: valoresMarcados('filtroBanco'),
      regimes: valoresMarcados('filtroRegime'),
      financeiros: valoresMarcados('filtroFinanceiro'),
      periodoDe: document.getElementById('filtroPeriodoDe').value || null,
      periodoAte: document.getElementById('filtroPeriodoAte').value || null,
    };
  }

  // Ocorrências (chave 'ano-mes') do status filtrado nas entradas
  // explícitas de contabil_diario_status_mensal da empresa, respeitando
  // mês/ano quando não estão em modo "todos" (null). Reaproveitado pelo
  // filtro e pela coluna "Status da Grade Mensal" do PDF — ver
  // docs/superpowers/specs/2026-08-08-diario-relatorios-filtro-todos-mes-ano-design.md.
  function ocorrenciasStatusGrade(ctx, codigoEmpresa, filtros) {
    const bucket = ctx.statusMensalPorEmpresa[codigoEmpresa] || {};
    return Object.entries(bucket).filter(([chave, status]) => {
      if (status !== filtros.statusGrade) return false;
      const [anoChave, mesChave] = chave.split('-').map(Number);
      if (filtros.gradeAno !== null && anoChave !== filtros.gradeAno) return false;
      if (filtros.gradeMes !== null && mesChave !== filtros.gradeMes) return false;
      return true;
    });
  }

  function aplicarFiltros(ctx, filtros) {
    return ctx.empresas.filter((e) => {
      const m = ctx.mapeamentoDe(e.codigo_empresa);
      const nivel = m ? (m.nivel_atencao || 'baixo') : 'baixo';
      if (filtros.niveis.length && !filtros.niveis.includes(nivel)) return false;

      if (filtros.situacoesAno.length) {
        const statusAno = m ? m[`situacao_${anoAtualStr()}_status`] : null;
        if (!statusAno || !filtros.situacoesAno.includes(statusAno)) return false;
      }

      if (filtros.statusGrade) {
        if (filtros.gradeMes === null || filtros.gradeAno === null) {
          if (!ocorrenciasStatusGrade(ctx, e.codigo_empresa, filtros).length) return false;
        } else {
          const bucket = ctx.statusMensalPorEmpresa[e.codigo_empresa];
          const statusMes = (bucket && bucket[`${filtros.gradeAno}-${filtros.gradeMes}`]) || 'nao_iniciado';
          if (statusMes !== filtros.statusGrade) return false;
        }
      }

      if (filtros.bancos.length) {
        const bancosEmpresa = m ? (ctx.bancosPorMapeamento[m.id] || []).map((b) => b.banco) : [];
        if (!filtros.bancos.some((b) => bancosEmpresa.includes(b))) return false;
      }

      if (filtros.regimes.length) {
        if (!m || !filtros.regimes.includes(m.regime_tributario)) return false;
      }

      if (filtros.financeiros.length) {
        if (!m || !filtros.financeiros.includes(m.financeiro_interno_bpo)) return false;
      }

      return true;
    });
  }

  function renderResultados(el, ctx, encontradas, filtros) {
    if (!encontradas.length) {
      el.innerHTML = '<div class="mapa-secao"><div class="mapa-secao-body"><p class="mapa-empty full">Nenhuma empresa encontrada com esses filtros.</p></div></div>';
      return;
    }

    const empresasHtml = encontradas.map((e) => `
      <label class="mapa-checkbox-item">
        <input type="checkbox" data-empresa-codigo="${ctx.escapeHtml(e.codigo_empresa)}" checked> ${ctx.escapeHtml(e.nome_empresa)}
      </label>
    `).join('');

    const colunasHtml = COLUNAS.map((c) => `
      <label class="mapa-checkbox-item">
        <input type="checkbox" data-coluna-key="${c.key}" ${c.padrao || c.fixa ? 'checked' : ''} ${c.fixa ? 'disabled' : ''}> ${c.label}
      </label>
    `).join('');

    el.innerHTML = `
      <div class="mapa-secao">
        <div class="mapa-secao-header">Empresas Encontradas (${encontradas.length})</div>
        <div class="mapa-secao-body">
          <div class="full mapa-checkbox-grupo">${empresasHtml}</div>
        </div>
      </div>
      <div class="mapa-secao">
        <div class="mapa-secao-header">Colunas do Relatório</div>
        <div class="mapa-secao-body">
          <div class="full mapa-checkbox-grupo">${colunasHtml}</div>
        </div>
      </div>
      <div class="mapa-secao">
        <div class="mapa-secao-body">
          <div class="full"><button type="button" class="btn btn-primary" id="btnGerarRelatorioPdf">📄 Gerar PDF</button></div>
        </div>
      </div>
    `;

    el.querySelector('#btnGerarRelatorioPdf').addEventListener('click', async () => {
      const codigosSelecionados = Array.from(el.querySelectorAll('[data-empresa-codigo]:checked')).map((i) => i.getAttribute('data-empresa-codigo'));
      const colunasSelecionadas = COLUNAS.filter((c) => el.querySelector(`[data-coluna-key="${c.key}"]`).checked);
      if (!codigosSelecionados.length) return;
      await gerarPdfRelatorio(ctx, codigosSelecionados, colunasSelecionadas, filtros);
    });
  }

  function truncar(texto, max) {
    if (!texto) return '';
    return texto.length > max ? texto.slice(0, max) + '…' : texto;
  }

  async function buscarInfoLancamentos(ctx, codigos, periodoDe, periodoAte) {
    let query = ctx.supabaseClient
      .from('contabil_diario_lancamentos')
      .select('codigo_empresa, data, texto, criado_por_nome, criado_por_email, created_at')
      .in('codigo_empresa', codigos)
      .order('data', { ascending: false })
      .order('created_at', { ascending: false });
    if (periodoDe) query = query.gte('data', periodoDe);
    if (periodoAte) query = query.lte('data', periodoAte);
    const { data, error } = await query;
    if (error) { console.error(error); return {}; }

    const porEmpresa = {};
    (data || []).forEach((l) => {
      const bucket = (porEmpresa[l.codigo_empresa] = porEmpresa[l.codigo_empresa] || { qtd: 0, ultimo: null });
      bucket.qtd += 1;
      if (!bucket.ultimo) bucket.ultimo = l;
    });
    return porEmpresa;
  }

  async function gerarPdfRelatorio(ctx, codigos, colunas, filtros) {
    const precisaLancamentos = colunas.some((c) => c.key === 'qtdLancamentos' || c.key === 'ultimoLancamento');
    const infoLancamentos = precisaLancamentos
      ? await buscarInfoLancamentos(ctx, codigos, filtros.periodoDe, filtros.periodoAte)
      : {};

    const linhas = codigos.map((codigo) => {
      const e = ctx.empresas.find((x) => x.codigo_empresa === codigo);
      const m = ctx.mapeamentoDe(codigo);
      const bancos = m ? (ctx.bancosPorMapeamento[m.id] || []).map((b) => b.banco) : [];
      const lanc = infoLancamentos[codigo];

      return colunas.map((c) => {
        switch (c.key) {
          case 'empresa': return e ? e.nome_empresa : codigo;
          case 'regime': return m && m.regime_tributario ? (ctx.REGIME_LABELS[m.regime_tributario] || m.regime_tributario) : '—';
          case 'periodicidade': return m && m.periodicidade ? (ctx.PERIODICIDADE_LABELS[m.periodicidade] || m.periodicidade) : '—';
          case 'responsavel': return m && m.responsavel_execucao ? m.responsavel_execucao : '—';
          case 'contato': return m ? [m.contato_nome, m.contato_telefone, m.contato_email].filter(Boolean).join(' • ') || '—' : '—';
          case 'financeiro': return m && m.financeiro_interno_bpo ? (ctx.FINANCEIRO_LABELS[m.financeiro_interno_bpo] || m.financeiro_interno_bpo) : '—';
          case 'bancos': return bancos.length ? bancos.join(', ') : '—';
          case 'sistemas': return m && (m.sistemas_utilizados || []).length ? m.sistemas_utilizados.join(', ') : '—';
          case 'situacaoAno': {
            const status = m ? m[`situacao_${anoAtualStr()}_status`] : null;
            return status ? (ctx.SITUACAO_LABELS[status] || status) : '—';
          }
          case 'nivel': return ctx.NIVEL_LABELS[m ? (m.nivel_atencao || 'baixo') : 'baixo'];
          case 'entregaveis': return m && (m.entregaveis_esperados || []).length ? m.entregaveis_esperados.join(', ') : '—';
          case 'obrigacoes': return m && (m.obrigacoes_acessorias || []).length ? m.obrigacoes_acessorias.join(', ') : '—';
          case 'particularidadesContabeis': return m && m.particularidades_contabeis ? m.particularidades_contabeis : '—';
          case 'particularidadesFiscais': return m && m.particularidades_fiscais ? m.particularidades_fiscais : '—';
          case 'particularidadesSocietarias': return m && m.particularidades_societarias ? m.particularidades_societarias : '—';
          case 'statusGrade': {
            if (filtros.gradeMes === null || filtros.gradeAno === null) {
              if (!filtros.statusGrade) return '—';
              const ocorrencias = ocorrenciasStatusGrade(ctx, codigo, filtros)
                .map(([chave]) => {
                  const [anoChave, mesChave] = chave.split('-').map(Number);
                  return `${window.ContabilDiarioUtil.MESES_LABELS[mesChave - 1]}/${anoChave}`;
                })
                .sort();
              return ocorrencias.length ? ocorrencias.join(', ') : '—';
            }
            const bucket = ctx.statusMensalPorEmpresa[codigo];
            const status = (bucket && bucket[`${filtros.gradeAno}-${filtros.gradeMes}`]) || 'nao_iniciado';
            return STATUS_GRADE_LABELS[status];
          }
          case 'qtdLancamentos': return lanc ? String(lanc.qtd) : '0';
          case 'ultimoLancamento': {
            if (!lanc || !lanc.ultimo) return '—';
            const data = parseDataLocalRelatorio(lanc.ultimo.data).toLocaleDateString('pt-BR');
            const autor = lanc.ultimo.criado_por_nome || lanc.ultimo.criado_por_email || 'desconhecido';
            return `${data} — ${truncar(lanc.ultimo.texto, 80)} (${autor})`;
          }
          default: return '—';
        }
      });
    });

    const { jsPDF } = window.jspdf;
    const orientacao = colunas.length >= 5 ? 'landscape' : 'portrait';
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: orientacao });
    const MARGEM = 10;
    const pageW = doc.internal.pageSize.getWidth();

    doc.setFillColor(139, 58, 58);
    doc.roundedRect(MARGEM, MARGEM, pageW - MARGEM * 2, 16, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13); doc.setFont('helvetica', 'bold');
    doc.text('Relatório — Departamento Contábil', MARGEM + 4, MARGEM + 10);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.text('Gerado em ' + new Date().toLocaleDateString('pt-BR'), pageW - MARGEM - 4, MARGEM + 10, { align: 'right' });

    doc.autoTable({
      head: [colunas.map((c) => c.label)],
      body: linhas,
      startY: MARGEM + 22,
      margin: { left: MARGEM, right: MARGEM },
      styles: { fontSize: 7.5, cellPadding: 1.6, textColor: [44, 62, 80] },
      headStyles: { fillColor: [139, 58, 58], textColor: 255 },
      theme: 'striped',
    });

    doc.save(`relatorio-departamento-contabil-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  window.DiarioRelatorios = { render };
})();
