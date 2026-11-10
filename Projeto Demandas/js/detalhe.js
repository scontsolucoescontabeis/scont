// Projeto Demandas/js/detalhe.js — Detalhe: dados, linha do tempo, histórico, edição e tratativa manual.
DEM.detalhe = {
    id: null,
    voltarPara: 'lista',

    async render(id) {
        const D = DEM.detalhe;
        if (id) D.id = id;
        const d = DEM.demandas.find(x => x.id === D.id);
        const raiz = DEM.$('tela-detalhe');
        if (!d) { raiz.innerHTML = '<div class="vazio">Demanda não encontrada.</div>'; return; }
        const esc = DEM.esc, hoje = DEM.hojeISO();
        const venc = DEM.vencida(d, hoje);
        const dias = DEM.ehAberta(d) ? DEM.diasParaPrazo(d, hoje) : null;
        const manuais = d.campos_manuais || [];
        const marca = (c) => manuais.includes(c) ? ' <span title="Editado manualmente no Portal: a planilha não sobrescreve sem confirmação" aria-label="editado manualmente">✏️</span>' : '';
        const P = DEM.parser;
        const opt = (lista, sel, vazio) => (vazio ? '<option value="">—</option>' : '') + lista.map(v => `<option ${v === sel ? 'selected' : ''}>${esc(v)}</option>`).join('');
        const responsaveis = [...new Set(DEM.demandas.map(x => x.responsavel).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
        const empresa = d.cliente_id ? DEM.empresas.find(e => e.codigo_empresa === d.cliente_id) : null;

        raiz.innerHTML = `
            <button class="link-voltar" id="dtVoltar">← Voltar</button>
            <div class="cabecalho"><div><h2>${esc(d.cliente)}</h2>
                <p class="sub">${esc(d.demanda_inicial || 'Sem descrição da demanda inicial')}</p></div>
                <div class="acoes">${DEM.badgePrio(d.prioridade)} ${DEM.badgeStatus(d.status)}
                    ${/^https?:\/\//i.test(d.link_email || '') ? `<a class="btn sec" href="${esc(d.link_email)}" target="_blank" rel="noopener noreferrer">✉️ Abrir no Gmail</a>` : ''}</div></div>
            <div class="detalhe-grid">
              <div>
                <div class="painel"><h3>Dados</h3><dl class="campos">
                    <dt>Solicitante</dt><dd>${esc(d.solicitante || '—')}</dd>
                    <dt>Área / Tipo</dt><dd>${esc(d.area || '—')} · ${esc(d.tipo || '—')}</dd>
                    <dt>Aberta em</dt><dd>${DEM.fDataHora(d.aberta_em)}</dd>
                    <dt>Prazo${marca('prazo')}</dt><dd class="${venc ? 'venc' : ''}">${DEM.fData(d.prazo)}${venc ? ` — vencida há ${Math.abs(dias)} dia(s)` : (dias != null && dias >= 0 && dias <= 7 ? ` — vence em ${dias} dia(s)` : '')}</dd>
                    <dt>Obs. do prazo</dt><dd>${esc(d.prazo_obs || '—')}</dd>
                    <dt>Responsável${marca('responsavel')}</dt><dd>${esc(d.responsavel || '—')}</dd>
                    <dt>Próxima ação${marca('proxima_acao')}</dt><dd>${esc(d.proxima_acao || '—')}</dd>
                    <dt>Último movimento</dt><dd>${DEM.fDataHora(d.ultimo_movimento)}</dd>
                    <dt>Concluída em</dt><dd>${d.concluida_em ? DEM.fDataHora(d.concluida_em) : '—'}</dd>
                    <dt>Leituras</dt><dd>1ª em ${DEM.fData(d.primeira_leitura)} · última em ${DEM.fData(d.ultima_leitura)}</dd>
                    <dt>Empresa (Portal)</dt><dd>${empresa ? `${esc(empresa.codigo_empresa)} — ${esc(empresa.nome_empresa)}` : `<span class="sub">Não vinculada.</span>
                        <select id="dtEmpresa"><option value="">Vincular a uma empresa…</option>${DEM.empresas.map(e => `<option value="${esc(e.codigo_empresa)}">${esc(e.codigo_empresa)} — ${esc(e.nome_empresa)}</option>`).join('')}</select>`}</dd>
                </dl></div>

                <div class="painel"><h3>Editar</h3>
                  <form id="dtForm" class="form-grid">
                    <label>Status<select name="status">${opt(P.STATUS, d.status)}</select></label>
                    <label>Prioridade<select name="prioridade">${opt(P.PRIORIDADES, d.prioridade, true)}</select></label>
                    <label>Responsável<input type="text" name="responsavel" list="dtResps" value="${esc(d.responsavel || '')}" maxlength="120"></label>
                    <label>Prazo<input type="date" name="prazo" value="${esc(d.prazo || '')}"></label>
                    <label class="larga">Próxima ação<textarea name="proxima_acao" maxlength="1000">${esc(d.proxima_acao || '')}</textarea></label>
                    <div class="larga acoes"><button class="btn" type="submit">Salvar alterações</button>
                        <span class="sub" id="dtMsg"></span></div>
                  </form>
                  <datalist id="dtResps">${responsaveis.map(r => `<option value="${esc(r)}">`).join('')}</datalist>
                </div>

                <div class="painel"><h3>Histórico de alterações</h3><div id="dtHistorico"><div class="vazio">Carregando…</div></div></div>
              </div>

              <div>
                <div class="painel"><h3>Tratativas</h3>
                  <div id="dtTratativas"><div class="vazio">Carregando…</div></div>
                  <hr style="border:none;border-top:1px solid var(--border);margin:14px 0">
                  <form id="dtTrForm" class="form-grid">
                    <label class="larga">Nova tratativa (manual)<textarea name="descricao" required maxlength="2000" placeholder="O que foi feito / combinado…"></textarea></label>
                    <label>Data/hora<input type="datetime-local" name="quando" required></label>
                    <label>Autor<select name="autor_tipo">${opt(P.AUTORES, 'SCONT')}</select></label>
                    <div class="larga"><button class="btn sec" type="submit">Adicionar tratativa</button></div>
                  </form>
                </div>
              </div>
            </div>`;

        // data/hora padrão = agora em Brasília
        DEM.detalhe.definirAgora(raiz.querySelector('[name=quando]'));
        DEM.$('dtVoltar').addEventListener('click', () => DEM.ir(D.voltarPara));
        DEM.$('dtForm').addEventListener('submit', (e) => { e.preventDefault(); D.salvar(d); });
        DEM.$('dtTrForm').addEventListener('submit', (e) => { e.preventDefault(); D.adicionarTratativa(d, e.target); });
        DEM.$('dtEmpresa')?.addEventListener('change', (e) => e.target.value && D.vincular(d, e.target.value));
        D.carregarRelacionados(d);
    },

    definirAgora(input) {
        const p = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
        input.value = p.replace(' ', 'T');
    },

    async carregarRelacionados(d) {
        const esc = DEM.esc;
        const [tr, hi] = await Promise.all([
            DEM.sb.from('tratativas').select('ocorrida_em, autor_tipo, autor, descricao, origem').eq('demanda_id', d.id).order('ocorrida_em', { ascending: true }),
            DEM.sb.from('demanda_historico').select('campo, valor_ant, valor_novo, origem, alterado_em').eq('demanda_id', d.id).order('alterado_em', { ascending: false }),
        ]);
        if (DEM.detalhe.id !== d.id) return;       // usuário já saiu desta demanda
        const elT = DEM.$('dtTratativas'), elH = DEM.$('dtHistorico');
        if (!elT || !elH) return;
        elT.innerHTML = tr.error ? `<div class="aviso aviso-erro">Erro ao carregar tratativas: ${esc(tr.error.message)}</div>`
            : tr.data.length ? `<ul class="linha-tempo">${tr.data.map(t => `
                <li class="${t.autor_tipo === 'SCONT' ? 'scont' : t.autor_tipo === 'Cliente' ? 'cliente' : ''}">
                    <div class="quando">${DEM.fDataHora(t.ocorrida_em)} · <strong>${esc(t.autor_tipo || '—')}</strong>${t.autor ? ' (' + esc(t.autor) + ')' : ''}${t.origem === 'manual' ? ' · manual' : ''}</div>
                    <div>${esc(t.descricao)}</div></li>`).join('')}</ul>`
            : '<div class="vazio">Nenhuma tratativa registrada.</div>';
        const NOMES = { status: 'Status', prioridade: 'Prioridade', prazo: 'Prazo', responsavel: 'Responsável', proxima_acao: 'Próxima ação' };
        const fmt = (campo, v) => v == null || v === '' ? '—' : campo === 'prazo' ? DEM.fData(v) : v;
        elH.innerHTML = hi.error ? `<div class="aviso aviso-erro">Erro ao carregar histórico: ${esc(hi.error.message)}</div>`
            : hi.data.length ? `<div class="tabela-wrap"><table><thead><tr><th>Quando</th><th>Campo</th><th>De</th><th>Para</th><th>Origem</th></tr></thead><tbody>${hi.data.map(h => `
                <tr><td class="num">${DEM.fDataHora(h.alterado_em)}</td><td>${esc(NOMES[h.campo] || h.campo)}</td>
                <td class="corta">${esc(fmt(h.campo, h.valor_ant))}</td><td class="corta">${esc(fmt(h.campo, h.valor_novo))}</td>
                <td>${h.origem === 'importacao' ? 'Importação' : 'Manual'}</td></tr>`).join('')}</tbody></table></div>`
            : '<div class="vazio">Nenhuma alteração registrada.</div>';
    },

    async salvar(d) {
        const f = DEM.$('dtForm'), msg = DEM.$('dtMsg');
        const v = (n) => f.elements[n].value.trim();
        const novo = { status: v('status'), prioridade: v('prioridade') || null, responsavel: v('responsavel') || null, prazo: v('prazo') || null, proxima_acao: v('proxima_acao') || null };
        const patch = {};
        for (const k of Object.keys(novo)) if ((novo[k] ?? null) !== (d[k] ?? null)) patch[k] = novo[k];
        if (!Object.keys(patch).length) { msg.textContent = 'Nada foi alterado.'; return; }
        const btn = f.querySelector('button[type=submit]'); btn.disabled = true; msg.textContent = 'Salvando…';
        const { data, error } = await DEM.sb.from('demandas').update(patch).eq('id', d.id).select().single();
        btn.disabled = false;
        if (error) { msg.textContent = ''; DEM.toast('Erro ao salvar: ' + error.message, 'erro'); return; }
        Object.assign(d, data);
        DEM.toast('Alterações salvas.', 'ok');
        DEM.detalhe.render();
    },

    async adicionarTratativa(d, form) {
        const descricao = form.elements.descricao.value.trim();
        const quando = form.elements.quando.value;
        if (!descricao || !quando) return;
        const btn = form.querySelector('button'); btn.disabled = true;
        const { error } = await DEM.sb.from('tratativas').insert({
            demanda_id: d.id, ocorrida_em: quando + ':00-03:00', autor_tipo: form.elements.autor_tipo.value,
            autor: DEM.userNome || null, descricao, origem: 'manual', criado_por: DEM.userId,
        });
        btn.disabled = false;
        if (error) {
            DEM.toast(/duplicate|unique/i.test(error.message) ? 'Essa tratativa já existe (mesma data/hora e texto).' : 'Erro ao adicionar: ' + error.message, 'erro');
            return;
        }
        DEM.toast('Tratativa adicionada.', 'ok');
        form.elements.descricao.value = '';
        DEM.detalhe.carregarRelacionados(d);
    },

    async vincular(d, codigo) {
        const { error } = await DEM.sb.from('demandas').update({ cliente_id: codigo }).eq('id', d.id);
        if (error) { DEM.toast('Erro ao vincular: ' + error.message, 'erro'); return; }
        d.cliente_id = codigo;
        DEM.toast('Cliente vinculado à empresa.', 'ok');
        DEM.detalhe.render();
    },
};
