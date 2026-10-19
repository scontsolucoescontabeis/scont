// Projeto PDI/js/tela-pdi.js — PDI individual (abas na ordem do documento de referência)
window.PdiTela = (function () {
    'use strict';
    const U = window.PdiUI;
    const e = U.esc;
    const T = window.PdiTextos;
    const C = window.PdiCalculo;
    const Doc = window.PdiDocumento;
    const Api = window.PdiApi;
    const fd = Doc.fmtData;

    const ABAS = [
        ['resumo', 'Resumo'], ['cabecalho', '1–2 Objetivo e perfil'], ['pilares', '3 Pilares 1 e 2'],
        ['plano', '4 Plano do ciclo'], ['performance', '5 Pilares 3 e 4'], ['acomp', 'Acompanhamento'],
        ['feedbacks', 'Feedbacks'], ['ficha', '6 Ficha trimestral'], ['evolucao', '7 Evolução'],
        ['ciencia', '8 Ciência'], ['documento', 'Documento'],
    ];

    let host = null, d = null, ctx = null, aba = 'resumo';
    let ocupado = false, sujo = false;

    window.addEventListener('beforeunload', (ev) => { if (sujo) { ev.preventDefault(); ev.returnValue = ''; } });

    function render(h, dados, contexto, abaInicial) {
        host = h; d = dados; ctx = contexto;
        if (abaInicial) aba = abaInicial;
        desenhar();
    }

    async function salvar(fn, ok) {
        if (ocupado) return;           // evita duplo clique duplicar o registro
        ocupado = true;
        const y = window.scrollY;      // mantém a posição de leitura após recarregar
        host.setAttribute('aria-busy', 'true');
        try {
            await fn();
            sujo = false;
            if (ok) U.toast(ok, 'ok');
            await ctx.recarregar(aba);
            window.scrollTo(0, y);
        } catch (err) {
            U.toast(U.erroAmigavel(err), 'erro');
        } finally {
            ocupado = false;
            host.removeAttribute('aria-busy');
        }
    }

    async function trocarAba(nova) {
        if (sujo && !(await U.confirmar('Alterações não salvas', 'Você alterou a ficha e ainda não salvou. Sair descarta essas alterações.', 'Descartar e sair'))) return;
        sujo = false;
        aba = nova;
        desenhar();
        window.scrollTo(0, 0);
    }

    // ---------- util ----------
    const pode = () => ctx.pode.avaliar;
    // data-label em cada célula: no celular a tabela empilha em cartões (CSS .empilhar)
    const rotular = (tr, cab) => { let i = 0; return tr.replace(/<td(?=[ >])/g, () => `<td data-label="${e(cab[i++] || '')}"`); };
    const tabela = (cab, linhas, vazio) => linhas.length
        ? `<div class="tabela-wrap"><table class="doc-tab empilhar"><thead><tr>${cab.map(c => `<th>${e(c)}</th>`).join('')}</tr></thead><tbody>${linhas.map(l => rotular(l, cab)).join('')}</tbody></table></div>`
        : `<p class="vazio">${e(vazio || 'Nada registrado ainda.')}</p>`;
    const btn = (a, rot, id, cls) => `<button class="btn peq ${cls || 'sec'}" data-a="${a}"${id ? ` data-id="${e(id)}"` : ''}>${e(rot)}</button>`;
    const fim = () => C.fimPdi(d.pdi.data_inicio, d.pdi.meses_acompanhamento);
    const cicloAtual = () => {
        const h = U.hojeISO();
        const c = (d.ciclos || []).find(x => h >= x.inicio && h <= x.fim);
        return c ? c.numero : (h > fim() ? 4 : 1);
    };
    const nivelRot = (n) => { const x = T.ESCALA_TECNICA.find(i => i.nivel === n); return x ? `${n} — ${x.titulo}` : '—'; };

    function dadosComSemanas() {
        return { ...d, semanasPrevistas: window.PdiAlertas.semanasPrevistas(d.pdi.data_inicio, U.hojeISO(), fim()) };
    }

    // ---------- abas ----------
    function abaResumo() {
        const dd = dadosComSemanas();
        const alertas = window.PdiAlertas.calcular(dd, U.hojeISO());
        const prio = C.progressoTecnico(d.tecnicas, 2);
        const acoes = d.acoes.filter(a => !a.recorrencia);
        const conc = acoes.filter(a => a.status === 'concluido').length;
        const ultimas = d.avaliacoes.filter(a => a.status === 'concluida').slice(-1)[0];
        const kpi = (rot, val, sub) => `<div class="kpi"><span class="kpi-v${String(val).length > 7 ? ' txt' : ''}">${e(val)}</span><span class="kpi-r">${e(rot)}</span>${sub ? `<small>${e(sub)}</small>` : ''}</div>`;
        const prox = acoes.filter(a => a.status !== 'concluido').map(a => ({ a, data: C.somarDias(d.pdi.data_inicio, a.prazo_dias) }))
            .sort((x, y) => x.data.localeCompare(y.data)).slice(0, 4);
        return `<div class="kpis">
            ${kpi('Ciclo atual', cicloAtual(), `${fd(d.pdi.data_inicio)} a ${fd(fim())}`)}
            ${kpi('Ações concluídas', `${conc} de ${acoes.length}`)}
            ${kpi('Rotinas priorizadas ≥ nível 2', prio.total ? `${prio.atingidas} de ${prio.total}` : '—')}
            ${kpi('Autonomia', Doc.fmtPct(C.autonomia(d.tecnicas)))}
            ${kpi('Última avaliação', ultimas ? T.RESULTADOS[ultimas.resultado] || '—' : '—', ultimas ? `Ciclo ${ultimas.ciclo_numero}` : '')}
        </div>
        <h3>Alertas</h3>
        ${alertas.length ? `<ul class="alertas">${alertas.map(a => `<li class="al ${a.gravidade}">${e(a.mensagem)}</li>`).join('')}</ul>` : '<p class="muted">Nenhum alerta no momento.</p>'}
        <h3>Próximas ações</h3>
        ${tabela(['Ação', 'Prazo', 'Status'], prox.map(x => `<tr><td>${e(x.a.foco_acao)}</td><td>${fd(x.data)}</td><td>${e(T.STATUS_ACAO[x.a.status])}</td></tr>`), 'Sem ações pendentes com prazo.')}`;
    }

    function abaCabecalho() {
        const p = d.pdi, cont = p.conteudo || {}, pc = p.perfil_comportamental || {};
        const ed = pode();
        return `<h2>${e(T.SECOES[0].titulo)}</h2>
        <table class="doc-kv"><tbody>
          <tr><th>Nome</th><td>${e(p.colaborador_nome)}</td></tr>
          <tr><th>Cargo e setor</th><td>${e(p.cargo_setor)}</td></tr>
          <tr><th>Admissão</th><td>${fd(p.admissao)}</td></tr>
          <tr><th>Gestor responsável</th><td>${e(p.gestor_nome || '—')}</td></tr>
          <tr><th>Início do PDI (D)</th><td>${fd(p.data_inicio)}</td></tr>
          <tr><th>Acompanhamento</th><td>${e(p.acompanhamento_texto)}</td></tr>
          <tr><th>Avaliação</th><td>${e(p.avaliacao_texto)}</td></tr>
        </tbody></table>
        ${ed ? `<p>${btn('editar-cabecalho', 'Editar cabeçalho')}</p>` : ''}

        <h2>${e(T.SECOES[1].titulo)}</h2>
        ${(cont.objetivo || [T.TEXTOS.objetivo1, T.TEXTOS.objetivo2]).map(t => `<p>${U.br(t)}</p>`).join('')}
        <p><strong>Contexto de desenvolvimento:</strong> ${U.br(p.contexto_desenvolvimento || '—')}</p>
        ${ed ? `<p>${btn('editar-contexto', 'Editar contexto e objetivo')}</p>` : ''}

        <h2>${e(T.SECOES[2].titulo)}</h2>
        <h3>Perfil evidenciado</h3>
        ${pc.disc ? `<p>O relatório comportamental de ${fd(pc.data_relatorio)} apresenta predominância DISC <strong>${e(pc.disc)} — ${e(pc.disc_descritor || '')}</strong>.</p>
          <p>${U.br(pc.descricao || '')}</p><p>${U.br(pc.complementares || '')}</p>
          ${pc.oportunidades ? `<p><strong>Oportunidades apontadas:</strong> ${e(pc.oportunidades)}</p>` : ''}`
            : '<p class="muted">Perfil comportamental ainda não registrado.</p>'}
        <p class="doc-nota">${e(T.TEXTOS.avisoPerfilEvidenciado)}</p>
        ${pc.arquivo ? btn('abrir-relatorio', 'Abrir relatório (PDF)') : ''}
        ${ed ? btn('editar-perfil', 'Editar perfil evidenciado') + ' ' + btn('enviar-relatorio', 'Anexar relatório (PDF)') : ''}
        <h3>Perfil esperado para o cargo</h3>
        ${tabela(['Competência', 'Evidência do relatório', 'Direcionamento inicial', 'Status', ...(ed ? [''] : [])],
            (cont.perfil_esperado || []).map((r, i) => `<tr${r.status === 'prioritario' ? ' class="destaque"' : ''}>
              <td>${e(r.competencia)}</td><td>${e(r.evidencia)}</td><td>${e(r.direcionamento)}</td>
              <td>${U.badge(T.STATUS_PERFIL[r.status] || r.status, r.status)}${r.validado_em ? `<br><small>Validado em ${fd(r.validado_em)}</small>` : ''}</td>
              ${ed ? `<td>${btn('perfil-status', 'Alterar', String(i))}</td>` : ''}</tr>`))}
        <p>${e(T.TEXTOS.statusPerfilProposto)}</p>
        <p class="doc-nota">${e(T.TEXTOS.avisoPerfilEsperado)}</p>`;
    }

    function abaPilares() {
        const ed = pode(), col = ctx.pode.colab || ed;
        const prog1 = C.progressoTecnico(d.tecnicas, 2), prog3 = C.progressoTecnico(d.tecnicas, 3);
        const pendInicial = C.nivelInicialPendente(d.pdi.data_inicio, U.hojeISO(), d.tecnicas.filter(t => t.niveis.length).length);
        return `<h2>${e(T.SECOES[3].titulo)}</h2>
        <h3>PILAR 1 – COMPETÊNCIAS TÉCNICAS</h3>
        <p>${e(T.TEXTOS.pilar1Intro)}</p>
        ${pendInicial ? `<p class="al critico">Nível inicial não registrado até D + 15 dias (${fd(C.somarDias(d.pdi.data_inicio, 15))}).</p>` : ''}
        <p><strong>Progresso:</strong> ${prog1.atingidas} de ${prog1.total} rotinas priorizadas no nível ≥ 2 (meta do 1º trimestre) · ${prog3.atingidas} de ${prog3.total} no nível ≥ 3 (ciclos seguintes).</p>
        ${tabela(['Competência', 'Prática de desenvolvimento', 'Meta no primeiro ciclo', 'Priorizada', 'Nível atual', 'Histórico', ''],
            d.tecnicas.map(t => {
                const atual = C.nivelAtual(t.niveis);
                const ultimo = t.niveis[t.niveis.length - 1];
                return `<tr><td>${e(t.competencia)}</td><td>${e(t.pratica)}</td><td>${e(t.meta_ciclo1)}</td>
                  <td>${ed ? `<input type="checkbox" data-a="priorizar" data-id="${t.id}"${t.priorizada ? ' checked' : ''} aria-label="Priorizada">` : (t.priorizada ? 'Sim' : 'Não')}</td>
                  <td>${atual == null ? '—' : e(nivelRot(atual))}${ultimo && !ultimo.validado_em ? '<br><small class="aviso">último registro aguarda validação</small>' : ''}</td>
                  <td>${t.niveis.map(n => `<div class="hist">${fd(n.data)}: <strong>${n.nivel}</strong> ${n.validado_em ? '✔' : '⏳'}${n.evidencia ? ` — ${e(n.evidencia)}` : ''}${ed && !n.validado_em ? ' ' + btn('validar-nivel', 'Validar', n.id, 'ok') : ''}</div>`).join('') || '—'}</td>
                  <td>${col ? btn('registrar-nivel', 'Registrar nível', t.id) : ''}</td></tr>`;
            }))}
        <h3>Escala de evolução técnica</h3>
        <ul class="doc-lista">${T.ESCALA_TECNICA.map(x => `<li><strong>${x.nivel} — ${e(x.titulo)}:</strong> ${e(x.descricao)}</li>`).join('')}</ul>
        <p>${e(T.TEXTOS.pilar1Regra)}</p>

        <h3>PILAR 2 – COMPETÊNCIAS COMPORTAMENTAIS</h3>
        ${tabela(['Competência', 'Comportamento esperado', 'Ação e evidência', 'Nota atual', 'Histórico', ''],
            d.comportamentais.map(c => {
                const u = c.avaliacoes[c.avaliacoes.length - 1];
                return `<tr><td>${e(c.competencia)}</td><td>${e(c.comportamento_esperado)}</td><td>${e(c.acao_evidencia)}</td>
                  <td>${u ? e(`${u.nota} — ${T.ESCALA_COMPORTAMENTAL[u.nota - 1].titulo}`) : '—'}</td>
                  <td>${c.avaliacoes.map(a => `<div class="hist">${fd(a.data)}: <strong>${a.nota}</strong>${a.evidencia ? ` — ${e(a.evidencia)}` : ''}</div>`).join('') || '—'}</td>
                  <td>${ed ? btn('avaliar-comp', 'Avaliar', c.id) : ''}</td></tr>`;
            }))}
        <h4>Escala comportamental</h4>
        <ul class="doc-lista">${T.ESCALA_COMPORTAMENTAL.map(x => `<li>${x.nivel} — ${e(x.titulo)}</li>`).join('')}</ul>`;
    }

    function abaPlano() {
        const ed = pode(), col = ctx.pode.colab || ed;
        const hoje = U.hojeISO();
        return `<h2>${e(T.SECOES[4].titulo)}</h2><p>${e(T.TEXTOS.planoIntro)}</p>
        ${tabela(['Foco e ação', 'Responsáveis', 'Prazo', 'Evidência esperada', 'Status', ''],
            d.acoes.map(a => {
                const pr = C.prazoRelativo(d.pdi.data_inicio, a.prazo_dias, a.recorrencia);
                const atrasada = pr.data && a.status !== 'concluido' && pr.data < hoje;
                const evid = d.evidencias.filter(x => x.ref_tipo === 'acao' && x.ref_id === a.id);
                return `<tr${atrasada ? ' class="atrasada"' : ''}><td>${e(a.foco_acao)}${a.origem === 'ficha_trimestral' ? ' <small>(ficha trimestral)</small>' : ''}</td>
                  <td>${e(a.responsaveis)}</td><td>${e(pr.rotulo)}${pr.data ? `<br><small>${fd(pr.data)}</small>` : ''}${atrasada ? '<br><span class="aviso">Atrasada</span>' : ''}</td>
                  <td>${e(a.evidencia_esperada)}${evid.map(x => `<div class="hist">${x.link ? `<a href="${e(x.link)}" target="_blank" rel="noopener">${e(x.texto || x.link)}</a>` : e(x.texto)}</div>`).join('')}</td>
                  <td>${col ? `<select data-a="status-acao" data-id="${a.id}" aria-label="Status da ação">${Object.entries(T.STATUS_ACAO).map(([k, v]) =>
                      `<option value="${k}"${a.status === k ? ' selected' : ''}>${e(v)}</option>`).join('')}</select>` : e(T.STATUS_ACAO[a.status])}</td>
                  <td>${col ? btn('evidencia-acao', 'Evidência', a.id) : ''}</td></tr>`;
            }))}
        <p><strong>Status inicial das ações:</strong> ${e(T.TEXTOS.planoStatusInicial)}</p>
        <p><strong>Apoio da Scont:</strong> ${e(d.pdi.apoio_scont || T.TEXTOS.apoioScont)}</p>
        ${ed ? `<p>${btn('nova-acao', 'Nova ação (prioridade do próximo ciclo)', null, 'ok')}</p>` : ''}`;
    }

    function abaPerformance() {
        const ed = pode(), col = ctx.pode.colab || ed;
        const dd = dadosComSemanas();
        return `<h2>${e(T.SECOES[5].titulo)}</h2>
        <h3>PILAR 3 — INDICADORES DE PERFORMANCE</h3><p>${e(T.TEXTOS.pilar3Intro)}</p>
        ${tabela(['Indicador e cálculo', 'Meta proposta no ciclo 1', 'Evidência', 'Resultado', 'Apurações', ''],
            d.indicadores.map(i => {
                const v = Doc.valorIndicador(i, dd);
                const st = C.atingimento(i, v);
                return `<tr><td><strong>${e(i.nome)}</strong>: ${e(i.formula)}${i.calculo_automatico ? '<br><small>cálculo automático</small>' : ''}</td>
                  <td>${e(i.meta_texto)}${i.tipo_meta === 'relativa_linha_base' ? `<br><small>${i.valor_meta == null ? 'percentual a definir após a medição' : `meta: ≤ ${i.valor_meta}%`}</small>` : ''}</td>
                  <td>${e(i.evidencia)}</td>
                  <td>${v == null ? 'Sem medição' : `<strong>${Doc.fmtPct(v)}</strong><br>${U.badge(T.ATINGIMENTO[st], st)}`}</td>
                  <td>${i.apuracoes.map(a => `<div class="hist">${String(a.competencia_mes).slice(5, 7)}/${String(a.competencia_mes).slice(0, 4)}: ${a.numerador}/${a.denominador} = ${a.percentual == null ? '—' : Doc.fmtPct(Number(a.percentual))}${a.linha_base ? ' <em>(linha de base)</em>' : ''}</div>`).join('') || '—'}</td>
                  <td>${ed ? btn('apurar', 'Apurar mês', i.id) + (i.tipo_meta !== 'numerica' ? ' ' + btn('meta-indicador', 'Definir meta', i.id) : '') : ''}</td></tr>`;
            }))}
        ${grafico()}
        <h3>PILAR 4 — MELHORIAS APRESENTADAS</h3><p>${e(T.TEXTOS.pilar4Intro)}</p>
        ${tabela([...T.TEXTOS.pilar4Colunas, ''],
            d.melhorias.map(m => `<tr><td>${fd(m.data)} — ${e(m.rotina)}</td><td>${e(m.situacao_anterior)}</td><td>${e(m.melhoria_evidencia)}</td>
              <td>${m.validacao_gestor === 'validado' ? U.badge('Validado', 'consolidado') : m.validacao_gestor === 'nao_validado' ? U.badge('Não validado', 'prioritario') : U.badge('Pendente', 'em_desenvolvimento')}
                ${m.comentario_gestor ? `<br><small>${e(m.comentario_gestor)}</small>` : ''}${m.validado_em ? `<br><small>${fd(m.validado_em)}</small>` : ''}</td>
              <td>${ed ? btn('validar-melhoria', 'Validar', m.id) : ''}</td></tr>`), 'Nenhuma melhoria registrada.')}
        ${col ? `<p>${btn('nova-melhoria', 'Registrar melhoria', null, 'ok')}</p>` : ''}
        <p><strong>Frequência:</strong> ${e(T.TEXTOS.frequencia)}</p>`;
    }

    function grafico() {
        const pontos = d.indicadores.filter(i => i.apuracoes.some(a => a.percentual != null));
        if (!pontos.length) return '';
        const meses = [...new Set(d.indicadores.flatMap(i => i.apuracoes.map(a => String(a.competencia_mes).slice(0, 7))))].sort();
        if (!meses.length) return '';
        const W = 560, H = 180, pad = 28;
        const x = (k) => pad + (meses.length === 1 ? (W - 2 * pad) / 2 : k * (W - 2 * pad) / (meses.length - 1));
        const y = (v) => H - pad - (v / 100) * (H - 2 * pad);
        const cores = ['#8B3A3A', '#2C3E50', '#27AE60', '#C8861E', '#6C5B9E', '#1B8A9E'];
        const linhas = pontos.map((i, idx) => {
            const pts = meses.map((m, k) => { const a = i.apuracoes.find(z => String(z.competencia_mes).slice(0, 7) === m); return a && a.percentual != null ? [x(k), y(Number(a.percentual))] : null; }).filter(Boolean);
            return `<polyline fill="none" stroke="${cores[idx % 6]}" stroke-width="2" points="${pts.map(p => p.join(',')).join(' ')}"/>` +
                pts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="${cores[idx % 6]}"/>`).join('');
        }).join('');
        const eixo = meses.map((m, k) => `<text x="${x(k)}" y="${H - 8}" font-size="10" text-anchor="middle" fill="currentColor">${m.slice(5)}/${m.slice(2, 4)}</text>`).join('');
        const leg = pontos.map((i, idx) => `<span class="leg"><i style="background:${cores[idx % 6]}"></i>${e(i.nome)}</span>`).join('');
        return `<figure class="grafico" aria-label="Evolução mensal dos indicadores"><svg viewBox="0 0 ${W} ${H}" role="img">
            <line x1="${pad}" y1="${y(0)}" x2="${W - pad}" y2="${y(0)}" stroke="#ccc"/><line x1="${pad}" y1="${y(100)}" x2="${W - pad}" y2="${y(100)}" stroke="#eee"/>
            <text x="4" y="${y(100) + 4}" font-size="10" fill="currentColor">100%</text><text x="8" y="${y(0) + 4}" font-size="10" fill="currentColor">0</text>
            ${linhas}${eixo}</svg><figcaption>${leg}</figcaption></figure>`;
    }

    function semanaDe(iso) { return window.PdiAlertas.segunda(iso); }

    function abaAcompanhamento() {
        const ed = pode(), col = ctx.pode.colab || ed;
        const previstas = window.PdiAlertas.semanasPrevistas(d.pdi.data_inicio, U.hojeISO(), fim());
        const real = d.alinhamentos.filter(a => a.realizado).length;
        return `<h2>Acompanhamento</h2>
        <p>${e(T.TEXTOS.frequencia)}</p>
        <p><strong>Controles:</strong> ${real} revisões realizadas de ${previstas} previstas (${Doc.fmtPct(C.controles(real, previstas))}).</p>
        <h3>Alinhamento semanal</h3>
        ${tabela(['Semana', 'Concluídos', 'Pendências', 'Apoio necessário', 'Dificuldades', 'Feedback do gestor', ''],
            d.alinhamentos.slice().reverse().map(a => `<tr><td>${fd(a.semana_ref)}${a.realizado ? '' : '<br><small class="aviso">não realizado</small>'}</td>
              <td>${U.br(a.concluidos)}</td><td>${U.br(a.pendencias)}</td><td>${U.br(a.apoio_necessario)}</td><td>${U.br(a.dificuldades)}</td>
              <td>${U.br(a.feedback_gestor)}</td><td>${col ? btn('editar-alinhamento', 'Editar', a.id) : ''}</td></tr>`), 'Nenhum alinhamento registrado.')}
        ${col ? `<p>${btn('novo-alinhamento', 'Registrar resumo semanal', null, 'ok')}</p>` : ''}
        <h3>Sinalização de pendência / risco de prazo</h3>
        ${tabela(['Descrição', 'Sinalizada em', 'Prazo da entrega', 'Antes do prazo?', 'Resultado'],
            d.sinalizacoes.map(s => `<tr><td>${e(s.descricao)}</td><td>${fd(s.data_sinalizacao)}</td><td>${fd(s.prazo_entrega)}</td>
              <td>${s.antes_do_prazo ? 'Sim' : 'Não'}</td><td>${e(s.resultado || '')}</td></tr>`), 'Nenhuma sinalização registrada.')}
        <p><strong>Pendências:</strong> ${Doc.fmtPct(C.pendencias(d.sinalizacoes))}</p>
        ${col ? `<p>${btn('nova-sinalizacao', 'Sinalizar pendência/risco', null, 'ok')}</p>` : ''}`;
    }

    function abaFeedbacks() {
        const ed = pode();
        return `<h2>Feedbacks</h2>
        ${ed ? `<p>${btn('novo-feedback', 'Escrever feedback', null, 'ok')}</p>` : ''}
        ${d.feedbacks.length ? d.feedbacks.map(f => `<article class="feedback"><header><strong>${e(f.autor_nome || f.autor_papel)}</strong>
            <span class="muted">${e({ gestor: 'Gestor', socio: 'Sócio', admin: 'Administrador' }[f.autor_papel])} · ${fd(f.created_at)}${f.ciclo_numero ? ` · Ciclo ${f.ciclo_numero}` : ''}</span></header>
            <p>${U.br(f.texto)}</p></article>`).join('') : '<p class="muted">Nenhum feedback registrado.</p>'}`;
    }

    function fichaDe(n) { return d.avaliacoes.find(a => a.ciclo_numero === n); }

    function abaFicha() {
        const n = ctx.cicloFicha || cicloAtual();
        const f = fichaDe(n);
        const ed = pode();
        const ciclo = d.ciclos.find(c => c.numero === n) || {};
        const sel = `<p><label>Ciclo <select data-a="ciclo-ficha">${[1, 2, 3, 4].map(k => `<option value="${k}"${k === n ? ' selected' : ''}>Ciclo ${k}${fichaDe(k) ? ' — ' + T.STATUS_FICHA[fichaDe(k).status] : ''}</option>`).join('')}</select></label></p>`;
        if (!f) {
            return `<h2>${e(T.SECOES[6].titulo)}</h2>${sel}<p class="muted">Ficha do ciclo ${n} ainda não aberta.</p>
              ${ed ? btn('abrir-ficha', `Abrir ficha do ciclo ${n}`, null, 'ok') : ''}`;
        }
        const bloq = f.status === 'concluida';
        const edita = ed && !bloq;
        const colEdita = ctx.pode.colab && !bloq;
        const ciencias = d.ciencias.filter(c => c.referencia === 'avaliacao' && c.referencia_id === f.id);
        const pil = (p) => f.pilares.find(x => x.pilar === p) || {};
        const mediaTec = C.mediaNotas(d.tecnicas.map(t => C.nivelAtual(t.niveis)));
        const mediaComp = C.mediaNotas(d.comportamentais.map(c => (c.avaliacoes.slice(-1)[0] || {}).nota));
        const valid = d.melhorias.filter(m => m.validacao_gestor === 'validado' && m.data >= (ciclo.inicio || '') && m.data <= (ciclo.fim || '9999')).length;
        const dd = dadosComSemanas();
        const resumoInd = d.indicadores.map(i => { const v = Doc.valorIndicador(i, dd); return `${i.nome}: ${v == null ? 'sem medição' : Doc.fmtPct(v)}`; }).join(' · ');
        const linhaPilar = (p) => {
            const x = pil(p);
            const esc = T.CRITERIOS_PILAR[p];
            return `<tr data-pilar="${p}"><td><strong>${e(T.PILARES_ROTULO[p])}</strong>
                <details><summary>Critérios</summary><ul class="doc-lista">${esc.map(c => `<li>${c.nivel} — ${e(c.titulo)}</li>`).join('')}</ul></details></td>
              <td><input type="number" min="1" max="4" name="ni_${p}" value="${x.nota_inicial == null ? '' : x.nota_inicial}" ${edita ? '' : 'disabled'} aria-label="Nota inicial"> / 4</td>
              <td><input type="number" min="1" max="4" name="nc_${p}" value="${x.nota_ciclo == null ? '' : x.nota_ciclo}" ${edita && !x.na ? '' : 'disabled'} aria-label="Nota do ciclo"> / 4
                <label class="chk"><input type="checkbox" name="na_${p}" ${x.na ? 'checked' : ''} ${edita ? '' : 'disabled'}> N/A</label></td>
              <td><textarea name="ev_${p}" rows="2" ${edita ? '' : 'disabled'} aria-label="Evidências">${e(x.evidencias || '')}</textarea>
                <textarea name="ju_${p}" rows="2" placeholder="Justificativa do N/A (obrigatória)" ${edita ? '' : 'disabled'}>${e(x.justificativa_na || '')}</textarea></td></tr>`;
        };
        const papeisCiencia = ctx.pode.admin ? C.PAPEIS_CIENCIA : [
            ...(ctx.pode.colab ? ['colaborador'] : []), ...(ctx.pode.gestor ? ['gestor'] : []), ...(ctx.pode.socio ? ['diretoria'] : []),
        ];
        return `<h2>${e(T.SECOES[6].titulo)}</h2>${sel}
        <p><strong>Ciclo:</strong> ${n} · <strong>Período:</strong> ${fd(ciclo.inicio)} a ${fd(ciclo.fim)} · <strong>Status:</strong> ${U.badge(T.STATUS_FICHA[f.status], f.status)}
           ${f.reabertura_justificativa ? `<br><small>Reaberta: ${e(f.reabertura_justificativa)}</small>` : ''}</p>
        <form id="formFicha" class="ficha">
          <div class="grid2"><label>Data da reunião<input type="date" name="data_reuniao" value="${e(f.data_reuniao || '')}" ${edita ? '' : 'disabled'}></label>
            <label>Gestor<input name="gestor_nome" value="${e(f.gestor_nome || d.pdi.gestor_nome || '')}" ${edita ? '' : 'disabled'}></label></div>
          <div class="tabela-wrap"><table class="doc-tab empilhar"><thead><tr><th>Pilar</th><th>Nota inicial</th><th>Nota do ciclo</th><th>Evidências da avaliação</th></tr></thead>
            <tbody>${C.PILARES.map(p => rotular(linhaPilar(p), ['Pilar', 'Nota inicial', 'Nota do ciclo', 'Evidências da avaliação'])).join('')}</tbody></table></div>
          <p class="doc-nota">${e(T.TEXTOS.fichaNaRegra)}</p>
          <div class="apoio"><strong>Apoio à decisão (não substitui a nota):</strong> média técnica ${mediaTec == null ? '—' : String(mediaTec).replace('.', ',')}
             · média comportamental ${mediaComp == null ? '—' : String(mediaComp).replace('.', ',')} · melhorias validadas no período: ${valid} · ${e(resumoInd)}</div>
          <label>Principais avanços do período<textarea name="avancos" rows="3" ${edita ? '' : 'disabled'}>${e(f.avancos || '')}</textarea></label>
          <label>Pontos que permanecem em desenvolvimento<textarea name="pontos_desenvolvimento" rows="3" ${edita ? '' : 'disabled'}>${e(f.pontos_desenvolvimento || '')}</textarea></label>
          <label>Prioridades para o próximo ciclo<textarea name="prioridades_proximo_ciclo" rows="3" ${edita ? '' : 'disabled'}>${e(f.prioridades_proximo_ciclo || '')}</textarea></label>
          ${ed && n < 4 && f.prioridades_proximo_ciclo ? `<p class="muted">Uma prioridade por linha. ${btn('prioridades-em-acoes', `Criar ações no ciclo ${n + 1}`, null, 'sec')}</p>` : ''}
          <label>Considerações da colaboradora<textarea name="consideracoes_colaborador" rows="3" ${colEdita || edita ? '' : 'disabled'}>${e(f.consideracoes_colaborador || '')}</textarea></label>
          <fieldset><legend>Resultado do ciclo</legend>${Object.entries(T.RESULTADOS).map(([k, v]) =>
              `<label class="chk"><input type="radio" name="resultado" value="${k}" ${f.resultado === k ? 'checked' : ''} ${edita ? '' : 'disabled'}> ${e(v)}</label>`).join('')}</fieldset>
          <fieldset><legend>Direcionamento</legend>${Object.entries(T.DIRECIONAMENTOS).map(([k, v]) =>
              `<label class="chk"><input type="checkbox" name="dir_${k}" ${(f.direcionamentos || []).includes(k) ? 'checked' : ''} ${edita ? '' : 'disabled'}> ${e(v)}</label>`).join('')}</fieldset>
          ${edita || colEdita ? `<div class="barra"><button type="submit" class="btn">Salvar ficha</button>
             ${edita && f.status === 'rascunho' ? btn('ficha-status-em_reuniao', 'Marcar "Em reunião"') : ''}
             ${edita && ['rascunho', 'em_reuniao'].includes(f.status) ? btn('ficha-status-aguardando_ciencia', 'Enviar para ciência', null, 'ok') : ''}
             ${edita && f.status === 'aguardando_ciencia' ? btn('ficha-concluir', 'Concluir ficha', null, 'ok') : ''}</div>` : ''}
        </form>
        <h3>Ciência da ficha</h3>
        <div class="doc-ass">${C.PAPEIS_CIENCIA.map(p => {
            const c = ciencias.find(x => x.papel === p);
            const rot = { colaborador: 'Colaborador(a)', gestor: 'Gestor responsável', diretoria: 'Diretoria' }[p];
            return `<div class="ass ${c ? 'ok' : ''}"><span>${rot}${c ? ` — ${e(c.nome)}, ${fd(c.assinado_em)}` : ' — pendente'}</span>
              ${!c && papeisCiencia.includes(p) && f.status !== 'rascunho' && !bloq ? btn('ciencia-ficha-' + p, 'Dar ciência', null, 'ok') : ''}</div>`;
        }).join('')}</div>
        <p class="muted">A ciência registra o recebimento e a discussão da avaliação.</p>
        ${ctx.pode.admin && bloq ? `<p>${btn('reabrir-ficha', 'Reabrir ficha (justificativa obrigatória)', null, 'danger')}</p>` : ''}`;
    }

    function abaEvolucao() {
        const ed = pode();
        const blocos = Doc.montar(d);
        const i = blocos.findIndex(b => b.t === 'secao' && b.id === 'evolucao');
        const j = blocos.findIndex((b, k) => k > i && b.t === 'secao');
        const parte = blocos.slice(i, j < 0 ? undefined : j);
        const serie = C.PILARES.map(p => ({ p, v: [1, 2, 3, 4].map(k => {
            const f = fichaDe(k); const x = f && f.pilares.find(z => z.pilar === p);
            return x && !x.na && x.nota_ciclo != null ? x.nota_ciclo : null;
        }) }));
        const W = 420, H = 180, pad = 30;
        const cores = ['#8B3A3A', '#2C3E50', '#27AE60', '#C8861E'];
        const x = (k) => pad + k * (W - 2 * pad) / 3;
        const y = (v) => H - pad - ((v - 1) / 3) * (H - 2 * pad);
        const svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolução das notas por ciclo">
            ${[1, 2, 3, 4].map(v => `<line x1="${pad}" y1="${y(v)}" x2="${W - pad}" y2="${y(v)}" stroke="#eee"/><text x="8" y="${y(v) + 4}" font-size="10" fill="currentColor">${v}</text>`).join('')}
            ${[1, 2, 3, 4].map((k, i2) => `<text x="${x(i2)}" y="${H - 8}" font-size="10" text-anchor="middle" fill="currentColor">Ciclo ${k}</text>`).join('')}
            ${serie.map((s, idx) => {
                const pts = s.v.map((v, k) => v == null ? null : [x(k), y(v)]).filter(Boolean);
                return `<polyline fill="none" stroke="${cores[idx]}" stroke-width="2" points="${pts.map(q => q.join(',')).join(' ')}"/>` +
                    pts.map(q => `<circle cx="${q[0]}" cy="${q[1]}" r="3.5" fill="${cores[idx]}"/>`).join('');
            }).join('')}</svg>
            <figcaption>${serie.map((s, idx) => `<span class="leg"><i style="background:${cores[idx]}"></i>${e(T.PILARES_CURTO[s.p])}</span>`).join('')}</figcaption>`;
        return `${window.PdiRender.blocos(parte)}<figure class="grafico">${svg}</figure>
        ${ed ? `<h3>Agendar avaliação e registrar mudanças</h3>${tabela(['Ciclo', 'Avaliação agendada', 'Mudanças de escopo e apoio', ''],
            d.ciclos.map(c => `<tr><td>${c.numero}</td><td>${c.data_avaliacao_agendada ? fd(c.data_avaliacao_agendada) : '—'}</td>
              <td>${U.br(c.mudancas_escopo_apoio || '')}</td><td>${btn('editar-ciclo', 'Editar', c.id)}</td></tr>`))}` : ''}`;
    }

    function abaCiencia() {
        const cs = d.ciencias.filter(c => c.referencia === 'pdi');
        const papeis = ctx.pode.admin ? C.PAPEIS_CIENCIA : [
            ...(ctx.pode.colab ? ['colaborador'] : []), ...(ctx.pode.gestor ? ['gestor'] : []), ...(ctx.pode.socio ? ['diretoria'] : []),
        ];
        const rotulo = { colaborador: `Colaborador(a): ${d.pdi.colaborador_nome}`, gestor: 'Gestor responsável', diretoria: 'Diretoria' };
        return `<h2>${e(T.SECOES[8].titulo)}</h2><p>${e(T.TEXTOS.ciencia)}</p>
        <div class="doc-ass">${C.PAPEIS_CIENCIA.map(p => {
            const c = cs.find(x => x.papel === p);
            return `<div class="ass ${c ? 'ok' : ''}"><span>${e(rotulo[p])}${c ? ` — ${e(c.nome)}, ${new Date(c.assinado_em).toLocaleString('pt-BR')}` : ' — Assinatura / Data'}</span>
              ${!c && papeis.includes(p) ? btn('ciencia-pdi-' + p, 'Dar ciência', null, 'ok') : ''}</div>`;
        }).join('')}</div>
        <p class="muted">A ciência registra o recebimento e a discussão do plano. Fica registrada com o usuário autenticado e a data/hora.</p>`;
    }

    function abaDocumento() {
        return `<div class="barra"><button class="btn" data-a="imprimir">Imprimir / salvar PDF</button>
            <button class="btn sec" data-a="docx">Baixar DOCX</button>
            <button class="btn sec" data-a="xlsx">Indicadores (Excel)</button></div>
            <article class="documento">${window.PdiRender.blocos(Doc.montar(dadosComSemanas()))}</article>`;
    }

    const CONTEUDO = { resumo: abaResumo, cabecalho: abaCabecalho, pilares: abaPilares, plano: abaPlano,
        performance: abaPerformance, acomp: abaAcompanhamento, feedbacks: abaFeedbacks, ficha: abaFicha,
        evolucao: abaEvolucao, ciencia: abaCiencia, documento: abaDocumento };

    function desenhar() {
        const p = d.pdi;
        host.innerHTML = `<header class="pdi-topo">
            <div><button class="btn sec peq" data-a="voltar">← Voltar</button></div>
            <div class="pdi-titulo"><h1>${e(p.colaborador_nome)}</h1>
              <p>${e(p.cargo_setor)} · Gestor: ${e(p.gestor_nome || '—')} · Início: ${fd(p.data_inicio)} · ${U.badge(p.status, p.status)}
              ${p.colaborador_user_id ? '' : ' <span class="aviso">sem usuário vinculado</span>'}
              ${p.pdi_anterior_id ? ` · <button class="btn sec peq" data-a="abrir-anterior">Ver PDI anterior</button>` : ''}</p></div>
            <div><button class="btn" data-a="apresentar">Apresentar</button></div>
          </header>
          <nav class="abas" aria-label="Seções do PDI">${ABAS.map(a => `<button class="aba${a[0] === aba ? ' ativa' : ''}" data-aba="${a[0]}"${a[0] === aba ? ' aria-current="page"' : ''}>${e(a[1])}</button>`).join('')}</nav>
          <section class="aba-corpo" aria-live="polite">${CONTEUDO[aba]()}</section>`;
        document.title = `${p.colaborador_nome} — PDI — SCONT`;
        if (ctx.gravarHash) ctx.gravarHash({ pdi: p.id, aba }, false);
        sujo = false;
        ligar();
        const ativa = host.querySelector('.aba.ativa');
        if (ativa && ativa.scrollIntoView) ativa.scrollIntoView({ block: 'nearest', inline: 'center' });
    }

    function ligar() {
        host.querySelectorAll('[data-aba]').forEach(b => b.onclick = () => trocarAba(b.dataset.aba));
        host.querySelectorAll('button[data-a]').forEach(b => b.onclick = () => executar(b.dataset.a, b.dataset.id));
        host.querySelectorAll('select[data-a]').forEach(s => s.onchange = () => executar(s.dataset.a, s.dataset.id, s.value));
        host.querySelectorAll('input[type=checkbox][data-a]').forEach(c => c.onchange = () => executar(c.dataset.a, c.dataset.id, c.checked));
        const ff = host.querySelector('#formFicha');
        if (ff) {
            ff.onsubmit = (ev) => { ev.preventDefault(); salvarFicha(ff); };
            ff.addEventListener('input', () => { sujo = true; });
            ff.addEventListener('change', () => { sujo = true; });
            ff.querySelectorAll('input[name^="na_"]').forEach(c => c.onchange = () => {
                const p = c.name.slice(3);
                ff.elements['nc_' + p].disabled = c.checked;
            });
        }
    }

    // ---------- ações ----------
    async function salvarFicha(form, novoStatus) {
        const f = fichaDe(ctx.cicloFicha || cicloAtual());
        const g = (n) => form.elements[n];
        const ehAval = pode();
        await salvar(async () => {
            if (!ehAval) {
                await Api.atualizarSemEco('pdi_avaliacoes_trimestrais', f.id, { consideracoes_colaborador: g('consideracoes_colaborador').value || null });
                return;
            }
            const dirs = Object.keys(T.DIRECIONAMENTOS).filter(k => g('dir_' + k).checked);
            await Api.atualizarSemEco('pdi_avaliacoes_trimestrais', f.id, {
                data_reuniao: g('data_reuniao').value || null, gestor_nome: g('gestor_nome').value || null,
                avancos: g('avancos').value || null, pontos_desenvolvimento: g('pontos_desenvolvimento').value || null,
                prioridades_proximo_ciclo: g('prioridades_proximo_ciclo').value || null,
                consideracoes_colaborador: g('consideracoes_colaborador').value || null,
                resultado: (form.querySelector('input[name=resultado]:checked') || {}).value || null,
                direcionamentos: dirs,
            });
            for (const p of C.PILARES) {
                const na = g('na_' + p).checked;
                const nc = g('nc_' + p).value;
                const ni = g('ni_' + p).value;
                await Api.upsertPilar({
                    pdi_id: d.pdi.id, avaliacao_id: f.id, pilar: p,
                    nota_inicial: ni === '' ? null : Number(ni), nota_ciclo: na || nc === '' ? null : Number(nc),
                    na, justificativa_na: na ? (g('ju_' + p).value || null) : null, evidencias: g('ev_' + p).value || null,
                });
            }
            if (novoStatus) await Api.atualizarSemEco('pdi_avaliacoes_trimestrais', f.id, { status: novoStatus });
        }, novoStatus ? 'Status da ficha atualizado.' : 'Ficha salva.');
    }

    const nomeUsuario = () => ctx.user.nome || ctx.user.email;

    const HANDLERS = {
        voltar: async () => {
            if (sujo && !(await U.confirmar('Alterações não salvas', 'Você alterou a ficha e ainda não salvou. Sair descarta essas alterações.', 'Descartar e sair'))) return;
            sujo = false;
            ctx.voltar();
        },
        apresentar: () => window.PdiApresentar.abrir(dadosComSemanas()),
        imprimir: () => window.PdiExportar.imprimir(dadosComSemanas()),
        docx: () => window.PdiExportar.docx(dadosComSemanas()).catch(err => U.toast(err.message, 'erro')),
        xlsx: () => window.PdiExportar.xlsx(dadosComSemanas()).catch(err => U.toast(err.message, 'erro')),

        'editar-cabecalho': async () => {
            const p = d.pdi;
            const r = await U.formulario('Editar cabeçalho', [
                { nome: 'colaborador_nome', rotulo: 'Nome', obrigatorio: true, valor: p.colaborador_nome },
                { nome: 'cargo_setor', rotulo: 'Cargo e setor', obrigatorio: true, valor: p.cargo_setor },
                { nome: 'admissao', rotulo: 'Admissão', tipo: 'date', valor: p.admissao },
                { nome: 'gestor_nome', rotulo: 'Gestor responsável', valor: p.gestor_nome },
                { nome: 'data_inicio', rotulo: 'Início do PDI (D)', tipo: 'date', obrigatorio: true, valor: p.data_inicio,
                    dica: 'Alterar D recalcula prazos e ciclos exibidos; os ciclos gravados são mantidos.' },
                { nome: 'acompanhamento_texto', rotulo: 'Acompanhamento', valor: p.acompanhamento_texto },
                { nome: 'avaliacao_texto', rotulo: 'Avaliação', valor: p.avaliacao_texto },
            ]);
            if (r) salvar(() => Api.atualizarSemEco('pdis', p.id, r), 'Cabeçalho atualizado.');
        },
        'editar-contexto': async () => {
            const p = d.pdi;
            const r = await U.formulario('Objetivo e contexto', [
                { nome: 'objetivo', tipo: 'textarea', linhas: 7, rotulo: 'Objetivo e acompanhamento (um parágrafo por linha em branco)',
                    valor: ((p.conteudo || {}).objetivo || [T.TEXTOS.objetivo1, T.TEXTOS.objetivo2]).join('\n\n') },
                { nome: 'contexto', tipo: 'textarea', linhas: 5, rotulo: 'Contexto de desenvolvimento', valor: p.contexto_desenvolvimento },
                { nome: 'apoio', tipo: 'textarea', linhas: 3, rotulo: 'Apoio da Scont', valor: p.apoio_scont },
            ]);
            if (!r) return;
            const conteudo = { ...(p.conteudo || {}), objetivo: (r.objetivo || '').split(/\n\s*\n/).map(s => s.trim()).filter(Boolean) };
            salvar(() => Api.atualizarSemEco('pdis', p.id, { conteudo, contexto_desenvolvimento: r.contexto, apoio_scont: r.apoio }), 'Salvo.');
        },
        'editar-perfil': async () => {
            const pc = d.pdi.perfil_comportamental || {};
            const r = await U.formulario('Perfil evidenciado', [
                { nome: 'data_relatorio', rotulo: 'Data do relatório comportamental', tipo: 'date', valor: pc.data_relatorio },
                { nome: 'disc', rotulo: 'Predominância DISC', tipo: 'select', valor: pc.disc, opcoes: ['D', 'I', 'S', 'C'].map(x => [x, x]) },
                { nome: 'disc_descritor', rotulo: 'Descritor (ex.: Estabilidade e Suporte)', valor: pc.disc_descritor },
                { nome: 'descricao', rotulo: 'Descrição', tipo: 'textarea', valor: pc.descricao },
                { nome: 'complementares', rotulo: 'Informações complementares (MBTI, estilo…)', tipo: 'textarea', valor: pc.complementares },
                { nome: 'oportunidades', rotulo: 'Oportunidades apontadas', valor: pc.oportunidades },
            ]);
            if (r) salvar(() => Api.atualizarSemEco('pdis', d.pdi.id, { perfil_comportamental: { ...pc, ...r } }), 'Perfil salvo.');
        },
        'enviar-relatorio': () => {
            const inp = document.createElement('input');
            inp.type = 'file'; inp.accept = 'application/pdf';
            inp.onchange = () => {
                const file = inp.files[0];
                if (!file) return;
                salvar(async () => {
                    const path = await Api.enviarRelatorio(d.pdi.id, file);
                    await Api.atualizarSemEco('pdis', d.pdi.id, { perfil_comportamental: { ...(d.pdi.perfil_comportamental || {}), arquivo: path } });
                }, 'Relatório anexado.');
            };
            inp.click();
        },
        'abrir-relatorio': async () => {
            try { window.open(await Api.urlRelatorio(d.pdi.perfil_comportamental.arquivo), '_blank', 'noopener'); }
            catch (err) { U.toast(err.message, 'erro'); }
        },
        'perfil-status': async (id) => {
            const i = Number(id);
            const item = d.pdi.conteudo.perfil_esperado[i];
            const r = await U.formulario(`Status — ${item.competencia}`, [
                { nome: 'status', rotulo: 'Status', tipo: 'select', vazio: false, valor: item.status, opcoes: Object.entries(T.STATUS_PERFIL) },
                { nome: 'direcionamento', rotulo: 'Direcionamento inicial', valor: item.direcionamento },
            ]);
            if (!r) return;
            const lista = d.pdi.conteudo.perfil_esperado.map((x, k) => k === i
                ? { ...x, ...r, validado_por: ctx.user.id, validado_em: new Date().toISOString() } : x);
            salvar(() => Api.atualizarSemEco('pdis', d.pdi.id, { conteudo: { ...d.pdi.conteudo, perfil_esperado: lista } }), 'Status atualizado.');
        },

        priorizar: (id, v) => salvar(() => Api.atualizarSemEco('pdi_competencias_tecnicas', id, { priorizada: v })),
        'registrar-nivel': async (id) => {
            const t = d.tecnicas.find(x => x.id === id);
            const r = await U.formulario(`Registrar nível — ${t.competencia}`, [
                { nome: 'nivel', rotulo: 'Nível', tipo: 'select', vazio: false, obrigatorio: true,
                    opcoes: T.ESCALA_TECNICA.map(x => [x.nivel, `${x.nivel} — ${x.titulo}: ${x.descricao}`]) },
                { nome: 'data', rotulo: 'Data', tipo: 'date', valor: U.hojeISO(), obrigatorio: true },
                { nome: 'evidencia', rotulo: 'Evidência', tipo: 'textarea' },
            ]);
            if (r) salvar(() => Api.ins('pdi_niveis_tecnicos', { pdi_id: d.pdi.id, competencia_tecnica_id: id,
                nivel: Number(r.nivel), data: r.data, evidencia: r.evidencia }), 'Nível registrado.');
        },
        'validar-nivel': (id) => salvar(() => Api.atualizarSemEco('pdi_niveis_tecnicos', id,
            { validado_em: new Date().toISOString(), validado_por: ctx.user.id }), 'Nível validado.'),
        'avaliar-comp': async (id) => {
            const c = d.comportamentais.find(x => x.id === id);
            const r = await U.formulario(`Avaliar — ${c.competencia}`, [
                { nome: 'nota', rotulo: 'Nota', tipo: 'select', vazio: false, obrigatorio: true,
                    opcoes: T.ESCALA_COMPORTAMENTAL.map(x => [x.nivel, `${x.nivel} — ${x.titulo}`]) },
                { nome: 'data', rotulo: 'Data', tipo: 'date', valor: U.hojeISO(), obrigatorio: true },
                { nome: 'evidencia', rotulo: 'Evidência', tipo: 'textarea' },
            ]);
            if (r) salvar(() => Api.ins('pdi_avaliacoes_comportamentais', { pdi_id: d.pdi.id, competencia_id: id,
                nota: Number(r.nota), data: r.data, evidencia: r.evidencia }), 'Avaliação registrada.');
        },

        'status-acao': (id, v) => salvar(() => Api.atualizarSemEco('pdi_acoes', id, { status: v })),
        'evidencia-acao': async (id) => {
            const r = await U.formulario('Evidência da ação', [
                { nome: 'texto', rotulo: 'Descrição', tipo: 'textarea', obrigatorio: true },
                { nome: 'link', rotulo: 'Link (opcional)', tipo: 'url' },
            ]);
            if (r) salvar(() => Api.ins('pdi_evidencias', { pdi_id: d.pdi.id, ref_tipo: 'acao', ref_id: id, texto: r.texto, link: r.link }), 'Evidência registrada.');
        },
        'nova-acao': async () => {
            const r = await U.formulario('Nova ação do plano', [
                { nome: 'foco_acao', rotulo: 'Foco e ação', obrigatorio: true },
                { nome: 'responsaveis', rotulo: 'Responsáveis' },
                { nome: 'prazo_dias', rotulo: 'Prazo: D + n dias', tipo: 'number', min: 1, dica: 'Deixe vazio e marque "Semanal" para ação recorrente.' },
                { nome: 'semanal', rotulo: 'Recorrência semanal', tipo: 'checkbox' },
                { nome: 'evidencia_esperada', rotulo: 'Evidência esperada', obrigatorio: true },
                { nome: 'ciclo', rotulo: 'Ciclo', tipo: 'select', vazio: false, valor: cicloAtual(), opcoes: [1, 2, 3, 4].map(k => [k, `Ciclo ${k}`]) },
            ]);
            if (!r) return;
            if (!r.semanal && !r.prazo_dias) { U.toast('Informe o prazo (D + n) ou marque recorrência semanal.', 'erro'); return; }
            salvar(() => Api.ins('pdi_acoes', {
                pdi_id: d.pdi.id, ordem: d.acoes.length + 1, foco_acao: r.foco_acao, responsaveis: r.responsaveis,
                prazo_dias: r.semanal ? null : r.prazo_dias, recorrencia: r.semanal ? 'semanal' : null,
                evidencia_esperada: r.evidencia_esperada, ciclo: Number(r.ciclo), origem: 'ficha_trimestral',
            }), 'Ação criada.');
        },

        apurar: async (id) => {
            const i = d.indicadores.find(x => x.id === id);
            const hoje = U.hojeISO();
            const r = await U.formulario(`Apurar — ${i.nome}`, [
                { nome: 'mes', rotulo: 'Mês de competência', tipo: 'month', valor: hoje.slice(0, 7), obrigatorio: true },
                { nome: 'numerador', rotulo: 'Numerador', tipo: 'number', min: 0, step: 'any', obrigatorio: true, dica: i.formula },
                { nome: 'denominador', rotulo: 'Denominador', tipo: 'number', min: 0, step: 'any', obrigatorio: true },
                { nome: 'linha_base', rotulo: 'Linha de base (1º mês)', tipo: 'checkbox', valor: !i.apuracoes.length },
                { nome: 'observacao', rotulo: 'Observação', tipo: 'textarea', linhas: 2 },
            ]);
            if (r) salvar(() => Api.upsertApuracao({ pdi_id: d.pdi.id, indicador_id: id, competencia_mes: `${r.mes}-01`,
                numerador: r.numerador, denominador: r.denominador, linha_base: r.linha_base, observacao: r.observacao }), 'Apuração salva.');
        },
        'meta-indicador': async (id) => {
            const i = d.indicadores.find(x => x.id === id);
            const r = await U.formulario(`Meta — ${i.nome}`, [
                { nome: 'operador', rotulo: 'Operador', tipo: 'select', vazio: false, valor: i.operador || '<=', opcoes: [['>=', '≥'], ['<=', '≤'], ['=', '=']] },
                { nome: 'valor_meta', rotulo: 'Meta (%)', tipo: 'number', min: 0, max: 100, step: 'any', valor: i.valor_meta },
                { nome: 'meta_texto', rotulo: 'Texto da meta', valor: i.meta_texto },
            ]);
            if (r) salvar(() => Api.atualizarSemEco('pdi_indicadores', id, r), 'Meta definida.');
        },

        'nova-melhoria': async () => {
            const r = await U.formulario('Registrar melhoria', [
                { nome: 'data', rotulo: 'Data', tipo: 'date', valor: U.hojeISO(), obrigatorio: true },
                { nome: 'rotina', rotulo: 'Rotina', obrigatorio: true },
                { nome: 'situacao_anterior', rotulo: 'Situação anterior', tipo: 'textarea', obrigatorio: true },
                { nome: 'melhoria_evidencia', rotulo: 'Melhoria e evidência', tipo: 'textarea', obrigatorio: true },
            ]);
            if (r) salvar(() => Api.ins('pdi_melhorias', { pdi_id: d.pdi.id, ...r }), 'Melhoria registrada.');
        },
        'validar-melhoria': async (id) => {
            const r = await U.formulario('Validação do gestor', [
                { nome: 'validacao_gestor', rotulo: 'Resultado', tipo: 'select', vazio: false, opcoes: [['validado', 'Validado'], ['nao_validado', 'Não validado'], ['pendente', 'Pendente']] },
                { nome: 'comentario_gestor', rotulo: 'Comentário', tipo: 'textarea' },
            ]);
            if (r) salvar(() => Api.atualizarSemEco('pdi_melhorias', id, r), 'Validação registrada.');
        },

        'novo-alinhamento': () => formAlinhamento(null),
        'editar-alinhamento': (id) => formAlinhamento(d.alinhamentos.find(a => a.id === id)),
        'nova-sinalizacao': async () => {
            const r = await U.formulario('Sinalizar pendência / risco de prazo', [
                { nome: 'descricao', rotulo: 'Descrição', tipo: 'textarea', obrigatorio: true },
                { nome: 'data_sinalizacao', rotulo: 'Data da sinalização', tipo: 'date', valor: U.hojeISO(), obrigatorio: true },
                { nome: 'prazo_entrega', rotulo: 'Prazo da entrega', tipo: 'date', obrigatorio: true },
                { nome: 'resultado', rotulo: 'Resultado', tipo: 'textarea', linhas: 2 },
            ]);
            if (r) salvar(() => Api.ins('pdi_sinalizacoes', { pdi_id: d.pdi.id, ...r }), 'Sinalização registrada.');
        },

        'novo-feedback': async () => {
            const r = await U.formulario('Escrever feedback', [
                { nome: 'ciclo_numero', rotulo: 'Ciclo (opcional)', tipo: 'select', opcoes: [1, 2, 3, 4].map(k => [k, `Ciclo ${k}`]) },
                { nome: 'texto', rotulo: 'Feedback', tipo: 'textarea', linhas: 6, obrigatorio: true },
            ], { texto: 'O feedback fica registrado com seu nome e não pode ser alterado depois.' });
            if (!r) return;
            const papel = ctx.pode.admin ? 'admin' : (ctx.pode.socio ? 'socio' : 'gestor');
            salvar(() => Api.ins('pdi_feedbacks', { pdi_id: d.pdi.id, autor_id: ctx.user.id, autor_nome: nomeUsuario(),
                autor_papel: papel, ciclo_numero: r.ciclo_numero ? Number(r.ciclo_numero) : null, texto: r.texto }), 'Feedback registrado.');
        },

        'ciclo-ficha': (_, v) => { ctx.cicloFicha = Number(v); desenhar(); },
        'abrir-ficha': async () => {
            const n = ctx.cicloFicha || cicloAtual();
            // nota inicial = nota do ciclo anterior (ou, no ciclo 1 de um PDI renovado, a da última ficha do PDI anterior)
            let origem = null;
            if (n > 1) origem = d.avaliacoes.filter(a => a.ciclo_numero < n && a.status === 'concluida').pop() || null;
            else if (d.pdi.pdi_anterior_id) { try { origem = await Api.ultimaFichaConcluida(d.pdi.pdi_anterior_id); } catch (_) { /* sem acesso: ficha abre em branco */ } }
            const notas = C.notasIniciais(origem);
            const copiou = origem && C.PILARES.some(p => notas[p] != null);
            salvar(async () => {
                const av = await Api.upsertAvaliacao({ pdi_id: d.pdi.id, ciclo_numero: n, gestor_nome: d.pdi.gestor_nome });
                if (!copiou) return;
                for (const p of C.PILARES) {
                    if (notas[p] != null) await Api.upsertPilar({ pdi_id: d.pdi.id, avaliacao_id: av.id, pilar: p, nota_inicial: notas[p] });
                }
            }, copiou ? 'Ficha aberta com as notas iniciais copiadas do ciclo anterior.' : 'Ficha aberta.');
        },
        'prioridades-em-acoes': async () => {
            const n = ctx.cicloFicha || cicloAtual();
            const f = fichaDe(n);
            if (sujo) { U.toast('Salve a ficha antes de criar as ações.', 'erro'); return; }
            const alvo = n + 1;
            const norm = (s) => String(s).trim().toLowerCase();
            const jaTem = new Set(d.acoes.filter(a => a.ciclo === alvo && a.origem === 'ficha_trimestral').map(a => norm(a.foco_acao)));
            const linhas = C.prioridadesEmLinhas(f.prioridades_proximo_ciclo);
            const novas = linhas.filter(l => !jaTem.has(norm(l)));
            if (!linhas.length) { U.toast('Escreva as prioridades, uma por linha.', 'erro'); return; }
            if (!novas.length) { U.toast(`Todas as prioridades já viraram ações do ciclo ${alvo}.`, 'erro'); return; }
            const prazo = C.prazoFimDoCiclo(d.pdi.data_inicio, alvo);
            if (!await U.confirmar(`Criar ${novas.length} ação(ões) no ciclo ${alvo}`,
                `${novas.join(' • ')} — prazo: D + ${prazo} dias (fim do ciclo ${alvo}); responsáveis: colaborador(a) e gestor. Você pode ajustar depois no Plano de ação.`, 'Criar ações')) return;
            salvar(async () => {
                let ordem = d.acoes.length;
                for (const l of novas) {
                    await Api.ins('pdi_acoes', { pdi_id: d.pdi.id, ordem: ++ordem, foco_acao: l, responsaveis: 'Colaborador(a) e gestor',
                        prazo_dias: prazo, evidencia_esperada: 'Registro da entrega e validação do gestor', ciclo: alvo, origem: 'ficha_trimestral' });
                }
            }, `${novas.length} ação(ões) criada(s) no ciclo ${alvo}.`);
        },
        'abrir-anterior': () => ctx.abrirPdi(d.pdi.pdi_anterior_id),
        'ficha-status-em_reuniao': () => salvarFicha(host.querySelector('#formFicha'), 'em_reuniao'),
        'ficha-status-aguardando_ciencia': () => salvarFicha(host.querySelector('#formFicha'), 'aguardando_ciencia'),
        'ficha-concluir': async () => {
            const f = fichaDe(ctx.cicloFicha || cicloAtual());
            const ciencias = d.ciencias.filter(c => c.referencia === 'avaliacao' && c.referencia_id === f.id).map(c => c.papel);
            const erros = C.validarFicha({ pilares: f.pilares, resultado: f.resultado, direcionamentos: f.direcionamentos, ciencias });
            if (erros.length) { U.toast(erros.join(' '), 'erro'); return; }
            if (await U.confirmar('Concluir ficha', 'Após concluída, a ficha fica bloqueada para edição. Confirmar?', 'Concluir')) {
                salvar(() => Api.atualizarSemEco('pdi_avaliacoes_trimestrais', f.id, { status: 'concluida' }), 'Ficha concluída.');
            }
        },
        'reabrir-ficha': async () => {
            const f = fichaDe(ctx.cicloFicha || cicloAtual());
            const r = await U.formulario('Reabrir ficha', [{ nome: 'j', rotulo: 'Justificativa', tipo: 'textarea', obrigatorio: true }],
                { texto: 'A reabertura fica registrada na auditoria.', confirmar: 'Reabrir' });
            if (r) salvar(() => Api.atualizarSemEco('pdi_avaliacoes_trimestrais', f.id,
                { status: 'em_reuniao', reabertura_justificativa: r.j }), 'Ficha reaberta.');
        },
        'editar-ciclo': async (id) => {
            const c = d.ciclos.find(x => x.id === id);
            const r = await U.formulario(`Ciclo ${c.numero}`, [
                { nome: 'data_avaliacao_agendada', rotulo: 'Avaliação agendada com a Diretoria', tipo: 'date', valor: c.data_avaliacao_agendada },
                { nome: 'mudancas_escopo_apoio', rotulo: 'Mudanças de escopo e apoio oferecido', tipo: 'textarea', valor: c.mudancas_escopo_apoio },
            ]);
            if (r) salvar(() => Api.atualizarSemEco('pdi_ciclos', id, r), 'Ciclo atualizado.');
        },
    };

    ['colaborador', 'gestor', 'diretoria'].forEach(p => {
        HANDLERS['ciencia-pdi-' + p] = () => darCiencia('pdi', d.pdi.id, p);
        HANDLERS['ciencia-ficha-' + p] = () => darCiencia('avaliacao', fichaDe(ctx.cicloFicha || cicloAtual()).id, p);
    });

    async function darCiencia(ref, refId, papel) {
        if (!await U.confirmar('Dar ciência', 'A ciência registra o recebimento e a discussão. Será gravada com seu usuário, data e hora.', 'Dar ciência')) return;
        salvar(() => Api.ins('pdi_ciencias', { pdi_id: d.pdi.id, referencia: ref, referencia_id: refId, papel, nome: nomeUsuario() }), 'Ciência registrada.');
    }

    async function formAlinhamento(a) {
        const r = await U.formulario(a ? 'Editar resumo semanal' : 'Resumo semanal', [
            { nome: 'semana_ref', rotulo: 'Semana (segunda-feira)', tipo: 'date', valor: a ? a.semana_ref : semanaDe(U.hojeISO()), obrigatorio: true },
            { nome: 'concluidos', rotulo: 'Concluídos', tipo: 'textarea', valor: a && a.concluidos },
            { nome: 'pendencias', rotulo: 'Pendências', tipo: 'textarea', valor: a && a.pendencias },
            { nome: 'apoio_necessario', rotulo: 'Apoio necessário', tipo: 'textarea', valor: a && a.apoio_necessario },
            { nome: 'dificuldades', rotulo: 'Dificuldades', tipo: 'textarea', valor: a && a.dificuldades },
            ...(pode() ? [{ nome: 'feedback_gestor', rotulo: 'Feedback do gestor', tipo: 'textarea', valor: a && a.feedback_gestor },
                { nome: 'realizado', rotulo: 'Alinhamento realizado com o gestor', tipo: 'checkbox', valor: a ? a.realizado : true }] : []),
        ]);
        if (!r) return;
        r.semana_ref = semanaDe(r.semana_ref);
        salvar(() => Api.upsertAlinhamento({ pdi_id: d.pdi.id, ...r }), 'Resumo salvo.');
    }

    async function executar(acao, id, valor) {
        const h = HANDLERS[acao];
        if (h) await h(id, valor);
    }

    return { render };
})();
